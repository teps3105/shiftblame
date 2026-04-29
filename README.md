<div align="center">

# shiftblame

### 推鍋

_去中心化多端點 AI 調度框架_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-plugin-8a2be2.svg)](https://claude.com/claude-code)
[![Agents](https://img.shields.io/badge/agents-9-blue.svg)](#部門職能)
[![Skills](https://img.shields.io/badge/skills-6-9cf.svg)](#使用)
[![Language](https://img.shields.io/badge/lang-繁體中文-red.svg)](#)

> _「專案發出來了，接下來你要怎麼用就不是我的鍋了。」_

**[核心機制](#核心機制)** · **[架構](#架構)** · **[部門職能](#部門職能)** · **[檔案結構](#檔案結構)** · **[安裝](#安裝)** · **[使用](#使用)**

</div>

---

## 核心機制

### 為什麼是去中心化

傳統做法：一個 AI 從頭包到底，context 膨脹、注意力稀釋、單點失敗。

shiftblame 做法：
- **每個 PROXY 獨立啟動外部 CLI**，context 完全隔離，不被 Claude Code 污染
- **三方共議**：PROXY 透過通訊目錄互相讀取提案、辯論、收斂、分工
- **單點失效自動吸收**：一個 PROXY 掛了，其他自動接手
- **端點熱替換**：換模型不需要改框架，改 PROXY 的 CLI 指令即可

---

## 架構

### 循環圓

六個部門嚴格按序執行，形成封閉循環：

```
QA → SEC → PRD → DEV → QC → MIS →（下一輪回到 QA）
```

秘書依據 REPO.md 現狀分析，從任意節點開始（不固定從 QA）。

### 資料存取（金字塔累積制）

每個部門可讀**自己 + 所有上游**的產出。MIS 讀全部。

| 部門 | 可讀範圍 |
|---|---|
| QA | 自己 |
| SEC | 自己 + QA |
| PRD | 自己 + QA + SEC |
| DEV | 自己 + QA + SEC + PRD |
| QC | 自己 + QA + SEC + PRD + DEV |
| MIS | 全部 |

### PROXY 共議通訊

```
~/.shiftblame/<repo>/<slug>/<DEPT>/
├── task.md              # 秘書下達的任務（目標 + 約束，不含做法）
├── consensus.md         # 共識（分工 + 做法 + 產出結構）
├── claude/{proposal,result}.md
├── codex/{proposal,result}.md
└── gemini/{proposal,result}.md
```

共議流程：各自提出分工提案 → 辯論收斂 → 寫入共識 → 各自執行 → 回報秘書。

### 秘書調度流程

```
老闆提需求 → 秘書判斷方向
  ├─ 不明確：諮詢模式（結構化問答收斂）
  └─ 明確：啟動循環圓
      → 每部門：Read DISPATCH_CHECKLIST → 三 PROXY 共議 → 執行 → 回報
      → Read GATE_FLOW → 呈報老闆 → 等裁定 → 推進
      → MIS SUCCESS → 常識提煉 + slug 歸檔 + worktree 清理
```

秘書的 SKILL.md 僅骨架，詳細 SOP 拆為 on-demand 檔案（派工前/閘門/PROXY/worktree/收尾），每次執行時 Read 刷新到 context，避免長 context 稀釋。

---

## 部門職能

| 部門 | 職能 | 產出 |
|---|---|---|
| **QA** | 定義用戶業務邏輯的行為斷言（X→Y→Z） | `QA.md` |
| **SEC** | 資安稽核 + 工具篩選 + worktree 隔離環境 | `SEC.md` |
| **PRD** | 架構設計 + 驗收條件 + 測試區分 + 實作計畫 | `PRD.md` |
| **DEV** | TDD 開發 → 全綠 + 親自啟動應用驗證 | `DEV.md` + worktree |
| **QC** | 穩健性攻擊 + 邊緣案例挖掘 + 紅藍隊 | `QC.md` |
| **MIS** | 部署上線 + 歸檔 + REPO.md 整理 | `MIS.md` |

### 部門常識

跨專案通用常識存放在 `~/.shiftblame/common/<DEPT>.md`，由 PROXY 共議產出、秘書提煉。專案層級紀錄存放在 `~/.shiftblame/<repo>/REPO.md`。

---

## 檔案結構

### Plugin 結構（repo 內）

```
shiftblame/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── agents/
│   ├── QA.md / SEC.md / PRD.md / DEV.md / QC.md / MIS.md
│   ├── CLAUDE_PROXY.md
│   ├── CODEX_PROXY.md
│   └── GEMINI_PROXY.md
├── skills/
│   └── secretary/
│       ├── SKILL.md           # 82 行骨架
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
├── common/                        # 跨 repo 私人常識（PROXY 共議提煉）
│   └── <DEPT>.md                  # 部門常識（QA/SEC/PRD/DEV/QC/MIS/SECRETARY）
└── <repo>/
    ├── REPO.md                    # 專案知識（永遠在這，不隨歸檔移動）
    ├── archive/<slug>/            # 已歸檔的 slug 快照
    └── <slug>/                    # 當前迭代
        ├── <DEPT>.md              # 部門結論檔
        └── <DEPT>/                # PROXY 通訊目錄

~/.worktree/<repo>/<slug>/        # worktree（所有部門隔離工作空間）
```

---

## 安裝與更新

```bash
# 註冊 Marketplace（寫入 settings.json extraKnownMarketplaces）
claude plugin marketplace add teps3105/shiftblame

# 安裝 Plugin
claude plugin install shiftblame@shiftblame
```

更新：`claude plugin marketplace update` + `claude plugin update shiftblame`（重啟生效）。

全域 CLAUDE.md 載入秘書 skill：
```
load shiftblame: secretary
```

首次執行 `/secretary` 時自動初始化 `~/.shiftblame/` 目錄結構、repo 內 IDE symlink、`.gitignore`。

---

## 使用

```
/secretary → 輸入需求 → 秘書調度 → QA→SEC→PRD→DEV→QC→MIS
```

老闆在過程中只需回應秘書的 AskUserQuestion：
- **繼續**：推進下一部門
- **重做**：退回重派
- **暫停**：討論或調整

---

## 授權

> _「專案發出來了，接下來你要怎麼用就不是我的鍋了。」_

MIT
