# PM TASK — L1 執行任務

> L1 ｜ 依複雜度 ｜ 研究期 ｜ PM 無上游
> 依計畫將 5W1H 翻譯為業務 GWT，成果寫入 task.md。不產出可執行程式碼。完成後 commit。

## 面向差異

| | 研究面向 | 需求面向 |
|---|---|---|
| 觸發時機 | 需求釐清、功能研究 | 品質偏移、標準不明 |
| L1 重點 | 需求分析、GWT 翻譯、前端設計 | 偏移分析、校正、一致性檢查 |
| 產出特徵 | 功能規格、業務 GWT、設計規格 | 校正報告、修訂方案 |
| 驗收標準 | 規格完整、驗收標準可執行 | 偏移已修正、標準已校正 |
| 攻擊焦點 | 需求漏洞、規格缺口 | 品質標準缺口、校正不完整 |
| 防禦焦點 | 規格完整性、DEV 可執行性 | 品質有效性、一致性恢復 |

## 執行規範

- 依計畫將 5W1H 翻譯為業務 GWT（Given/When/Then）；不產出可執行程式碼；成果寫入 task.md
- PM 僅產出需求規格，禁止提出實作計畫（改哪些檔案、怎麼改屬 DEV L0 職責）
- commit：`git commit -m "feat(<slug>): <繁中標題>"`
- PM 可讀碼研究但禁定義實作；按需求提供資訊給 DEV

## 子代理上下文

1. 角色：研究需求執行者 2. 任務：本輪計畫 3. 背景：REPO.md/ROADMAP.md
4. 上游：前輪 conclusion.md（若有） 5. 面向：研究期=研究/需求期=需求
6. 讀寫規則：UTF-8；PM 可讀碼研究但禁定義實作；不變更 repo，產物僅存 .shiftblame/

## task.md 產出格式

```markdown
---
slug: <slug> | role: PM | aspect: <研究/需求> | round: <NNN>
status: EXECUTED | created_at: <ISO> | trigger: <原因>
review: local | upstream: <上游 conclusion.md 路徑或 null>
---
# PM/<NNN> <觸發原因>任務：<標題>

## 階段生命週期
| 宣告 | 時間 | 狀態 |
| 宣告開始 | | |
| 宣告完成 | | |

## 業務 GWT
（將 plan 5W1H 翻譯為 Given/When/Then 可執行規格）

## 執行成果
（變更摘要、修改檔案清單、驗證方式與結果）
```
