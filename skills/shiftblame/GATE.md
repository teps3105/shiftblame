# shiftblame — 狀態機閘門

統一閘門檢查定義。管理者在每次狀態轉移前，依下表驗證必要條件；不通過則中止並報告缺件。

## 狀態與轉移

```
UNINIT ──G0──→ READY ──G1──→ TASK ──result──→ RESULT ──red──→ RED ──blue──→ GATE ──confirm──→ PASSED ──next/archive──→ READY/ARCHIVED
```

| 狀態 | 意義 | 必要檔案 |
|------|------|----------|
| UNINIT | 尚未初始化 | 無 |
| READY | 可開始任務 | `.shiftblame/REPO.md` |
| TASK | 任務已建立 | `<slug>/<DEPT>/<NNN>/task.md` |
| RESULT | 執行者產出完成，等待紅隊 | `result.md` |
| RED | 紅隊產出完成，等待藍隊 | `result.md` + `red.md` |
| GATE | 三方產出齊全，待老闆確認 | `result.md` + `red.md` + `blue.md` |
| PASSED | 老闆確認通過 | — |
| ARCHIVED | 已歸檔 | （已搬移至 `archive/`） |

## 閘門定義

### BossConfirm — 老闆確認

`BossConfirm` 是跨主開發環境的老闆確認機制：

| 目前環境 | 確認方式 |
|----------|----------|
| Claude Code | `AskUserQuestion` |
| Codex CLI | 在目前對話中提出明確確認問題，等待使用者回覆後再繼續 |

凡文件寫 `BossConfirm`，皆代表必須等待老闆明確回覆通過、退回或調整方向；不得自行假設通過。

### PublishConfirm — 任務發布前確認

重新發布任務前，若符合下列任一觸發閘門，管理者必須先說明「接下來要做什麼、為什麼要這樣做、將建立哪個 `<DEPT>/<NNN>` 任務」，並經 `BossConfirm` 後才可繼續：

| 觸發閘門 | 需要說明與 BossConfirm |
|----------|------------------------|
| 同部門任務起始閘門 | 需要 |
| 進入下游部門閘門 | 需要 |
| 退回上游部門閘門 | 需要 |
| 同部門迭代（同部門 `NNN + 1` 修正） | 不需要 |

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

**時機**：派工給子代理或 Gemini CLI 前。

**檢查**：目標目錄 `<slug>/<DEPT>/<NNN>/task.md` 是否存在。

**工作區模式**：建立新 slug 的第一個 task.md 時，管理者以 `BossConfirm` 詢問老闆選擇工作區模式：

| 模式 | 說明 |
|------|------|
| `worktree` | 建立 git worktree，所有產物寫入 `<slug>/worktree/`（預設） |
| `direct` | 直接在主 repo 切分支開發，不額外建工作樹 |

**紅藍隊模式**：同時詢問紅藍隊派工方式：

| 模式 | 紅隊 | 藍隊 |
|------|------|------|
| `gemini` | Gemini CLI | Gemini CLI（預設，依序分兩次呼叫） |
| `solo` | 本環境子代理 | 本環境子代理 |

選定後寫入 task.md 的 `workspace` 與 `review` 欄位，同一 slug 後續任務沿用相同模式。

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
review: gemini | solo
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

**時機**：向老闆 `BossConfirm` 確認前。

**順序**：同一任務必須嚴格序列執行，不得並行紅藍隊：

1. 管理者或執行者完成 `result.md`。
2. `result.md` 存在且格式有效後，才呼叫紅隊產出 `red.md`。
3. `red.md` 存在且格式有效後，才呼叫藍隊產出 `blue.md`；藍隊必須讀取 `task.md`、`result.md`、`red.md` 後寫出攻防對照報告。
4. `result.md`、`red.md`、`blue.md` 三檔皆存在且格式有效後，才進入 GATE 並詢問老闆。

**檢查**：目前任務目錄下 `result.md`、`red.md`、`blue.md` 是否皆存在，且每檔皆含 YAML frontmatter 與繁體中文內容。

| 情境 | 動作 |
|------|------|
| 三檔皆存在 | 通過，可詢問老闆 |
| 缺 `result.md` | BLOCK：先完成執行者產出，不得呼叫紅隊或藍隊 |
| 缺 `red.md` | BLOCK：先呼叫紅隊，不得呼叫藍隊 |
| 缺 `blue.md` | BLOCK：先呼叫藍隊 |
| 檔案為空、無 YAML frontmatter、或格式無效 | BLOCK：重派對應員工，不得跳過該輪 |

### G3 — 歸檔

**時機**：QC 閘門通過並收尾後。

**動作**：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`

| 情境 | 動作 |
|------|------|
| 歸檔目錄已有同名 slug | 附加時間戳：`<slug>_<YYYYMMDDTHHMMSS>` |
| git worktree 分支仍存在 | 僅 worktree 模式：警告但允許繼續歸檔；direct 模式不適用 |

## 管理者職責

管理者依上述閘門在每次狀態轉移前執行檢查。檢查方式：

- **讀取（Linux/macOS/Git Bash）**：`cat`、`sed -n`
- **讀取（Windows PowerShell）**：`Get-Content -Encoding UTF8`
- **檢查/列檔**：`test -f`、`find`、`ls`、`Test-Path`、`Get-ChildItem`
- **寫入**：shell heredoc、CLI 檔案寫入工具
- **禁止**：使用 `read_file` 或內建檔案讀取器讀取 `.shiftblame/` 內檔案
- **禁止**：在 Windows PowerShell 以未指定 `-Encoding UTF8` 的 `Get-Content`、`type`、`cat` 讀取含中文的 Markdown 檔案

所有檔案路徑以 `.shiftblame/` 為根，相對於 repo root。

## 全域入口安裝

安裝 shiftblame 技能後，在主開發 CLI 的全域入口檔寫入 managed block：

| CLI | 檔案 | 標記 |
|-----|------|------|
| Codex | `~/.codex/AGENTS.md` | `<!-- BEGIN shiftblame:codex-entry -->` |
| Claude Code | `~/.claude/CLAUDE.md` | `<!-- BEGIN shiftblame:claude-entry -->` |

每個 block 包含：觸發關鍵字、技能入口路徑、角色映射表、讀取規則（Windows PowerShell 讀取技能與 `.shiftblame/` Markdown 時必須使用 `Get-Content -Encoding UTF8`）。以 `<!-- BEGIN/END shiftblame:<label> -->` 標記，更新時只替換標記內容，不動其他區段。
