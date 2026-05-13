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
| 管理者 | 目前環境 | 協調、派工、管線、閘門、收尾 |
| 執行者 | 目前環境 | result.md |
| 紅隊 | 本環境子代理 | red.md |
| 藍隊 | 本環境子代理 | blue.md |

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| 主開發環境 | 目前環境 | 本環境子代理 | 本環境子代理 |

紅隊與藍隊一律使用本環境子代理，不使用外部品牌工具或跨環境審查。

同一任務的攻防流程固定序列為：執行者完成 `result.md` → 管理者呼叫紅隊 → 紅隊寫出 `red.md` → 管理者呼叫藍隊 → 藍隊讀取 `task.md`、`result.md`、`red.md` 並寫出 `blue.md` → 閘門確認。紅藍隊不得並行；每次退回都建立下一輪 `NNN + 1`，重新從 `result.md` 開始，直到閘門收斂通過。

全流程預設老闆不懂技術，只是一個想用 AI 實現作品的人。所有確認與回報都用繁體中文描述作品效果、可操作步驟與驗證結果，不用技術術語包裝成主要內容。

```
L1: 執行 → 收尾
L2: RES → QA → PRD → DEV → QC → 產品現況確認 → 收尾
```

## 工作區模式

建立任務時選擇工作區模式：

| 模式 | 說明 |
|------|------|
| `direct` | 直接在主 repo 切分支開發，不額外建工作樹（預設） |
| `worktree` | 建立獨立 git worktree，產物寫入 `<slug>/worktree/` |

兩種模式皆會建立功能分支，差異僅在是否有獨立工作目錄。

## 紅藍隊模式

紅藍隊派工方式固定為本環境子代理：

| 模式 | 紅隊 | 藍隊 | 說明 |
|------|------|------|------|
| `local` | 本環境子代理 | 本環境子代理 | 固定模式，依序產出紅隊與藍隊 |

## 部門

| # | 部門 | 類型 |
|:-:|:----:|:----:|
| 0 | RES | 研究 |
| 1 | QA | 品保 |
| 2 | PRD | 產品 |
| 3 | DEV | 開發 |
| 4 | QC | 品管 |

詳見 `DEPT/*.md`。功能開發必須先經 RES 完成研究，確認本輪使用者想實現的功能，並調查建立標準前需要知道的市場研究、通用方法、設計模式、CVE 或版本差異等背景；QA 再依 RES 結果定義驗收與介面標準，PRD 依 QA 標準產出產品與實作規格。市場調查不得延後到 PRD 才開始。進入 DEV 前，管理者必須詢問老闆想先看到 PRD 中哪個功能被做出來，並用中文寫明本回合實際開發的可見功能。

## 閘門

| 閘門 | 條件 |
|:----:|------|
| RES→QA | result → red → blue → `BossConfirm` 老闆確認，QA 退回 → RES 新 NNN |
| QA→PRD | result → red → blue → `BossConfirm` 老闆確認，PRD 退回 → 上游新 NNN |
| PRD→DEV | result → red → blue → `BossConfirm` 老闆確認，DEV 退回 → 上游新 NNN |
| DEV→QC | result → red → blue → `BossConfirm` 老闆確認，QC 退回 → 上游新 NNN |
| QC→收尾 | 實際啟動產品，提供 URL/指令/截圖或操作證據 → `BossConfirm` 老闆確認現況，未通過 → 退回 DEV 或 QC 新 NNN；通過 → 收尾後自動歸檔 slug |

`BossConfirm` 為跨環境老闆確認機制：支援內建提問工具時使用內建提問工具；一般對話環境則在目前對話中提出明確確認問題並等待使用者回覆。

DEV 期間另有 `BossPreview`：老闆可多次要求觀看目前作品、驗證結果或下一個想調整的效果；管理者提供 URL/指令/截圖/操作證據與中文摘要。`BossPreview` 不取代正式 `BossConfirm`，也不代表 DEV 閘門通過。

任務發布前若為同部門任務起始、進入下游部門或退回上游部門，管理者必須先說明接下來要做什麼，經 `BossConfirm` 後才可繼續；同部門 `NNN + 1` 迭代不需說明。

## 收尾檢查

收尾前必須確認下列項目，不符合則退回 DEV 或 QC 新 NNN：

- 無殭屍程序、背景 dev server、測試服務或未關閉的 watcher。
- 無開發殘留檔案進入主分支，例如 scratch、demo、prototype、debug output、臨時設定。
- 無測試文件或測試產物進入主分支，除非它們是正式測試資產。
- 無多餘 build artifact、coverage report、log、cache、截圖、錄影、下載檔。
- `.shiftblame/`、worktree 專用產物、本地私密設定不納入版本控制。
- 待辦事項與未來開發路線圖只維護於 `.shiftblame/ROADMAP.md`，且只記錄本輪使用者要求衍生出的完成項、未完成事項與後續候選；不得建立 `docs/` 或其他會推送到遠端的計畫文件。
- README.md 與 REPO.md 已反映最終現況。
- QC→收尾確認通過後，slug 通訊文件夾直接搬移至 `.shiftblame/archive/`。

---

## 檔案結構

```
skills/shiftblame/
├── SKILL.md          # 框架入口
├── GATE.md           # 狀態機閘門定義
├── MANAGER.md        # 管理者定義（≤50 行）
├── STAFF.md          # 員工呼叫規格
└── DEPT/
    ├── RES.md        # 研究部門
    ├── QA.md         # 品保部門
    ├── PRD.md        # 產品部門
    ├── DEV.md        # 開發部門
    └── QC.md         # 品管部門
```

## 文件結構

```
.shiftblame/
├── REPO.md               # 專案現狀（本地私密）
├── ROADMAP.md            # 待辦事項與未來開發路線圖（本地私密）
└── <slug>/<DEPT>/<NNN>/
    ├── task.md
    ├── result.md        # 執行者
    ├── red.md          # 紅隊
    └── blue.md         # 藍隊
```

---

## 安裝

主開發環境使用 skills symlink 安裝：將本 repo 的 `skills/shiftblame` 連結到主開發環境的 skills 目錄。

```bash
# 範例：將技能連結到主開發環境的 skills 目錄
mkdir -p ~/.local/share/agent-skills
ln -s ~/shiftblame/skills/shiftblame ~/.local/share/agent-skills/shiftblame

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
