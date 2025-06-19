# KUUGA CLI

宇宙スケールの知の保存を目的としたプロトコル「KUUGA」のCLIツールです。論文をMarkdownとJSONで管理し、IPFSへの公開と永続化を支援します。

## 特徴
- MarkdownとJSONによるシンプルな論文管理
- Gitモノレポと連携したバージョン管理
- IPFSネットワークへの自動公開
- 引用関係をもとにしたピン留めルールの推奨

## インストール

```bash
npm install -g @frourio/kuuga
```

または、プロジェクト内で：

```bash
npm install @frourio/kuuga
```

## 使用方法

### プロジェクト初期化
新しいKUUGAプロジェクトを初期化します：

```bash
kuuga init my-kuuga-project
```

生成されるファイル：

```
my-kuuga-project/
├── Dockerfile      # IPFSノード用
├── publish.sh      # IPFS自動公開スクリプト
└── .github/workflows/commit-zips.yml
```

### 論文の追加
papers配下に新しい論文ディレクトリを作成します：

```bash
kuuga add my-paper
```

生成されるファイル：

```
papers/my-paper/
├── main.md         # 本文（Markdown）
├── meta.json       # 論文のメタ情報
└── README.md       # 論文用Readme
```

### 検証

papers配下のすべての論文の構成ファイルを一括検証します：

```bash
kuuga validate
```

### ビルド

papers配下のすべての論文をZIPファイルに一括パッケージします：

```bash
kuuga build
```

ZIPファイルは`out/`ディレクトリに`{論文名}.{バージョン}.zip`の形式で作成されます。

### ピン留め

outディレクトリのZIPファイルをIPFSにピン留めし、引用先もピン留めします：

```bash
kuuga pin
```

### CID計算

outディレクトリのZIPファイルのIPFS CIDを計算します：

```bash
kuuga publish
```

## 自動公開とピン留め（GitHub Actions + IPFSノード）

- `main`ブランチにPushすると、GHAが差分を検知してZIPファイルを自動生成・コミットします。
- IPFSノードが起動すると、`publish.sh` スクリプトが以下を実行します：
  - outディレクトリ内のすべてのZIPファイルをIPFSに追加・ピン留め
  - papers配下の各meta.jsonに記載された `references` をもとに引用論文をピン留め

この仕組みにより、引用関係が壊れないようネットワーク全体での保存努力が促進されます。
