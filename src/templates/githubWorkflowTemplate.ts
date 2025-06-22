export const githubWorkflowTemplate = `name: Auto Build Papers on Version Change

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

      - name: Build Papers
        run: npm run build

      - name: Commit Built Papers
        run: |
          git config user.name "kuuga-bot"
          git config user.email "actions@github.com"
          if [ -z "$(git status --porcelain)" ]; then
            echo "No changes to commit"
          else
            git add papers/
            git commit -m "chore: build papers"
            git push
          fi
`;
