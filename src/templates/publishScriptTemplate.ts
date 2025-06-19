export const publishScriptTemplate = `#!/bin/sh

echo "🚀 IPFSノード準備中..."

find kuuga -type f -name "v*.kuuga.zip" | while read zipfile; do
  echo "📦 公開: $zipfile"
  ipfs add --cid-version=1 --pin=true --raw-leaves=true "$zipfile"
done

find kuuga -type f -name "meta.json" | while read metafile; do
  refs=$(jq -r '.references[]?' "$metafile")
  for ref in $refs; do
    echo "📌 引用先をピン留め: $ref"
    ipfs pin add "$ref"
  done
done

echo "✅ すべての論文と引用先をピン留めしました"
tail -f /dev/null`;
