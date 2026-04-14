<div align="center">

# shiftblame

### 推鍋

_一套明確責任歸屬的 Agents 開發框架_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-8a2be2.svg)](https://claude.com/claude-code)
[![Agents](https://img.shields.io/badge/agents-25-blue.svg)](#資源供給機制)
[![Skills](https://img.shields.io/badge/skills-4-9cf.svg)](#skills)
[![Language](https://img.shields.io/badge/lang-繁體中文-red.svg)](#)

> _「這不是我的鍋。」_

**[誰的鍋](#誰的鍋)** · **[運作原理](#運作原理)** · **[安裝](#安裝)** · **[使用](#使用)**

</div>

---

秘書動態掃描 agents 目錄，把正確的需求推給正確的部門。每個部門該誰負責、出了事該找誰，白紙黑字記在鍋紀錄裡。

還沒想清楚？秘書也能幫你**釐清方向**——用結構化問答收斂需求，確認後再推鍋。

---

## 資源供給機制

模型分配**按角色類型**，不按部門層級：

| 角色類型 | 模型 | 對象 |
|----------|------|------|
| **主管 / 秘書**（擋錯把關） | **opus** | PRD、DEV、QA、QC、SEC、MIS、SECRETARY |
| **執行職級**（sub-agent） | **opus** / **sonnet** / **haiku**（依任務複雜度） | 由主管按任務複雜度分配 |

---

## 誰的鍋

每個部門都有自己的 `~/.shiftblame/blame/<DEPT>/<role>/BLAME.md`，犯錯就記，下次避雷。

### 秘書的鍋

| 情境 | 為什麼是秘書的鍋 |
|------|------------------|
| **路由判錯**：需求推給了錯誤的部門導致重工 | 秘書職責就是判斷該推給誰 |
| **退回判錯**：老闆說不 OK 時推給了錯誤的部門 | 秘書職責就是判斷根因在哪 |

### 各部門的鍋

| 部門 | 典型犯錯情境 |
|------|-------------|
| PRD | PRD 漏掉老闆明確提到的需求、自作主張加了老闆沒說的東西、技術選型不可行、市調資料不準確 |
| QA | 測試涵蓋度不足、拆分任務不當導致測試工程師產出衝突 |
| DEV | 實作偏離 spec、引入新 bug、拆分任務不當導致工程師產出衝突 |
| QC | 品管場景遺漏關鍵流程、邊緣/模糊測試不足、一致性遺漏、使用者體驗問題 |
| SEC | 該抓的沒抓到（放水）、退回理由不具體、安全掃描遺漏 |
| MIS | 環境盤點遺漏、CI/CD pipeline 配置錯誤、合併出包、部署失敗 |

---

## 運作原理

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
 │ 掃描 agents 目錄        │
 │ 判斷該推給哪個部門      │
 └─────────┬───────────────┘
           │
   ┌───────┴────────┐
   │                │
 預審 OK          不 OK
   │                │
   ▼                ▼
 啟動該部門    秘書判斷根因，
   │           推給正確的部門重做
   ▼
 收回傳 → 判斷下一步
   │
   ▼
 完成 → 秘書對照原話 → 呈報老闆
```

### 需求路由

秘書根據需求性質，把鍋推給對的部門：

| 需求性質 | 推給 |
|---|---|
| 全新功能 / 方向性變更 | PRD |
| 技術選型 / 工具比較 | PRD |
| 架構調整 / 技術遷移 | PRD |
| 加細節 / 改驗收條件 | DEV |
| 測試不足 / 要補測試 | QA |
| 已知 bug / 程式修正 | DEV |
| 使用者體驗問題 | QC |
| 部署 / 上線方式調整 | MIS |
| 環境 / 工具問題 | MIS |
| CI/CD / 自動化調整 | MIS |

全新功能的標準開發路徑：`PRD → QA → DEV → QC`，秘書可依實際需求動態調整步驟。

### 檔案結構

```
~/.shiftblame/
├── blame/                                       # 鍋紀錄（所有 repo 共用）
│   ├── DEV/{fe,be,db}/BLAME.md
│   ├── MIS/{infra,cicd,cloud}/BLAME.md
│   ├── PRD/{plan,arch,market}/BLAME.md
│   ├── QA/{unit,integ,e2e}/BLAME.md
│   ├── QC/{test,uni,user}/BLAME.md
│   ├── SEC/{red,white,blue}/BLAME.md
│   └── SECRETARY/BLAME.md
└── <repo>/
    ├── {MIS}/<slug>.md
    ├── {DEV,QA}/<slug>.md
    ├── {PRD,QC,SEC}/<slug>.md
    └── REPO.md

~/.worktree/<repo>/<slug>/                       # 共享 worktree

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

安裝完成後，在目標 repo 中執行：

```
/blame-init
```

建立 `~/.shiftblame/` 完整目錄結構、repo 內 symlink、檢查 `.gitignore`。秘書在首次推鍋時也會自動偵測並執行初始化。

---

## 使用

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
老闆 → 秘書（預審）→ 部門主管（分配工程師）→ 工程師（執行）→ 主管（收合回報）→ 秘書（彙報）→ 老闆
```

1. 秘書收到老闆原話，向老闆預審「派哪個部門、做什麼」
2. 老闆 OK 後，秘書派工給部門主管（可建議人選但不強制）
3. 主管自行決定派給哪個工程師，等待回報
4. 主管向秘書回報「誰做了什麼 / 問題 / 解決方式 / 結果」
5. 遇問題時主管回報秘書進行跨部門或部門內協調
6. 秘書收齊所有主管回報後，向老闆做最終彙報

### 聚合鍋紀錄

當各部門的 BLAME.md 累積了一定歷史後，可以執行：

```
/blame-reflect
```

掃描所有部門的鍋紀錄，將「下次怎麼避免」提煉成**常識（規則）**，將「背後的機制」提煉成**認知（模型）**，寫回各 BLAME.md 檔頭。

### 聚合文件

```
/repo-reflect
```

掃描各 repo 的部門目錄，將舊紀錄合併至 `REPO.md`，每個部門保留最新 3 筆。原檔保留不刪。

### 同步 README

```
/update-readme
```

掃描專案現狀（agents、skills、hooks、config、目錄結構），將 README.md 同步為最新。適用於任何 Claude Code 專案。

### 秘書接手後

1. 掃描 `.claude/agents/` 取得可用部門清單
2. 保存你的**原話逐字稿**
3. 每個部門啟動前先用人話告訴你「派哪個部門、做什麼」，你回 OK 才繼續
4. 部門主管自行分配工程師、執行後回報「誰做了什麼 / 問題 / 解決方式 / 結果」
5. 秘書收齊回報後對照原話，呈報「完全達成 X / 部分達成 Y / 未達成 Z」
6. 完成後依序自動執行 `blame-reflect` → `repo-reflect` → `update-readme`

你在過程中只需要：

- **OK**：繼續推
- **不 OK + 原因**：秘書會判斷該推給哪個部門重做

---

## 授權

> _「倉庫已經發出來了，接下來怎麼用就不是我的鍋了。」_

MIT
