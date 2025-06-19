import { Command } from "commander";
import fs from "fs";
import path from "path";

export const validateCommand = new Command("validate")
  .argument("dir", "論文ディレクトリ名")
  .description("論文の構造とメタデータの整合性を検証する")
  .action((dir) => {
    const fullPath = path.resolve(process.cwd(), dir);
    const requiredFiles = ["main.md", "meta.json", "manifest.json"];
    let hasError = false;

    for (const file of requiredFiles) {
      const filePath = path.join(fullPath, file);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ ファイルが見つかりません: ${file}`);
        hasError = true;
      }
    }

    if (hasError) process.exit(1);

    const metaPath = path.join(fullPath, "meta.json");
    const manifestPath = path.join(fullPath, "manifest.json");

    let meta, manifest;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch (err) {
      console.error("❌ JSONファイルのパースに失敗しました:", err);
      process.exit(1);
    }

    if (meta.version !== manifest.version) {
      console.error(
        `❌ バージョン不一致: meta.json(${meta.version}) ≠ manifest.json(${manifest.version})`
      );
      hasError = true;
    }

    if (!meta.title || typeof meta.title !== "string") {
      console.error("❌ meta.json に有効な title がありません");
      hasError = true;
    }

    if (!Array.isArray(meta.authors) || meta.authors.length === 0) {
      console.error("❌ meta.json に authors が定義されていません");
      hasError = true;
    }

    if (hasError) process.exit(1);
    console.log("✅ 検証成功: meta.json と manifest.json は整合しています");
  });
