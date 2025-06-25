import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

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

  const paperCids: PaperCid[] = [];

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
        const output = execSync(
          `ipfs add --cid-version=1 --pin=true --recursive --quiet "${versionPath}"`,
          {
            encoding: 'utf-8',
          },
        );
        const cid = output.trim().split('\n').pop();
        if (cid) {
          console.log(`✅ CID: ${cid}`);
          paperCids.push({ paperdir: `${paperDir}/${version}`, cid });
        } else {
          console.error(`❌ CID取得失敗: ${paperDir}/${version}`);
        }
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
                execSync(`ipfs pin add "${cleanRef}"`, { stdio: 'pipe' });
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
            execSync(`ipfs pin add "${cleanPrev}"`, { stdio: 'pipe' });
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
        execSync(`ipfs cat "${cid}" > /dev/null 2>&1 || ipfs ls "${cid}" > /dev/null 2>&1`, {
          stdio: 'pipe',
        });
        ipfsAccessible = true;
        console.log(`✓ IPFS内でCIDアクセス確認: ${cid}`);
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
          const output = execSync(
            `ipfs add --cid-version=1 --pin=true --recursive --quiet "${path.join(papersDir, paperdir)}"`,
            {
              encoding: 'utf-8',
            },
          );
          const newCid = output.trim().split('\n').pop();
          if (newCid && newCid !== cid) {
            console.log(`📡 新CIDで公開通知: ${newCid}`);
            try {
              const response = await fetch(`https://kuuga.io/ipfs/${newCid}`, { method: 'HEAD' });
              console.log(`📊 レスポンス: ${response.status} for ${newCid}`);
            } catch {
              console.log(`❌ 新CID通信エラー: ${newCid}`);
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

  console.log('🎉 すべての処理が完了しました');
}
