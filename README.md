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
├── .gitignore
├── .github/workflows/build-papers.yml
├── .kuuga/config.json          # 論文のメタ情報初期値
├── .kuuga/private_key.pem      # 所有権証明用
└── .kuuga/public_key.pem       # 所有権証明用
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
└── meta.json       # 論文のメタ情報
```

### 検証

drafts配下のすべての原稿の構成ファイルを一括検証します：

```bash
kuuga validate
```

### ビルド

drafts配下のすべての原稿からpapersディレクトリに論文を生成します：

```bash
kuuga build
```

論文は`papers/{論文名}/{3ケタパディング付きバージョン}_{IPFSのCID}/`の形式でディレクトリ構造が作成されます。

### Peer ID生成

IPFSネットワークで使用するPeer IDを生成し、JSONファイルに保存します：

```bash
kuuga gen-key
```

オプショナルで出力先のパスを指定できます：

```bash
kuuga gen-key my-peer-id.json
```

生成されるJSONファイルの形式：

```json
{
  "id": "12D3...",
  "privKey": "CAESQBc...（Base64エンコードされた秘密鍵）",
  "pubKey": "MCowBQ...（Base64エンコードされた公開鍵）"
}
```

生成されたPeer IDを使用するには、JSONファイルの内容を`KUUGA_KEY`環境変数に設定します：

```bash
export KUUGA_KEY='{"id":"12D3...","privKey":"CAESQ...","pubKey":"MCowB..."}'
kuuga pin
```

### ピン留め

papersディレクトリの論文と引用先をIPFSにピン留めします：

```bash
kuuga pin
```

`KUUGA_KEY`環境変数が設定されている場合、指定されたPeer IDでIPFSネットワークに接続します。設定されていない場合は、実行の度に新しいPeer IDが生成されます。

### Pinataへのアップロード

papersディレクトリの論文をPinataサービスにアップロードします：

```bash
kuuga pinata
```

このコマンドを使用するには、`PINATA_JWT`環境変数の設定が必要です：

```bash
export PINATA_JWT='your-pinata-jwt-token'
kuuga pinata
```

オプションで`PINATA_GATEWAY`環境変数を設定することもできます：

```bash
export PINATA_GATEWAY='your-custom-gateway.mypinata.cloud'
```

アップロードされたファイルは、`{バージョン番号}_{論文名}`の形式で保存されます（例：`001_my-paper`）。

### 論文のダウンロード

指定されたCIDの論文とその引用元をIPFSからダウンロードします：

```bash
kuuga fetch <cid> <directoryName>
```

- `<cid>`: ダウンロードする論文のCID（`ipfs://`プレフィックスはオプション）
- `<directoryName>`: papers配下に作成するディレクトリ名

例：

```bash
kuuga fetch bafybeie37nnusfxejtmkfi2l2xb6c7qqn74ihgcbqxzvvbytnjstgnznkq my-downloaded-paper
```

このコマンドは、指定されたCIDの論文をダウンロードし、その論文の`previousPaper`フィールドを辿って引用元の論文も再帰的にダウンロードします。KUUGAプロトコルの起源論文に到達するまでダウンロードを続けます。

ダウンロードされた論文は`papers/{directoryName}/{バージョン番号}_{CID}/`の形式で保存されます。

## 自動公開とピン留め（GitHub Actions + Dockerコンテナ）

- `main`ブランチにPushすると、GHAが差分を検知して論文ディレクトリを自動生成・コミットします。
- 任意のサーバーで4001番ポートを開放し、Dockerfileでコンテナを起動するとIPFSへのピン留めが実行されます。

この仕組みにより、引用関係が壊れないようネットワーク全体での保存努力が促進されます。
