#!/usr/bin/env node

import { Command } from "commander";
import { init } from "./commands/init";
import { validate } from "./commands/validate";
import { build } from "./commands/build";
import { pin } from "./commands/pin";
import { publish } from "./commands/publish";

const program = new Command();

program
  .name("kuuga")
  .description("KUUGA: 宇宙スケールの知の保存プロトコル CLI")
  .version("0.1.0");

program
  .command("init")
  .argument("<dir>", "論文ディレクトリを指定")
  .description("新しい論文ディレクトリを初期化する")
  .action((dir) => init(dir));

program
  .command("validate")
  .argument("<dir>", "論文ディレクトリ")
  .description("論文の構成ファイルを検証する")
  .action((dir) => validate(dir));

program
  .command("build")
  .argument("<dir>", "論文ディレクトリ")
  .description("論文ディレクトリをZIPにパッケージする")
  .action((dir) => build(dir));

program
  .command("pin")
  .argument("<zipFile>", "公開対象のZIPファイル")
  .option("--recursive", "meta.jsonの引用先まで含めてピン留めする")
  .description("ローカルのIPFSノードにZIPと引用先をピン留めする")
  .action((zipFile, options) => pin(zipFile, options));

program
  .command("publish")
  .argument("<zipFile>", "ビルド済みZIPファイル名")
  .description("ZIPファイルのIPFS CID（v1）を計算する")
  .action((zipFile) => publish(zipFile));

program.parse();
