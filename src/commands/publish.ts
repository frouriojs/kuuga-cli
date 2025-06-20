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

    const paperDirs = fs.readdirSync(outDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    if (paperDirs.length === 0) {
        console.log("📝 out ディレクトリに論文がありません");
        return;
    }

    for (const paperDir of paperDirs) {
        const paperPath = path.join(outDir, paperDir);
        const versions = fs.readdirSync(paperPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const version of versions) {
            const versionPath = path.join(paperPath, version);
            console.log(`🔍 CID計算中: ${paperDir}/${version}`);
            
            // ディレクトリ全体のCIDを計算するため、メタファイルを作成
            const metaPath = path.join(versionPath, "meta.json");
            if (fs.existsSync(metaPath)) {
                const metaContent = fs.readFileSync(metaPath, "utf-8");
                const metaBuffer = Buffer.from(metaContent, 'utf-8');
                const hash = await sha256.digest(metaBuffer);
                const cid = CID.create(1, raw.code, hash);
                
                console.log(`✅ ${paperDir}/${version} - Meta CID (v1): ${cid.toString()}`);
            }
        }
    }

    console.log("✅ すべてのCID計算が完了しました");
}
