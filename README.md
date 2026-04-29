<div align="center">

# shiftblame

### 推鍋

_一套 PROXY 共議常識的 Agents 開發框架_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-plugin-8a2be2.svg)](https://claude.com/claude-code)
[![Agents](https://img.shields.io/badge/agents-9-blue.svg)](#部門職能)
[![Skills](https://img.shields.io/badge/skills-1-9cf.svg)](#使用)
[![Language](https://img.shields.io/badge/lang-繁體中文-red.svg)](#)

> _「這不是我的鍋。」_

**[架構](#架構)** · **[部門職能](#部門職能)** · **[檔案結構](#檔案結構)** · **[安裝](#安裝)** · **[使用](#使用)**

</div>

---

## 核心概念

三個 AI CLI（Claude / Codex / Gemini）作為 **PROXY agent** 在同一 worktree 上共議分工、自主執行、互相辯論。每個 PROXY 都是**外殼代理**——透過 Agent() 讓老闆在 Claude Code UI 看到進度，但內部透過 Bash 啟動各自的外部 CLI 進程（`claude -p` / `codex exec` / `gemini -p`），確保三個 CLI 上下文獨立、不被 Claude Code 污染、完全對等。

秘書是純調度器——只設定邊界、下達任務、收齊回報，不干預巨頭內部協調。

每個部門由三個 PROXY 同時派工，透過 `~/.shiftblame/<repo>/<slug>/<DEPT>/` 通訊目錄自組織：
1. 各自提出分工提案
2. 辯論收斂（最多 2 輪）
3. 寫入共識後各自啟動外部 CLI 執行
4. 回報結果，由秘書彙整呈報老闆

單點失效時自動降級：其他 PROXY 吸收失敗者的份額。

---

## 架構

### 循環圓

六個部門嚴格按序執行，形成封閉循環：

```
QA → SEC → PRD → DEV → QC → MIS →（下一輪回到 QA）
```

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

### 三巨頭能力定位

| 巨頭 | 能力排序 | 強項 | PROXY agent |
|---|---|---|---|
| **Claude** | 邏輯 > 細節 > 資訊 | 深度推理、架構決策、代碼審查 | `CLAUDE_PROXY` |
| **Codex** | 細節 > 資訊 > 邏輯 | 精確實作、GUI 操作、端到端測試 | `CODEX_PROXY` |
| **Gemini** | 資訊 > 邏輯 > 細節 | 外部工具調用、Web search、API 整合 | `GEMINI_PROXY` |

### Model 策略

各 CLI 用自家 default 模型，不從外部指定。廠商最清楚哪個模型最有效率。

| CLI | 策略 |
|---|---|
| `claude -p` | 用 Claude Code default |
| `codex exec` | 用 Codex default |
| `gemini -p` | 用 Gemini default |

### PROXY 共議通訊

```
~/.shiftblame/<repo>/<slug>/<DEPT>/
├── task.md              # 秘書下達的任務
├── dept.md              # 部門定義（廣義職責 + 產出規格）
├── consensus.md         # 三方共識
├── claude/
│   ├── proposal.md      # Claude 分工提案
│   └── result.md        # Claude 執行結果
├── codex/
│   ├── proposal.md      # Codex 分工提案
│   └── result.md        # Codex 執行結果
└── gemini/
    ├── proposal.md      # Gemini 分工提案
    └── result.md        # Gemini 執行結果
```

通訊目錄位於 slug 階層下，每輪迭代的討論產出永久保留。

### 秘書調度流程

```
老闆提需求 → 秘書判斷方向是否明確
  ├─ 不明確：諮詢模式（結構化問答收斂）
  └─ 明確：啟動循環圓（各 CLI 用自家 default 模型）
      → QA→SEC→PRD→DEV→QC→MIS 逐一部門派工
          → 每部門：三 PROXY 共議 → 執行 → 回報
          → 秘書交叉比對 → 呈報老闆
      → MIS 回報 SUCCESS → 常識提煉 + slug 歸檔 + 物理清理
```

---

## 部門職能

每個部門的定義檔只包含**廣義職責**和**產出規格**，權限由秘書在派工時動態注入。

| 部門 | 職能 | 產出 |
|---|---|---|
| **QA** | 定義用戶業務邏輯的行為斷言（X→Y→Z），不寫程式碼 | `~/.shiftblame/<repo>/<slug>/QA.md` |
| **SEC** | 資安稽核 + 工具篩選 + worktree 建置 + 隔離環境 | `~/.shiftblame/<repo>/<slug>/SEC.md` |
| **PRD** | 市調 + 架構設計 + 驗收條件 + 定義 QC 介面 + 實作計畫 | `~/.shiftblame/<repo>/<slug>/PRD.md` |
| **DEV** | TDD 開發直到全綠 + 親自啟動應用驗證 + 語法檢查 | `~/.shiftblame/<repo>/<slug>/DEV.md` |
| **QC** | 穩健性攻擊 + 邊緣案例挖掘 + 紅藍隊攻防 | `~/.shiftblame/<repo>/<slug>/QC.md` |
| **MIS** | 部署上線 + 歸檔 + REPO.md 重寫 + README 同步 + worktree 清理 | `~/.shiftblame/<repo>/<slug>/MIS.md` |

### 部門常識

每個部門的跨專案通用常識存放在 `~/.shiftblame/common/<DEPT>.md`，由 PROXY 共議產出、秘書提煉。包含規則（做什麼）和認知（為什麼有效）。

---

## 檔案結構

```
~/.shiftblame/
├── common/                  # 跨 repo 部門常識 + 秘書 on-demand SOP
│   ├── DEV.md
│   ├── QA.md
│   ├── QC.md
│   ├── SEC.md
│   ├── MIS.md
│   ├── PRD.md
│   ├── SECRETARY.md
│   ├── DISPATCH_CHECKLIST.md   # 派工前必讀
│   ├── GATE_FLOW.md           # 閘門時必讀
│   ├── PROXY_PROTOCOL.md      # 派 PROXY 時讀
│   ├── WORKTREE_SOP.md        # worktree 操作時讀
│   └── LIFECYCLE.md           # MIS 完成後收尾時讀
└── <repo>/                  # 各 repo 產出（slug 階層）
    ├── REPO.md              # 專案知識（MIS 最終整理，永遠在這）
    ├── archive/             # 歸檔目錄（MIS 完成後 mv 進來）
    │   └── <slug>/          # 已歸檔的 slug 快照
    │       ├── QA.md
    │       ├── SEC.md
    │       ├── PRD.md
    │       ├── DEV.md
    │       ├── QC.md
    │       ├── MIS.md
    │       ├── QA/          # 永久討論目錄
    │       ├── SEC/
    │       ├── PRD/
    │       ├── DEV/
    │       ├── QC/
    │       └── MIS/
    └── <slug>/              # 當前迭代的 slug 目錄
        ├── QA.md            # 部門結論檔
        ├── SEC.md
        ├── PRD.md
        ├── DEV.md
        ├── QC.md
        ├── MIS.md
        ├── QA/              # 永久討論目錄（PROXY 產出）
        │   ├── task.md
        │   ├── dept.md
        │   ├── consensus.md
        │   ├── claude/
        │   ├── codex/
        │   └── gemini/
        ├── SEC/
        ├── PRD/
        ├── DEV/
        ├── QC/
        └── MIS/

~/.worktree/<repo>/<slug>/   # worktree（agents 工作空間）

<repo>/                      # 專案根目錄（老闆 IDE 看到）
├── .shiftblame/             # symlink → ~/.shiftblame/<repo>/
│   └── common → ~/.shiftblame/common/
└── .worktree/               # symlink → ~/.worktree/<repo>/
```

> **注意**：`.shiftblame/` 和 `.worktree/` symlink 建在**專案根目錄**，是給老闆在 IDE 瀏覽用的。agents 直接用絕對路徑操作，不依賴這些 symlink。PROXY 通訊目錄已從 worktree 內的 `.proxy-sync/` 移到 `~/.shiftblame/<repo>/<slug>/<DEPT>/`（永久保存）。

---

## 安裝

```bash
# 透過 Claude Code Marketplace Plugin
/plugin marketplace add teps3105/shiftblame
/plugin install shiftblame
```

首次執行 `/secretary` 時自動初始化 `~/.shiftblame/`、專案根目錄 symlink、`.gitignore`。

---

## 使用

輸入 `/secretary` 啟用秘書模式，再輸入需求。還沒想清楚也可以先啟用再諮詢。

```
老闆 → /secretary → 秘書（路由 + 派工）
  → QA→SEC→PRD→DEV→QC→MIS 完整循環
  → 秘書（彙報）→ 老闆
```

老闆在過程中只需：

- **OK**：繼續
- **不 OK + 原因**：秘書判斷推給哪個部門重做

---

## Plugin 結構

```
shiftblame/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── agents/
│   ├── QA.md              # 品保主管
│   ├── SEC.md             # 資安主管
│   ├── PRD.md             # 企劃主管
│   ├── DEV.md             # 開發主管
│   ├── QC.md              # 品管主管
│   ├── MIS.md             # MIS 主管
│   ├── CLAUDE_PROXY.md    # Claude CLI 代理
│   ├── CODEX_PROXY.md     # Codex CLI 代理
│   └── GEMINI_PROXY.md    # Gemini CLI 代理
├── skills/
│   └── secretary/
│       └── SKILL.md       # 秘書 skill
├── LICENSE
└── README.md
```

---

## 授權

> _「專案發出來了，接下來你要怎麼用就不是我的鍋了。」_

MIT
