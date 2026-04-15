---
name: repo-reflect
description: >-
  快照當前 main 分支的專案狀態，更新 REPO.md。
  Use this skill when: the user says "聚合文件", "文件聚合", "repo-reflect", "/repo-reflect".
---

# shiftblame:repo-reflect — 專案快照

查詢 main 分支的當下快照，將各部門最新狀態寫入 `REPO.md`。

## 快照邏輯

1. 切到 main 分支，讀取**當下**各部門目錄中的最新檔案
2. 每個部門只取**最新 1 筆**（按修改時間排序）
3. 將快照結果寫入 `~/.shiftblame/<repo>/REPO.md`
4. 不刪除、不移動任何歷史檔案

## 執行步驟

### 1. 取得 repo 資訊

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
```

### 2. 切到 main 並拉最新

```bash
cd "$REPO_ROOT"
git checkout main
git pull --ff-only origin main
```

### 3. 掃描各部門最新檔案

對每個部門目錄 `~/.shiftblame/<repo>/{SEC,QA,PRD,DEV,QC,MIS}/`：

```bash
# 取該部門最新的 .md 檔案（排除 REPO.md）
ls -t ~/.shiftblame/<repo>/<DEPT>/*.md 2>/dev/null | head -1
```

### 4. 讀取最新檔案並快照

對每個部門的最新檔案：
- Read 檔案內容
- 取前 20 行作為摘要（或全文，若檔案小於 20 行）

### 5. 寫入 REPO.md

Write 到 `~/.shiftblame/<repo>/REPO.md`：

```markdown
# <repo> — REPO.md

> 快照時間：<YYYY-MM-DD HH:MM> | main HEAD：<short hash>

## SEC
### <slug>（<YYYY-MM-DD>）
<摘要>

## QA
### <slug>（<YYYY-MM-DD>）
<摘要>

## PRD
### <slug>（<YYYY-MM-DD>）
<摘要>

## DEV
### <slug>（<YYYY-MM-DD>）
<摘要>

## QC
### <slug>（<YYYY-MM-DD>）
<摘要>

## MIS
### <slug>（<YYYY-MM-DD>）
<摘要>
```

### 6. 回報結果

```
✅ shiftblame:repo-reflect 完成

快照時間：<YYYY-MM-DD HH:MM>
main HEAD：<hash>
部門快照：
  SEC：<slug>（最新）
  QA：<slug>（最新）
  PRD：<slug>（最新）
  DEV：<slug>（最新）
  QC：<slug>（最新）
  MIS：<slug>（最新）
跳過（無檔案）：<部門清單或「無」>
```

## 注意事項

- 只在 **main 分支**上快照，不讀 worktree 或 feature 分支
- 只取每個部門的**最新 1 筆**，不做歷史聚合
- 不刪除、不移動、不修改任何歷史檔案
- 如果某部門目錄為空，該部門標記為「（無紀錄）」
