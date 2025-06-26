import type { UnixFS } from '@helia/unixfs';
import type { Helia } from 'helia';
import { CID } from 'multiformats/cid';
import path from 'path';
import { addDirectory } from './helia-helpers.js';

interface PaperCid {
  paperdir: string;
  cid: string;
}

export async function notifyRegistry(
  paperCids: PaperCid[],
  helia: Helia,
  heliaFs: UnixFS,
  papersDir: string,
): Promise<void> {
  console.log('🌐 KUUGAレジストリに公開通知中...');

  // IPFSノードが安定するまで少し待機
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // 保存されたCIDを使って公開通知
  if (paperCids.length > 0) {
    for (const { paperdir, cid } of paperCids) {
      console.log(`📡 公開通知送信中: ${cid} (${paperdir})`);

      // まずIPFSでCIDが本当にアクセス可能か確認
      let ipfsAccessible = false;
      try {
        // CIDをパースしてブロックが存在するか確認
        const parsedCid = CID.parse(cid);
        const hasBlock = await helia.blockstore.has(parsedCid);
        if (hasBlock) {
          ipfsAccessible = true;
          console.log(`✓ IPFS内でCIDアクセス確認: ${cid}`);
        }
      } catch {
        console.log(`❌ IPFS内でCIDアクセス不可: ${cid}`);
      }

      if (ipfsAccessible) {
        // 503の場合は30秒ごとにリトライ
        let retryCount = 0;
        const maxRetries = 10;

        while (retryCount < maxRetries) {
          try {
            const response = await fetch(`https://kuuga.io/ipfs/${cid}`, { method: 'HEAD' });
            if (response.status === 200) {
              console.log(`✅ 公開通知成功: ${cid}`);
              break;
            } else if (response.status === 503) {
              console.log(`⏳ サービス一時利用不可、30秒後にリトライ: ${cid}`);
              await new Promise((resolve) => setTimeout(resolve, 30000));
              retryCount++;
            } else {
              console.log(`⚠️ 予期しないレスポンス (${response.status}): ${cid}`);
              break;
            }
          } catch (err) {
            console.log(`❌ 通信エラー: ${cid}`, err);
            break;
          }
        }
      } else {
        // CIDが取得できない場合は再度追加を試行
        console.log(`🔄 再追加試行: ${paperdir}`);
        try {
          const newCid = await addDirectory(heliaFs, path.join(papersDir, paperdir));
          const newCidString = newCid.toString();
          if (newCidString && newCidString !== cid) {
            console.log(`📡 新CIDで公開通知: ${newCidString}`);
            try {
              const response = await fetch(`https://kuuga.io/ipfs/${newCidString}`, {
                method: 'HEAD',
              });
              console.log(`📊 レスポンス: ${response.status} for ${newCidString}`);
            } catch {
              console.log(`❌ 新CID通信エラー: ${newCidString}`);
            }
          }
        } catch {
          console.error(`❌ 再追加失敗: ${paperdir}`);
        }
      }
    }
  } else {
    console.log('⚠️ CID情報が見つかりません');
  }
}
