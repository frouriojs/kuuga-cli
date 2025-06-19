import fs from "fs";
import path from "path";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as raw from "multiformats/codecs/raw";

export async function publish() {
    const outDir = path.resolve('out');
    
    if (!fs.existsSync(outDir)) {
        console.error("❌ out ディレクトリが見つかりません。先に build コマンドを実行してください");
        process.exit(1);
    }

    const zipFiles = fs.readdirSync(outDir)
        .filter(file => file.endsWith('.zip'))
        .map(file => path.join(outDir, file));

    if (zipFiles.length === 0) {
        console.log("📝 out ディレクトリにZIPファイルがありません");
        return;
    }

    for (const zipPath of zipFiles) {
        console.log(`🔍 CID計算中: ${path.basename(zipPath)}`);
        
        const fileBuffer = fs.readFileSync(zipPath);
        const hash = await sha256.digest(fileBuffer);
        const cid = CID.create(1, raw.code, hash);

        console.log(`✅ ${path.basename(zipPath)} - IPFS CID (v1): ${cid.toString()}`);
    }

    console.log("✅ すべてのCID計算が完了しました");
}
