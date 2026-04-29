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

**[架構](#架構)** · **[部門職能](#部門職能)** · **[檔案結構](#檔案結構)** · **[安裝](#安裝)** · **[使用](#使用)**

</div>

---

## 架構

### 去中心化

傳統做法：一個 AI 從頭包到底，context 膨脹、注意力稀釋、單點失敗。

shiftblame 做法：三個 PROXY 各自啟動外部 CLI，透過通訊目錄共議分工，context 完全隔離。一個掛了，其他自動接手。同一個 PROXY 的 CLI 介面可以指向不同的 API 端點，換端點即可。

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

### 秘書調度

```
老闆提需求 → 秘書判斷方向
  ├─ 不明確：諮詢模式（結構化問答收斂）
  └─ 明確：啟動循環圓
      → 每部門：三 PROXY 共議 → 執行 → 回報
      → 呈報老闆 → 等裁定 → 推進
      → MIS 完成 → 常識提煉 + slug 歸檔 + worktree 清理
```

秘書的 SKILL.md 僅骨架，詳細 SOP 拆為 on-demand 檔案（派工前/閘門/PROXY/worktree/收尾），每次執行時 Read 刷新到 context，避免長 context 稀釋。

---

## 部門職能

| 部門 | 職能 | 產出 |
|---|---|---|
| **QA** | 定義用戶業務邏輯的行為斷言（X→Y→Z） | `QA.md` |
| **SEC** | 資安稽核 + 工具篩選 | `SEC.md` |
| **PRD** | 架構設計 + 驗收條件 + 測試區分 + 實作計畫 | `PRD.md` |
| **DEV** | TDD 開發 → 全綠 + 親自啟動應用驗證 | `DEV.md` + worktree |
| **QC** | 穩健性攻擊 + 邊緣案例挖掘 + 紅藍隊 | `QC.md` |
| **MIS** | 部署上線 + 歸檔 + REPO.md 整理 | `MIS.md` |

跨專案常識由 PROXY 共議產出、秘書提煉，存放在 `~/.shiftblame/common/<DEPT>.md`。專案紀錄存放在 `~/.shiftblame/<repo>/REPO.md`。

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

~/.worktree/<repo>/<slug>/  # worktree
```

---

## 安裝與更新

```bash
# 註冊 Marketplace
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
