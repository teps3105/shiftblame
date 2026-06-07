# MANAGE — 管理者協調與操作

管理者負責協調、管線、閘門、歸檔。讀寫含中文文件須指定 UTF-8。

## 目錄結構

```
.shiftblame/<slug>/
├── SLUG.md
└── <NNN>/{plan,red,task,blue,result,conclusion}.md
.shiftblame/
├── PRD/    ← 老闆筆記本（需求記錄）
├── PID/    ← 老闆筆記本（標準記錄）
└── SOP.md  ← 全局標準（需意圖揭露）
```

## 隔離原則

**slug 鏈範圍僅限主 repo**。`.shiftblame/` 是本地運行時，不入 repo、不進 slug 鏈。PRD/PID/SOP 等運行時文件由老闆管理，agent 可協助整理但不屬 slug 產物。

## PRD/PID/SOP 操作

- PRD/PID：老闆的筆記本，agent 可參考與協助整理，模板提供格式參考
- SOP：皆可更新，追加式記錄（來源+日期），建立與修改皆需意圖揭露

## 流程操作

**產物完整性**：每階段完成前，驗證該階段必要文件已寫入且正文非空。不符 → BLOCK。

建立 slug：`mkdir -p .shiftblame/<slug>/001` + `git checkout -b feat/<slug>` + 預建實作+審計兩條龍
新 NNN：同 slug 複用既有 `feat/<slug>` 分支，開新目錄
Commit：管理者執行 `git add <變更> && git commit -m "<type>(<slug>): <標題>"`（時機僅限 L3 PASS 後；禁止 force-add .shiftblame/）
歸檔：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`
清理：合併後刪除 `feat/<slug>` 分支（main 上執行 `git branch -d feat/<slug>`）
FAIL 回退：同 NNN 產物增量更新（已完成/本次新增分區），不重建

## 分支保護

- **main**：僅限老闆手動操作（文件修正等人工操作）
- **feat/<slug>**：agent 所有變更走此分支，收尾合併回 main
- **NNN=Commit**：L3 PASS 後才 commit，每個 NNN 恰好一個 commit

## 觸發流程

1. 讀取指定或搜尋未歸檔 SLUG.md → 掌握管線狀態
2. 呈現理解到的意圖 → 與老闆溝通確認
3. 歸屬判定：L3 已 PASS → FAIL 開新 NNN；L3 未 PASS → FAIL 回同 NNN L0
4. 一條龍交替：閘門點暫停當前條龍、喚醒另一條龍，注入摘要延續上下文
