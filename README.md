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

`shiftblame` 是一套 AI agents 流程定義框架，以純 Markdown 定義檔構建跨模型協作流程。管理者（主 session）協調；目前所在 CLI 擔任執行者，另外兩個 CLI 擔任紅隊/藍隊。

---

## 角色

| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 主 session | 協調、派工、管線、閘門、收尾 |
| 執行者 | 目前 CLI（claude/codex/gemini） | result.md |
| 紅隊 | 非目前 CLI 之一 | red.md |
| 藍隊 | 非目前 CLI 之一 | blue.md |

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| Claude CLI | claude | codex | gemini |
| Codex CLI | codex | claude | gemini |
| Gemini CLI | gemini | claude | codex |

```
L1: 執行 → 收尾
L2: 執行 → PRD → QA → DEV → QC → 產品現況確認 → 收尾
```

## 部門

| # | 部門 | 類型 |
|:-:|:----:|:----:|
| 0 | PRD | 產品 |
| 1 | QA | 品保 |
| 2 | DEV | 開發 |
| 3 | QC | 品管 |

詳見 `DEPT/*.md`。

## 閘門

| 閘門 | 條件 |
|:----:|------|
| PRD→QA | 執行者/紅隊/藍隊 result/red/blue → `AskUserQuestion` 老闆確認，QA 退回 → 上游新 NNN |
| QA→DEV | 執行者/紅隊/藍隊 result/red/blue → `AskUserQuestion` 老闆確認，DEV 退回 → 上游新 NNN |
| DEV→QC | 執行者/紅隊/藍隊 result/red/blue → `AskUserQuestion` 老闆確認，QC 退回 → 上游新 NNN |
| QC→收尾 | 實際啟動產品，提供 URL/指令/截圖或操作證據 → `AskUserQuestion` 老闆確認現況，未通過 → 退回 DEV 或 QC 新 NNN；通過 → 收尾後自動歸檔 slug |

## 收尾檢查

收尾前必須確認下列項目，不符合則退回 DEV 或 QC 新 NNN：

- 無殭屍程序、背景 dev server、測試服務或未關閉的 watcher。
- 無開發殘留檔案進入主分支，例如 scratch、demo、prototype、debug output、臨時設定。
- 無測試文件或測試產物進入主分支，除非它們是正式測試資產。
- 無多餘 build artifact、coverage report、log、cache、截圖、錄影、下載檔。
- `.shiftblame/`、worktree 專用產物、本地私密設定不納入版本控制。
- README.md 與 REPO.md 已反映最終現況。
- QC→收尾確認通過後，slug 通訊文件夾直接搬移至 `.shiftblame/archive/`，不再詢問是否歸檔。

---

## 檔案結構

```
skills/shiftblame/
├── SKILL.md          # 框架入口
├── MANAGER.md        # 管理者定義（≤50 行）
├── STAFF.md          # 員工呼叫規格
└── DEPT/
    ├── PRD.md        # 產品部門
    ├── QA.md         # 品保部門
    ├── DEV.md        # 開發部門
    └── QC.md         # 品管部門
```

## 文件結構

```
.shiftblame/
├── REPO.md               # 專案現狀（本地私密）
└── <slug>/<DEPT>/<NNN>/
    ├── task.md
    ├── result.md        # 執行者
    ├── red.md          # 紅隊
    └── blue.md         # 藍隊
```

---

## 安裝

### Claude CLI

```bash
# 新增 marketplace（首次）
claude plugin marketplace add https://github.com/teps3105/shiftblame.git

# 安裝 plugin
claude plugin install shiftblame@shiftblame-plugins

# 升級
claude plugin update shiftblame@shiftblame-plugins
```

### Codex CLI

在 Codex 內用 prompt 安裝：

```text
$skill-installer install https://github.com/teps3105/shiftblame/tree/main/skills/shiftblame
```

安裝後重啟 Codex，讓新技能被載入。

本機開發版可用 symlink：

```bash
mkdir -p ~/.codex/skills
ln -s ~/shiftblame/skills/shiftblame ~/.codex/skills/shiftblame
```

Codex 也會讀取 repo 根目錄的 `AGENTS.md`。

### Gemini CLI

Gemini 讀取 repo 根目錄的 `GEMINI.md`，並使用同一套 `skills/shiftblame/` 定義。

## 自訂

本專案不接受外部貢獻。如需微調，請 fork 後調整。

## 授權

[MIT](./LICENSE)
