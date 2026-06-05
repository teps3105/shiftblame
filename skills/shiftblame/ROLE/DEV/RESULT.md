# DEV RESULT — L2 驗收成果
> L2 ｜ 開發期 ｜ 寫入權：可 commit ｜ 驗收者非執行者

DEV 自行驗收：GWT 逐條驗證、邊界測試、端到端驗收。self-contained。

## 面向差異

| | 開發面向 | 維運面向 |
|---|---|---|
| 驗收焦點 | 功能實作完整性、GWT 逐條通過 | 端到端流程完整性、使用者體驗品質 |

## 子代理上下文
1. 角色：DEV 驗收者 2. 任務：task.md 成果 3. 背景：REPO/ROADMAP
4. 上游：shared/handoff.md 5. 讀寫：UTF-8，臨時檔放 .shiftblame/tmp/

## result.md 產出格式

```markdown
---
slug: <slug>
role: DEV
aspect: <開發/維運>
round: <NNN>
status: EXECUTED
created_at: <ISO 8601>
---
# result.md — <slug> DEV/<NNN>

## 階段生命週期
| 宣告 | 時間 | 狀態 |
|------|------|------|
| 宣告開始 | | |
| 宣告完成 | | |
| 宣告通過 | | |

## 驗收結果
| # | 項目 | 判定 | 說明 |
|---|------|------|------|
| C1 | | 通過/未通過 | |

## 變更摘要
（修改檔案清單、commit hash）

## 技術債狀態
（如無則寫「無」）
```