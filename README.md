# shiftblame

### 推鍋

_「這不是我的鍋。」_

**AI Agents 協作開發框架 — 流程協議與定義檔**

---

## 簡介

`shiftblame` 是一套 AI agents 流程定義框架，以純 Markdown 定義檔構建跨模型協作流程。管理者（主 session）協調；執行者/驗證者（子代理）透過 CLI 執行。三名員工在同一個 worktree 上透過固定角色分工協作，由管理者統籌派工、管線、閘門、收尾。

---

## 角色與流程

| 員工 | 身份 | 職責 |
|------|------|------|
| 管理者 | 主 session | 協調、派工、管線、閘門、收尾 |
| 執行者 | 子代理（claude） | 獨佔 worktree，產出 result.md |
| 驗證者 | 子代理（codex/gemini） | 產出 review.md（紅隊/藍隊） |

```
L1: 執行 → 收尾
L2: 執行 → PRD → QA → DEV → QC → 收尾
```

## 部門

| # | 部門 | 類型 | 執行者產出 | 驗證者產出 |
|:-:|:----:|:----:|------------|------------|
| 0 | PRD | 規劃 | 產品目標/DAG 實作計畫 | 紅隊風險分析/藍隊完整性 |
| 1 | QA | 標準 | E2E 操作介面標準 | 紅隊標準漏洞/藍隊覆蓋度 |
| 2 | DEV | 開發 | 實作成果/commit hash | 紅隊邏輯/藍隊功能完整性 |
| 3 | QC | 驗證 | E2E 操作（chrome-devtools-mcp） | 紅隊攻擊/藍隊防禦掃描 |

## 閘門

- **PRD/QA**：執行者/驗證者 result/review → `AskUserQuestion` 老闆確認
- **DEV→QC**：QC 執行者 E2E（chrome-devtools-mcp）+ 老闆覆核
- **QC→DEV**：QC 退回 → 上游新 NNN

---

## 檔案結構

```
skills/shiftblame/
├── SKILL.md          # 框架入口
├── MANAGER.md        # 管理者定義（≤50 行）
├── STAFF.md          # 員工呼叫規格
└── DEPT/
    ├── PRD.md · QA.md
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
claude plugin update shiftblame@shiftblame-plugins
```

## 自訂

本專案不接受外部貢獻。如需微調，請 fork 後調整。

## 授權

[MIT](./LICENSE)