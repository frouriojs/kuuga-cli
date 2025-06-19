import { Command } from "commander";
import fs from "fs";
import path from "path";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as raw from "multiformats/codecs/raw";

export const publishCommand = new Command("publish")
  .argument("zipFile", "ビルド済みZIPファイル名")
  .description("ZIPファイルのIPFS CID（v1）を計算する")
  .action(async (zipFile) => {
    const zipPath = path.resolve(process.cwd(), zipFile);

    if (!fs.existsSync(zipPath)) {
      console.error(`❌ ZIPファイルが見つかりません: ${zipPath}`);
      process.exit(1);
    }

    const fileBuffer = fs.readFileSync(zipPath);
    const hash = await sha256.digest(fileBuffer);
    const cid = CID.create(1, raw.code, hash);

    console.log(`✅ IPFS CID (v1): ${cid.toString()}`);
  });
