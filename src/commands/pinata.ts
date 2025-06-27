import * as fs from 'fs';
import * as path from 'path';
import { PinataSDK } from 'pinata';

interface UploadedPaper {
  paperdir: string;
  cid: string;
}

async function notifyRegistryForPinata(uploadedPapers: UploadedPaper[]): Promise<void> {
  console.log('🌐 KUUGAレジストリに公開通知中...');

  // IPFSゲートウェイが反映されるまで少し待機
  await new Promise((resolve) => setTimeout(resolve, 5000));

  for (const { paperdir, cid } of uploadedPapers) {
    console.log(`📡 公開通知送信中: ${cid} (${paperdir})`);

    // 503の場合は60秒ごとにリトライ
    let retryCount = 0;
    let isSuccess = false;
    const maxRetries = 10;

    while (retryCount < maxRetries) {
      try {
        const response = await fetch(`https://kuuga.io/ipfs/${cid}`, { method: 'HEAD' });
        if (response.status === 200) {
          console.log(`✅ 公開通知成功: ${cid}`);
          isSuccess = true;
          break;
        } else if (response.status === 503) {
          console.log(`⏳ サービス一時利用不可、60秒後にリトライ: ${cid}`);
          await new Promise((resolve) => setTimeout(resolve, 60000));
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

    if (!isSuccess) process.exit(1);
  }
}

export async function pinata(): Promise<void> {
  if (!process.env.PINATA_JWT) {
    console.error('Error: PINATA_JWT environment variable is not set');
    process.exit(1);
  }

  const pinataClient = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY,
  });

  const papersDir = './papers';

  if (!fs.existsSync(papersDir)) {
    console.error('Error: papers directory not found');
    process.exit(1);
  }

  // Get all name directories
  const nameDirs = fs.readdirSync(papersDir).filter((file) => {
    const fullPath = path.join(papersDir, file);
    return fs.statSync(fullPath).isDirectory();
  });

  if (nameDirs.length === 0) {
    console.log('No papers found to upload');
    return;
  }

  const uploadedPapers: UploadedPaper[] = [];

  for (const nameDir of nameDirs) {
    const nameDirPath = path.join(papersDir, nameDir);

    // Get all version_CID directories
    const versionDirs = fs.readdirSync(nameDirPath).filter((file) => {
      const fullPath = path.join(nameDirPath, file);
      return fs.statSync(fullPath).isDirectory() && file.match(/^\d{3}_baf/);
    });

    for (const versionDir of versionDirs) {
      const versionDirPath = path.join(nameDirPath, versionDir);

      // Get all files in the version directory recursively
      if (fs.existsSync(versionDirPath)) {
        console.log(`📦 準備中: ${nameDir}/${versionDir}`);

        // Create file array for folder structure upload
        const fileArray: File[] = [];

        // Recursively walk through the version directory
        function walkDir(currentPath: string, relativePath: string = ''): void {
          const entries = fs.readdirSync(currentPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

            if (entry.isDirectory()) {
              walkDir(fullPath, relPath);
            } else if (entry.isFile()) {
              const fileContent = fs.readFileSync(fullPath);
              // Create a File with only the relative path within the version directory
              const blob = new Blob([fileContent], { type: 'application/octet-stream' });
              const file = new File([blob], relPath);
              fileArray.push(file);
            }
          }
        }

        walkDir(versionDirPath);

        if (fileArray.length === 0) {
          continue;
        }

        // Upload all files as a folder structure
        try {
          console.log(`📤 アップロード中: ${nameDir}/${versionDir}`);

          // Extract version number from versionDir (e.g., "001_bafyxxx" -> "001")
          const version = versionDir.split('_')[0];

          const result = await pinataClient.upload.public
            .fileArray(fileArray)
            .name(`${version}_${nameDir}`);

          console.log(`✅ アップロード成功: ${result.cid}`);

          // Store the paper info for registry notification
          uploadedPapers.push({
            paperdir: `${nameDir}/${versionDir}`,
            cid: result.cid,
          });
        } catch (error) {
          console.error(`❌ アップロード失敗: ${nameDir}/${versionDir}`, error);
          process.exit(1);
        }
      }
    }
  }

  console.log('✅ すべての論文をPinataにアップロードしました');

  // KUUGAレジストリに公開通知を送信
  if (uploadedPapers.length > 0) {
    await notifyRegistryForPinata(uploadedPapers);
  }

  console.log('🎉 すべての処理が完了しました');
}
