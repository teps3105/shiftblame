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
| PRD | 需求文件 + 架構設計 + 市場調研 | PRD 漏掉老闆明確提到的需求、自作主張加了老闆沒說的東西、技術選型不可行、市調資料不準確 |
| QA | 單元測試 + 整合測試 + E2E 測試設計 | 測試涵蓋度不足、測試設計與驗收條件脫節 |
| DEV | 前端 + 後端 + 資料庫全端實作 | 實作偏離 spec、引入新 bug、模組間介面不一致 |
| QC | E2E 執行 + 稽核 + 邊緣/模糊測試 + 一致性 + 可用性 | 品管場景遺漏關鍵流程、邊緣/模糊測試不足、一致性遺漏、使用者體驗問題 |
| SEC | 工具審核 + 紅隊攻擊 + 藍隊防禦 | 該抓的沒抓到（放水）、退回理由不具體、安全掃描遺漏 |
| MIS | 環境盤點 + CI/CD + 合併 + 部署 | 環境盤點遺漏、CI/CD pipeline 配置錯誤、合併出包、部署失敗 |

---

## 運作原理

### 循環圓（標準作業流程）

六個部門形成封閉循環，嚴格按順序執行：

```
        ┌─── SEC（法遵 / 安全基線）
        │     只讀：SEC + MIS
        │
        ├─── QA（做事前法遵 → 測試設計）
        │     只讀：QA + SEC
        │
        ├─── PRD（做規劃開發 → 需求 + 架構）
        │     只讀：PRD + QA
        │
        ├─── DEV（做規劃開發 → 全端實作）
        │     只讀：DEV + PRD
        │
        ├─── QC（做品控上線 → 驗收）
        │     只讀：QC + DEV
        │
        └─── MIS（做品控上線 → 部署）
              只讀：MIS + QC
              │
              └→ 回到 SEC（下一輪）
```

### 資料存取限制

每個部門**只能讀兩個資料夾**：自己的 + 上一流程的。嚴禁偷看其他部門。

| 部門 | 可讀自己 | 可讀上一流程 |
|---|---|---|
| SEC | `~/.shiftblame/<repo>/SEC/` | `~/.shiftblame/<repo>/MIS/` |
| QA | `~/.shiftblame/<repo>/QA/` | `~/.shiftblame/<repo>/SEC/` |
| PRD | `~/.shiftblame/<repo>/PRD/` | `~/.shiftblame/<repo>/QA/` |
| DEV | `~/.shiftblame/<repo>/DEV/` | `~/.shiftblame/<repo>/PRD/` |
| QC | `~/.shiftblame/<repo>/QC/` | `~/.shiftblame/<repo>/DEV/` |
| MIS | `~/.shiftblame/<repo>/MIS/` | `~/.shiftblame/<repo>/QC/` |

### 秘書調度流程

```
 老闆說話
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

| 需求性質 | 切入點 | 完整路徑 |
|---|---|---|
| 全新功能 | SEC | SEC → QA → PRD → DEV → QC → MIS |
| 安全合規問題 | SEC | SEC → QA → PRD → DEV → QC → MIS |
| 測試不足 | QA | QA → PRD → DEV → QC → MIS → SEC |
| 需求 / 架構變更 | PRD | PRD → DEV → QC → MIS → SEC → QA |
| 已知 bug / 程式修正 | DEV | DEV → QC → MIS → SEC → QA → PRD |
| 品質驗收問題 | QC | QC → MIS → SEC → QA → PRD → DEV |
| 部署 / 上線問題 | MIS | MIS → SEC → QA → PRD → DEV → QC |

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

### Skills

| Skill | 用途 | 觸發方式 |
|---|---|---|
| `secretary` | 推鍋入口。初始化環境、派工、寫鍋紀錄、提煉常識、同步 README，全部整合在一個 skill 中 | `/secretary` |

### 顯式呼叫

每個 session 開始時，使用 `/secretary` 進入秘書模式：

```
/secretary 幫我做一個 Markdown 轉 HTML 的 CLI
```

還沒想清楚？也可以諮詢：

```
/secretary 我在猶豫要用 REST 還是 GraphQL，你覺得呢
```

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
