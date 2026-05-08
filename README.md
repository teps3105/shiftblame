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

`shiftblame` 是一套 AI agents 流程定義框架，以純 Markdown 定義檔構建跨模型協作流程。管理者（主 session）協調；執行者/紅隊/藍隊（子代理）執行。

---

## 角色

| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 主 session | 協調、派工、管線、閘門、收尾 |
| 執行者 | 子代理（claude） | result.md |
| 紅隊 | 子代理（codex） | red.md |
| 藍隊 | 子代理（gemini） | blue.md |

```
L1: 執行 → 收尾
L2: 執行 → PRD → QA → DEV → QC → 收尾
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

```bash
# 新增 marketplace（首次）
claude plugin marketplace add https://github.com/teps3105/shiftblame.git

# 安裝 plugin
claude plugin install shiftblame@shiftblame-plugins

# 升級
claude plugin update shiftblame@shiftblame-plugins
```

## 自訂

本專案不接受外部貢獻。如需微調，請 fork 後調整。

## 授權

[MIT](./LICENSE)