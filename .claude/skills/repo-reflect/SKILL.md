---
name: repo-reflect
description: >-
  聚合各 repo 的部門文件（STM），將舊紀錄合併至 REPO.md，每部門保留最新 N 筆。
  Use this skill when: the user says "聚合文件", "文件聚合", "repo-reflect", "/repo-reflect".
---

# shiftblame:repo-reflect — 文件聚合

掃描 `~/.shiftblame/` 下各 repo 的部門目錄，將歷史 STM（Short-Term Memory）文件聚合至 `REPO.md`，每個部門只保留最新 N 筆。

## 聚合邏輯

對每個 `~/.shiftblame/<repo>/` 下的部門目錄（PRD/ARC/QA/DEV/QC/SEC/MIS 等）：

1. Glob 部門目錄下所有 `*.md` 檔案（不含 REPO.md）
2. 按修改時間排序（舊 → 新）
3. 保留最新 N 筆（預設 N=3），其餘聚合至 `REPO.md`
4. 聚合時將檔案內容附加到 `REPO.md` 對應部門的章節
5. 被聚合的原檔保留不刪（供追溯）
6. 即使少於 N 筆仍聚合（確保 REPO.md 有完整紀錄）

## REPO.md 格式

```markdown
# <repo> 紀錄

## PRD
### <slug> · <YYYY-MM-DD>
<原始檔案內容>
---

## ARC
### <slug> · <YYYY-MM-DD>
<原始檔案內容>
---

## QA
...
```

每個部門章節內按時間排序（舊 → 新）。

## 執行步驟

### 1. 掃描所有 repo

```bash
ls -d ~/.shiftblame/*/
```

排除 `blame/`（鍋紀錄，由 blame-reflect 處理）。

### 2. 對每個 repo

```bash
# 找出所有部門目錄
ls -d ~/.shiftblame/<repo>/*/
```

排除 `REPO.md`（目標檔案）。

### 3. 對每個部門目錄

```bash
# 按修改時間排序
ls -t ~/.shiftblame/<repo>/<DEPT>/*.md
```

- 保留最新 N 筆（預設 N=3）
- 其餘檔案讀取內容，準備聚合

### 4. 寫入 REPO.md

- 讀取現有 REPO.md（若存在）
- 依部門章節整理聚合內容
- 同一部門內按時間排序
- Write 回 REPO.md

### 5. 回報結果

```
✅ shiftblame:repo-reflect 完成

已處理 X 個 repo：
- dnd-prototype：聚合 Y 筆至 REPO.md（保留 Z 筆 STM）
  - PRD：聚合 N 筆、保留 M 筆
  - QA：聚合 N 筆、保留 M 筆
  - ...
- shiftblame：聚合 Y 筆至 REPO.md（保留 Z 筆 STM）
  - ...
跳過（無文件）：W 個部門
```

## 參數

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `--keep` | 3 | 每部門保留的最新筆數 |
| `--repo` | 全部 | 指定處理的 repo（預設處理全部） |
| `--dept` | 全部 | 指定處理的部門（預設處理全部） |
| `--dry-run` | false | 只顯示將聚合的檔案清單，不實際寫入 |

## 注意事項

- 只處理 `~/.shiftblame/` 下的 repo 目錄
- 不處理 `blame/` 目錄（由 blame-reflect 負責）
- 被聚合的原檔保留不刪，確保可追溯
- REPO.md 可能隨時間增長很大，未來可考慮分年月歸檔
- 如果 REPO.md 不存在，自動建立
