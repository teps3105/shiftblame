# shiftblame — 狀態機閘門

統一閘門檢查定義。管理者在每次狀態轉移前，依下表驗證必要條件；不通過則中止並報告缺件。

## 狀態與轉移

```
UNINIT ──G0──→ READY ──G1──→ TASK ──dispatch──→ EXECUTING ──G2──→ GATE ──confirm──→ PASSED ──G3──→ ARCHIVED
```

| 狀態 | 意義 | 必要檔案 |
|------|------|----------|
| UNINIT | 尚未初始化 | 無 |
| READY | 可開始任務 | `.shiftblame/REPO.md` |
| TASK | 任務已建立 | `<slug>/<DEPT>/<NNN>/task.md` |
| EXECUTING | 子代理執行中 | — |
| GATE | 三方產出齊全，待老闆確認 | `result.md` + `red.md` + `blue.md` |
| PASSED | 老闆確認通過 | — |
| ARCHIVED | 已歸檔 | （已搬移至 `archive/`） |

## 閘門定義

### G0 — 初始化

**時機**：觸發 shiftblame 技能時。

**檢查**：`.shiftblame/REPO.md` 是否存在。

| 情境 | 動作 |
|------|------|
| `.shiftblame/` + `REPO.md` 皆存在 | 通過 |
| `.shiftblame/` 存在但無 `REPO.md` | BLOCK：手動建立 REPO.md |
| 位於 git repo，無 `.shiftblame/` | 自動建立 `.shiftblame/` + `REPO.md` 模板 |
| 空目錄（無檔案） | 先 `git init`，再自動建立 |
| 非 git repo 且非空 | BLOCK：請先執行 `git init` |

REPO.md 模板：

```markdown
# REPO — 專案現狀

> 本地私密，不納入版本控制

## 概述


## 技術棧


## 已知問題

```

### G1 — 派工

**時機**：派工給子代理或外部 CLI 前。

**檢查**：目標目錄 `<slug>/<DEPT>/<NNN>/task.md` 是否存在。

**工作區模式**：建立新 slug 的第一個 task.md 時，管理者以 `AskUserQuestion` 詢問老闆選擇工作區模式：

| 模式 | 說明 |
|------|------|
| `worktree` | 建立 git worktree，所有產物寫入 `<slug>/worktree/`（預設） |
| `direct` | 直接在主 repo 切分支開發，不額外建工作樹 |

選定後寫入 task.md 的 `workspace` 欄位，同一 slug 後續任務沿用相同模式。

| 情境 | 動作 |
|------|------|
| `task.md` 存在 | 通過 |
| 目錄存在但無 `task.md` | BLOCK：先建立 task.md（見下方模板） |
| 無對應目錄 | BLOCK：先建立目錄結構與 task.md |

task.md 模板：

```markdown
---
slug: <slug>
dept: <DEPT>
task: <NNN>
version: 0.1.0
status: pending
workspace: worktree | direct
created: <ISO timestamp>
---

# 目標


# 上游輸入


# 約束

```

建立規則：
- `NNN` 為三位數零填充（001, 002, …），省略時自動遞增。
- 已存在 `task.md` 時不覆寫。

### G2 — 閘門審查

**時機**：向老闆 `AskUserQuestion` 確認前。

**檢查**：目前任務目錄下 `result.md`、`red.md`、`blue.md` 是否皆存在。

| 情境 | 動作 |
|------|------|
| 三檔皆存在 | 通過，可詢問老闆 |
| 有缺件 | BLOCK：列出缺少檔案，等待對應員工完成 |

### G3 — 歸檔

**時機**：QC 閘門通過並收尾後。

**動作**：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`

| 情境 | 動作 |
|------|------|
| 歸檔目錄已有同名 slug | 附加時間戳：`<slug>_<YYYYMMDDTHHMMSS>` |
| git worktree 分支仍存在 | 僅 worktree 模式：警告但允許繼續歸檔；direct 模式不適用 |

## 管理者職責

管理者依上述閘門在每次狀態轉移前執行檢查。檢查方式：

- **讀取**：`cat`、`test -f`、`find`、`ls`
- **寫入**：shell heredoc、CLI 檔案寫入工具
- **禁止**：使用 `read_file` 或內建檔案讀取器讀取 `.shiftblame/` 內檔案

所有檔案路徑以 `.shiftblame/` 為根，相對於 repo root。

## 全域入口安裝

安裝 shiftblame 技能後，在各 CLI 的全域入口檔寫入 managed block：

| CLI | 檔案 | 標記 |
|-----|------|------|
| Codex | `~/.codex/AGENTS.md` | `<!-- BEGIN shiftblame:codex-entry -->` |
| Claude | `~/.claude/CLAUDE.md` | `<!-- BEGIN shiftblame:claude-entry -->` |
| Gemini | `~/.gemini/GEMINI.md` | `<!-- BEGIN shiftblame:gemini-entry -->` |

每個 block 包含：觸發關鍵字、技能入口路徑、角色映射表。以 `<!-- BEGIN/END shiftblame:<label> -->` 標記，更新時只替換標記內容，不動其他區段。
