# PM RESULT — L4 實作規格

> L4 ｜ 依複雜度 ｜ 實作
> 依 L2 GWT 翻譯，產出能進入開發的規格結果。不變更 repo。

## 子代理上下文

1. 角色：研究需求實作者 2. 任務：task.md GWT 規格
3. 背景：REPO.md/ROADMAP.md 4. 上游：前輪 conclusion.md（若有）
5. 面向：研究/需求
6. 讀寫規則：UTF-8；PM 可讀碼研究但禁定義實作；不變更 repo，產物僅存 .shiftblame/

## result.md 產出格式

```markdown
---
slug: <slug> | role: PM | aspect: <研究/需求> | round: <NNN>
status: IMPLEMENTED | created_at: <ISO>
---
# result.md — <slug> PM/<NNN>

## 階段生命週期
| 宣告 | 時間 | 狀態 |
|------|------|------|
| 宣告開始 | | |
| 宣告完成 | | |

## 實作摘要
（依 GWT 產出的規格成果）

## 實作項目
### C1: （標題）
- **判定**：通過 / 未通過
- **說明**：（實作說明）

## 綜合結論
PASS / FAIL
```
