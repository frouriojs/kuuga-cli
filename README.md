# KUUGA CLI

**KUUGA** は、知識の構造を未来に保存するための非中央集権プロトコルです。  
この CLI ツールは、KUUGA 論文を作成・検証・封入・公開するための最小インターフェースを提供します。

## 📦 インストール

```bash
npm install -g kuuga-cli
````

## 🧪 使い方

### 1. テンプレートの作成

```bash
kuuga init my-paper
```

`my-paper/` に以下の構造を生成します：

my-paper/
├── main.md         # 論文本文
├── meta.json       # メタデータ（構造・著者等）
├── README.md       # 説明文
└── manifest.json   # バージョン情報

### 2. 構造の検証

```bash
kuuga validate my-paper
```

* ファイルの存在確認
* `meta.json` ↔ `manifest.json` のバージョン整合性
* 必須項目（title, authors 等）の存在検証

### 3. ZIP生成（無圧縮）

```bash
kuuga build my-paper
# => my-paper.kuuga.zip が生成される
```

### 4. IPFS CIDの計算

```bash
kuuga publish my-paper.kuuga.zip
# => IPFS CID (v1) が表示される
```

## 🎯 プロトコル理念

KUUGA は次の特徴を持ちます：

* 起源論文から引用によって知識が構造化される
* 論文はZIPで封入し、IPFSで共有・継承される
* バージョンは `manifest.json` で管理し、改変は推奨されない
* 起源論文は空文字で構成され、知識構造の始点を担う
