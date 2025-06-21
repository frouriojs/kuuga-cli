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
└── .github/workflows/build-papers.yml
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

papers配下のすべての論文を`out/`ディレクトリに一括コピーします：

```bash
kuuga build
```

論文は`out/{論文名}/{バージョン}/`の形式でディレクトリ構造が作成されます。

### ピン留め

outディレクトリの論文ディレクトリをIPFSにピン留めし、引用先もピン留めします：

```bash
kuuga pin
```

### CID計算

outディレクトリの論文ディレクトリのIPFS CIDを計算します：

```bash
kuuga publish
```

## 自動公開とピン留め（GitHub Actions + IPFSノード）

- `main`ブランチにPushすると、GHAが差分を検知して論文ディレクトリを自動生成・コミットします。
- IPFSノードが起動すると、`node_modules/@frourio/kuuga/dist/publish.sh` スクリプトが以下を実行します：
  - outディレクトリ内のすべての論文ディレクトリをIPFSに再帰的に追加・ピン留め
  - papers配下の各meta.jsonに記載された `references` をもとに引用論文をピン留め

この仕組みにより、引用関係が壊れないようネットワーク全体での保存努力が促進されます。
