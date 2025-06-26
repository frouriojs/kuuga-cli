import { unixfs } from '@helia/unixfs';
import { bootstrap } from '@libp2p/bootstrap';
import { keys } from '@libp2p/crypto';
import { peerIdFromPrivateKey } from '@libp2p/peer-id';
import fs from 'fs';
import { createHelia } from 'helia';
import { bootstrapConfig } from 'helia/src/utils/bootstrappers.js';
import { CID } from 'multiformats/cid';
import path from 'path';
import { z } from 'zod';
import { addDirectory } from '../utils/helia-helpers.js';
import { notifyRegistry } from '../utils/registry-notify.js';

interface PaperCid {
  paperdir: string;
  cid: string;
}

export async function pin(): Promise<void> {
  console.log('🚀 IPFSノード準備中...');

  const papersDir = path.resolve('papers');

  if (!fs.existsSync(papersDir)) {
    console.error('❌ papers ディレクトリが見つかりません。先に build コマンドを実行してください');
    process.exit(1);
  }

  let peerId;
  if (process.env.KUUGA_KEY) {
    const keyData = z
      .object({ id: z.string(), privKey: z.string(), pubKey: z.string() })
      .parse(JSON.parse(process.env.KUUGA_KEY));
    const privateKeyBytes = Buffer.from(keyData.privKey, 'base64');
    const privateKey = keys.privateKeyFromProtobuf(privateKeyBytes);
    peerId = peerIdFromPrivateKey(privateKey);
  } else {
    const privateKey = await keys.generateKeyPair('Ed25519');
    peerId = peerIdFromPrivateKey(privateKey);
  }

  console.log(`✅ PeerID: ${peerId.toString()}`);
  const helia = await createHelia({
    libp2p: { peerId, peerDiscovery: [bootstrap(bootstrapConfig)] },
  });
  const heliaFs = unixfs(helia);
  const paperCids: PaperCid[] = [];

  try {
    // papersディレクトリ内の論文ディレクトリを再帰的に公開
    const paperDirs = fs
      .readdirSync(papersDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const paperDir of paperDirs) {
      const paperPath = path.join(papersDir, paperDir);
      const versions = fs
        .readdirSync(paperPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const version of versions) {
        const versionPath = path.join(paperPath, version);
        console.log(`📦 公開: ${paperDir}/${version}`);

        try {
          const cid = await addDirectory(heliaFs, versionPath);
          const cidString = cid.toString();
          console.log(`✅ CID: ${cidString}`);
          paperCids.push({ paperdir: `${paperDir}/${version}`, cid: cidString });
        } catch (err) {
          console.error(`❌ CID取得失敗: ${paperDir}/${version}`, err);
        }
      }
    }

    // 各論文のmeta.jsonから引用先とpreviousPaperをピン留め
    for (const paperDir of paperDirs) {
      const metaPath = path.join(papersDir, paperDir, 'meta.json');
      if (fs.existsSync(metaPath)) {
        console.log(`📋 メタファイル処理: ${paperDir}/meta.json`);

        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as {
            references?: string[];
            previousPaper?: string;
          };

          // 引用先をピン留め
          if (meta.references && Array.isArray(meta.references)) {
            for (const ref of meta.references) {
              if (ref && ref !== 'null') {
                // ipfs://プレフィックスを削除
                const cleanRef = ref.replace(/^ipfs:\/\//, '');
                console.log(`📌 引用先をピン留め: ${cleanRef}`);
                try {
                  // CIDをパースしてピン留め
                  const cid = CID.parse(cleanRef);
                  helia.pins.add(cid);
                } catch {
                  console.log(`⚠️  ピン留め失敗: ${cleanRef}`);
                }
              }
            }
          }

          // previousPaperをピン留め
          if (meta.previousPaper && meta.previousPaper !== 'null') {
            // ipfs://プレフィックスを削除
            const cleanPrev = meta.previousPaper.replace(/^ipfs:\/\//, '');
            console.log(`📌 過去論文をピン留め: ${cleanPrev}`);
            try {
              // CIDをパースしてピン留め
              const cid = CID.parse(cleanPrev);
              helia.pins.add(cid);
            } catch {
              console.log(`⚠️  ピン留め失敗: ${cleanPrev}`);
            }
          }
        } catch (err) {
          console.error(`❌ メタファイル処理失敗: ${metaPath}`, err);
        }
      }
    }

    console.log('✅ すべての論文と引用先をピン留めしました');

    // KUUGAレジストリに公開通知を送信
    await notifyRegistry(paperCids, helia, heliaFs, papersDir);

    console.log('🎉 すべての処理が完了しました');
  } finally {
    // Heliaインスタンスを停止
    await helia.stop();
  }
}
