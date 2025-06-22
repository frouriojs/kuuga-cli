#!/usr/bin/env node

import { Command } from "commander";
import { init } from "./commands/init.js";
import { add } from "./commands/add.js";
import { validate } from "./commands/validate.js";
import { build } from "./commands/build.js";
import { pin } from "./commands/pin.js";

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
  .description("drafts配下に新しい原稿ディレクトリを作成する")
  .action(add);

program
  .command("validate")
  .description("drafts配下のすべての原稿を検証する")
  .action(validate);

program
  .command("build")
  .description("drafts配下のすべての原稿からpapersに論文を生成する")
  .action(build);

program
  .command("pin")
  .description("papersディレクトリのすべての論文と引用先をIPFSにピン留めする")
  .action(pin);

program.parse();
