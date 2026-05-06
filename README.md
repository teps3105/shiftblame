<div align="center">

# shiftblame

### 推鍋

_「這不是我的鍋。」_

**AI Agents 協作開發框架 — 流程協議與定義檔**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Hermes Agent Skill](https://img.shields.io/badge/Hermes%20Agent-skill-8a2be2.svg)](https://hermes-agent.nousresearch.com)
[![Agents](https://img.shields.io/badge/agents-6-blue.svg)](#六部門職能)
[![Version](https://img.shields.io/badge/version-v4.0.0-green.svg)]()

</div>

---

## 簡介

`shiftblame` 是一套 AI agents 流程定義框架，以**純 Markdown 定義檔**構建跨模型的協作流程。三名 CLI 員工（claude / codex / gemini）透過 `terminal()` 直接呼叫，各自使用獨立模型，在同一個 worktree 上透過**自組織分工機制**共議分工、自主執行、互相辯論，由秘書統籌研究、派工與收尾。

框架以 Hermes Agent Skill 形式發布，載入後 Skill 自動注入秘書系統提示，使用者直接對話即可啟動四等級開發流程。

---

## 核心機制

### CLI 員工

三名 CLI 員工（`claude` / `codex` / `gemini`）透過 `terminal()` 直接呼叫，各自使用獨立模型，實現多方上下文完全隔離。

### 秘書雙模式

- **L1 模式**：秘書獨立研究和修改檔案，不呼叫 CLI 員工。適用於日常維護、簡單修改、研究分析。
- **L2+ 模式**：秘書完成 L1 研究後轉為部門主管角色，派工 CLI 員工推進管線。秘書負責流程的起點（研究）和終點（收尾）。

### 自組織分工

秘書只定義「目標 + 約束」，不指定分工與做法。三名 CLI 員工讀取任務後各自提出方案，經辯論收斂為共識後各自執行：

```
讀取任務 → 三名 CLI 員工各自提案 → 辯論收斂 → 共識 → 各自執行 → 回報結果
```

### 合作式失敗處理

| 機制 | 說明 |
|:---:|---|
| **failure-notice.md** | 失敗的 CLI 員工由主管建立標準化失敗通知 |
| **雙軌吸收** | 其餘 CLI 員工主動吸收失敗者份額；三方全失敗則回報秘書暫停流程 |
| **降級彙整** | 共識階段連續超時但三方 proposal 已完整時，降級為單體彙整 |

---

## 架構概覽

### 四等級開發制度

每次執行時，秘書依需求複雜度判定模式：

| 等級 | 名稱 | 流程 | 適用情境 |
|:---:|:---:|---|---|
| **L1** | 日常維護 | 秘書直接執行 | 安裝、部署、版本修改、日常運維 |
| **L2** | 標準 | `PRD → DEV` | 功能開發、bug 修復 |
| **L3** | 完整 | `QA → PRD → DEV → QC` | 需品質驗證的功能開發 |
| **L4** | 高等 | `SEC → QA → PRD → DEV → QC → EXP` | 資安 + 用戶體驗完整流程 |

> 模式由秘書依 L1 研究結果判定，可升級也可降級（縮小範圍），降級不可逆轉。收尾操作（合併、推送、歸檔、worktree 清理）由秘書執行。

### 六部門職能

| 部門 | 職能 |
|:---:|---|
| **SEC** | 資安稽核、CVE 搜尋、工具篩選、環境規範 |
| **QA** | 定義用戶業務邏輯的行為斷言（X→Y→Z） |
| **PRD** | 架構設計、DAG、測試區分、實作計畫 |
| **DEV** | 開發實作：TDD 開發 → 全綠 + 啟動應用驗證 |
| **QC** | 品質檢核：穩健性攻擊、邊緣案例、紅藍隊（僅執行測試） |
| **EXP** | 用戶體驗：用戶視角驗證（僅執行測試） |

> **部門分類** — SEC/QA/PRD 為研究部門（equal_consensus，三方各自分析）；DEV/QC/EXP 為執行部門（lead_executor，主執行者獨佔 worktree）。僅 DEV 可修改 worktree。

---

## 檔案結構

### Skill 結構

```
shiftblame-hermes/
├── skills/
│   └── shiftblame/
│       ├── SKILL.md          # 框架入口
│       ├── SECRETARY.md      # 秘書準則
│       ├── DEPT.md           # 部門主管協調機制
│       ├── CLI.md            # CLI 員工呼叫規格
│       └── DEPT/
│           ├── SEC.md · QA.md · PRD.md
│           └── DEV.md · QC.md · EXP.md
├── LICENSE
└── README.md
```

### 運行時結構

```
.shiftblame/
├── REPO.md                        # 專案現狀（本地私密，不納入版本控制）
├── archive/<slug>/                 # 歸檔
└── <slug>/
    ├── meta.md                     # 秘書寫入：slug 級別狀態
    ├── worktree/                   # 隔離工作區
    └── <DEPT>/<NNN>/
        ├── task.md                 # 目標 + 約束
        ├── consensus.md            # 執行部門共識
        ├── conclusion.md           # 研究部門結論
        ├── claude/{proposal,result}.md
        ├── codex/{proposal,result}.md
        └── gemini/{proposal,result}.md
```

---

## 安裝

```bash
# 將 shiftblame skill 複製到 Hermes skills 目錄
cp -r shiftblame-hermes/ ~/.hermes/skills/shiftblame/

# 或直接 clone 到 skills 目錄
git clone https://github.com/teps3105/shiftblame-hermes.git ~/.hermes/skills/shiftblame
```

<details>
<summary>更新</summary>

```bash
cd ~/.hermes/skills/shiftblame && git pull
```

</details>

Hermes 載入 Skill 時自動完成以下初始化：

1. 秘書系統提示透過 Skill 自動載入，無需手動注入
2. 確認 `.shiftblame/` 目錄存在、檢查 `.gitignore` 是否包含 `.shiftblame/`

---

## 使用

Skill 載入後直接對話即可。秘書負責研究、流程調度、部門派工與閘門管控，依需求複雜度判定模式。

```
老闆提問 → 秘書 L1 研究 → 模式確認 → 老闆決策 → 秘書調度管線 → 秘書收尾歸檔
```

---

## 自訂

本專案不接受外部貢獻。如需微調架構以適應你的專案，請 fork 或 clone 後調整為自己的版本。

---

## 授權

[MIT](./LICENSE)
