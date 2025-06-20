import fs from "fs-extra";
import path from "path";

export async function build() {
    const papersDir = path.resolve('papers');
    
    if (!fs.existsSync(papersDir)) {
        throw new Error("papers ディレクトリが見つかりません");
    }

    const paperDirs = fs.readdirSync(papersDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    if (paperDirs.length === 0) {
        console.log("📝 papers ディレクトリに論文がありません");
        return;
    }

    const outDir = path.resolve('out');
    await fs.ensureDir(outDir);

    for (const paperDir of paperDirs) {
        console.log(`🔨 ビルド中: ${paperDir}`);
        const sourcePath = path.join(papersDir, paperDir);
        
        const metaPath = path.join(sourcePath, "meta.json");
        if (!fs.existsSync(metaPath)) {
            console.error(`❌ ${paperDir}/meta.json が見つかりません`);
            continue;
        }
        
        const metaContent = fs.readFileSync(metaPath, "utf-8");
        const meta = JSON.parse(metaContent);
        const version: number | undefined = meta.version;
        
        if (version === undefined) {
            console.error(`❌ ${paperDir}/meta.json に version がありません`);
            continue;
        }
        
        // out/<name>/<version>/ 構造でディレクトリを作成
        const outputPath = path.join(outDir, paperDir, version.toString());
        await fs.ensureDir(outputPath);
        
        // 論文ディレクトリの内容をコピー
        await fs.copy(sourcePath, outputPath);
        
        console.log(`✅ ディレクトリを作成: ${outputPath}`);
    }
    
    console.log("✅ すべての論文のビルドが完了しました");
}
