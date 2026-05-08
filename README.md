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

`shiftblame` 是一套 AI agents 流程定義框架，以純 Markdown 定義檔構建跨模型協作流程。claude 直接執行或透過 Agent 子代理承擔所有角色（秘書/管理者/開發者/驗證者）；codex 與 gemini 透過 CLI 承擔研究與監督角色。三名員工在同一個 worktree 上透過固定角色分工協作，由秘書統籌研究與收尾，管理者協調部門管線。

框架以通用 Markdown 定義檔形式發布，可被任何支援 Skill 載入機制的 AI Agent 調度器使用。

---

## 核心機制

### 員工與角色

| 員工 | 呼叫方式 | 角色 |
|------|----------|------|
| claude | 直接執行 / Agent 子代理 | 主執行者（秘書/管理者/開發/驗證） |
| codex | `Bash` + CLI | 研究者 + 監督者（邏輯正確性 + 測試覆蓋度） |
| gemini | `Bash` + CLI | 研究者 + 監督者（功能完整性 + 規格一致性） |

### 四等級模式

| 等級 | 流程 | 適用 |
|:---:|---|---|
| L1 | 研究 → 收尾 | 日常維護、安裝、部署 |
| L2 | 研究 → PRD → DEV → QC → 收尾 | 功能開發、bug 修復 |
| L3 | 研究 → QA → PRD → DEV → QC → 收尾 | 需品保驗證的功能 |
| L4 | 研究 → SEC → QA → PRD → DEV → QC → 收尾 | 資安完整流程 |

### 部門

| 類型 | 部門 | 機制 |
|:---:|:---:|---|
| 研究 | SEC/QA/PRD | 三方各寫 proposal → 管理者 conclusion.md |
| 開發 | DEV | claude 主執行 + codex/gemini 監督 review |
| 驗證 | QC | 三方各自獨立驗證（穩健性/紅藍隊）→ conclusion.md |

### 閘門

- **DEV→QC**：管理者 E2E 實際驗證 + 老闆覆核（前端介面操作在 E2E 閘門完成，QC 以 API/CLI 驗證）
- **QC 退回 DEV**：修正後再 E2E + 老闆覆核

---

## 檔案結構

```
skills/shiftblame/
├── SKILL.md          # 框架入口（≤50 行）
├── SECRETARY.md      # 秘書準則
├── MANAGER.md        # 管理者定義
├── STAFF.md          # 員工呼叫規格
└── DEPT/
    ├── SEC.md · QA.md · PRD.md
    └── DEV.md · QC.md
```

所有定義檔 ≤50 行，人類可直接維護。

---

## 安裝

```bash
# 新增 marketplace（首次）
claude plugin marketplace add https://github.com/teps3105/shiftblame.git

# 安裝 plugin
claude plugin install shiftblame@shiftblame-plugins

# 升級
claude plugin update shiftblame
```

## 自訂

本專案不接受外部貢獻。如需微調，請 fork 後調整。

## 授權

[MIT](./LICENSE)
