---
title: GATE/WORKTREE
---

# worktree 閘門

**建立**：slug 啟動時（第一次進入 DEV 前），管理者在主工作目錄執行 `git worktree add .worktrees/<slug> -b feat/<slug>`。

**Commit 閘門（worktree 環境）**：管理者在 `.worktrees/<slug>` 下執行 `git status` 驗證工作目錄乾淨。PLAN 模式維持現有規則（在主工作目錄執行）。

**紅隊存取**：管理者提供 `git diff`（在 `.worktrees/<slug>` 下執行）的輸出給紅隊子代理，或在派工 prompt 中指定 worktree 路徑讓紅隊在 worktree 中工作。

**收尾清理**：管理者切回主工作目錄 → merge --no-ff → push → `git worktree remove .worktrees/<slug>` → `git branch -d feat/<slug>` → 歸檔。

**驗證**：`git worktree list` 確認 worktree 已移除；`git branch` 確認功能分支已刪除；主工作目錄在 main 分支且乾淨。
