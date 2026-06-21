#!/bin/bash
# 自動でGitに追加、コミット、プッシュを行うスクリプト

# 変更があるかチェック
if [ -z "$(git status --porcelain)" ]; then
  echo "変更はありません。"
  exit 0
fi

# コミットメッセージの作成（引数があればそれを使用、なければデフォルトメッセージ）
COMMIT_MSG=${1:-"Update games (Auto-commit)"}

echo "Staging changes..."
git add .

echo "Committing changes with message: '$COMMIT_MSG'..."
git commit -m "$COMMIT_MSG"

echo "Pushing to origin..."
git push origin main

echo "Push completed successfully!"
