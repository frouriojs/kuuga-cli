#!/bin/sh

echo "🚀 IPFSノード準備中..."

# CIDを保存する配列（連想配列として使用）
paper_cids=""

# outディレクトリ内の論文ディレクトリを再帰的に公開
find out -mindepth 2 -maxdepth 2 -type d | while read paperdir; do
  echo "📦 公開: $paperdir"
  cid=$(ipfs add --cid-version=1 --pin=true --recursive --quiet "$paperdir" | tail -1)
  if [ -n "$cid" ]; then
    echo "✅ CID: $cid"
    # CIDとパスをファイルに保存（後で読み取るため）
    echo "$paperdir:$cid" >> /tmp/kuuga_cids.txt
  else
    echo "❌ CID取得失敗: $paperdir"
  fi
done

# 各論文のmeta.jsonから引用先とpreviousPaperをピン留め
find . -type f -name "meta.json" -not -path "./out/*" | while read metafile; do
  echo "📋 メタファイル処理: $metafile"
  
  # 引用先をピン留め
  refs=$(jq -r '.references[]?' "$metafile" 2>/dev/null)
  for ref in $refs; do
    if [ -n "$ref" ] && [ "$ref" != "null" ]; then
      # ipfs://プレフィックスを削除
      clean_ref=$(echo "$ref" | sed 's|^ipfs://||')
      echo "📌 引用先をピン留め: $clean_ref"
      ipfs pin add "$clean_ref" || echo "⚠️  ピン留め失敗: $clean_ref"
    fi
  done
  
  # previousPaperをピン留め
  previousPaper=$(jq -r '.previousPaper?' "$metafile" 2>/dev/null)
  if [ -n "$previousPaper" ] && [ "$previousPaper" != "null" ]; then
    # ipfs://プレフィックスを削除
    clean_prev=$(echo "$previousPaper" | sed 's|^ipfs://||')
    echo "📌 過去論文をピン留め: $clean_prev"
    ipfs pin add "$clean_prev" || echo "⚠️  ピン留め失敗: $clean_prev"
  fi
done

echo "✅ すべての論文と引用先をピン留めしました"

# KUUGAレジストリに公開通知を送信
echo "🌐 KUUGAレジストリに公開通知中..."

# IPFSノードが安定するまで少し待機
sleep 5

# 保存されたCIDを使って公開通知
if [ -f /tmp/kuuga_cids.txt ]; then
  while IFS=: read -r paperdir cid; do
    echo "📡 公開通知送信中: $cid ($paperdir)"
    
    # まずIPFSでCIDが本当にアクセス可能か確認
    if ipfs cat "$cid" > /dev/null 2>&1 || ipfs ls "$cid" > /dev/null 2>&1; then
      echo "✓ IPFS内でCIDアクセス確認: $cid"
      
      # 503の場合は30秒ごとにリトライ
      while true; do
        response=$(curl -s -o /dev/null -w "%{http_code}" "https://kuuga.io/ipfs/$cid")
        if [ "$response" = "200" ]; then
          echo "✅ 公開通知成功: $cid"
          break
        elif [ "$response" = "503" ]; then
          echo "⏳ サービス一時利用不可、30秒後にリトライ: $cid"
          sleep 30
        else
          echo "⚠️ 予期しないレスポンス ($response): $cid"
          break
        fi
      done
    else
      echo "❌ IPFS内でCIDアクセス不可: $cid"
      # CIDが取得できない場合は再度追加を試行
      echo "🔄 再追加試行: $paperdir"
      new_cid=$(ipfs add --cid-version=1 --pin=true --recursive --quiet "$paperdir" | tail -1)
      if [ -n "$new_cid" ] && [ "$new_cid" != "$cid" ]; then
        echo "📡 新CIDで公開通知: $new_cid"
        response=$(curl -s -o /dev/null -w "%{http_code}" "https://kuuga.io/ipfs/$new_cid")
        echo "📊 レスポンス: $response for $new_cid"
      fi
    fi
  done < /tmp/kuuga_cids.txt
  
  # 一時ファイルを削除
  rm -f /tmp/kuuga_cids.txt
else
  echo "⚠️ CID情報ファイルが見つかりません"
fi

echo "🎉 すべての処理が完了しました"
tail -f /dev/null
