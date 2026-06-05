# PM RESULT — L2 驗收成果

> L2 ｜ 依複雜度 ｜ 研究期 ｜ 驗收者非執行者
> 驗收 L1 成果是否正確。驗收者不修改任何檔案，僅檢驗與報告。

## frontmatter status 說明

`status: EXECUTED` 記錄被驗收的 L1 狀態；GATE 閘門 APPROVED 是管線狀態，兩者各司其職。

## 子代理上下文

1. 角色：研究品管驗收者（非執行者） 2. 任務：task.md 執行成果
3. 背景：REPO.md/ROADMAP.md 4. 上游：前輪 conclusion.md（若有）
5. 面向：研究期=研究/品管期=品管
6. 讀寫規則：UTF-8；PM 不變更 repo，產物僅存 .shiftblame/

## result.md 產出格式

```markdown
---
slug: <slug> | role: PM | aspect: <研究/品管> | round: <NNN>
status: EXECUTED | created_at: <ISO>
---
# result.md — <slug> PM/<NNN>

## 階段生命週期
| 宣告 | 時間 | 狀態 |
|------|------|------|
| 宣告開始 | | |
| 宣告完成 | | |

## 驗收摘要
（整體評估）

## 驗收項目
### C1: （標題）
- **判定**：通過 / 未通過
- **說明**：（驗收說明）

## 綜合結論
PASS / FAIL
```
