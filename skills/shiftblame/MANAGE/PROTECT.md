---
title: MANAGE/PROTECT
---

# PROTECT — 流程保護

## 跳步防護

管理者在狀態機轉移時，必須驗證前一狀態的產物存在且格式有效。驗證不通過則中止轉移。

**宣告更新規則**：若執行者在 BossConfirm 前更新了宣告內容（無論是否已進入 DECLARED），狀態回到 DECLARED，必須重新走完整宣告流程（BossConfirm），不得視為自動 APPROVED。

| 轉移 | 驗證條件 | 不通過處理 |
|------|----------|-----------|
| TASK → DECLARED | task.md「## 宣告」段落非空 | 要求執行者先寫入宣告 |
| DECLARED → APPROVED | BossConfirm 已完成（老闆已明確同意） | 中止，等待老闆確認 |
| APPROVED → EXECUTED | 老闆已同意宣告且 task.md status 為 APPROVED | 中止 |
| EXECUTED → RED | result.md 存在且格式有效（含 YAML frontmatter 與繁體中文工作成果） | 要求執行者先完成工作成果 |
| RED → BLUE | red.md 存在、含 YAML frontmatter、含繁體中文攻擊內容 | 重新呼叫紅隊 |
| BLUE → CONCLUSION | blue.md 存在、含 YAML frontmatter、含繁體中文檢視內容；conclusion.md 存在、含 YAML frontmatter、含繁體中文結論 | 重新呼叫藍隊 / 管理者先完成結論產出 |
| CONCLUSION → CHECKED | 五檔齊全（task.md + result.md + red.md + blue.md + conclusion.md），每檔含 YAML frontmatter 與繁體中文 | 要求補齊缺件 |

**不可跳步**：藍隊判定 FAIL 時，管理者回到 L2（EXECUTED），執行者原地修復 result.md → BossConfirm → L3→L4→L5，不產出 conclusion.md。只有藍隊 PASS 才進入 L5 產出 conclusion.md。L2 BossConfirm 不可跳過。L5 BossConfirm FAIL 時退回 L1 重新宣告。

## Commit 閘門

所有模式、所有角色，result.md 產出前必須先 commit 所有工作變更。此閘門為**主動觸發型**：管理者在批准進入 L2 產出階段前，必須先執行 `git status` 驗證工作目錄乾淨（不存在未追蹤檔案、已追蹤但未暫存修改、已暫存但未提交）。若目錄不乾淨，管理者必須執行 `git add` + `git commit` 後才能允許進入 L2。不得跳過此步驟。無例外。

PLAN 模式（管理者直接執行時）：管理者自己在產出 result.md 前必須先 commit 所有變更。管理者不得既當執行者又跳過 Commit 閘門。

## 工作目錄鎖定

紅藍隊期間（EXECUTED → RED 轉移至 BLUE 完成）以及 DECLARED → APPROVED 期間，管理者不得進行任何會修改工作目錄中已追蹤檔案的操作。唯一例外：更新 SLUG.md 的「管線狀態紀錄」段落和「BossPreview / 退回紀錄」段落。

紅隊子代理將報告寫入 `red.md`，藍隊子代理將報告寫入 `blue.md`。管理者在子代理回傳後驗證檔案是否已產出且格式有效；若未產出，重新呼叫該子代理。管理者寫入 `conclusion.md`，不得刪除既有攻防紀錄。

紅隊報告中發現問題時，管理者不得直接修復。必須繼續藍隊流程。若需修復，FAIL 原地修復或打回上游。

## 派工隔離

管理者在派工 prompt 中不得引用 GATE.md 狀態定義表。GATE.md 為管理者內部參考文件，不透過 prompt 傳遞給任何代理。
