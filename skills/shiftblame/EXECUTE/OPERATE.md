---
title: EXECUTE/OPERATE
---

# OPERATE 模式形式定義

DEV-only 主分支操作模式。直接在 main 分支工作，不建立功能分支，不使用 worktree。僅執行者參與。

## 適用情境

生產環境緊急修復、配置變更、單一角色直接操作。管理者指定或自動判斷。

## 形式參數

| 屬性 | 值 |
|------|-----|
| Pass | 1（DEV only） |
| 角色序列 | 無 |
| BossConfirm | Manual |
| 分支 | main |
| 目錄 | .shiftblame/\<slug\>/\<NNN\>/ |
| worktree | 否 |
| 上游讀取 | 無 |
| MaxIter | 1 |

## 管線

無角色管線。管理者直接派工給執行者（DEV only）。完整跑 L1→L5。BossConfirm 在 L1/L2/L5 需老闆確認。

## L4 FAIL

無打回上游選項（無上游）。僅原地修復（EXECUTED），修復後 BossConfirm → L3→L4→L5。

## 收尾

PASSED → COMMITTED → PUSHED → ARCHIVED → UPDATED。首次 commit 在 RESULT.md 產出前完成。無 merge、無 worktree 清理。
