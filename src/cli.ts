#!/usr/bin/env node

import { Command } from "commander";
import { init } from "./commands/init.js";
import { add } from "./commands/add.js";
import { validate } from "./commands/validate.js";
import { build } from "./commands/build.js";
import { pin } from "./commands/pin.js";
import { publish } from "./commands/publish.js";

const program = new Command();

program
  .name("kuuga")
  .description("KUUGA CLI")
  .version(process.env.npm_package_version ?? '');

program
  .command("init")
  .description("新しいKUUGAプロジェクトを初期化する")
  .action(init);

program
  .command("add")
  .argument("<name>", "論文名を指定")
  .description("papers配下に新しい論文ディレクトリを作成する")
  .action(add);

program
  .command("validate")
  .description("papers配下のすべての論文を検証する")
  .action(validate);

program
  .command("build")
  .description("papers配下のすべての論文をZIPにパッケージする")
  .action(build);

program
  .command("pin")
  .description("outディレクトリのZIPファイルをIPFSにピン留めする")
  .action(pin);

program
  .command("publish")
  .description("outディレクトリのZIPファイルのIPFS CIDを計算する")
  .action(publish);

program.parse();
