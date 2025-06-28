import { unixfs } from '@helia/unixfs';
import fs from 'fs-extra';
import { createHelia } from 'helia';
import type { CID } from 'multiformats/cid';
import path from 'path';

export const ORIGIN_PAPER = 'ipfs://bafybeie37nnusfxejtmkfi2l2xb6c7qqn74ihgcbqxzvvbytnjstgnznkq';

export async function calculateDirectoryCID(dirPath: string): Promise<CID> {
  const helia = await createHelia();
  const heliaFs = unixfs(helia);

  try {
    async function* addDirectoryEntries(): AsyncGenerator<{
      path: string;
      content: AsyncIterable<Uint8Array> | Uint8Array;
    }> {
      async function* walkDirectory(
        currentPath: string,
        basePath: string = '',
      ): AsyncGenerator<{ path: string; content: AsyncIterable<Uint8Array> | Uint8Array }> {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });

        // ファイル名でソート（IPFSの順序と一致させるため）
        entries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;

          if (entry.isDirectory()) {
            yield* walkDirectory(fullPath, relativePath);
          } else {
            const content = fs.readFileSync(fullPath);
            yield { path: relativePath, content };
          }
        }
      }

      yield* walkDirectory(dirPath);
    }

    const entries = addDirectoryEntries();
    const addResults = heliaFs.addAll(entries, { wrapWithDirectory: true });
    const allEntries: Array<{ path: string; cid: CID }> = [];
    let directoryCid: CID | undefined;

    for await (const result of addResults) {
      allEntries.push({ path: result.path || '', cid: result.cid });

      if (!result.path || result.path === '') {
        directoryCid = result.cid;
      }
    }

    if (!directoryCid) {
      throw new Error('Failed to get directory CID');
    }

    return directoryCid;
  } finally {
    await helia.stop();
  }
}

export async function checkVersionConflicts(
  draftDir: string,
  version: number,
  versionFormatted: string,
  paperPath: string,
  sourcePath: string,
  papersDir: string,
): Promise<void> {
  const existingDirs = fs
    .readdirSync(paperPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .filter((dirent) => dirent.name.startsWith(`${versionFormatted}_`))
    .map((dirent) => dirent.name);

  if (existingDirs.length > 0) {
    const tempOutputPath = path.join(papersDir, draftDir, 'temp_check');

    await fs.ensureDir(tempOutputPath);
    await fs.copy(sourcePath, tempOutputPath);

    let previousPaper: string | undefined;
    if (version === 0) {
      previousPaper = undefined;
    } else if (version === 1) {
      previousPaper = ORIGIN_PAPER;
    } else {
      const prevVersion = version - 1;
      const prevVersionFormatted = prevVersion.toString().padStart(3, '0');
      const prevVersionDirs = fs
        .readdirSync(paperPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .filter((dirent) => dirent.name.startsWith(`${prevVersionFormatted}_`))
        .map((dirent) => dirent.name);

      if (prevVersionDirs.length > 0) {
        const prevCidDir = prevVersionDirs[0];
        const [, ...cidParts] = prevCidDir.split('_');
        const prevCid = cidParts.join('_');
        previousPaper = `ipfs://${prevCid}`;
      }
    }

    const tempMetaPath = path.join(tempOutputPath, 'meta.json');
    const tempMetaContent = fs.readFileSync(tempMetaPath, 'utf-8');
    const tempMeta = JSON.parse(tempMetaContent) as Record<string, string>;
    if (previousPaper !== undefined) {
      tempMeta.previousPaper = previousPaper;
    }
    fs.writeFileSync(tempMetaPath, JSON.stringify(tempMeta, null, 2));

    const newCid = await calculateDirectoryCID(tempOutputPath);
    const newCidString = newCid.toString();
    await fs.remove(tempOutputPath);

    const existingCidString = existingDirs[0].split('_').slice(1).join('_');
    if (existingCidString !== newCidString) {
      throw new Error(
        `❌ ${draftDir}: バージョン ${version} で異なるCIDが検出されました。\n` +
          `   既存: ${existingCidString}\n` +
          `   新規: ${newCidString}\n` +
          `   バージョンをインクリメントしてください。`,
      );
    }
  }

  if (version > 0) {
    const allVersionDirs = fs
      .readdirSync(paperPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => {
        const match = dirent.name.match(/^(\d{3})_/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((v): v is number => v !== null)
      .sort((a, b) => b - a);

    if (allVersionDirs.length > 0) {
      const latestVersion = allVersionDirs[0];

      if (version !== latestVersion + 1 && !existingDirs.length) {
        throw new Error(
          `❌ ${draftDir}: バージョンが正しくインクリメントされていません。\n` +
            `   現在の最新バージョン: ${latestVersion}\n` +
            `   指定されたバージョン: ${version}\n` +
            `   次のバージョンは ${latestVersion + 1} である必要があります。`,
        );
      }
    }
  }
}

export function getPreviousPaper(
  version: number,
  draftDir: string,
  papersDir: string,
): string | undefined {
  if (version === 0) {
    return undefined;
  } else if (version === 1) {
    return ORIGIN_PAPER;
  } else {
    const prevVersion = version - 1;
    const prevVersionFormatted = prevVersion.toString().padStart(3, '0');
    const paperPath = path.join(papersDir, draftDir);

    if (fs.existsSync(paperPath)) {
      const existingDirs = fs
        .readdirSync(paperPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .filter((dirent) => dirent.name.startsWith(`${prevVersionFormatted}_`))
        .map((dirent) => dirent.name);

      if (existingDirs.length > 0) {
        const prevCidDir = existingDirs[0];
        const [, ...cidParts] = prevCidDir.split('_');
        const prevCid = cidParts.join('_');
        return `ipfs://${prevCid}`;
      } else {
        throw new Error(`❌ ${draftDir} の前のバージョン ${prevVersion} が見つかりません`);
      }
    } else {
      return ORIGIN_PAPER;
    }
  }
}
