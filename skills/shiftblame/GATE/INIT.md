---
title: GATE/INIT
---

# G0 — 初始化

**時機**：觸發 shiftblame 技能時。

**檢查**：`.shiftblame/REPO.md` 與 `.shiftblame/ROADMAP.md` 是否存在。

| 情境 | 動作 |
|------|------|
| `.shiftblame/` + `REPO.md` + `ROADMAP.md` 皆存在 | 通過 |
| `.shiftblame/` 存在但缺 `REPO.md` 或 `ROADMAP.md` | BLOCK：手動補齊缺少的本地私密文件 |
| 位於 git repo，無 `.shiftblame/` | 自動建立 `.shiftblame/` + `REPO.md` + `ROADMAP.md` 模板 |
| 空目錄（無檔案） | 先 `git init`，再自動建立 |
| 非 git repo 且非空 | BLOCK：請先執行 `git init` |

確認 REPO.md 和 ROADMAP.md 格式。不符合標準格式時，管理者整理為標準格式後繼續。

## REPO.md 模板

```markdown
# REPO — 專案現狀
> 本地私密，不納入版本控制
## 專案現狀
## 已完成功能
## 技術棧
## 架構演進
```

## ROADMAP.md 模板

```markdown
# ROADMAP — 穩定產品路線圖
> 本地私密，不納入版本控制；不得改以 docs/ 或其他會推送到遠端的文件維護。

## 原則
- ROADMAP 只在歸檔後更新。REPO.md 記錄「完成了什麼」，ROADMAP.md 記錄「未來預計要做什麼」。語意不可交叉。
- 開發中的工作筆記、臨時待辦、退回原因、BossPreview 回饋與本輪決策一律寫入 `.shiftblame/<slug>/SLUG.md`。
- 不得邊開發邊把 PM/DEV 流程待辦寫進 ROADMAP。
- 不得把 ROADMAP 內容當成本輪必做功能來源；本輪範圍永遠以使用者本輪明確想實現的功能為準。

## 產品方向
## 後續計畫
## 已知問題
## 待改進項目
```
