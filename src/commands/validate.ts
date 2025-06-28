import fs from 'fs';
import fs_extra from 'fs-extra';
import path from 'path';
import { z } from 'zod';
import { calculateDirectoryCID, ORIGIN_PAPER } from './buildUtils.js';

const OriginMetaSchema = z.object({
  title: z.string(),
  language: z.string(),
  version: z.literal(0),
  authors: z.array(z.never()),
  license: z.string(),
});

const StandardMetaSchema = z.object({
  title: z.string(),
  language: z.string(),
  version: z.number().int().positive(),
  description: z.string().optional(),
  authors: z.tuple([z.string()]).rest(z.string()),
  references: z.array(z.string().startsWith('ipfs://').or(z.string().url())).optional(),
  license: z.string(),
});

const MetaSchema = OriginMetaSchema.or(StandardMetaSchema);

export async function validate(): Promise<void> {
  const draftsDir = path.resolve('drafts');

  if (!fs.existsSync(draftsDir)) {
    console.error('❌ drafts ディレクトリが見つかりません');
    process.exit(1);
  }

  const draftDirs = fs
    .readdirSync(draftsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  if (draftDirs.length === 0) {
    console.log('📝 drafts ディレクトリに原稿がありません');
    process.exit(1);
  }

  let hasError = false;
  const requiredFiles = ['main.md', 'meta.json'];
  const papersDir = path.resolve('papers');

  for (const draftDir of draftDirs) {
    console.log(`🔍 検証中: ${draftDir}`);
    const fullPath = path.join(draftsDir, draftDir);

    for (const file of requiredFiles) {
      const filePath = path.join(fullPath, file);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ ${draftDir}/${file} が見つかりません`);
        hasError = true;
      }
    }

    const metaPath = path.join(fullPath, 'meta.json');
    if (fs.existsSync(metaPath)) {
      try {
        const metaContent = fs.readFileSync(metaPath, 'utf-8');
        const meta = MetaSchema.safeParse(JSON.parse(metaContent));

        if (!meta.success) {
          console.error(`❌ ${draftDir}/meta.json のスキーマ検証に失敗:`);
          for (const issue of meta.error.issues) {
            console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
          }
          hasError = true;
        } else {
          const version = meta.data.version;
          const paperPath = path.join(papersDir, draftDir);
          const versionFormatted = version.toString().padStart(3, '0');

          if (fs.existsSync(paperPath)) {
            try {
              await checkVersionConflicts(
                draftDir,
                version,
                versionFormatted,
                paperPath,
                fullPath,
                papersDir,
              );
            } catch (error) {
              if (error instanceof Error) {
                console.error(error.message);
                hasError = true;
              } else {
                throw error;
              }
            }
          }
        }
      } catch (err) {
        console.error(`❌ ${draftDir}/meta.json のパースに失敗:`, err);
        hasError = true;
        continue;
      }
    }
  }

  if (hasError) {
    process.exit(1);
  } else {
    console.log('✅ すべての原稿の検証が完了しました');
  }
}

async function checkVersionConflicts(
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

    await fs_extra.ensureDir(tempOutputPath);
    await fs_extra.copy(sourcePath, tempOutputPath);

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
    if (previousPaper !== undefined) tempMeta.previousPaper = previousPaper;
    fs.writeFileSync(tempMetaPath, JSON.stringify(tempMeta, null, 2));

    const newCid = await calculateDirectoryCID(tempOutputPath);
    const newCidString = newCid.toString();
    await fs_extra.remove(tempOutputPath);

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
