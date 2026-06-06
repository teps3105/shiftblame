# MANAGE — 管理者協調與操作

管理者負責協調、管線、閘門、歸檔。讀寫含中文文件須指定 UTF-8。

## 目錄結構

```
.shiftblame/<slug>/
├── SLUG.md
└── <NNN>/{plan,red,task,blue,result,conclusion}.md
.shiftblame/
├── PRD/    ← 規劃（draft→active→completed→歸檔）
├── PID/    ← 標準（draft→active→deprecated→歸檔）
└── SOP.md  ← 全局標準（需意圖揭露）
```

## PRD/PID/SOP 操作

- PRD：撰寫 → 老闆確認 → slug 引用 → completed 後歸檔至 archive/PRD/
- PID：撰寫 → 老闆確認 → slug 引用 → deprecated 後歸檔至 archive/PID/
- SOP：皆可更新，追加式記錄（來源+日期），建立與修改皆需意圖揭露

## 流程操作

**產物完整性**：每階段完成前，驗證該階段必要文件已寫入且正文非空。不符 → BLOCK。

建立 slug：`mkdir -p .shiftblame/<slug>/001` + `git checkout -b feat/<slug>`
新 NNN：同 slug 複用既有 `feat/<slug>` 分支，開新目錄
Commit：`git add <變更> && git commit -m "<type>(<slug>): <標題>"`（禁止 force-add .shiftblame/）
歸檔：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`

## 分支保護

- **main**：僅限老闆手動操作（文件修正等人工操作）
- **feat/<slug>**：agent 所有變更走此分支，收尾合併回 main
- **NNN=Commit**：每個 NNN 恰好一個 commit

## 觸發流程

1. 讀取指定或搜尋未歸檔 SLUG.md → 掌握管線狀態
2. 呈現理解到的意圖 → 與老闆溝通確認
3. 歸屬判定（當前 NNN / 新 NNN）→ 分流；任何 FAIL 自動開新 NNN 從 L0
