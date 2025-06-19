export const githubWorkflowTemplate = `name: Auto Commit ZIPs on Version Change

on:
  push:
    branches: [main]
    paths:
      - '**/main.md'
      - '**/meta.json'
      - '**/manifest.json'

jobs:
  build-and-commit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install deps
        run: npm ci

      - name: Build CLI
        run: npm run build

      - name: Detect changes
        id: changes
        run: |
          MODIFIED_DIRS=$(git diff --name-only HEAD~1 HEAD | grep -E '^(kuuga/.+/)(main\\.md|meta\\.json|manifest\\.json)' | cut -d/ -f1-2 | uniq)
          echo "modified=$MODIFIED_DIRS" >> $GITHUB_OUTPUT

      - name: Build and Save ZIPs
        if: steps.changes.outputs.modified != ''
        run: |
          for dir in \${{ steps.changes.outputs.modified }}; do
            echo "📦 Processing $dir"
            node dist/bin/cli.js validate "$dir"
            node dist/bin/cli.js build "$dir"
            ZIP_NAME=$(jq -r '.version' "$dir/manifest.json")
            mv "$dir.kuuga.zip" "$dir/v\${ZIP_NAME}.kuuga.zip"
            git add "$dir/v\${ZIP_NAME}.kuuga.zip"
          done

      - name: Commit ZIPs
        if: steps.changes.outputs.modified != ''
        run: |
          git config user.name "kuuga-bot"
          git config user.email "actions@github.com"
          git commit -m "chore: add updated ZIPs"
          git push`;
