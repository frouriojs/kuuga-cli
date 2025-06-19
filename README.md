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
└── .github/workflows/commit-zips.yml
```

### 論文の追加
プロジェクト内に新しい論文ディレクトリを作成します：

```bash
kuuga add papers/my-paper
```

生成されるファイル：

```
papers/my-paper/
├── main.md         # 本文（Markdown）
├── meta.json       # 論文のメタ情報
├── manifest.json   # バージョン情報
├── README.md       # 論文用Readme
└── docker/publish.sh
```

### 検証

構成ファイルの整合性を検証します：

```bash
kuuga validate papers/my-paper
```

### ビルド

ZIPを作成し、IPFSにアップロードする準備をします：

```bash
kuuga build papers/my-paper
```

## 自動公開とピン留め（GitHub Actions + IPFSノード）

- `main`ブランチにPushすると、GHAが差分を検知してZIPファイルを自動生成・コミットします。
- Dockerコンテナ上の `publish.sh` スクリプトは以下を実行します：
  - ZIPをIPFSに追加
  - meta.json に記載された `references` をもとに引用論文をピン留め
  - 論文自身もピン留め

この仕組みにより、引用関係が壊れないようネットワーク全体での保存努力が促進されます。
