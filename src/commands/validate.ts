import fs from "fs";
import path from "path";
import { z } from "zod";

const OriginMetaSchema = z.object({
  "title": z.string(),
  "language": z.string(),
  "version":  z.literal(0),
  "authors": z.array(z.never()),
  "license": z.string()
})

const StandardMetaSchema = z.object({
  "title": z.string(),
  "language": z.string(),
  version: z.number().int().positive(),
  description: z.string().optional(),
  "authors": z.tuple([z.string()]).rest(z.string()),
  "references": z.array(z.string().startsWith('ipfs://').or(z.string().url())).optional(),
  "license": z.string()
})

const MetaSchema = OriginMetaSchema.or(StandardMetaSchema)

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
            
            // MetaSchemaで検証
            const validationResult = MetaSchema.safeParse(meta);
            if (!validationResult.success) {
                console.error(`❌ ${paperDir}/meta.json のスキーマ検証に失敗:`);
                for (const issue of validationResult.error.issues) {
                    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
                }
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
