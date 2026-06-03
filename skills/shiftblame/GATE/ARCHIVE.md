---
title: GATE/ARCHIVE
---

# G3 — 歸檔

**時機**：所有角色皆 PASSED 並收尾後。

## 收尾檢查清單

歸檔前必須確認：
- merge --no-ff 已完成
- push 完成
- worktree 已移除
- 功能分支已刪除

## 歸檔動作

`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`

| 情境 | 動作 |
|------|------|
| 歸檔目錄已有同名 slug | 附加時間戳：`<slug>_<YYYYMMDDTHHMMSS>` |

## 歸檔後更新

歸檔後更新 REPO.md 和 ROADMAP.md。管理者從 `.shiftblame/archive/<slug>/SLUG.md` 提取「待收尾整理」內容：

- REPO.md 加入已完成功能、架構變更、技術棧更新
- ROADMAP.md 加入後續計畫、已知問題、待改進項目
- 兩份文件語意不可交叉，只在歸檔後更新

禁止把待辦事項或未來路線圖寫入 `docs/`、README 的未來計畫章節，或其他會推送到遠端的文件。
