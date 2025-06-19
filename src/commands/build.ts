import fs from "fs";
import path from "path";
import archiver from "archiver";

export async function build(dir: string) {
    const fullPath = path.resolve(process.cwd(), dir);
    
    const metaPath = path.join(fullPath, "meta.json");
    if (!fs.existsSync(metaPath)) {
        throw new Error(`meta.json not found: ${metaPath}`);
    }
    
    const metaContent = fs.readFileSync(metaPath, "utf-8");
    const meta = JSON.parse(metaContent);
    const version = meta.version;
    
    if (version === undefined) {
        throw new Error("version not found in meta.json");
    }
    
    const outputPath = path.resolve(process.cwd(), `out/${path.basename(dir)}/${path.basename(dir)}.${version}.zip`);

    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: 0 }, // 無圧縮
      store: true
    });

    output.on("close", () => {
      console.log(`✅ ZIPファイルを作成しました: ${outputPath} (${archive.pointer()} bytes)`);
    });

    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(output);
    archive.directory(fullPath + "/", false);
    await archive.finalize();
}
