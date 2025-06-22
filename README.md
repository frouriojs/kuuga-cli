# KUUGA CLI

宇宙スケールの知の保存を目的としたプロトコル「KUUGA」のCLIツールです。論文をMarkdownとJSONで管理し、IPFSへの公開と永続化を支援します。

## 特徴
- MarkdownとJSONによるシンプルな論文管理
- Gitでのバージョン管理を前提
- IPFSネットワークに論文と引用先の自動ピン留め

## インストール

```bash
npm install -g kuuga-cli
```

または、プロジェクト内で：

```bash
npm install kuuga-cli
```

## 使用方法

### プロジェクト初期化
新しいKUUGAプロジェクトを初期化します：

```bash
kuuga init
```

生成されるファイル：

```
/
├── Dockerfile      # IPFSノード用
└── .github/workflows/build-papers.yml
```

### 原稿の追加
drafts配下に新しい原稿ディレクトリを作成します：

```bash
kuuga add my-paper
```

生成されるファイル：

```
drafts/my-paper/
├── main.md         # 本文（Markdown）
├── meta.json       # 論文のメタ情報
└── README.md       # 論文用Readme
```

### 検証

drafts配下のすべての論文の構成ファイルを一括検証します：

```bash
kuuga validate
```

### ビルド

drafts配下のすべての原稿からpapersディレクトリに論文を生成します：

```bash
kuuga build
```

論文は`papers/{論文名}/{3ケタパディング付きバージョン}_{IPFSのCID}/`の形式でディレクトリ構造が作成されます。

### ピン留め

papersディレクトリの論文と引用先をIPFSにピン留めします：

```bash
kuuga pin
```

## 自動公開とピン留め（GitHub Actions + Dockerコンテナ）

- `main`ブランチにPushすると、GHAが差分を検知して論文ディレクトリを自動生成・コミットします。
- 任意のサーバーで4001番ポートを開放し、Dockerfileでコンテナを起動するとIPFSへのピン留めが実行されます。

この仕組みにより、引用関係が壊れないようネットワーク全体での保存努力が促進されます。
