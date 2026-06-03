---
title: MANAGE/WORKTREE
---

# WORKTREE — worktree 生命週期管理

管理者負責 worktree 的完整生命週期管理。

## 建立階段

slug 啟動時（第一次進入 DEV 前），在主工作目錄執行 `git worktree add .worktrees/<slug> -b feat/<slug>`

## 開發期間

- DEV 在 worktree 中工作、commit
- 紅隊在 worktree 中或透過 `git diff` 檢視程式碼

## 收尾清理

切回主工作目錄 → merge → push → `git worktree remove .worktrees/<slug>` → `git branch -d feat/<slug>`

## 異常處理

- merge 衝突 → 解決後重新 merge
- worktree 移除失敗 → 檢查未 commit 變更
- 分支刪除失敗 → 確認已 merge 後使用 `-D` 強制刪除

## 並行支援

git worktree 原生支援多個 worktree 同時存在，但由於「每個 slug 完成後開新對話」策略，實際上同一對話中通常只有一個活躍 slug。管理者應在新 slug 啟動前確認前一個 slug 已完成 merge 和清理。
