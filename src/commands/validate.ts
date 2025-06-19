import fs from "fs";
import path from "path";

export function validate() {
    const papersDir = path.resolve('papers');
    
    if (!fs.existsSync(papersDir)) {
        console.error("❌ papers ディレクトリが見つかりません");
        process.exit(1);
    }

    const paperDirs = fs.readdirSync(papersDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    if (paperDirs.length === 0) {
        console.log("📝 papers ディレクトリに論文がありません");
        return;
    }

    let hasError = false;
    const requiredFiles = ["main.md", "meta.json"];

    for (const paperDir of paperDirs) {
        console.log(`🔍 検証中: ${paperDir}`);
        const fullPath = path.join(papersDir, paperDir);

        for (const file of requiredFiles) {
            const filePath = path.join(fullPath, file);
            if (!fs.existsSync(filePath)) {
                console.error(`❌ ${paperDir}/${file} が見つかりません`);
                hasError = true;
            }
        }

        const metaPath = path.join(fullPath, "meta.json");
        if (fs.existsSync(metaPath)) {
            let meta: any;
            try {
                meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
            } catch (err) {
                console.error(`❌ ${paperDir}/meta.json のパースに失敗:`, err);
                hasError = true;
                continue;
            }
            
            if (meta.version === undefined) {
                console.error(`❌ ${paperDir}/meta.json に version がありません`);
                hasError = true;
            }

            if (!meta.title || typeof meta.title !== "string") {
                console.error(`❌ ${paperDir}/meta.json に有効な title がありません`);
                hasError = true;
            }

            if (!Array.isArray(meta.authors) || meta.authors.length === 0) {
                console.error(`❌ ${paperDir}/meta.json に authors が定義されていません`);
                hasError = true;
            }
        }
    }

    if (hasError) {
        process.exit(1);
    } else {
        console.log("✅ すべての論文の検証が完了しました");
    }
}
