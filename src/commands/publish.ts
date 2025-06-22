import fs from "fs";
import path from "path";

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
        const cidDirs = fs.readdirSync(paperPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .filter(dirent => /^\d{3}_/.test(dirent.name))
            .map(dirent => dirent.name);

        for (const cidDir of cidDirs) {
            const cidDirPath = path.join(paperPath, cidDir);
            console.log(`📋 論文情報: ${paperDir}/${cidDir}`);
            
            // CIDディレクトリ名からversionとCIDを抽出
            const [versionStr, ...cidParts] = cidDir.split('_');
            const version = parseInt(versionStr, 10);
            const cid = cidParts.join('_');
            
            // メタファイルの存在確認
            const metaPath = path.join(cidDirPath, "meta.json");
            if (fs.existsSync(metaPath)) {
                const metaContent = fs.readFileSync(metaPath, "utf-8");
                const meta = JSON.parse(metaContent);
                
                console.log(`✅ ${paperDir} - CID: ${cid}`);
                console.log(`   Version: ${version}`);
                console.log(`   Title: ${meta.title || 'Unknown'}`);
            } else {
                console.log(`⚠️  ${paperDir}/${cidDir} - meta.json が見つかりません`);
            }
        }
    }

    console.log("✅ すべてのCID計算が完了しました");
}
