# PM CONCLUSION — L5 最終結論

> 階段：L5 ｜ 執行者：管理者（目前環境）｜ 上下文：高權重

## 結論上下文

管理者彙整五檔（task.md + result.md + red.md + blue.md），寫入 conclusion.md。

```bash
# Read .shiftblame/<slug>/PM/<NNN>/task.md
# Read .shiftblame/<slug>/PM/<NNN>/result.md
# Read .shiftblame/<slug>/PM/<NNN>/red.md
# Read .shiftblame/<slug>/PM/<NNN>/blue.md
# Write .shiftblame/<slug>/PM/<NNN>/conclusion.md — 彙整五檔寫入
```

內容包含：
- 最終結論 + 紅藍整合
- 跨部門推進聲明（DEV 可接續的項目）
- conclusion.md 本身為 self-contained（結論段落不引用其他文件路徑；「歸檔時應更新」欄位為管理者歸檔指引，非角色引用）

### 面向差異

| | 規劃面向 | 品管面向 |
|---|---|---|
| 結論重點 | 功能規格交付狀態、DEV 可接續項目、設計規格交接狀態 | 品質校正結果、標準修訂狀態、殘餘品質風險 |

## conclusion.md 產出格式

```markdown
# conclusion.md — <slug> PM/<NNN>（<面向>面向）

## 階段生命週期

| 宣告 | 時間 | 狀態 |
|------|------|------|
| 宣告開始 | | |
| 宣告完成 | | |
| 宣告通過 | | |

## 結論

PASS / FAIL

（管理者填入最終判定）

## 變更成果

（摘要本次變更的成果）

## 跨部門推進聲明

（DEV 可接續的項目、已定義的規格、驗收標準）

## Commit 紀錄

- `<hash>` — <commit 訊息>

## 殘餘風險

（如有殘餘風險請列出，無則寫「無」）

## 歸檔時應更新

- REPO.md：（需更新的項目，含面向資訊）
- ROADMAP.md：（需更新的項目）
```
