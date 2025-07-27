/* eslint-disable max-lines */
import { unixfs } from '@helia/unixfs';
import fs from 'fs-extra';
import { createHelia } from 'helia';
import { CID } from 'multiformats/cid';
import path from 'path';
import { z } from 'zod';
import { ORIGIN_PAPER } from './buildUtils.js';
import { MetaSchema } from './validate.js';

export async function fetchCommand(uriOrCid: string, directoryName: string): Promise<void> {
  const papersDir = path.resolve('papers');
  await fs.ensureDir(papersDir);

  const targetDir = path.join(papersDir, directoryName);

  await fs.ensureDir(targetDir);

  const draftsDir = path.resolve('drafts');
  await fs.ensureDir(draftsDir);

  console.log('🚀 IPFSノードを起動中...');

  const helia = await createHelia();
  const heliaFs = unixfs(helia);

  // ピアに接続されるまで待つ（より長く待機）
  console.log('🔗 IPFSネットワークに接続中...');
  let peersConnected = false;
  for (let i = 0; i < 10; i++) {
    const peers = helia.libp2p.getPeers();
    if (peers.length > 0) {
      console.log(`✅ ${peers.length}個のピアに接続しました`);
      peersConnected = true;
      break;
    }
    console.log(`⏳ ピアへの接続を待機中... (${i + 1}/10)`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (!peersConnected) {
    console.log('⚠️  ピアへの接続に失敗しました。直接ゲートウェイからのダウンロードを試みます。');
  }

  try {
    let currentCid = uriOrCid.replace('ipfs://', '');
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

      // 再帰的にディレクトリを探索する関数
      async function fetchDirectory(cid: CID, basePath = ''): Promise<void> {
        // ピアが接続されていない場合は直接ゲートウェイを使用
        if (!peersConnected) {
          await fetchFromGatewayWithRetry(cid, basePath);
          return;
        }

        // Heliaでの取得を試みる（短いタイムアウト）
        const heliaTimeout = 30000; // 30秒のタイムアウト
        const heliaTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Helia timeout')), heliaTimeout);
        });

        try {
          await Promise.race([
            (async (): Promise<void> => {
              // まずstatでCIDのタイプを確認
              try {
                const stat = await heliaFs.stat(cid);

                if (stat.type === 'file') {
                  // 単一ファイルの場合
                  const chunks: Uint8Array[] = [];
                  for await (const chunk of heliaFs.cat(cid)) {
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
                  // ファイル名は不明なので、適切なデフォルト名を使用
                  entries.push({ path: basePath || 'file', content });
                } else if (stat.type === 'directory') {
                  // ディレクトリの場合はlsで中身を探索
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
                }
              } catch {
                // statが失敗した場合は、ディレクトリとして試してみる
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
              }
            })(),
            heliaTimeoutPromise,
          ]);
        } catch (error) {
          if (error instanceof Error && error.message === 'Helia timeout') {
            console.log(
              '⚠️  Heliaでの取得がタイムアウトしました。ゲートウェイから取得を試みます...',
            );

            await fetchFromGatewayWithRetry(cid, basePath);
          } else {
            throw error;
          }
        }
      }

      // ゲートウェイからの取得をリトライ付きで実行
      async function fetchFromGatewayWithRetry(cid: CID, basePath: string): Promise<void> {
        const gateways = [
          'https://ipfs.io',
          'https://dweb.link',
          'https://gateway.ipfs.io',
          'https://cloudflare-ipfs.com',
        ];

        let lastError: Error | null = null;

        for (const gateway of gateways) {
          for (let retry = 0; retry < 3; retry++) {
            try {
              console.log(`🌐 ${gateway} から取得中... (試行 ${retry + 1}/3)`);
              await fetchFromGateway(cid, basePath, gateway);
              return; // 成功したら終了
            } catch (error) {
              lastError = error as Error;
              console.log(`❌ ${gateway} からの取得に失敗しました: ${lastError.message}`);
              if (retry < 2) {
                await new Promise((resolve) => setTimeout(resolve, 2000 * (retry + 1))); // リトライ前に待機
              }
            }
          }
        }

        throw new Error(`すべてのゲートウェイからの取得に失敗しました: CID ${cid.toString()}`);
      }

      // IPFSゲートウェイからディレクトリ構造を取得する関数
      async function fetchFromGateway(cid: CID, basePath: string, gateway: string): Promise<void> {
        // ゲートウェイ経由でディレクトリを取得する場合、直接アクセスを試みる
        const dirUrl = `${gateway}/ipfs/${cid.toString()}/`;
        const dirResponse = await fetch(dirUrl, { method: 'HEAD' });

        if (dirResponse.ok && dirResponse.headers.get('x-ipfs-roots')) {
          // ディレクトリの場合、HTMLディレクトリリストを取得
          const listResponse = await fetch(dirUrl);
          if (listResponse.ok) {
            const html = await listResponse.text();
            // 簡易的なHTMLパース（リンクを抽出）
            const linkRegex = /<a href="([^"]+)">([^<]+)<\/a>/g;
            const links: Array<{ name: string; isDirectory: boolean }> = [];
            let match;
            while ((match = linkRegex.exec(html)) !== null) {
              const name = match[2];
              if (name !== '../' && name !== './') {
                links.push({
                  name: name.endsWith('/') ? name.slice(0, -1) : name,
                  isDirectory: name.endsWith('/'),
                });
              }
            }

            if (links.length === 0) {
              // 空のディレクトリの場合は何もしない
              return;
            }

            // ディレクトリの中身を処理
            for (const link of links) {
              const entryPath = basePath ? `${basePath}/${link.name}` : link.name;

              if (!link.isDirectory) {
                // ファイル
                const fileUrl = `${gateway}/ipfs/${cid.toString()}/${encodeURIComponent(link.name)}`;
                const fileResponse = await fetch(fileUrl);

                if (!fileResponse.ok) {
                  throw new Error(`Failed to fetch file: ${link.name}`);
                }

                const content = new Uint8Array(await fileResponse.arrayBuffer());
                entries.push({ path: entryPath, content });
              } else {
                // ディレクトリ - 再帰的に取得
                const subDirUrl = `${gateway}/ipfs/${cid.toString()}/${encodeURIComponent(link.name)}/`;
                // サブディレクトリのCIDを取得するため、HEADリクエストを送信
                const subDirResponse = await fetch(subDirUrl, { method: 'HEAD' });
                const ipfsHash = subDirResponse.headers.get('x-ipfs-path');
                if (ipfsHash) {
                  // x-ipfs-pathから CIDを抽出
                  const cidMatch = ipfsHash.match(/\/ipfs\/([^/]+)/);
                  if (cidMatch) {
                    const subCid = CID.parse(cidMatch[1]);
                    await fetchFromGateway(subCid, entryPath, gateway);
                  }
                }
              }
            }
          } else {
            // ディレクトリリストが取得できない場合は単一ファイルとして扱う
            throw new Error('Not a directory');
          }
        } else {
          // lsが失敗した場合、単一ファイルとして試す
          const fileUrl = `${gateway}/ipfs/${cid.toString()}`;
          const fileResponse = await fetch(fileUrl);

          if (fileResponse.ok) {
            const content = new Uint8Array(await fileResponse.arrayBuffer());
            entries.push({ path: basePath || 'file', content });
          } else {
            throw new Error(`Gateway fetch failed: Cannot access CID ${cid.toString()}`);
          }
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
