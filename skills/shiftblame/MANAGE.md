# MANAGE — 管理者協調與操作

管理者負責協調、管線、閘門、歸檔。讀寫含中文文件須指定 UTF-8。

## 目錄結構

```
.shiftblame/<slug>/├── SLUG.md └── <NNN>/{plan,red,task,blue,result,conclusion}.md
.shiftblame/├── PRD/ PID/ └── SOP.md
```

## 隔離與操作

**slug 鏈範圍僅限主 repo**。`.shiftblame/` 本地運行時，不入 repo、不進 slug 鏈。
PRD/PID：老闆的筆記本。SOP：皆可更新，建立與修改皆需意圖揭露。

## 發散調度（L0）／收斂綜合（L5）

L0：決定發散子代理數量與視角，盲獨立運行，管理者收斂為 plan.md。
L5：分配正交審計維度（覆蓋率/一致性），盲獨立運行，管理者彙整為 conclusion.md。

## 流程操作

**產物完整性**：每階段完成前驗證文件已寫入且正文非空。不符 → BLOCK。
建立 slug：`mkdir -p .shiftblame/<slug>/001` + `git checkout -b feat/<slug>` + 預建收斂管線(L1/L3+L2/L4)，形式由老闆決定
新 NNN：同 slug 複用 `feat/<slug>` 分支，開新目錄
Commit：管理者執行 `git add <變更> && git commit`（時機僅限 L3 PASS 後；禁止 force-add .shiftblame/）
歸檔：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`
清理：合併後刪除 `feat/<slug>` 分支。FAIL 回退：同 NNN 增量更新

## 分支保護

**main**：僅限老闆手動。**feat/<slug>**：agent 所有變更走此分支，收尾合併。**NNN=Commit**：L3 PASS 後才 commit，每 NNN 恰好一個。

## 觸發流程

1. 讀取或搜尋未歸檔 SLUG.md → 掌握管線狀態
2. 呈現理解到的意圖 → 與老闆溝通確認
3. L0 發散：多子代理盲獨立研究 → 收斂為 plan.md
4. 歸屬判定：L3 已 PASS → FAIL 開新 NNN；未 PASS → 回同 NNN L0
5. L5 收斂：多子代理全域審計 → 收斂為 conclusion.md
6. 收斂管線交替：閘門點暫停/喚醒，注入摘要延續上下文
