# MANAGE — 管理者協調與操作

管理者負責協調、派工、管線、閘門、歸檔。讀寫含中文文件須指定 UTF-8。

## 決策表

| # | 輸入 | 部門 | 期別 |
|---|------|------|------|
| 1 | 研究需求 | PM（研究需求） | 研究期 / 需求期 |
| 2 | 開發維運 | DEV（開發維運） | 開發期 / 維運期 |
| 3 | 功能開發 | PM → DEV | 各自兩期 |
| 4 | 提問答詢 | 直接回答 | — |

提問判定：輸入涉及未歸檔 slug 則非提問，須進入意圖確認。面向自動綁定。

## 目錄結構

```
.shiftblame/<slug>/
├── SLUG.md, shared/handoff.md
├── PM/<NNN>/{plan,task,result,red,blue,conclusion}.md
└── DEV/<NNN>/{plan,task,result,red,blue,conclusion}.md
.shiftblame/
├── PRD/    ← PM 規劃（draft→active→completed→歸檔）
├── SOP/    ← DEV 標準（draft→active→deprecated→歸檔）
└── PID.md  ← 全域紀錄（PM/DEV 可更新，需意圖揭露）
```

## PRD/SOP/PID 操作

- PRD：PM 撰寫 → 老闆確認 → slug 引用 → completed 後歸檔至 archive/PRD/
- SOP：DEV 撰寫 → 老闆確認 → slug 引用 → deprecated 後歸檔至 archive/SOP/
- PID：PM/DEV 皆可更新，追加式記錄（來源+日期），建立與修改皆需意圖揭露

## 流程操作

**產物完整性**：每階段完成前，驗證該階段必要文件已寫入且正文非空。不符 → BLOCK。

建立 slug：`mkdir -p .shiftblame/<slug>/shared .shiftblame/<slug>/<ROLE>/001`
L1 commit：`git add <變更> && git commit -m "<type>(<slug>): <標題>"`（禁止 force-add .shiftblame/）
交接：PM PASSED → 彙整 conclusion.md 至 `shared/handoff.md`
歸檔：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`

## 觸發流程

1. 讀取指定或搜尋未歸檔 SLUG.md → 掌握管線狀態
2. 呈現理解到的意圖 → 與老闆溝通確認
3. 歸屬判定（當前 NNN / 新 NNN）→ 分流（執行期 / 審計期）
