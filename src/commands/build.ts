import { Command } from "commander";
import fs from "fs";
import path from "path";
import archiver from "archiver";

export const buildCommand = new Command("build")
  .argument("dir", "論文ディレクトリ名")
  .description("論文をZIPにまとめる")
  .action(async (dir) => {
    const fullPath = path.resolve(process.cwd(), dir);
    const outputPath = path.resolve(process.cwd(), `${path.basename(dir)}.kuuga.zip`);

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
  });
