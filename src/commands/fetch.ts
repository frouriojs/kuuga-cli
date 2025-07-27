import { unixfs } from '@helia/unixfs';
import { bootstrap } from '@libp2p/bootstrap';
import fs from 'fs-extra';
import { createHelia } from 'helia';
import { CID } from 'multiformats/cid';
import path from 'path';
import { z } from 'zod';
import { ORIGIN_PAPER } from './buildUtils.js';
import { MetaSchema } from './validate.js';

export async function fetchCommand(cid: string, directoryName: string): Promise<void> {
  const papersDir = path.resolve('papers');
  await fs.ensureDir(papersDir);

  const targetDir = path.join(papersDir, directoryName);

  await fs.ensureDir(targetDir);

  const draftsDir = path.resolve('drafts');
  await fs.ensureDir(draftsDir);

  console.log('🚀 IPFSノードを起動中...');

  // kuuga.ioから追加のマルチアドレスを取得
  let multiaddrs: string[] = [];
  try {
    multiaddrs = await fetch('https://kuuga.io/api/multiaddrs')
      .then((res) => res.json())
      .then((json) => z.array(z.string()).parse(json));
    console.log(`✅ ${multiaddrs.length}個の追加ピアアドレスを取得しました`);
  } catch {
    console.log('⚠️  追加ピアアドレスの取得に失敗しました（続行します）');
  }

  const helia = await createHelia({
    libp2p: {
      peerDiscovery: [
        bootstrap({
          list: [
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
            '/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8',
            '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
            ...multiaddrs,
          ],
        }),
      ],
    },
  });
  const heliaFs = unixfs(helia);

  // ピアに接続されるまで少し待つ
  console.log('🔗 IPFSネットワークに接続中...');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    let currentCid = cid.replace('ipfs://', '');
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

      // 再帰的にディレクトリを探索する関数（タイムアウト付き）
      async function fetchDirectory(cid: CID, basePath = ''): Promise<void> {
        const timeout = 30000; // 30秒のタイムアウト
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Fetch timeout')), timeout);
        });

        try {
          await Promise.race([
            (async (): Promise<void> => {
              for await (const entry of heliaFs.ls(cid)) {
                const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

                if (entry.type === 'file') {
                  const chunks: Uint8Array[] = [];
                  for await (const chunk of heliaFs.cat(entry.cid)) {
                    chunks.push(chunk);
                  }
                  const content = new Uint8Array(
                    chunks.reduce((acc, chunk) => acc + chunk.length, 0),
                  );
                  let offset = 0;
                  for (const chunk of chunks) {
                    content.set(chunk, offset);
                    offset += chunk.length;
                  }
                  entries.push({ path: entryPath, content });
                } else if (entry.type === 'directory') {
                  // ディレクトリの場合は再帰的に探索
                  await fetchDirectory(entry.cid, entryPath);
                }
              }
            })(),
            timeoutPromise,
          ]);
        } catch (error) {
          if (error instanceof Error && error.message === 'Fetch timeout') {
            throw new Error(`タイムアウト: CID ${cid.toString()} の取得に時間がかかりすぎています`);
          }
          throw error;
        }
      }

      await fetchDirectory(cidObj);

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
    if (error instanceof Error && error.message.includes('タイムアウト')) {
      console.log('💡 ヒント: IPFSネットワークへの接続に問題がある可能性があります。');
      console.log('   - インターネット接続を確認してください');
      console.log('   - ファイアウォールがIPFS通信をブロックしていないか確認してください');
      console.log('   - しばらく待ってから再度お試しください');
    }
    process.exit(1);
  } finally {
    await helia.stop();
  }
}
