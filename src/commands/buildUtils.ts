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
