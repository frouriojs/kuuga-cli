export const publishScriptTemplate = `#!/bin/sh

echo "🚀 IPFSノード準備中..."

# outディレクトリ内のZIPファイルを公開
find out -type f -name "*.zip" | while read zipfile; do
  echo "📦 公開: $zipfile"
  ipfs add --cid-version=1 --pin=true --raw-leaves=true "$zipfile"
done

# 各論文のmeta.jsonから引用先をピン留め
find . -type f -name "meta.json" -not -path "./out/*" | while read metafile; do
  echo "📋 メタファイル処理: $metafile"
  refs=$(jq -r '.references[]?' "$metafile" 2>/dev/null)
  for ref in $refs; do
    if [ -n "$ref" ] && [ "$ref" != "null" ]; then
      echo "📌 引用先をピン留め: $ref"
      ipfs pin add "$ref" || echo "⚠️  ピン留め失敗: $ref"
    fi
  done
done

echo "✅ すべての論文と引用先をピン留めしました"
tail -f /dev/null`;
