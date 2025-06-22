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
    const draftsDir = path.resolve('drafts');
    
    if (!fs.existsSync(draftsDir)) {
        console.error("❌ drafts ディレクトリが見つかりません");
        process.exit(1);
    }

    const draftDirs = fs.readdirSync(draftsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    if (draftDirs.length === 0) {
        console.log("📝 drafts ディレクトリに論文がありません");
        return;
    }

    let hasError = false;
    const requiredFiles = ["main.md", "meta.json"];

    for (const draftDir of draftDirs) {
        console.log(`🔍 検証中: ${draftDir}`);
        const fullPath = path.join(draftsDir, draftDir);

        for (const file of requiredFiles) {
            const filePath = path.join(fullPath, file);
            if (!fs.existsSync(filePath)) {
                console.error(`❌ ${draftDir}/${file} が見つかりません`);
                hasError = true;
            }
        }

        const metaPath = path.join(fullPath, "meta.json");
        if (fs.existsSync(metaPath)) {
            let meta: any;
            try {
                meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
            } catch (err) {
                console.error(`❌ ${draftDir}/meta.json のパースに失敗:`, err);
                hasError = true;
                continue;
            }
            
            // MetaSchemaで検証
            const validationResult = MetaSchema.safeParse(meta);
            if (!validationResult.success) {
                console.error(`❌ ${draftDir}/meta.json のスキーマ検証に失敗:`);
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
        console.log("✅ すべての原稿の検証が完了しました");
    }
}
