export const githubWorkflowTemplate = `name: Auto Commit ZIPs on Version Change

on:
  push:
    branches: [main]

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
          node-version: 22

      - name: Install deps
        run: npm ci

      - name: Build CLI
        run: npm run build

      - name: Commit ZIPs
        run: |
          git config user.name "kuuga-bot"
          git config user.email "actions@github.com"
          if [ -z "$(git status --porcelain)" ]; then
            echo "No changes to commit"
          else
            git add .
            git commit -m "chore: add updated ZIPs"
            git push
          fi
`;
