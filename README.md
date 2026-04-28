<div align="center">

# shiftblame

### 推鍋

_一套明確責任歸屬的 Agents 開發框架_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-plugin-8a2be2.svg)](https://claude.com/claude-code)
[![Agents](https://img.shields.io/badge/agents-9-blue.svg)](#誰的鍋)
[![Skills](https://img.shields.io/badge/skills-2-9cf.svg)](#使用)
[![Language](https://img.shields.io/badge/lang-繁體中文-red.svg)](#)

> _「這不是我的鍋。」_

**[誰的鍋](#誰的鍋)** · **[運作原理](#運作原理)** · **[安裝](#安裝)** · **[使用](#使用)**

</div>

---

秘書動態掃描 agents 目錄，把正確的需求推給正確的部門。每個部門透過三巨頭 **PROXY agent**（CLAUDE_PROXY / CODEX_PROXY / GEMINI_PROXY）路由任務到對應的 AI CLI。秘書動態決定巨頭組合，不硬編碼——最優組合由實務執行判定。單點失效時自動降級補救。產出交叉比對後，分歧呈報老闆裁決。所有修改透過 worktree 隔離，不直推 main。

還沒想清楚？秘書也能幫你**釐清方向**——用結構化問答收斂需求，確認後再推鍋。

---

## 資源供給機制

**三巨頭 PROXY 動態路由**：秘書透過 PROXY agent 路由任務到三個 AI CLI，動態決定巨頭組合。

### 三巨頭能力定位

| 巨頭 | 能力排序 | 強項 | PROXY agent |
|---|---|---|---|
| **Claude** | 邏輯 > 細節 > 資訊 | 深度推理、架構決策、代碼審查 | `shiftblame:CLAUDE_PROXY` |
| **Codex** | 細節 > 資訊 > 邏輯 | 精確實作、GUI 操作、端到端測試 | `shiftblame:CODEX_PROXY` |
| **Gemini** | 資訊 > 邏輯 > 細節 | 外部工具調用、Web search、API 整合、即時資料 | `shiftblame:GEMINI_PROXY` |

### 動態路由

秘書分析每個任務的核心能力需求，動態決定派出哪個（些）巨頭。不硬編碼部門-巨頭組合——具體最優組合由實務執行累積經驗判定。

### 單點失效補救

當某個巨頭 PROXY 回報錯誤（rate limit / quota / CLI 不可用 / timeout），秘書自動降級：
- 雙巨頭 → 單巨頭（仍可繼續，交叉比對缺省）
- 單巨頭 → 無巨頭（回報老闆暫停等待）

### Claude model（按認知複雜度動態決定）

| 認知複雜度 | model | 適用情境 |
|----------|------|------|
| **低** | **haiku** | 簡單明確的任務：已知模式的 CRUD、例行性檢查、格式化、簡單配置 |
| **中** | **sonnet** | 標準開發任務：常規功能實作、標準測試設計、CI/CD 配置、標準架構 |
| **高** | **opus** | 需要深度推理的任務：複雜跨模組整合、安全攻防、架構決策、模糊需求解析 |

### Codex model（動態偵測，不自訂）

透過 `codex debug models` 即時查詢 API 模型目錄，按 `priority` 取最新可用模型。不硬編碼模型名稱，OpenAI 推新模型時自動獲益。

### Gemini model（動態偵測，不自訂）

透過 Gemini API 即時查詢可用模型清單，優先選 pro（更強），其次 flash。不讀 config 預設值。

---

## 誰的鍋

每個部門都有自己的 `~/.shiftblame/common/<DEPT>.md`，秘書負責寫入犯錯紀錄、提煉跨專案通用常識（規則 + 認知）。

### 秘書的鍋

| 情境 | 為什麼是秘書的鍋 |
|------|------------------|
| **路由判錯**：需求推給了錯誤的部門導致重工 | 秘書職責就是判斷該推給誰 |
| **退回判錯**：老闆說不 OK 時推給了錯誤的部門 | 秘書職責就是判斷根因在哪 |
| **model 選錯**：高複雜度任務派了 haiku 導致品質低落 | 秘書職責就是評估認知複雜度 |
| **巨頭組合選錯**：資訊型部門沒派 Gemini、實作型沒派 Codex | 秘書職責就是能力路由 |
| **派工單缺欄位**：WORKTREE_PATH 或 BRANCH 空白仍派出 | 秘書是派工流程的閘門 |
| **回報後未驗證 git**：agent 回報完成後未檢查分支/路徑 | 秘書的事後驗證是最後防線 |

### 各部門的鍋

| 部門 | 職能 | 典型犯錯情境 |
|------|------|-------------|
| QA | 用戶業務邏輯的行為斷言定義（X→Y→Z，含 E2E 基本斷言，不寫程式碼） | 斷言遺漏、E2E 斷言缺失、格式不精確、斷言與需求不符 |
| SEC | 資安稽核 + 工具篩選 + 隔離環境建置 + 環境管理規範 | 工具篩選不當、環境建置錯誤、安全遺漏 |
| PRD | 市調 + 架構設計 + 翻譯斷言為驗收條件 + 定義 QC 可操作介面 + 測試區分 + **在 worktree 親自寫測試檔** + 實作計畫 | 驗收條件模糊、QC 可操作介面缺失、測試檔 parse error、E2E 測試缺失 |
| DEV | TDD 開發（依計畫實作直到全綠，含 QC 可操作介面實作，commit 前語法檢查）+ **親自啟動應用驗證功能可運行** | 測試未全綠、介面未實作、commit 前未做語法檢查、測試全綠但未啟動驗證、引入新 bug |
| QC | **親自啟動應用做穩健性攻擊**：對照 QA 原始品保條件做破壞性測試，挖掘 BUG、邊緣案例、業務邏輯斷裂 + 紅藍隊攻防（指標是抓出多少問題，不是通過多少規格） | 只做程式碼審查未啟動應用、照規格打勾不主動攻擊、邊緣案例遺漏、紅藍隊模擬不完整 |
| MIS | 部署上線 + 專案內文件整理（REPO.md 重寫、README 同步） | 部署失敗、pipeline 配置錯誤、合併出包、REPO.md 遺漏重寫 |

---

## 運作原理

### 循環圓（標準作業流程）

六個部門形成封閉循環，嚴格按順序執行：

```
        ┌─── QA（定義用戶業務邏輯的行為斷言 X→Y→Z）
        │     可讀：僅自己
        │
        ├─── SEC（資安稽核 + 工具篩選 + 隔離環境建置）
        │     可讀：自己 + QA
        │
        ├─── PRD（市調 + 架構 + 翻譯驗收條件 + 定義 QC 介面 + 寫測試 + 實作計畫）
        │     可讀：自己 + QA + SEC
        │
        ├─── DEV（TDD 開發 → 全綠 + 親自啟動應用驗證，含 QC 介面實作與語法檢查）
        │     可讀：自己 + QA + SEC + PRD
        │
        ├─── QC（穩健性攻擊 + 邊緣案例挖掘 + 業務邏輯流動 + 紅藍隊攻防）
        │     可讀：自己 + QA + SEC + PRD + DEV
        │
        └─── MIS（部署上線 + 專案文件整理 — 最後一道防線）
              可讀：全部（QA + SEC + PRD + DEV + QC + 自己）
              │
              └→ 回到 QA（下一輪）
```

### 資料存取限制（金字塔累積制）

每個部門可讀**自己 + 所有上游部門**的產出。越後面的部門可讀越多，MIS 讀全部。嚴禁讀下游部門。

金字塔設計目的：
- 部署後秘書清理所有產出，沒有「上一輪」文件，不存在跨輪存取需求
- 每個部門直接讀所有上游原始產出，避免透過中間層轉述造成資訊失真
- MIS 是最後一道防線，必須閱讀全部產出確認無誤才能部署，部署後完成專案內文件整理（REPO.md 重寫、README 同步）；秘書負責跨專案常識提煉與物理清理

| 部門 | 可讀範圍 |
|---|---|
| QA | 自己 |
| SEC | 自己 + QA |
| PRD | 自己 + QA + SEC |
| DEV | 自己 + QA + SEC + PRD |
| QC | 自己 + QA + SEC + PRD + DEV |
| MIS | 自己 + QA + SEC + PRD + DEV + QC（全部） |

### 秘書調度流程

```
 老闆提出用戶需求
      │
      ▼
 ┌─────────────────────────┐
 │ 秘書判斷：方向明確嗎？  │
 └─────────┬───────────────┘
           │
   ┌───────┴────────┐
   │                │
 明確              不確定
   │                │
   ▼                ▼
 原話留底      ┌──────────────────────┐
   │           │ 諮詢模式             │
   │           │ 結構化問答釐清方向   │
   │           │ 確認後才推鍋         │
   │           └──────────┬───────────┘
   │                      │
   │◄─────────────────────┘
   ▼
 ┌──────────────────────────────────────────┐
 │ 評估認知複雜度 → 指派 Claude model      │
 │ 動態路由 → 決定巨頭組合（不硬編碼）     │
 │ 按循環圓順序派工                         │
 └─────────┬────────────────────────────────┘
           │
   ┌───────┴────────┐
   │                │
   ▼                ▼
 PROXY 派工     單點失效補救
 ┌───┬───┐      ┌──────────────┐
 │   │   │      │ rate limit   │→ 降級/改派
 ▼   ▼   │      │ quota        │→ 降級/改派
CL  CX  │      │ timeout      │→ 重試/改派
 │   │   │      │ CLI missing  │→ 標記不可用
 ▼   ▼   │      └──────────────┘
 交叉比對│
 │       │
 ▼       ▼
 呈報老闆
```

CL = Claude agent, GM = Gemini agent, CX = Codex agent

### 檔案結構

```
~/.shiftblame/
├── common/                                      # 跨 repo 共用經驗
│   ├── DEV.md
│   ├── QA.md
│   ├── QC.md
│   ├── SEC.md
│   ├── MIS.md
│   ├── PRD.md
│   └── SECRETARY.md
└── <repo>/
    ├── QA.md                                    # 品保產出（flat 檔案，每部門一個）
    ├── SEC.md                                   # 資安產出
    ├── PRD.md                                   # 企劃產出
    ├── DEV.md                                   # 開發產出
    ├── QC.md                                    # 品管產出
    ├── MIS.md                                   # 部署產出
    └── REPO.md                                  # 專案知識（MIS 最終整理）

~/.worktree/<repo>/<slug>/                       # shiftblame 自定義 worktree
    └── .proxy-sync/                             # PROXY 協調通訊目錄

<repo>/
├── .shiftblame/                                 # symlink 目錄
│   ├── <repo> → ~/.shiftblame/<repo>/
│   └── common → ~/.shiftblame/common/
└── .worktree/
    └── <slug> → ~/.worktree/<repo>/<slug>/
```

---

## 安裝

### 透過 Claude Code Marketplace Plugin

```bash
# 加入 marketplace（若尚未加入）
/plugin marketplace add teps3105/shiftblame

# 安裝 plugin
/plugin install shiftblame
```

### 初始化

首次執行 `/secretary` 時，秘書會自動偵測並初始化 `~/.shiftblame/` 完整目錄結構、repo 內 symlink、檢查 `.gitignore`。已有內容的 REPO.md 和 BLAME.md 會保留，空目錄才初始化。

---

## 使用

### 直接對話

每次對話開始時，輸入 `/secretary` 啟用秘書模式，再輸入需求。還沒想清楚也可以先啟用再諮詢。

### 派工流程

```
老闆 → 秘書（能力路由 + 選 model）→ QA→SEC→PRD→DEV→QC→MIS 完整循環 → 秘書（彙報）→ 老闆
```

1. 秘書收到老闆原話，評估認知複雜度
2. 所有需求一律從 QA 起步，走完整循環圓（QA→SEC→PRD→DEV→QC→MIS），不跳過任何節點
3. 能力路由決定每個部門的巨頭組合（由秘書動態決定，不硬編碼）
4. 老闆 OK 後，按循環圓順序逐一部門派工
5. 每個部門透過 PROXY agent 路由到對應 AI CLI（CLAUDE_PROXY / CODEX_PROXY / GEMINI_PROXY）
6. 每個部門只能讀自己 + 所有上游的產出（金字塔累積制）
7. 主管親自執行所有職能，完成後回報
8. 秘書交叉比對 PROXY 回報，分歧呈報老闆裁決
9. 秘書在主管回報後執行 `git status && git branch --show-current` 驗證改動在 worktree、分支正確
10. 秘書收齊所有主管回報後，向老闆做最終彙報

### 秘書接手後

1. 偵測 `.shiftblame/` 是否存在，不存在則自動初始化
2. 掃描 agents 取得可用部門清單
3. 保存你的**原話逐字稿**
4. 評估認知複雜度，自動指派 Claude model；動態決定巨頭組合
5. 每個部門透過 PROXY agent 路由到 AI CLI，完成後用 AskUserQuestion 回報結果
6. 建立 worktree 隔離環境
7. 部門主管親自執行所有職能，產出寫入 `~/.shiftblame/<repo>/<DEPT>.md`
8. 主管回報「做了什麼 / 問題 / 解決方式 / 結果」
9. 秘書收齊回報後對照原話，呈報「完全達成 X / 部分達成 Y / 未達成 Z」
10. 秘書負責寫入犯錯紀錄
11. MIS 在部署階段完成專案內文件整理：重寫 REPO.md、同步 README
12. MIS 回報 SUCCESS 後，秘書執行循環收尾：常識提煉 + 物理清理

你在過程中只需要：

- **OK**：繼續推
- **不 OK + 原因**：秘書會判斷該推給哪個部門重做

---

## Plugin 結構

```
shiftblame/
├── .claude-plugin/
│   └── plugin.json        # Plugin manifest
├── agents/
│   ├── QA.md              # 品保主管（廣義職責 + 產出規格）
│   ├── SEC.md             # 資安主管
│   ├── PRD.md             # 企劃主管
│   ├── DEV.md             # 開發主管
│   ├── QC.md              # 品管主管
│   ├── MIS.md             # MIS 主管
│   ├── CLAUDE_PROXY.md    # Claude CLI 代理（啟動 claude -p 並回報）
│   ├── CODEX_PROXY.md     # Codex CLI 代理（啟動 codex exec 並回報）
│   └── GEMINI_PROXY.md    # Gemini CLI 代理（啟動 gemini -p 並回報）
├── skills/
│   └── secretary/
│       └── SKILL.md       # 秘書 skill
├── LICENSE
└── README.md
```

---

## 授權

> _「倉庫已經發出來了，接下來怎麼用就不是我的鍋了。」_

MIT
