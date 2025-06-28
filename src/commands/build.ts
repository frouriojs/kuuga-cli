import fs from 'fs-extra';
import path from 'path';
import { calculateDirectoryCID, checkVersionConflicts, getPreviousPaper } from './buildUtils.js';
import { validate } from './validate.js';

export async function build(): Promise<void> {
  console.log('🔍 論文の検証を開始...');
  try {
    validate();
  } catch {
    console.error('❌ 検証に失敗しました');
    process.exit(1);
  }
  console.log('✅ 検証完了、ビルドを開始します\n');

  const draftsDir = path.resolve('drafts');

  if (!fs.existsSync(draftsDir)) {
    throw new Error('drafts ディレクトリが見つかりません');
  }

  const draftDirs = fs
    .readdirSync(draftsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  if (draftDirs.length === 0) {
    console.log('📝 drafts ディレクトリに原稿がありません');
    return;
  }

  const papersDir = path.resolve('papers');
  await fs.ensureDir(papersDir);

  for (const draftDir of draftDirs) {
    console.log(`🔨 ビルド中: ${draftDir}`);
    const sourcePath = path.join(draftsDir, draftDir);

    const metaPath = path.join(sourcePath, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      console.error(`❌ ${draftDir}/meta.json が見つかりません`);
      continue;
    }

    const metaContent = fs.readFileSync(metaPath, 'utf-8');
    const meta = JSON.parse(metaContent) as Record<string, string | number>;
    const version = meta.version as number;
    const paperPath = path.join(papersDir, draftDir);
    const versionFormatted = version.toString().padStart(3, '0');

    if (fs.existsSync(paperPath)) {
      try {
        await checkVersionConflicts(
          draftDir,
          version,
          versionFormatted,
          paperPath,
          sourcePath,
          papersDir,
        );
      } catch (error) {
        if (error instanceof Error) {
          console.error(error.message);
          continue;
        }
        throw error;
      }
    }

    let previousPaper: string | undefined;
    try {
      previousPaper = getPreviousPaper(version, draftDir, papersDir);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
        continue;
      }
      throw error;
    }

    const tempOutputPath = path.join(papersDir, draftDir, 'temp');

    if (fs.existsSync(tempOutputPath)) {
      console.log(`🧹 既存のtempディレクトリを削除: ${tempOutputPath}`);
      await fs.remove(tempOutputPath);
    }

    await fs.ensureDir(tempOutputPath);
    await fs.copy(sourcePath, tempOutputPath);

    const tempMetaPath = path.join(tempOutputPath, 'meta.json');
    const tempMetaContent = fs.readFileSync(tempMetaPath, 'utf-8');
    const tempMeta = JSON.parse(tempMetaContent) as Record<string, string>;
    if (previousPaper !== undefined) {
      tempMeta.previousPaper = previousPaper;
    }
    fs.writeFileSync(tempMetaPath, JSON.stringify(tempMeta, null, 2));

    const cid = await calculateDirectoryCID(tempOutputPath);
    const cidString = cid.toString();
    const finalOutputPath = path.join(papersDir, draftDir, `${versionFormatted}_${cidString}`);

    if (fs.existsSync(finalOutputPath)) {
      console.log(`⏭️  既存のディレクトリをスキップ: ${finalOutputPath}`);

      await fs.remove(tempOutputPath);
    } else {
      await fs.move(tempOutputPath, finalOutputPath);
      console.log(`✅ ディレクトリを作成: ${finalOutputPath}`);
    }
  }

  console.log('✅ すべての論文のビルドが完了しました');
}
