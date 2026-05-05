# shiftblame

### 推鍋

_「這不是我的鍋。」_

_AI agents 開發框架——流程協議與定義檔_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-plugin-8a2be2.svg)](https://claude.com/claude-code)
[![Agents](https://img.shields.io/badge/agents-8-blue.svg)](#八部門職能)

**[核心機制](#核心機制)** · **[架構概覽](#架構概覽)** · **[檔案結構](#檔案結構)** · **[安裝](#安裝)** · **[使用](#使用)**

---

## 簡介

shiftblame 是一套 AI agents 流程定義框架，以純 Markdown 定義檔構建跨 CLI 框架的協作流程。三個 PROXY（Claude / Codex / Gemini）在同一個 worktree 上透過自組織分工機制共議分工、自主執行、互相辯論，由秘書統籌派工與閘門管控。

框架以 Claude Code Plugin 形式發布，安裝後 SessionStart hook 自動注入秘書，使用者直接對話即可啟動八部門單向流程，協調從需求研究到品質驗證的完整開發流程。

當前版本：v2.0.4

---

## 核心機制

### PROXY 外殼代理

三個 PROXY（`CLAUDE_PROXY` / `CODEX_PROXY` / `GEMINI_PROXY`）不直接操作程式碼，而是各自啟動外部 CLI 進程執行任務。這確保三個 CLI 的上下文完全獨立、對等、不被 Claude Code 污染。各 CLI 使用自家預設模型，不從外部指定。

### 自組織分工

秘書只定義「目標 + 約束」，不指定分工與做法。三個 PROXY 讀取任務後各自提出方案，經辯論收斂為共識後各自執行：

```
讀取任務 → 三 PROXY 各自提案 → 辯論收斂 → 共識 → 各自執行 → 回報結果
```

- 異議必須附替代方案
- 同一部門的三個 PROXY 互相監督執行正確性
- 任一 CLI 失敗時透過 failure-notice.md 通知，其他 PROXY 主動探測並吸收份額；三方全失敗則通知秘書暫停流程

### 合作式失敗處理

- **failure-notice.md**：失敗的 PROXY 建立標準化失敗通知，優先級高於 result.md
- **持續探測**：完成份額後進入探測模式，掃描同事狀態，超時未回報則記錄
- **雙軌吸收**：執行前即時掃描吸收 + 完成後事後探測吸收，吸收結果標注於 result.md

### 常識政策

常識不隨運行動態新增。若有需要新增或修改常識，應更新框架定義檔。

### CLI 去識別化

CLI 彼此僅知使用三種不同的 CLI 框架，不知底層模型細節，避免偏好干擾協作判斷。

---

## 架構概覽

### 五等級開發制度

每次執行時，秘書依需求複雜度判定模式：

| 等級 | 名稱 | 流程 | 適用情境 |
|---|---|---|---|
| **L1** | 日常維護 | 秘書直接執行 | 安裝、部署、版本修改、日常運維 |
| **L2** | 基本 | RES → MIS | 框架定義檔維護、文件更新、歷史修正 |
| **L3** | 標準 | RES → PRD → DEV → MIS | 功能開發、bug 修復 |
| **L4** | 完整 | RES → QA → PRD → DEV → QC → MIS | 需品質驗證的功能開發 |
| **L5** | 高等 | RES → SEC → QA → PRD → DEV → QC → EXP → MIS | 資安+用戶體驗完整流程 |

模式由秘書依需求複雜度判定，可升級也可降級（縮小範圍），降級不可逆轉。收尾操作（合併、推送、歸檔、worktree 清理）由秘書執行。

### 八部門職能

| 部門 | 職能 |
|---|---|
| **RES** | 研究部門（流程起點）：專案現狀釐清、執行準則確立、問題診斷、市調、子循環拆分建議、.shiftblame/REPO.md 初始化 |
| **SEC** | 資安稽核、CVE 搜尋、工具篩選、環境規範 |
| **QA** | 定義用戶業務邏輯的行為斷言（X→Y→Z） |
| **PRD** | 架構設計、DAG、測試區分、實作計畫 |
| **DEV** | 開發實作：TDD 開發 → 全綠 + 啟動應用驗證 |
| **QC** | 品質檢核：穩健性攻擊、邊緣案例、紅藍隊（執行部門，無 worktree 編輯權，僅執行測試） |
| **EXP** | 用戶體驗：用戶視角驗證，專注「用戶從哪個 view 點哪個按鈕觸發什麼行為」（執行部門，無 worktree 編輯權，僅執行測試） |
| **MIS** | 維護部門（流程終點）：框架定義檔維護、文件維護、semver 同步、一致性審計、歸檔紀錄、環境清理 |

### 執行部門定位

DEV、QC、EXP、MIS 為執行部門。其中 QC 與 EXP 無 worktree 編輯權（僅執行測試），採主執行者機制但全體 PROXY 均僅執行測試。

---

## 檔案結構

### Plugin 結構

```
shiftblame/
├── .claude-plugin/
│   ├── plugin.json          # v2.0.4
│   └── marketplace.json
├── agents/
│   ├── RES.md / SEC.md / QA.md / PRD.md / DEV.md / QC.md / EXP.md / MIS.md  # 八部門主管
│   ├── CLAUDE_PROXY.md                                       # Claude 外殼代理
│   ├── CODEX_PROXY.md                                       # Codex 外殼代理
│   └── GEMINI_PROXY.md                                      # Gemini 外殼代理
├── skills/
│   └── secretary/
│       ├── SKILL.md
│       ├── DISPATCH_CHECKLIST.md
│       ├── GATE_FLOW.md
│       ├── PROXY_PROTOCOL.md
│       ├── WORKTREE_SOP.md
│       └── LIFECYCLE.md
├── hooks/
│   ├── hooks.json           # SessionStart hook 定義
│   └── inject-claudemd.sh   # CLAUDE.md 自動注入腳本
├── LICENSE                  # MIT
└── README.md
```

### 運行時結構

```
.shiftblame/
├── .shiftblame/REPO.md
├── archive/<slug>/      # 歸檔
└── <slug>/
    ├── worktree/        # 隔離工作區
    └── <DEPT>/          # 部門報告目錄
        ├── task.md      # 任務目標與約束
        ├── consensus.md # 部門共識報告
        ├── failure-notice.md
        ├── claude/{proposal,result}.md
        ├── codex/{proposal,result}.md
        └── gemini/{proposal,result}.md
```

---

## 安裝

```bash
# 註冊 Marketplace
claude plugin marketplace add teps3105/shiftblame

# 安裝 Plugin
claude plugin install shiftblame@shiftblame
```

更新：

```bash
claude plugin marketplace update
claude plugin update shiftblame
```

安裝後首次啟動 Claude Code 時，Plugin 透過 SessionStart hook 自動完成以下初始化：

1. 將秘書提示詞注入 `~/.claude/CLAUDE.md`（若已有相關提示則不重複注入）
2. 確認 `.shiftblame/` 目錄存在、檢查 `.gitignore` 是否包含 `.shiftblame/`

無需手動設定，直接開始使用即可。

---

## 使用

安裝後直接對話即可。秘書負責流程調度、部門派工與閘門管控，依需求複雜度判定模式（見[五等級開發制度](#五等級開發制度)）。

```
老闆提問 → 秘書顧問翻譯 → RES 研究 → 模式確認 → 老闆決策 → 秘書調度
```

---

## 自訂

本專案不接受外部貢獻。如需微調架構以適應你的專案，請 fork 或 clone 後調整為自己的版本。

---

## 授權

MIT
