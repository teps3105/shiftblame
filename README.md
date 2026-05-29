<div align="center">

# shiftblame

### 推鍋

_「這不是我的鍋。」_

**AI Agents 協作開發框架 — 流程協議與定義檔**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![AI Agent Skill](https://img.shields.io/badge/AI%20Agent-skill-8a2be2.svg)]()

</div>

---

## 簡介

`shiftblame` 是一套 AI agents 流程定義框架，以純 Markdown 定義檔構建跨模型協作流程。

---

## 角色

| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 目前環境 | 協調、派工、管線、閘門、收尾（不寫入部門正式產物） |
| 執行者 | 目前環境 | result.md |
| 紅隊 | 本環境子代理 | red.md |
| 藍隊 | 本環境子代理 | blue.md |

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| 主開發環境 | 目前環境 | 本環境子代理 | 本環境子代理 |

紅隊與藍隊一律使用本環境子代理，不使用外部品牌工具或跨環境審查。

同一任務的攻防流程固定序列為：執行者寫入宣告 → 管理者向老闆確認宣告（宣告-確認-執行閘門）→ 老闆同意後執行者寫入 task.md 工作結論 → 管理者呼叫紅隊 → 紅隊攻擊 task.md 工作結論並寫出 `red.md` → 管理者呼叫藍隊 → 藍隊讀取 `task.md`、`red.md` 並寫出 `blue.md` → 執行者依紅藍回饋寫入 `result.md` → Result Check → CHECKED → BossConfirm → PASSED。紅藍隊不得並行。FAIL 時原地修復同一 NNN（不建立新 NNN，回到 task.md 重寫結論並重新走完整攻防流程）；PASS 後管理者判斷分支：推進下一部門或同部門新執行切片（新 NNN）。一個 NNN 可以多次提交。

每一輪任務開始前，管理者必須向老闆確認宣告內容，老闆同意後才能開始執行。全部門、每一輪都適用。

全流程預設老闆不懂技術，只是一個想用 AI 實現作品的人。所有確認與回報都用繁體中文描述作品效果、可操作步驟與驗證結果，不用技術術語包裝成主要內容。面向老闆的詢問語言必須使用繁體中文，不得使用英文狀態機值作為選項文字。

```
L1: 執行 → 收尾
L2: 專案計畫 → 品質保證 → 產品開發 → 工程收尾 → 驗收上線 → 收尾
```

## 功能分支

管理者在第一次進入產品開發時建立 `feat/<slug>` 功能分支，專案計畫和品質保證不使用功能分支。

- 功能分支生命週期：產品開發開始時建立 → 驗收上線通過後 merge --no-ff 到主分支 → push → 刪除
- 所有程式碼變更、README.md 更新都在功能分支上
- `.shiftblame/` 產物不受分支管理（已被 .gitignore 排除）

## 紅藍隊模式

紅藍隊派工方式固定為本環境子代理：

| 模式 | 紅隊 | 藍隊 | 說明 |
|------|------|------|------|
| `local` | 本環境子代理 | 本環境子代理 | 固定模式，依序產出紅隊與藍隊 |

## 部門

| # | 部門 | 類型 |
|:-:|:----:|:----:|
| 0 | PM | 專案計畫 |
| 1 | QA | 品質保證 |
| 2 | DEV | 產品開發 |
| 3 | QC | 驗收上線 |

| 部門 | `result.md` 內容型別 |
|:----:|:----------------------:|
| PM | 需求釐清 + 市場研究 + 產品規格 |
| QA | 安全標準 + 操作標準 + 系統規格 |
| DEV | 技術規劃 + 技術設計 + 技術實作 |
| QC | 驗收計畫 + 驗收報告 + 驗收結論 |

需求釐清/市場研究/產品規格、安全標準/操作標準/系統規格、技術規劃/技術設計/技術實作、驗收計畫/驗收報告/驗收結論皆不是額外檔名，而是各部門 `result.md` 承載的內容章節；不得建立同名 `.md` 檔作為替代產物。

詳見 `DEPT/<DEPT>/L1-L4.md`。功能開發必須先經專案計畫在 `result.md` 產出需求釐清、市場研究、產品規格，確認本輪使用者想實現的功能，並調查建立標準前需要知道的市場研究、通用方法、設計模式、CVE 或版本差異等背景。品質保證再依專案計畫結果產出安全標準、操作標準、系統規格，並承擔原專案計畫的產品規格、任務拆解與實作規劃職責。進入產品開發前，管理者必須詢問老闆想先看到品質保證結果中的哪個功能被做出來，並用中文寫明本回合實際產品開發的可見功能；產品開發必須先在 `task.md` 建立技術規劃、技術設計、技術實作的前置內容，再依此開發。

## 閘門

| 閘門 | 條件 |
|:----:|------|
| PM→QA | 宣告 → BossConfirm → 工作結論 → 紅隊 → 藍隊 → RESULT → RESULT Check → CHECKED → `BossConfirm` → PASSED |
| QA→DEV | 宣告 → BossConfirm → 工作結論 → 紅隊 → 藍隊 → RESULT → RESULT Check → CHECKED → `BossConfirm` → PASSED |
| DEV→工程收尾 | 宣告 → BossConfirm → 工作結論 → 紅隊 → 藍隊 → RESULT → RESULT Check → CHECKED → `BossConfirm` → PASSED |
| 工程收尾→驗收上線 | 管理者確認清理無殘留 → 建立驗收上線任務（邏輯驗證+部署+E2E） |
| 驗收上線→合併 | 宣告 → BossConfirm → 工作結論 → 紅隊 → 藍隊 → RESULT → RESULT Check → CHECKED → `BossConfirm` → PASSED |
| 合併→歸檔 | merge --no-ff 完成 → push 完成 → 功能分支已刪除 → 歸檔 |
| 歸檔→更新 | 管理者從 archive/ 讀取 SLUG.md 並更新 REPO.md/ROADMAP.md |
| 老闆強制停止 | 選項 A（commit 後強制收尾）/ 選項 B（全部捨棄） |

`BossConfirm` 為跨環境老闆確認機制：支援內建提問工具時使用內建提問工具；一般對話環境則在目前對話中提出明確確認問題並等待使用者回覆。

DEV 期間另有 `BossPreview`：老闆可多次要求觀看目前作品、驗證結果或下一個想調整的效果；管理者提供 URL/指令/截圖/操作證據與中文摘要。`BossPreview` 不取代正式 `BossConfirm`，也不代表 DEV 閘門通過。

任務發布前管理者必須向老闆確認宣告內容（宣告-確認-執行閘門），老闆同意後才可繼續。每一輪、全部門都適用。

## 收尾檢查

收尾前必須確認下列項目，不符合則 FAIL 原地重做（驗收上線不修改程式碼）：

- 無殭屍程序、背景 dev server、測試服務或未關閉的 watcher。
- 無開發殘留檔案進入主分支，例如 scratch、demo、prototype、debug output、臨時設定。
- 無測試文件或測試產物進入主分支，除非它們是正式測試資產。
- 無多餘 build artifact、coverage report、log、cache、截圖、錄影、下載檔。
- `.shiftblame/`、本地私密設定不納入版本控制。
- 開發中的筆記、臨時待辦、預覽回饋與退回原因只維護於 `.shiftblame/<slug>/SLUG.md`。
- `.shiftblame/ROADMAP.md` 只在歸檔後更新為穩定產品路線圖：記錄實際完成結果與後續候選，不得當成工作日誌。
- README.md 已在開發任務中更新並通過紅藍隊審查。
- 驗收上線閘門通過後，slug 通訊文件夾直接搬移至 `.shiftblame/archive/`。

---

## 檔案結構

```
skills/shiftblame/
├── SKILL.md          # 框架入口
├── GATE.md           # 狀態機閘門定義
├── MANAGER.md        # 管理者定義
├── STAFF.md          # 員工呼叫規格
└── DEPT/
    ├── PM/
    │   ├── L1.md     # 專案計畫執行者工作結論
    │   ├── L2.md     # 專案計畫紅隊
    │   ├── L3.md     # 專案計畫藍隊
    │   └── L4.md     # 專案計畫執行者結果產出
    ├── QA/
    │   ├── L1.md     # 品質保證執行者工作結論
    │   ├── L2.md     # 品質保證紅隊
    │   ├── L3.md     # 品質保證藍隊
    │   └── L4.md     # 品質保證執行者結果產出
    ├── DEV/
    │   ├── L1.md     # 產品開發執行者工作結論
    │   ├── L2.md     # 產品開發紅隊
    │   ├── L3.md     # 產品開發藍隊
    │   └── L4.md     # 產品開發執行者結果產出
    └── QC/
        ├── L1.md     # 驗收上線執行者工作結論
        ├── L2.md     # 驗收上線紅隊
        ├── L3.md     # 驗收上線藍隊
        └── L4.md     # 驗收上線執行者結果產出
```

## 文件結構

```
.shiftblame/
├── REPO.md               # 專案現狀（本地私密）
├── ROADMAP.md            # 穩定產品路線圖（本地私密，僅歸檔後更新）
├── archive/              # 歷史紀錄（已完成任務）
└── <slug>/
    ├── SLUG.md           # 本輪開發筆記（開發中唯一工作日誌）
    └── <DEPT>/<NNN>/
        ├── task.md
        ├── result.md    # 執行者，依部門承載三段式文件章節
        ├── red.md       # 紅隊
        └── blue.md      # 藍隊
```

---

## 安裝

主開發環境使用 skills symlink 安裝：將本 repo 的 `skills/shiftblame` 連結到各 AI 環境的 skills 目錄。

**Claude**：

```bash
# Claude 使用 skills/ 目錄
mkdir -p ~/.claude/skills
ln -s ~/shiftblame/skills/shiftblame ~/.claude/skills/shiftblame
```

Windows PowerShell 可用 junction，不需要系統管理員權限：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
cmd /c mklink /J "%USERPROFILE%\.claude\skills\shiftblame" "D:\shiftblame\skills\shiftblame"
```

**Codex**：

```bash
# Codex 使用 skills/ 目錄
mkdir -p ~/.codex/skills
ln -s ~/shiftblame/skills/shiftblame ~/.codex/skills/shiftblame
```

Windows PowerShell 可用 junction，不需要系統管理員權限：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.codex\skills" | Out-Null
cmd /c mklink /J "%USERPROFILE%\.codex\skills\shiftblame" "D:\shiftblame\skills\shiftblame"
```

也可以直接複製到專案目錄內，讓該專案自行攜帶技能設定：

```bash
# 在目標專案根目錄執行
mkdir -p .claude/skills .codex/skills
cp -R ~/shiftblame/skills/shiftblame .claude/skills/shiftblame
cp -R ~/shiftblame/skills/shiftblame .codex/skills/shiftblame
```

Windows PowerShell：

```powershell
# 在目標專案根目錄執行
New-Item -ItemType Directory -Force .claude\skills, .codex\skills | Out-Null
Copy-Item -Recurse -Force D:\shiftblame\skills\shiftblame .claude\skills\shiftblame
Copy-Item -Recurse -Force D:\shiftblame\skills\shiftblame .codex\skills\shiftblame
```

安裝後，管理者依 `GATE.md` 全域入口安裝段落在主開發環境的全域入口檔寫入 managed block。重啟對應環境讓新技能被載入。

## Windows 編碼

本技能與 `.shiftblame/` 產物皆以 UTF-8 Markdown 儲存。Windows PowerShell 讀取含中文檔案時必須明確指定 UTF-8，例如：

```powershell
Get-Content -Encoding UTF8 .\skills\shiftblame\SKILL.md
Get-Content -Encoding UTF8 .\.shiftblame\<slug>\<DEPT>\<NNN>\task.md
```

不要在 Windows PowerShell 使用未指定 `-Encoding UTF8` 的 `Get-Content`、`type` 或 `cat` 讀取含中文 Markdown；部分環境會依系統預設編碼解讀，導致繁體中文亂碼。

## 自訂

本專案不接受外部貢獻。如需微調，請 fork 後調整。

## 授權

[MIT](./LICENSE)
