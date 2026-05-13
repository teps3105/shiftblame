# shiftblame — 狀態機閘門

統一閘門檢查定義。管理者在每次狀態轉移前，依下表驗證必要條件；不通過則中止並報告缺件。

## 狀態與轉移

```
UNINIT ──G0──→ READY ──G1──→ TASK ──result──→ RESULT ──red──→ RED ──blue──→ GATE ──confirm──→ PASSED ──next/archive──→ READY/ARCHIVED
```

| 狀態 | 意義 | 必要檔案 |
|------|------|----------|
| UNINIT | 尚未初始化 | 無 |
| READY | 可開始任務 | `.shiftblame/REPO.md` + `.shiftblame/ROADMAP.md` |
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
| 支援內建提問工具 | 使用內建提問工具 |
| 一般對話環境 | 在目前對話中提出明確確認問題，等待使用者回覆後再繼續 |

凡文件寫 `BossConfirm`，皆代表必須等待老闆明確回覆通過、退回或調整方向；不得自行假設通過。

對老闆發出的確認問題必須預設對方不懂技術：使用繁體中文描述作品效果、可見變化與驗證結果，不得以技術術語作為主要確認內容。

### BossPreview — DEV 即時預覽

`BossPreview` 是 DEV 期間的即時觀看與調整機制，不是正式閘門，不取代 `BossConfirm`。老闆可在 DEV 中多次要求觀看目前作品、驗證結果或下一個想調整的效果。管理者必須用中文提供可操作 URL/指令/截圖/畫面結果，並用一句話說明「目前作品已經能做到什麼」。若老闆提出下一個請求，管理者先用非技術語言確認「本回合要做出的可見功能」，再繼續 DEV。

### PublishConfirm — 任務發布前確認

重新發布任務前，若符合下列任一觸發閘門，管理者必須先說明「接下來要做什麼、為什麼要這樣做、將建立哪個 `<DEPT>/<NNN>` 任務」，並經 `BossConfirm` 後才可繼續：

| 觸發閘門 | 需要說明與 BossConfirm |
|----------|------------------------|
| 同部門任務起始閘門 | 需要 |
| 進入下游部門閘門 | 需要 |
| 退回上游部門閘門 | 需要 |
| 同部門迭代（同部門 `NNN + 1` 修正） | 不需要 |

建立 QA 任務前另有 RES 前置條件：RES 必須已通過閘門，且 QA task.md 的「上游輸入」必須引用或摘要 RES result.md / red.md / blue.md 的結論。未完成 RES 不得建立 QA task.md。

建立 DEV 任務前另有選擇前置條件：管理者必須先詢問老闆想先完成 PRD 中哪個可見功能，並以作品效果列出候選項。老闆選定後才能建立 DEV task.md；task.md 不得只寫技術工作，必須明確寫出本回合要讓作品實際增加或改善的功能。

### G0 — 初始化

**時機**：觸發 shiftblame 技能時。

**檢查**：`.shiftblame/REPO.md` 與 `.shiftblame/ROADMAP.md` 是否存在。

| 情境 | 動作 |
|------|------|
| `.shiftblame/` + `REPO.md` + `ROADMAP.md` 皆存在 | 通過 |
| `.shiftblame/` 存在但缺 `REPO.md` 或 `ROADMAP.md` | BLOCK：手動補齊缺少的本地私密文件 |
| 位於 git repo，無 `.shiftblame/` | 自動建立 `.shiftblame/` + `REPO.md` + `ROADMAP.md` 模板 |
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

ROADMAP.md 模板：

```markdown
# ROADMAP — 待辦事項與未來開發路線圖

> 本地私密，不納入版本控制；不得改以 docs/ 或其他會推送到遠端的文件維護。

## 原則

- 所有待辦事項、未來功能、開發順序與長期規劃只維護於本檔。
- ROADMAP 只記錄本輪使用者要求衍生出的待辦、完成項與後續候選。
- 不得把 ROADMAP 內容當成本輪必做功能來源；本輪範圍永遠以使用者本輪明確想實現的功能為準。
- 遠端倉庫只保留正式文件與已完成現況，不推送開發計畫。

## 本輪待辦


## 後續候選


## 已完成

```

### G1 — 派工

**時機**：派工給子代理前。

**檢查**：目標目錄 `<slug>/<DEPT>/<NNN>/task.md` 是否存在。

**QA 前置 RES**：若目標部門為 QA，管理者必須先確認同 slug 的 RES 已通過，並把 RES 結論寫入 `task.md` 的「上游輸入」。RES 結論至少包含：

- 本輪使用者想實現的功能。
- 現有 repo、REPO.md、ROADMAP.md 中與本輪相關的背景。
- 本輪範圍與非本輪事項。
- ROADMAP 中可參考但不得自動納入本輪的項目。
- 建立 QA 標準前需要採納或排除的市場研究、通用方法、設計模式、CVE 或版本差異。

**DEV 前置選擇**：若目標部門為 DEV，管理者必須先取得老闆選擇的 PRD 功能，並把「本回合實際開發的可見功能」寫入 `task.md` 的「目標」。描述必須是老闆看得懂的作品效果，例如「讓使用者可以新增一張卡片並立刻在畫面上看到」，不得只寫「實作資料模型」或「串接 API」。

**工作區模式**：建立新 slug 的第一個 task.md 時，管理者以 `BossConfirm` 詢問老闆選擇工作區模式；若老闆沒有特別指定，預設使用 `direct`。

| 模式 | 說明 |
|------|------|
| `direct` | 直接在主 repo 切分支開發，不額外建工作樹（預設） |
| `worktree` | 建立 git worktree，所有產物寫入 `<slug>/worktree/` |

**紅藍隊模式**：固定使用本環境子代理。建立 task.md 時將 `review` 寫為 `local`，同一 slug 後續任務沿用此值。

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
workspace: direct | worktree
review: local
created: <ISO timestamp>
---

# 目標

## 本回合實際開發的可見功能（DEV 任務必填）


# 上游輸入

## RES 結論（QA 任務必填）


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

歸檔前必須更新 `.shiftblame/ROADMAP.md`：只依本輪使用者要求與實際完成結果移除或標記已完成待辦，補上本輪發現但未做的後續候選；不得把既有 ROADMAP 規劃重寫成本輪已實現或本輪必做內容。禁止把待辦事項或未來路線圖寫入 `docs/`、README 的未來計畫章節，或其他會推送到遠端的文件。

## 管理者職責

管理者依上述閘門在每次狀態轉移前執行檢查。檢查方式：

- **讀取（Linux/macOS/Git Bash）**：`cat`、`sed -n`
- **讀取（Windows PowerShell）**：`Get-Content -Encoding UTF8`
- **檢查/列檔**：`test -f`、`find`、`ls`、`Test-Path`、`Get-ChildItem`
- **寫入**：shell heredoc、目前環境檔案寫入工具
- **禁止**：使用 `read_file` 或內建檔案讀取器讀取 `.shiftblame/` 內檔案
- **禁止**：在 Windows PowerShell 以未指定 `-Encoding UTF8` 的 `Get-Content`、`type`、`cat` 讀取含中文的 Markdown 檔案

所有檔案路徑以 `.shiftblame/` 為根，相對於 repo root。

## 全域入口安裝

安裝 shiftblame 技能後，在主開發環境的全域入口檔寫入 managed block。

每個 block 包含：觸發關鍵字、技能入口路徑、角色映射表、讀取規則（Windows PowerShell 讀取技能與 `.shiftblame/` Markdown 時必須使用 `Get-Content -Encoding UTF8`）。以 `<!-- BEGIN/END shiftblame:<label> -->` 標記，更新時只替換標記內容，不動其他區段。
