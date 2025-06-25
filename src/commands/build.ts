import { unixfs } from '@helia/unixfs';
import fs from 'fs-extra';
import { createHelia } from 'helia';
import type { CID } from 'multiformats/cid';
import path from 'path';
import { validate } from './validate.js';

// HeliaとUnixFSを使ってディレクトリのCIDを計算
async function calculateDirectoryCID(dirPath: string): Promise<CID> {
  const helia = await createHelia();
  const heliaFs = unixfs(helia);

  try {
    // ディレクトリ全体を追加してCIDを取得（wrapWithDirectoryを使用）
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
            // サブディレクトリを再帰的に処理
            yield* walkDirectory(fullPath, relativePath);
          } else {
            // ファイルを追加
            const content = fs.readFileSync(fullPath);
            yield { path: relativePath, content };
          }
        }
      }

      yield* walkDirectory(dirPath);
    }

    // addAllでディレクトリ全体を追加（wrapWithDirectoryオプション使用）
    const entries = addDirectoryEntries();
    const addResults = heliaFs.addAll(entries, { wrapWithDirectory: true });

    // 結果を収集
    const allEntries: Array<{ path: string; cid: CID }> = [];
    let directoryCid: CID | undefined;

    for await (const result of addResults) {
      allEntries.push({ path: result.path || '', cid: result.cid });

      // 空のパスがディレクトリのCID
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

const ORIGIN_PAPER = 'ipfs://bafybeie37nnusfxejtmkfi2l2xb6c7qqn74ihgcbqxzvvbytnjstgnznkq';

export async function build(): Promise<void> {
  // まず検証を実行
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

    // previousPaperの設定
    let previousPaper: string | undefined;
    if (version === 0) {
      // version 0の場合はpreviousPaperを設定しない
      previousPaper = undefined;
    } else if (version === 1) {
      // version 1の場合は起源論文のCID
      previousPaper = ORIGIN_PAPER;
    } else {
      // version 2以降は前のバージョンのCIDを探す
      const prevVersion = version - 1;
      const prevVersionFormatted = prevVersion.toString().padStart(3, '0');

      // 前のバージョンのディレクトリを検索
      const paperPath = path.join(papersDir, draftDir);
      if (fs.existsSync(paperPath)) {
        const existingDirs = fs
          .readdirSync(paperPath, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .filter((dirent) => dirent.name.startsWith(`${prevVersionFormatted}_`))
          .map((dirent) => dirent.name);

        if (existingDirs.length > 0) {
          // 前のバージョンのCIDを抽出
          const prevCidDir = existingDirs[0];
          const [, ...cidParts] = prevCidDir.split('_');
          const prevCid = cidParts.join('_');
          previousPaper = `ipfs://${prevCid}`;
        } else {
          console.error(`❌ ${draftDir} の前のバージョン ${prevVersion} が見つかりません`);
          continue;
        }
      } else {
        previousPaper = ORIGIN_PAPER;
      }
    }

    // ディレクトリ全体のCIDを計算するため、まず一時的にコピー
    const tempOutputPath = path.join(papersDir, draftDir, 'temp');

    // 既存のtempディレクトリがあれば削除
    if (fs.existsSync(tempOutputPath)) {
      console.log(`🧹 既存のtempディレクトリを削除: ${tempOutputPath}`);
      await fs.remove(tempOutputPath);
    }

    await fs.ensureDir(tempOutputPath);
    await fs.copy(sourcePath, tempOutputPath);

    // コピー先のmeta.jsonにpreviousPaperを追加（version 0以外の場合）
    const tempMetaPath = path.join(tempOutputPath, 'meta.json');
    const tempMetaContent = fs.readFileSync(tempMetaPath, 'utf-8');
    const tempMeta = JSON.parse(tempMetaContent) as Record<string, string>;
    if (previousPaper !== undefined) {
      tempMeta.previousPaper = previousPaper;
    }
    fs.writeFileSync(tempMetaPath, JSON.stringify(tempMeta, null, 2));

    // ディレクトリ全体のCIDを計算
    const cid = await calculateDirectoryCID(tempOutputPath);

    // versionを3桁でフォーマットしてディレクトリ名を作成
    const versionFormatted = version.toString().padStart(3, '0');
    const cidString = cid.toString();
    const finalOutputPath = path.join(papersDir, draftDir, `${versionFormatted}_${cidString}`);

    // 既存ディレクトリがある場合はスキップ、ない場合のみ作成
    if (fs.existsSync(finalOutputPath)) {
      console.log(`⏭️  既存のディレクトリをスキップ: ${finalOutputPath}`);
      // 一時ディレクトリを削除
      await fs.remove(tempOutputPath);
    } else {
      // 一時ディレクトリを最終的な名前にリネーム
      await fs.move(tempOutputPath, finalOutputPath);
      console.log(`✅ ディレクトリを作成: ${finalOutputPath}`);
    }
  }

  console.log('✅ すべての論文のビルドが完了しました');
}
