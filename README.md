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

`shiftblame` 是一套 AI agents 流程定義框架，以純 Markdown 定義檔構建跨模型的協作流程。三名員工（claude / codex / gemini）透過 `terminal()` 直接呼叫，各自使用獨立模型，在同一個 worktree 上透過固定角色分工機制協作：claude 固定為開發部門主執行者，codex 與 gemini 固定擔任監督者。由秘書統籌研究、派工與收尾，管理者協調部門管線。

框架以通用 Markdown 定義檔形式發布，可被任何支援 Skill 載入機制的 AI Agent 調度器使用。載入後自動注入秘書系統提示，使用者直接對話即可啟動開發流程。

---

## 核心機制

### 三名員工

`claude`（Claude Code）、`codex`（Codex）、`gemini`（Gemini CLI）透過 `terminal()` 直接呼叫，各自使用獨立模型，多方上下文完全隔離。

### 秘書與管理者

- **L1 模式**：秘書獨立研究和修改檔案，不呼叫員工。適用日常維護、簡單修改。
- **L2+ 模式**：秘書完成研究後交給管理者協調部門管線，管線結束後交回秘書收尾。

### 三種部門執行模型

| 類型 | 部門 | 機制 |
|:---:|:---:|---|
| 研究部門（equal_consensus） | SEC / QA / PRD | 三方各自分析寫 proposal.md，管理者彙整 conclusion.md |
| 開發部門（lead_executor） | DEV | claude 固定為主執行者獨佔 worktree，codex 與 gemini 固定為監督者 |
| 三方驗證（equal_consensus） | QC | 三方 CLI 獨立驗證穩健性/邊緣案例/紅藍隊，管理者彙整 conclusion.md |

### 合作式失敗處理

| 機制 | 說明 |
|:---:|---|
| failure-notice.md | 失敗員工由管理者建立標準化失敗通知 |
| 吸收策略 | 其餘員工主動吸收失敗者份額；三方全失敗回報管理者暫停 |
| 降級彙整 | 連續超時但三方 proposal 已完整時，降級為單體彙整 |

---

## 四等級開發制度

秘書依需求複雜度判定模式：

| 等級 | 名稱 | 流程 | 適用情境 |
|:---:|:---:|---|---|
| L1 | 日常維護 | 秘書直接執行 | 安裝、部署、版本修改、日常運維 |
| L2 | 標準 | PRD → DEV → QC | 功能開發、bug 修復 |
| L3 | 完整 | QA → PRD → DEV → QC | 需品保驗證的功能開發 |
| L4 | 高等 | SEC → QA → PRD → DEV → QC | 資安完整流程 |

> 模式可升級也可降級，降級不可逆轉。收尾操作由秘書執行。

## 五部門

| 部門 | 類型 | 職能 |
|:---:|:---:|---|
| SEC | 研究 | 資安稽核、CVE 搜尋、工具篩選、環境規範 |
| QA | 研究 | 定義用戶業務邏輯的行為斷言（X→Y→Z） |
| PRD | 研究 | 架構設計、DAG、測試區分、實作計畫 |
| DEV | 開發 | TDD 開發 → 全綠 + 啟動驗證（claude 主執行者獨佔 worktree，codex/gemini 監督） |
| QC | 三方驗證 | 品管驗證：三方獨立驗證穩健性攻擊、邊緣案例、紅藍隊（claude 穩健性+邊緣案例，codex 紅隊攻擊，gemini 藍隊防禦+紅藍對照） |

---

## 檔案結構

### 框架定義檔

```
skills/shiftblame/
├── SKILL.md          # 框架入口
├── SECRETARY.md      # 秘書準則
├── MANAGER.md        # 管理者定義
├── STAFF.md          # 員工呼叫規格
└── DEPT/
    ├── SEC.md · QA.md · PRD.md
    └── DEV.md · QC.md
```

### 運行時結構

```
.shiftblame/
├── REPO.md                        # 專案現狀（本地私密，不納入版本控制）
├── archive/<slug>/                 # 歸檔
└── <slug>/
    ├── meta.md                     # 秘書建立，管理者維護
    ├── worktree/                   # 隔離工作區（單一共用）
    └── <DEPT>/<NNN>/
        ├── task.md                 # 目標 + 約束
        ├── conclusion.md           # 管理者彙整結論
        ├── failure-notice.md       # 失敗通知（僅失敗時）
        ├── claude/
        │   ├── proposal.md         # 001 分析提案
        │   └── result.md           # 002+ 執行成果（DEV 主執行者）
        ├── codex/
        │   ├── proposal.md         # 001 分析提案
        │   └── review.md           # 002+ 監督檢視（DEV 監督者）
        └── gemini/
            ├── proposal.md         # 001 分析提案
            └── review.md           # 002+ 監督檢視（DEV 監督者）
```

---

## 安裝

將框架定義檔複製到調度器的 Skill 目錄：

```bash
cp -r skills/shiftblame/ <調度器 Skill 目錄>/shiftblame/
```

調度器載入 Skill 時自動初始化：秘書系統提示透過 Skill 載入，確認 `.shiftblame/` 目錄存在、`.gitignore` 包含 `.shiftblame/`。

## 使用

Skill 載入後直接對話即可。

```
老闆提問 → 秘書研究 → 模式確認 → 管理者協調管線 → 秘書收尾歸檔
```

## 自訂

本專案不接受外部貢獻。如需微調架構，請 fork 後調整為自己的版本。

## 授權

[MIT](./LICENSE)
