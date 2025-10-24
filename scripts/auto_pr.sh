#!/usr/bin/env bash
set -euo pipefail
gh --version >/dev/null
gh auth status >/dev/null || gh auth login -w
git fetch origin --prune
BR="auto/pr-$(date +%Y%m%d-%H%M%S)"
git switch -c "$BR" || git checkout -b "$BR"
git add -A
git commit -m "chore: auto PR $(date +%F)" || git commit --allow-empty -m "chore: auto PR no changes $(date +%F)"
git push -u origin "$BR"
PR_URL=$(gh pr create --base main --head "$BR" --fill --title "chore: auto PR $(date +%F)")
PR_NUMBER=$(gh pr view --json number -q .number)
gh pr edit "$PR_NUMBER" --add-label ai-auto --add-label auto-merge
# 任意: すぐAI修正を走らせたいとき
gh pr comment "$PR_NUMBER" --body "/ai-fix"
echo "[OK] $PR_URL"
