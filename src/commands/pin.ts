import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export function pin() {
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

    // すべてのZIPファイルをピン留め
    for (const zipPath of zipFiles) {
        console.log(`📦 ピン留め中: ${path.basename(zipPath)}`);
        try {
            const output = execSync(`ipfs add --cid-version=1 --pin=true --raw-leaves=true "${zipPath}"`, {
                encoding: "utf-8"
            });
            console.log(`✅ ピン留め成功: ${output.trim()}`);
        } catch (err) {
            console.error(`❌ ${path.basename(zipPath)} のピン留めに失敗:`, err);
        }
    }

    // papers内のmeta.jsonから引用先をピン留め
    const papersDir = path.resolve('papers');
    if (fs.existsSync(papersDir)) {
        const paperDirs = fs.readdirSync(papersDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const paperDir of paperDirs) {
            const metaPath = path.join(papersDir, paperDir, "meta.json");
            if (fs.existsSync(metaPath)) {
                console.log(`📋 引用先チェック: ${paperDir}`);
                const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
                for (const ref of meta.references || []) {
                    try {
                        console.log(`📌 引用先ピン留め: ${ref}`);
                        execSync(`ipfs pin add ${ref}`, { stdio: "inherit" });
                    } catch (err) {
                        console.warn(`⚠️ 引用先 ${ref} のピン留めに失敗:`, err);
                    }
                }
            }
        }
    }

    console.log("✅ すべてのピン留めが完了しました");
}
