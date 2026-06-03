---
title: MANAGE/WORKTREE
---

# WORKTREE — 功能分支與 worktree 生命週期管理

管理者負責功能分支的完整生命週期管理。僅 AUTO 模式使用 worktree；MANUAL 模式在主工作目錄內建立分支。

## 建立階段

- **MANUAL**：`git checkout -b feat/<slug>`（主工作目錄內）
- **AUTO**：`git worktree add .worktrees/<slug> -b feat/<slug>`（獨立 worktree）

## 開發期間

- MANUAL：DEV 在主工作目錄的 feat/<slug> 分支上工作、commit
- AUTO：DEV 在 `.worktrees/<slug>` 中工作、commit

## 收尾清理

- **MANUAL**：切回 main → merge --no-ff → push → `git branch -d feat/<slug>`
- **AUTO**：切回主工作目錄 → merge --no-ff → push → `git worktree remove .worktrees/<slug>` → `git branch -d feat/<slug>`

## 異常處理

- merge 衝突 → 解決後重新 merge
- worktree 移除失敗（AUTO） → 檢查未 commit 變更
- 分支刪除失敗 → 確認已 merge 後使用 `-D` 強制刪除
