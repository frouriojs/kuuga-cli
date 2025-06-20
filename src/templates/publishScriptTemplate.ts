export const publishScriptTemplate = `#!/bin/sh

echo "🚀 IPFSノード準備中..."

# outディレクトリ内の論文ディレクトリを再帰的に公開
find out -mindepth 2 -maxdepth 2 -type d | while read paperdir; do
  echo "📦 公開: $paperdir"
  ipfs add --cid-version=1 --pin=true --recursive "$paperdir"
done

# 各論文のmeta.jsonから引用先とpreviousPaperをピン留め
find . -type f -name "meta.json" -not -path "./out/*" | while read metafile; do
  echo "📋 メタファイル処理: $metafile"
  
  # 引用先をピン留め
  refs=$(jq -r '.references[]?' "$metafile" 2>/dev/null)
  for ref in $refs; do
    if [ -n "$ref" ] && [ "$ref" != "null" ]; then
      echo "📌 引用先をピン留め: $ref"
      ipfs pin add "$ref" || echo "⚠️  ピン留め失敗: $ref"
    fi
  done
  
  # previousPaperをピン留め
  previousPaper=$(jq -r '.previousPaper?' "$metafile" 2>/dev/null)
  if [ -n "$previousPaper" ] && [ "$previousPaper" != "null" ]; then
    echo "📌 過去論文をピン留め: $previousPaper"
    ipfs pin add "$previousPaper" || echo "⚠️  ピン留め失敗: $previousPaper"
  fi
done

echo "✅ すべての論文と引用先をピン留めしました"
tail -f /dev/null
`;
