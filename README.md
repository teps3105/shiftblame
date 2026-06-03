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

`shiftblame` 是一套 AI agents 協作框架（Observable Workflow System, OWS），以純 Markdown 定義檔構建跨模型協作流程。定義管理者、執行者、紅隊、藍隊四個角色，以及 PM→DEV 兩角色的閘門管線。

---

## 角色

| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 目前環境 | 協調、派工、管線、閘門、收尾、CONCLUSION.md（不寫入其他部門正式產物） |
| 執行者 | 本環境子代理 | RESULT.md |
| 紅隊 | 本環境子代理 | RED.md |
| 藍隊 | 本環境子代理 | BLUE.md |

紅隊與藍隊一律使用本環境子代理，不使用外部品牌工具或跨環境審查。

## 五階段流程

同一任務的攻防流程固定序列：

1. **L1 宣告** — 管理者協調建立 TASK.md，向老闆確認（BossConfirm）
2. **L2 產出** — 執行者寫入 RESULT.md，向老闆確認（BossConfirm）
3. **L3 紅隊** — 紅隊攻擊 RESULT.md 並寫入 RED.md，向老闆確認（BossConfirm）
4. **L4 藍隊** — 藍隊防禦並寫入 BLUE.md，向老闆確認（BossConfirm）
5. **L5 結論** — 管理者寫入 CONCLUSION.md → Result Check（五檔齊全）→ BossConfirm → PASSED

紅藍隊不得並行；藍隊不得在 RED.md 完成前啟動。

### FAIL 狀態機

- L1~L5 BossConfirm FAIL 一律退回 DECLARED 重新宣告，不分模式
- AUTO 模式全閘門 BossConfirm 自動通過
- FAIL 修改不刪除檔案，宣告段落鎖定不變

## 模式

| 模式 | 分支 | 目錄結構 | 管線 | BossConfirm | 適用情境 |
|------|------|----------|------|:-----------:|----------|
| DOC | `main` | `<slug>/<NNN>/` | PM only | Manual | 規劃、制定規則、整理專案文件（僅修改 .shiftblame/） |
| FEATURE | `feat/<slug>` | `<slug>/<ROLE>/<NNN>/` | PM→DEV | Manual | 功能開發（預設新功能）、快速迭代、原型驗證 |
| AUTO | `feat/<slug>` | `<slug>/<ROLE>/<NNN>/` | PM→DEV | Auto | 快速迭代（需 RAPID.md，等同 FEATURE 但全自動 + worktree 隔離） |
| MAIN | `main` | `<slug>/<NNN>/` | DEV only | Manual | 緊急修復、配置變更、單一角色操作 |

DOC 為規劃模式，僅限修改 `.shiftblame/` 內的文件。MAIN 為 DEV-only 主分支操作模式。FEATURE 為預設新功能模式，未指定模式時自動選用。AUTO 等同 FEATURE 但全閘門 BossConfirm 自動通過，使用 worktree 隔離，僅在存在 `.shiftblame/RAPID.md` 時可用。FEATURE 在主工作目錄內開 `feat/<slug>` 分支（不開 worktree）。AUTO 使用 `.worktrees/<slug>` worktree 隔離功能分支。DOC 和 MAIN 直接在 main 分支工作，不建立功能分支。

## PM 與 DEV

| 角色 | 職責 |
|------|------|
| PM（專案計畫） | 需求研究、產品規格、品質定義、測試標準、驗收條件、前端設計（依 Open-design 環境操作） |
| DEV（產品開發） | 技術實作、自行驗收、功能驗證、邊界測試 |

PM 和 DEV 各自跑完整 L1→L5。下游讀取上游已 PASSED 的 CONCLUSION.md。RESULT.md 為目標導向產出（不限固定段式格式）。

## 宣告-確認-執行閘門

每一輪任務開始前，管理者必須向老闆確認宣告內容，老闆同意後才能執行。全部門、每一輪都適用。

## 面向老闆互動

全流程預設老闆不懂技術。所有確認與回報使用繁體中文、作品效果、可操作步驟與驗證結果，不用技術術語。狀態機值全部大寫（YAML、狀態描述）。面向老闆的選項文字使用中文（「同意」「不同意」「調整」），不得使用英文狀態機值。

`BossPreview`：老闆可多次要求觀看目前作品，管理者提供 URL/指令/截圖/操作證據與中文摘要。不取代正式 BossConfirm。

## 功能分支（FEATURE/AUTO 模式）

管理者在第一次進入 DEV 前建立 `feat/<slug>` 功能分支：

- **FEATURE**：`git checkout -b feat/<slug>`（主工作目錄內，不開 worktree）
- **AUTO**：`git worktree add .worktrees/<slug> -b feat/<slug>`（獨立 worktree）

功能分支生命週期：DEV 開始時建立 → PM/DEV 皆 PASSED 後 merge --no-ff → push → branch delete（AUTO 額外 worktree remove）。`.shiftblame/` 位於主工作目錄，不在 worktree 內。DOC 和 MAIN 不使用功能分支。

## 收尾檢查

收尾前必須確認：

- 無殭屍程序、背景 dev server、測試服務或 watcher
- 無開發殘留進入主分支（scratch、demo、prototype、debug output、臨時設定）
- 無多餘 build artifact、coverage report、log、cache、截圖、錄影、下載檔
- 臨時檔案存放於 `.shiftblame/tmp/`（由老闆自行清理）
- `.shiftblame/` 不納入版本控制
- 開發中的筆記只維護於 `.shiftblame/<slug>/SLUG.md`
- README.md 已更新並通過紅藍隊審查（開發任務中）

---

## 定義檔結構

```
skills/shiftblame/
├── SKILL.md              # 框架入口（導流）
├── GATE.md               # 閘門檢查與狀態機
├── MANAGE.md             # 管理者協調與操作
├── EXECUTE.md            # 子代理派工 + 四模式定義
├── ROLE.md               # 角色定義（PM + DEV）
├── START.md              # 流程開始定義
├── END.md                # 流程結束定義
├── TEMPLATES/             # 文件模板
│   ├── REPO.md           # REPO.md 模板
│   ├── ROADMAP.md        # ROADMAP.md 模板
│   ├── GRAPH.md          # 業務拓樑圖模板
│   ├── RAPID.md          # 快速功能配置模板（AUTO 前提）
│   └── SLUG/             # slug 五流程模板
│       ├── SLUG.md
│       ├── TASK.md
│       ├── RESULT.md
│       ├── RED.md
│       ├── BLUE.md
│       └── CONCLUSION.md
└── TOOLS/                # 工具包
    ├── OPEN-DESIGN.md    # Open Design 操作指南
    └── NEXGAME.md        # Nexgame 遊戲開發資源
```

## 工作目錄結構

```
.shiftblame/               # 本地私密，.gitignore
├── REPO.md               # 專案現狀
├── ROADMAP.md            # 穩定產品路線圖（僅歸檔後更新）
├── PRD/                  # 產品需求文件（非強制）
├── SOP/                  # 標準作業程序（非強制）
├── archive/              # 已歸檔 slug
├── tmp/                  # 臨時檔案
└── <slug>/
    ├── SLUG.md            # 開發筆記
    └── <ROLE>/<NNN>/       # FEATURE/AUTO: PM/DEV；DOC/MAIN: 扁平
        ├── TASK.md         # L1 宣告
        ├── RESULT.md       # L2 產出
        ├── RED.md          # L3 紅隊攻擊
        ├── BLUE.md         # L4 藍隊防禦
        └── CONCLUSION.md   # L5 結論

.worktrees/                # git worktree 隔離目錄，.gitignore
└── <slug>/                # feat/<slug> 分支的工作樹
```

---

## 安裝

### Skills symlink

主開發環境使用 skills symlink 安裝：將本 repo 的 `skills/shiftblame` 連結到各 AI 環境的 skills 目錄。

**Claude（bash）**：

```bash
mkdir -p ~/.claude/skills
ln -s ~/shiftblame/skills/shiftblame ~/.claude/skills/shiftblame
```

**Claude（Windows PowerShell）**：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
cmd /c mklink /J "%USERPROFILE%\.claude\skills\shiftblame" "D:\shiftblame\skills\shiftblame"
```

**Codex（bash）**：

```bash
mkdir -p ~/.codex/skills
ln -s ~/shiftblame/skills/shiftblame ~/.codex/skills/shiftblame
```

**Codex（Windows PowerShell）**：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.codex\skills" | Out-Null
cmd /c mklink /J "%USERPROFILE%\.codex\skills\shiftblame" "D:\shiftblame\skills\shiftblame"
```

### Managed block

安裝後，管理者在全域入口檔寫入 managed block：

- **Claude**：`~/.claude/CLAUDE.md`
- **Codex**：`$CODEX_HOME/AGENTS.md`

重啟對應環境讓新技能被載入。SKILL.md description 為 managed block 的唯一來源，三份檔案必須保持一致。

### 專案內安裝（替代方案）

也可直接複製到專案目錄內，讓該專案自行攜帶技能設定：

```bash
# 在目標專案根目錄執行
mkdir -p .claude/skills .codex/skills
cp -R ~/shiftblame/skills/shiftblame .claude/skills/shiftblame
cp -R ~/shiftblame/skills/shiftblame .codex/skills/shiftblame
```

---

## Windows 編碼

本技能與 `.shiftblame/` 產物皆以 UTF-8 Markdown 儲存。Windows PowerShell 讀取含中文檔案時必須明確指定 UTF-8：

```powershell
Get-Content -Encoding UTF8 .\skills\shiftblame\SKILL.md
```

## 自訂

本專案不接受外部貢獻。如需微調，請 fork 後調整。

## 授權

[MIT](./LICENSE)
