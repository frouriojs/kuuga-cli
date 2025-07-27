import { unixfs } from '@helia/unixfs';
import fs from 'fs-extra';
import { createHelia } from 'helia';
import { CID } from 'multiformats/cid';
import path from 'path';
import { z } from 'zod';
import { ORIGIN_PAPER } from './buildUtils.js';
import { MetaSchema } from './validate.js';

export async function fetch(cid: string, directoryName: string): Promise<void> {
  const papersDir = path.resolve('papers');
  await fs.ensureDir(papersDir);

  const targetDir = path.join(papersDir, directoryName);

  await fs.ensureDir(targetDir);

  const draftsDir = path.resolve('drafts');
  await fs.ensureDir(draftsDir);

  const helia = await createHelia();
  const heliaFs = unixfs(helia);

  try {
    let currentCid = cid.startsWith('ipfs://') ? cid.slice(7) : cid;
    const downloadedPapers = new Set<string>();
    let isFirstCid = true;

    while (currentCid) {
      if (downloadedPapers.has(currentCid)) {
        console.log('⚠️  循環参照を検出しました。ダウンロードを停止します。');
        break;
      }

      console.log(`📥 ダウンロード中: ipfs://${currentCid}`);

      const cidObj = CID.parse(currentCid);

      // IPFSからディレクトリ全体を取得
      const entries: Array<{ path: string; content: Uint8Array }> = [];

      for await (const entry of heliaFs.ls(cidObj)) {
        if (entry.type === 'file') {
          const chunks: Uint8Array[] = [];
          for await (const chunk of heliaFs.cat(entry.cid)) {
            chunks.push(chunk);
          }
          const content = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
          let offset = 0;
          for (const chunk of chunks) {
            content.set(chunk, offset);
            offset += chunk.length;
          }
          entries.push({ path: entry.name, content });
        }
      }

      // バージョン番号を取得
      const metaEntry = entries.find((e) => e.path === 'meta.json');
      if (!metaEntry) {
        console.error('❌ meta.jsonが見つかりません');
        break;
      }

      const meta = MetaSchema.and(
        z.object({ previousPaper: z.string().startsWith('ipfs://').optional() }),
      ).parse(JSON.parse(new TextDecoder().decode(metaEntry.content)));
      const version = meta.version;
      const versionFormatted = version.toString().padStart(3, '0');
      const paperDir = path.join(targetDir, `${versionFormatted}_${currentCid}`);

      // ファイルを保存
      await fs.ensureDir(paperDir);
      for (const entry of entries) {
        const filePath = path.join(paperDir, entry.path);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, entry.content);
      }

      // 最初のCIDの場合、draftsディレクトリにもコピー（cid.txtとcid.txt.otsを除く）
      if (isFirstCid) {
        for (const entry of entries) {
          if (entry.path !== 'cid.txt' && entry.path !== 'cid.txt.ots') {
            const draftsFilePath = path.join(draftsDir, entry.path);
            await fs.ensureDir(path.dirname(draftsFilePath));
            await fs.writeFile(draftsFilePath, entry.content);
          }
        }
        console.log(`✅ drafts ディレクトリにもコピーしました（cid.txt, cid.txt.otsを除く）`);
        isFirstCid = false;
      }

      console.log(`✅ ${paperDir} にダウンロードしました`);
      downloadedPapers.add(currentCid);

      // 次の論文のCIDを取得
      if (meta.previousPaper) {
        const previousPaper = meta.previousPaper;
        if (previousPaper === ORIGIN_PAPER) {
          currentCid = ORIGIN_PAPER.slice(7);
        } else {
          currentCid = previousPaper.startsWith('ipfs://') ? previousPaper.slice(7) : previousPaper;
        }
      } else if (version === 0) {
        // バージョン0の場合は終了
        break;
      } else {
        // previousPaperがない場合も終了
        break;
      }

      // ORIGIN_PAPERに到達したら終了
      if (`ipfs://${currentCid}` === ORIGIN_PAPER) {
        console.log(`🎯 ORIGIN_PAPERに到達しました`);
        break;
      }
    }

    console.log('✅ すべての論文のダウンロードが完了しました');
  } catch (error) {
    console.error('❌ ダウンロード中にエラーが発生しました:', error);
    process.exit(1);
  } finally {
    await helia.stop();
  }
}
