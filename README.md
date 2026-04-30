<div align="center">

# shiftblame

### 推鍋

_「專案發出來了，接下來你要怎麼用就不是我的鍋了。」_

_去中心化多端點 AI 調度框架_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-plugin-8a2be2.svg)](https://claude.com/claude-code)
[![Agents](https://img.shields.io/badge/agents-9-blue.svg)](#部門職能)
[![Skills](https://img.shields.io/badge/skills-6-9cf.svg)](#使用)
[![Language](https://img.shields.io/badge/lang-繁體中文-red.svg)](#)

**[核心機制](#核心機制)** · **[CLI-差異與盲點](#cli-差異與盲點)** · **[架構](#架構)** · **[部門職能](#部門職能)** · **[檔案結構](#檔案結構)** · **[安裝](#安裝)** · **[使用](#使用)**

</div>

---

## 核心機制

### 為何選 CLI，不用官方內部系統

shiftblame 透過三個 PROXY（`CLAUDE_PROXY` / `CODEX_PROXY` / `GEMINI_PROXY`）在同一個 worktree 上協調，各自啟動外部 CLI 完成任務。不綁定任何一家的官方內部代理系統，原因：

- **CLI 是跨供應商的通用邊界**——可替換端點，不需重寫框架。
- **PROXY 被限制為外殼代理**——只能呼叫外部 CLI，不直接在內部代理上下文改碼，降低單一系統綁定。
- **同套流程在不同 CLI 能力下運行**——故障時由其他 PROXY 吸收份額，不中斷流程。

### 執行隔離

每個 PROXY 的定義檔都將「外殼代理」列為最高優先約束：

- 唯一執行手段：透過 Bash 啟動外部 CLI 進程（`claude -p` / `codex exec` / `gemini -p`）
- 禁止直接使用 Read/Write/Edit/Grep 操作程式碼
- 只能讀寫通訊目錄內的協調文件（task.md、proposal.md、consensus.md、result.md）
- 讀取 CLI stdout 作為執行結果，整理後回報秘書

這確保三個 PROXY 完全對等——上下文不被 Claude Code 污染。

### 自組織流程

秘書只定義「目標 + 約束」（task.md），不指定分工與做法。分工、辯論、收斂由 PROXY 自行完成：

```
讀取 task.md → 各自提出 proposal → 辯論收斂（最多 2 輪）→ consensus.md → 各自執行 → result.md
```

- 提案基於能力匹配，不是搶工作
- 異議必須附替代方案
- 單點失效時，其他 PROXY 吸收份額；三方全失敗則回報秘書暫停

### PROXY 互監督

同一部門的三個 PROXY 是命運共同體：
- 互相監督執行正確性（CLI 指令、worktree 路徑、分工合理性）
- 發現同事錯誤時直接修正，不等秘書
- 提前完成的 PROXY 主動審查同事作業
- 秘書是流程管控閘門，互監督是技術正確性的第二道防線

### 秘書權限限制

秘書零編輯權限（等同各大廠商 Chat 模式）。秘書的寫入權限僅限於通訊目錄（task.md、proposal.md、result.md、consensus.md）。嚴禁修改 `agents/`、`skills/`、`README.md`、`REPO.md` 及 `~/.shiftblame/common/` 下的任何檔案。

框架定義檔與常識檔案的變更只能由 MIS 在 worktree 上執行。

---

## CLI 差異與盲點

### 三個 CLI 各自優點（來自各 PROXY 定義檔）

| CLI | 定位 | 可驗證的實際優勢 |
|---|---|---|
| `claude -p` | 邏輯推理 | 指令含 `--add-dir <WORKTREE>`、`--timeout 300000`，可直接把 worktree 納入執行上下文。提案模板明確定位在「邏輯推理」型任務。 |
| `codex exec` | 精確實作/GUI 操作 | 具備 sandbox 探測（`BWRAP_OK/BWRAP_FAIL`）與雙路徑降級（read-only 失敗時改 `--dangerously-bypass-approvals-and-sandbox`）。提案模板定位在精確實作。 |
| `gemini -p` | 外部資訊/Web search | 命令固定 `--yolo --skip-trust -o text`，偏向快速外部查詢與文字輸出。提案模板定位在「外部資訊 / Web search」。 |

### 各家問題與盲點（來自各 PROXY 失效偵測表）

| 面向 | Claude CLI | Codex CLI | Gemini CLI |
|---|---|---|---|
| 基本可用性 | `CLI_UNAVAILABLE`（`which claude` 失敗） | `CLI_UNAVAILABLE`（`which codex` 失敗） | `CLI_UNAVAILABLE`（`which gemini` 失敗） |
| 認證 | `AUTH_FAILURE` | `AUTH_FAILURE` | `AUTH_FAILURE`（帳號登入） |
| 速率/配額 | `RATE_LIMITED`、`QUOTA_EXCEEDED` | `RATE_LIMITED`、`QUOTA_EXCEEDED` | `RATE_LIMITED`、`QUOTA_EXCEEDED`、`RESOURCE_EXHAUSTED` |
| sandbox/信任 | 無額外探測流程 | 有 `BWRAP_OK/BWRAP_FAIL` 探測，失敗時走高權限 bypass | 額外有 `TRUST_BLOCKED` 類型（信任機制阻擋） |
| timeout/空輸出 | `TIMEOUT`、`EMPTY_OUTPUT` | `TIMEOUT`、`EMPTY_OUTPUT` | `TIMEOUT`、`EMPTY_OUTPUT` |

補充：
- 協議定義單點失效補救：任一 PROXY 失敗 → 其他吸收；二個失敗 → 剩餘獨立完成；三方全失敗 → 秘書暫停。

---

## 架構

### 去中心化協作

三個 PROXY 在同一 worktree 上工作，透過通訊目錄交換 task/proposal/consensus/result。秘書不下做法指令，僅設任務邊界。PROXY 最多兩輪辯論後收斂，技術分歧由 PROXY 內部解決（辯論收斂或互監督修正）。只有需求不明時才透過秘書與老闆溝通。

### 循環圓

六部門順序固定：

```
MIS → QA → SEC → PRD → DEV → QC → MIS →（下一輪回到 MIS）
```

### 資料存取（金字塔累積制）

| 部門 | 可讀範圍 |
|---|---|
| MIS | 全部 |
| QA | QA |
| SEC | QA + SEC |
| PRD | QA + SEC + PRD |
| DEV | QA + SEC + PRD + DEV |
| QC | QA + SEC + PRD + DEV + QC |

嚴格禁止讀下游部門的檔案。

---

## 部門職能

| 部門 | 職能 | 產出 |
|---|---|---|
| **MIS** | 專案現狀釐清 + 執行準則確立 + 合併 + 部署 + 生產環境驗證 + 歸檔 + 專案文件維護 + 常識寫入 + 問題診斷 | `MIS.md` |
| **QA** | 定義用戶業務邏輯的行為斷言（X→Y→Z）、市調 | `QA.md` |
| **SEC** | 資安稽核 + CVE 搜尋 + 工具篩選 + 環境規範 | `SEC.md` |
| **PRD** | 架構設計 + DAG + 測試區分 + 實作計畫 | `PRD.md` |
| **DEV** | TDD 開發 → 全綠 + 啟動應用驗證 | `DEV.md` + worktree |
| **QC** | 穩健性攻擊 + 邊緣案例 + 紅藍隊 | `QC.md` |

---

## 檔案結構

### Plugin 結構（repo 內）

```
shiftblame/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── QA.md / SEC.md / PRD.md / DEV.md / QC.md / MIS.md
│   ├── CLAUDE_PROXY.md
│   ├── CODEX_PROXY.md
│   └── GEMINI_PROXY.md
├── skills/
│   └── secretary/
│       ├── SKILL.md
│       ├── DISPATCH_CHECKLIST.md
│       ├── GATE_FLOW.md
│       ├── PROXY_PROTOCOL.md
│       ├── WORKTREE_SOP.md
│       └── LIFECYCLE.md
├── LICENSE
└── README.md
```

### 運行時結構

```
~/.shiftblame/
├── common/
│   └── <DEPT>.md
└── <repo>/
    ├── REPO.md
    ├── archive/<slug>/
    └── <slug>/
        ├── <DEPT>.md
        └── <DEPT>/          # PROXY 通訊目錄

~/.worktree/<repo>/<slug>/  # git worktree
```

### 框架使用的工具

#### 官方工具

| 工具 | 用途 | 來源 |
|---|---|---|
| `git` / `git worktree` | worktree 建立、分支管理、squash merge | MIS 定義 |
| Claude Code Plugin system | 插件安裝與載入（`.claude-plugin/plugin.json`） | plugin.json |

#### 非官方工具 / 外部 CLI（由 PROXY 調用）

| 工具 | 用途 | 來源 |
|---|---|---|
| `claude -p` | CLAUDE_PROXY 執行任務 | CLAUDE_PROXY.md |
| `codex exec` | CODEX_PROXY 執行任務 | CODEX_PROXY.md |
| `gemini -p` | GEMINI_PROXY 執行任務 | GEMINI_PROXY.md |
| `chrome-devtools-mcp` | QC 對 Web SPA 的前端操作 | QC.md |

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

全域 `CLAUDE.md` 設定版本檢查。使用時每個 session 開始執行 `/secretary` 啟動秘書調度。

首次執行 `/secretary` 時會初始化 `~/.shiftblame/`、建立 repo 內 symlink、檢查 `.gitignore` 是否含 `.shiftblame/` 與 `.worktree/`。

---

## 使用

```
/secretary → 報告現狀 → 老闆提問 → MIS 釐清 → 老闆決策 → 秘書調度 → MIS→QA→SEC→PRD→DEV→QC→MIS
```

互動節點由秘書用 AskUserQuestion 回報：
- **繼續**：同 turn 內推進下一部門或收尾
- **重做**：退回同一部門補強
- **暫停**：停止流程並討論

---

## 授權

> _「專案發出來了，接下來你要怎麼用就不是我的鍋了。」_

MIT
