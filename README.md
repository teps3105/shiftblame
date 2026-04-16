<div align="center">

# shiftblame

### 推鍋

_一套明確責任歸屬的 Agents 開發框架_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-8a2be2.svg)](https://claude.com/claude-code)
[![Agents](https://img.shields.io/badge/agents-6-blue.svg)](#資源供給機制)
[![Skills](https://img.shields.io/badge/skills-1-9cf.svg)](#skills)
[![Language](https://img.shields.io/badge/lang-繁體中文-red.svg)](#)

> _「這不是我的鍋。」_

**[誰的鍋](#誰的鍋)** · **[運作原理](#運作原理)** · **[安裝](#安裝)** · **[使用](#使用)**

</div>

---

秘書動態掃描 agents 目錄，把正確的需求推給正確的部門。每個部門主管親自執行所有職能，出了事由秘書寫入各部門的鍋紀錄。所有修改透過 worktree 隔離，不直推 main。

還沒想清楚？秘書也能幫你**釐清方向**——用結構化問答收斂需求，確認後再推鍋。

---

## 資源供給機制

模型分配**按認知複雜度**動態決定，不按角色固定：

| 認知複雜度 | model | 適用情境 |
|----------|------|------|
| **低** | **haiku** | 簡單明確的任務：已知模式的 CRUD、例行性檢查、格式化、簡單配置 |
| **中** | **sonnet** | 標準開發任務：常規功能實作、標準測試設計、CI/CD 配置、標準架構 |
| **高** | **opus** | 需要深度推理的任務：複雜跨模組整合、安全攻防、架構決策、模糊需求解析 |

秘書在派工時評估任務的模糊度、跨模組數、新穎性、風險等維度，動態選擇 model。

---

## 誰的鍋

每個部門都有自己的 `~/.shiftblame/blame/<DEPT>/BLAME.md`，秘書負責寫入犯錯紀錄、提煉跨專案通用常識（規則 + 認知）。

### 秘書的鍋

| 情境 | 為什麼是秘書的鍋 |
|------|------------------|
| **路由判錯**：需求推給了錯誤的部門導致重工 | 秘書職責就是判斷該推給誰 |
| **退回判錯**：老闆說不 OK 時推給了錯誤的部門 | 秘書職責就是判斷根因在哪 |
| **model 選錯**：高複雜度任務派了 haiku 導致品質低落 | 秘書職責就是評估認知複雜度 |

### 各部門的鍋

| 部門 | 職能 | 典型犯錯情境 |
|------|------|-------------|
| QA | 行為斷言定義（X→Y→Z，不寫程式碼） | 斷言遺漏、斷言格式不精確、斷言與需求不符 |
| SEC | 資安稽核 + 工具篩選 + 隔離環境建置 + 環境管理規範 | 工具篩選不當、環境建置錯誤、安全遺漏 |
| PRD | 市調 + 架構設計 + 測試區分 + 實作計畫 | 需求遺漏、架構不可行、測試區分不當 |
| DEV | TDD 開發（依計畫實作直到全綠） | 測試未全綠、實作偏離計畫、引入新 bug |
| QC | 驗證斷言行為（不跑測試）+ 紅藍隊攻防模擬 | 斷言驗證遺漏、紅藍隊模擬不完整 |
| MIS | 部署上線 | 部署失敗、pipeline 配置錯誤、合併出包 |

---

## 運作原理

### 循環圓（標準作業流程）

六個部門形成封閉循環，嚴格按順序執行：

```
        ┌─── QA（定義行為斷言 X→Y→Z）
        │     只讀：QA + MIS
        │
        ├─── SEC（資安稽核 + 工具篩選 + 隔離環境建置）
        │     只讀：SEC + QA
        │
        ├─── PRD（市調 + 架構 + 測試區分 + 實作計畫）
        │     只讀：PRD + SEC
        │
        ├─── DEV（TDD 開發 → 直到全綠）
        │     只讀：DEV + PRD
        │
        ├─── QC（驗證斷言 + 紅藍隊攻防）
        │     只讀：QC + DEV
        │
        └─── MIS（部署上線）
              只讀：MIS + QC
              │
              └→ 回到 QA（下一輪）
```

### 資料存取限制

每個部門**只能讀兩個資料夾**：自己的 + 上一流程的。嚴禁偷看其他部門。

| 部門 | 可讀自己 | 可讀上一流程 |
|---|---|---|
| QA | `~/.shiftblame/<repo>/QA/` | `~/.shiftblame/<repo>/MIS/` |
| SEC | `~/.shiftblame/<repo>/SEC/` | `~/.shiftblame/<repo>/QA/` |
| PRD | `~/.shiftblame/<repo>/PRD/` | `~/.shiftblame/<repo>/SEC/` |
| DEV | `~/.shiftblame/<repo>/DEV/` | `~/.shiftblame/<repo>/PRD/` |
| QC | `~/.shiftblame/<repo>/QC/` | `~/.shiftblame/<repo>/DEV/` |
| MIS | `~/.shiftblame/<repo>/MIS/` | `~/.shiftblame/<repo>/QC/` |

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
 ┌─────────────────────────┐
 │ 評估認知複雜度選 model  │
 │ 按循環圓順序派工        │
 └─────────┬───────────────┘
           │
   ┌───────┴────────┐
   │                │
 預審 OK          不 OK
   │                │
   ▼                ▼
 啟動該部門    秘書判斷根因，
 (帶 model)    推給正確的部門重做
   │
   ▼
 主管親自執行 → 回報結果
   │
   ▼
 秘書對照原話 → 呈報老闆
```

### 需求路由

秘書根據需求性質，決定從循環圓的哪個節點切入：

| 需求性質 | 切入點 |
|---|---|
| 功能需求 / 斷言不足 | QA |
| 安全合規問題 | SEC |
| 需求 / 架構變更 | PRD |
| 已知 bug / 程式修正 | DEV |
| 品質驗收問題 | QC |
| 部署 / 上線問題 | MIS |

完整路徑：QA → SEC → PRD → DEV → QC → MIS → 新需求 → QA

### 檔案結構

```
~/.shiftblame/
├── blame/                                       # 鍋紀錄（所有 repo 共用）
│   ├── DEV/BLAME.md
│   ├── QA/BLAME.md
│   ├── QC/BLAME.md
│   ├── SEC/BLAME.md
│   ├── MIS/BLAME.md
│   ├── PRD/BLAME.md
│   └── SECRETARY/BLAME.md
└── <repo>/
    ├── {MIS}/<slug>.md
    ├── {DEV,QA}/<slug>.md
    ├── {PRD,QC,SEC}/<slug>.md
    └── REPO.md

~/.worktree/<repo>/<slug>/                       # shiftblame 自定義 worktree

<repo>/
├── .shiftblame/                                 # symlink 目錄
│   ├── <repo> → ~/.shiftblame/<repo>/
│   └── blame → ~/.shiftblame/blame/
└── .worktree/
    └── <slug> → ~/.worktree/<repo>/<slug>/
```

---

## 安裝

### User 級別（所有 repo 共用）

```bash
npm install -g shiftblame
```

### Repo 級別（只在特定 repo 生效）

```bash
cd /path/to/your/project
npm install shiftblame
```

### 初始化

首次執行 `/secretary` 時，秘書會自動偵測並初始化 `~/.shiftblame/` 完整目錄結構、repo 內 symlink、檢查 `.gitignore`。已有內容的 REPO.md 和 BLAME.md 會保留，空目錄才初始化。

---

## 使用

### 直接對話

每次對話開始時，輸入「秘書」啟用秘書模式，再輸入需求。還沒想清楚也可以先啟用再諮詢。

### 派工流程

```
老闆 → 秘書（預審 + 選 model + 決定切入點）→ 循環圓依序執行 → 秘書（彙報）→ 老闆
```

1. 秘書收到老闆原話，評估認知複雜度，決定從循環圓哪個節點切入
2. 向老闆預審「從哪個部門開始、做什麼、用哪個 model」
3. 老闆 OK 後，按循環圓順序逐一部門派工
4. 每個部門只能讀自己 + 上一流程的產出
5. 主管親自執行所有職能，完成後回報
6. 秘書收齊所有主管回報後，向老闆做最終彙報

### 秘書接手後

1. 偵測 `.shiftblame/` 是否存在，不存在則自動初始化（先讀現有內容，有就保留）
2. 掃描 `.claude/agents/` 取得可用部門清單
3. 保存你的**原話逐字稿**
4. 評估認知複雜度，決定使用哪個 model
5. 每個部門啟動前先用人話告訴你「派哪個部門、做什麼、用哪個 model」，你回 OK 才繼續
6. 建立 worktree 隔離環境（shiftblame 自定義 worktree，非 Claude 內建）
7. 部門主管親自執行所有職能，產出寫入 `~/.shiftblame/<repo>/<DEPT>/<slug>.md`
8. 主管回報「做了什麼 / 問題 / 解決方式 / 結果」
9. 秘書收齊回報後對照原話，呈報「完全達成 X / 部分達成 Y / 未達成 Z」
10. 秘書負責寫入犯錯紀錄、提煉跨專案通用常識與專案常識
11. 完成後自動同步 README.md

你在過程中只需要：

- **OK**：繼續推
- **不 OK + 原因**：秘書會判斷該推給哪個部門重做

---

## 授權

> _「倉庫已經發出來了，接下來怎麼用就不是我的鍋了。」_

MIT
