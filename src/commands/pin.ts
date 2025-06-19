import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export function pin(zipFile: string, options?: { recursive?: boolean }) {
    const zipPath = path.resolve(process.cwd(), zipFile);
    if (!fs.existsSync(zipPath)) {
      console.error("❌ ZIPファイルが見つかりません");
      process.exit(1);
    }

    // add and pin the current ZIP
    try {
      const output = execSync(`ipfs add --cid-version=1 --pin=true --raw-leaves=true "${zipPath}"`, {
        encoding: "utf-8"
      });
      console.log(`📦 ピン留め成功: ${output.trim()}`);
    } catch (err) {
      console.error("❌ ipfs add に失敗:", err);
      process.exit(1);
    }

    if (options?.recursive) {
      const metaPath = path.join(path.dirname(zipPath), "meta.json");
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        for (const ref of meta.references || []) {
          try {
            execSync(`ipfs pin add ${ref}`, { stdio: "inherit" });
          } catch (err) {
            console.warn(`⚠️ 引用先 ${ref} のピン留めに失敗:`, err);
          }
        }
      }
    }
}
