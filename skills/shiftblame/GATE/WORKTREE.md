---
title: GATE/WORKTREE
---

# worktree 閘門

僅 AUTO 模式使用 worktree。MANUAL 模式開分支但不開 worktree。PLAN/OPERATE 不使用功能分支。

**建立（AUTO）**：slug 啟動時（第一次進入 DEV 前），管理者在主工作目錄執行 `git worktree add .worktrees/<slug> -b feat/<slug>`。

**建立（MANUAL）**：管理者在主工作目錄執行 `git checkout -b feat/<slug>`（不建立 worktree）。

**Commit 閘門**：AUTO 在 `.worktrees/<slug>` 下執行 `git status`；MANUAL 在主工作目錄執行。PLAN/OPERATE 在主工作目錄。

**紅隊存取**：AUTO 提供 `.worktrees/<slug>` 下的 `git diff`；MANUAL 提供主工作目錄的 `git diff`。

**收尾清理（AUTO）**：切回主工作目錄 → merge --no-ff → push → `git worktree remove .worktrees/<slug>` → `git branch -d feat/<slug>` → 歸檔。

**收尾清理（MANUAL）**：切回 main → merge --no-ff → push → `git branch -d feat/<slug>` → 歸檔。

**驗證**：AUTO 需確認 worktree 已移除（`git worktree list`）；MANUAL 不需。兩者皆確認分支已刪除、主工作目錄在 main 且乾淨。
