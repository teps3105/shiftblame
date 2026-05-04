<div align="center">

# shiftblame

### 推鍋

_「專案發出來了，接下來你要怎麼用就不是我的鍋了。」_

_AI agents 開發框架——流程協議與定義檔_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-plugin-8a2be2.svg)](https://claude.com/claude-code)
[![Agents](https://img.shields.io/badge/agents-7-blue.svg)](#七部門職能)

**[核心機制](#核心機制)** · **[架構概覽](#架構概覽)** · **[檔案結構](#檔案結構)** · **[安裝](#安裝)** · **[使用](#使用)**

</div>

---

## 簡介

shiftblame 是一套 AI agents 流程定義框架，以純 Markdown 定義檔構建跨 CLI 框架的協作流程。三個 PROXY（Claude / Codex / Gemini）在同一個 worktree 上透過自組織分工機制共議分工、自主執行、互相辯論，由秘書統籌派工與閘門管控。

框架以 Claude Code Plugin 形式發布，安裝後 SessionStart hook 自動注入秘書，使用者直接對話即可啟動七部門單向流程，協調從需求研究到品質驗證的完整開發流程。

當前版本：v1.0.18

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

### 單向流程

七部門依序執行，一次性的單向流程（中等/高等模式可包含 DEV/QC 多輪來回）：

```
RES → QA → SEC → PRD → DEV ↔ QC → MIS
```

RES 為流程起點，負責專案現狀釐清、執行準則確立、問題診斷。MIS 為流程終點，負責框架定義檔維護與收尾。收尾操作（合併、推送、歸檔、worktree 清理）由秘書執行。

### 三級開發制度

每次執行時，秘書透過 AskUserQuestion 確認模式：

| 模式 | 流程 | 適用情境 |
|---|---|---|
| **初等（basic）** | RES 研究後 MIS 執行收尾 → 秘書復判 → 收尾（歸檔） | 框架定義檔維護、文件更新等小規模工作 |
| **中等（medium）** | RES → DEV（可多輪）→ QC → MIS(尾) → 秘書復判 → 收尾（歸檔） | 功能開發、bug 修復等中等規模工作 |
| **高等（full）** | RES → QA → SEC → PRD → DEV（可多輪）→ QC → MIS → 秘書復判 → 收尾（歸檔） | 大型功能、架構重構等大規模工作 |

模式由秘書在 RES 研究後建議，老闆可升級（初等→中等→高等）或縮小範圍降級（高等→中等→初等）。降級不可逆轉。收尾操作（合併、推送、歸檔、worktree 清理）由秘書執行。

### 七部門職能

| 部門 | 職能 |
|---|---|
| **RES** | 研究部門（流程起點）：專案現狀釐清、執行準則確立、問題診斷、市調、子循環拆分建議、REPO.md 初始化 |
| **QA** | 定義用戶業務邏輯的行為斷言（X→Y→Z） |
| **SEC** | 資安稽核、CVE 搜尋、工具篩選、環境規範 |
| **PRD** | 架構設計、DAG、測試區分、實作計畫 |
| **DEV** | TDD 開發 → 全綠 + 啟動應用驗證 |
| **QC** | 穩健性攻擊、邊緣案例、紅藍隊 |
| **MIS** | 維護部門（流程終點）：框架定義檔維護、文件維護、semver 同步、一致性審計、歸檔紀錄 |

### 資料存取（金字塔累積制）

各部門僅能讀取自身及上游部門的產出，嚴格禁止讀取下游部門的檔案。RES 和 MIS 作為頂層部門，不受「嚴格禁止讀下游」限制。

| 部門 | 可讀範圍 |
|---|---|
| RES | 全部 |
| MIS | 全部 |
| QA | QA |
| SEC | QA + SEC |
| PRD | QA + SEC + PRD |
| DEV | QA + SEC + PRD + DEV |
| QC | QA + SEC + PRD + DEV + QC |

---

## 檔案結構

### Plugin 結構

```
shiftblame/
├── .claude-plugin/
│   ├── plugin.json          # v1.0.18
│   └── marketplace.json
├── agents/
│   ├── RES.md / QA.md / SEC.md / PRD.md / DEV.md / QC.md / MIS.md  # 七部門主管
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
├── REPO.md
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

秘書是使用者的主要互動介面，負責流程調度、部門派工、進度回報與閘門管控。秘書零編輯權限，不動手寫程式碼或定義檔。

Plugin 安裝後，SessionStart hook 會自動將秘書注入 `~/.claude/CLAUDE.md`。使用者直接在 Claude Code 中與秘書對話即可——秘書會讀取 `REPO.md` 進入顧問模式，翻譯需求並向老闆呈報，等待確認後派工。

```
老闆提問 → 秘書顧問翻譯 → RES 研究 → 模式確認 → 老闆決策 → 秘書調度
```

- **初等模式**：RES 研究 → 模式確認（初等）→ MIS 執行收尾 → 秘書復判 → 收尾（歸檔）
- **中等模式**：RES 研究 → 模式確認（中等）→ 老闆決策 → RES → DEV（可多輪）→ QC → MIS(尾) → 秘書復判 → 收尾（歸檔）
- **高等模式**：RES 研究 → 模式確認（高等）→ 老闆決策 → RES → QA → SEC → PRD → DEV（可多輪）→ QC → MIS(尾) → 秘書復判 → 收尾（歸檔）

秘書在每個關鍵節點透過 AskUserQuestion 回報，提供三個選項：

| 選項 | 行為 |
|---|---|
| **繼續** | 同 turn 內推進下一部門或收尾 |
| **重做** | 退回同一部門補強 |
| **暫停** | 停止流程並討論 |

---

## 自訂

本專案不接受外部貢獻。如需微調架構以適應你的專案，請 fork 或 clone 後調整為自己的版本。

---

## 授權

MIT
