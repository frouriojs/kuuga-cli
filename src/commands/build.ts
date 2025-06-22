import fs from "fs-extra";
import path from "path";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as raw from "multiformats/codecs/raw";

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
        
        // previousPaperの設定
        let previousPaper: string;
        if (version === 1) {
            // version 1の場合は起源論文のCID
            previousPaper = "ipfs://bafybeie37nnusfxejtmkfi2l2xb6c7qqn74ihgcbqxzvvbytnjstgnznkq";
        } else {
            // version 2以降は前のバージョンのCIDを探す
            const prevVersion = version - 1;
            const prevVersionFormatted = prevVersion.toString().padStart(3, '0');
            
            // 前のバージョンのディレクトリを検索
            const paperOutPath = path.join(outDir, paperDir);
            if (fs.existsSync(paperOutPath)) {
                const existingDirs = fs.readdirSync(paperOutPath, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .filter(dirent => dirent.name.startsWith(`${prevVersionFormatted}_`))
                    .map(dirent => dirent.name);
                
                if (existingDirs.length > 0) {
                    // 前のバージョンのCIDを抽出
                    const prevCidDir = existingDirs[0];
                    const [, ...cidParts] = prevCidDir.split('_');
                    const prevCid = cidParts.join('_');
                    previousPaper = `ipfs://${prevCid}`;
                } else {
                    console.error(`❌ ${paperDir} の前のバージョン ${prevVersion} が見つかりません`);
                    continue;
                }
            } else {
                previousPaper = "ipfs://bafybeie37nnusfxejtmkfi2l2xb6c7qqn74ihgcbqxzvvbytnjstgnznkq";
            }
        }
        
        // ディレクトリ全体のCIDを計算するため、まず一時的にコピー
        const tempOutputPath = path.join(outDir, paperDir, "temp");
        await fs.ensureDir(tempOutputPath);
        await fs.copy(sourcePath, tempOutputPath);
        
        // コピー先のmeta.jsonにpreviousPaperを追加
        const tempMetaPath = path.join(tempOutputPath, "meta.json");
        const tempMetaContent = fs.readFileSync(tempMetaPath, "utf-8");
        const tempMeta = JSON.parse(tempMetaContent);
        tempMeta.previousPaper = previousPaper;
        fs.writeFileSync(tempMetaPath, JSON.stringify(tempMeta, null, 2));
        
        // メタファイルの内容からCIDを計算
        const metaBuffer = fs.readFileSync(tempMetaPath);
        const hash = await sha256.digest(metaBuffer);
        const cid = CID.create(1, raw.code, hash);
        
        // versionを3桁でフォーマットしてディレクトリ名を作成
        const versionFormatted = version.toString().padStart(3, '0');
        const cidString = cid.toString();
        const finalOutputPath = path.join(outDir, paperDir, `${versionFormatted}_${cidString}`);
        
        // 一時ディレクトリを最終的な名前にリネーム
        await fs.move(tempOutputPath, finalOutputPath);
        
        console.log(`✅ ディレクトリを作成: ${finalOutputPath}`);
    }
    
    console.log("✅ すべての論文のビルドが完了しました");
}
