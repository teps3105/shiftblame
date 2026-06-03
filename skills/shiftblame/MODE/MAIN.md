# MODE — MAIN

主分支模式。直接在 main 分支工作，不建立功能分支，不使用 worktree。

## 適用情境

日常文件維護、生產環境部署、小型修復、配置變更。不需老闆指定。

## 形式參數

| 屬性 | 值 |
|------|-----|
| Pass | 1 |
| 部門序列 | 無 |
| BossConfirm | Manual |
| 分支 | main |
| 目錄 | .shiftblame/\<slug\>/\<NNN\>/ |
| worktree | 否 |
| 上游讀取 | 無 |

## 管線

無部門管線。管理者直接操作或派工給執行者。

## 五階段

完整跑 L1→L5。BossConfirm 在 L1/L2/L5 需老闆確認。

## RESULT.md

無固定格式，目標導向描述工作成果。

## L4 FAIL

無打回上游選項（無上游）。僅原地修復（EXECUTED），修復後 BossConfirm → L3→L4→L5。

## 退回

- L1 BossConfirm FAIL → 返回 L1 重新宣告
- L2 BossConfirm FAIL → DECLARED（更新宣告段落，重走確認）
- L4 Blue FAIL → 原地修復（無上游退回）
- L5 BossConfirm FAIL → 退回 L1 重新宣告
- 回溯 → 撤回該 slug 所有變更，回到 001

## 收尾

PASSED → COMMITTED → PUSHED → ARCHIVED → UPDATED

首次 commit 在 RESULT.md 產出前完成。無 merge、無 worktree 清理。
