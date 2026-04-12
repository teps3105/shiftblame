<div align="center">

# 🍲 shiftblame

### 推鍋

_一套明確責任歸屬的 Agents 開發框架_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-8a2be2.svg)](https://claude.com/claude-code)
[![Agents](https://img.shields.io/badge/agents-29-blue.svg)](#三級架構)
[![Language](https://img.shields.io/badge/lang-繁體中文-red.svg)](#)

> _「這不是我的鍋。」_

**[誰的鍋](#誰的鍋)** · **[運作原理](#運作原理)** · **[安裝](#安裝)** · **[使用](#使用)**

</div>

---

秘書動態掃描 agents 目錄，把正確的需求推給正確的部門。每個部門該誰負責、出了事該找誰，白紙黑字記在鍋紀錄裡。

還沒想清楚？秘書也能幫你**釐清方向**——用結構化問答收斂需求，確認後再推鍋。

---

## 三級架構

| 級別 | 定位 | 模型 | 部門 |
|------|------|------|------|
| **L1** | 支援與維運 | **haiku** | MIS、ADM、OPS（+cloud、infra）、AUTO（+ci、cd） |
| **L2** | 開發執行 | **sonnet** | PM、DEV（+fe、be、db）、QA（+unit、integ、e2e） |
| **L3** | 規劃決策 | **opus** | PRD、ARC、MKT、QC（+edge、fuzz、user）、SEC（+audit、consistency、red、blue） |

---

## 誰的鍋？

每個部門都有自己的 `~/.shiftblame/blame/<Ln>/<DEPT>/<role>/BLAME.md`，犯錯就記，下次避雷。

### 老闆的鍋

| 情境 | 為什麼是老闆的鍋 | 回退方式 |
|------|------------------|----------|
| **老闆明示直接修改**：親口說「直接改」「不用跑流程」 | 老闆下令跳過流程，改壞了自己扛。commit 以 `BOSS-HOTFIX:` 為前綴 | `git revert` |

### 秘書的鍋

| 情境 | 為什麼是秘書的鍋 |
|------|------------------|
| **路由判錯**：需求推給了錯誤的部門導致重工 | 秘書職責就是判斷該推給誰 |
| **退回判錯**：老闆說不 OK 時推給了錯誤的部門 | 秘書職責就是判斷根因在哪 |

### 各部門的鍋

| 部門 | 典型犯錯情境 |
|------|-------------|
| L3 PRD | PRD 漏掉老闆明確提到的需求、自作主張加了老闆沒說的東西 |
| L3 ARC | 技術選型不可行、模組拆分導致後續無法實作 |
| L3 MKT | 市調資料不準確、遺漏更好的替代方案 |
| L2 PM | 驗收條件與 PRD 矛盾、任務依賴排錯導致卡關 |
| L2 QA | 測試涵蓋度不足、拆分任務不當導致測試工程師產出衝突 |
| L2 DEV | 實作偏離 spec、引入新 bug、拆分任務不當導致工程師產出衝突 |
| L3 QC | e2e 場景遺漏關鍵流程、邊緣/模糊測試不足 |
| L3 SEC | 該抓的沒抓到（放水）、退回理由不具體、安全掃描遺漏 |
| L1 OPS | 部署步驟與 ARC 不符、上線後 smoke test 沒跑或漏驗 |
| L1 AUTO | CI/CD pipeline 配置錯誤、合併出包、rollback 機制失效 |
| L1 MIS | 環境盤點遺漏、安裝了錯誤版本的工具 |
| L1 ADM | 聚合遺漏、REPO.md 格式錯亂、誤刪 STM 檔案 |

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
| 全新功能 / 方向性變更 | L3 PRD |
| 技術選型 / 工具比較 | L3 MKT |
| 架構調整 / 技術遷移 | L3 ARC |
| 加細節 / 改驗收條件 | L2 PM |
| 測試不足 / 要補測試 | L2 QA |
| 已知 bug / 程式修正 | L2 DEV |
| 使用者體驗問題 | L3 QC |
| 部署 / 上線方式調整 | L1 OPS |
| 環境 / 工具問題 | L1 MIS |
| CI/CD / 自動化調整 | L1 AUTO |

全新功能的典型路徑：`PRD → ARC → MIS → PM → QA → DEV → QC → SEC → AUTO CI(合併) → OPS`，但秘書可依實際需求動態跳過或新增步驟。

### 檔案結構

```
~/.shiftblame/
├── blame/                                       # 鍋紀錄（所有 repo 共用）
│   ├── L1/{ADM,MIS}/LEAD/BLAME.md
│   ├── L1/OPS/{LEAD,cloud,infra}/BLAME.md
│   ├── L1/AUTO/{LEAD,ci,cd}/BLAME.md
│   ├── L2/PM/LEAD/BLAME.md
│   ├── L2/DEV/{LEAD,fe,be,db}/BLAME.md
│   ├── L2/QA/{LEAD,unit,integ,e2e}/BLAME.md
│   ├── L3/{PRD,ARC,MKT}/LEAD/BLAME.md
│   ├── L3/QC/{LEAD,edge,fuzz,user}/BLAME.md
│   ├── L3/SEC/{LEAD,audit,consistency,red,blue}/BLAME.md
│   ├── secretary/BLAME.md
│   └── boss/BLAME.md
└── <repo>/
    ├── L1/{MIS,OPS,AUTO}/<slug>.md
    ├── L2/{PM,DEV,QA}/<slug>.md
    ├── L3/{PRD,ARC,MKT,QC,SEC}/<slug>.md
    ├── report/<YYYY-MM-DD_HHMMSS>-<slug>.md
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

### 版本升級

```bash
npm update -g shiftblame   # 或 npm update shiftblame
```

升級後在 repo 中執行：

```
/blame-update
```

這會讀懂舊版鍋紀錄的**實際內容**，按新版組織架構的責任歸屬重新分配到正確的部門。既有的鍋不會丟失——無法自動判斷的會放入待審區，由秘書呈報老闆手動分配。

秘書在推鍋時也會自動偵測：目錄結構與 agents 不一致時，自動呼叫 `/blame-update`。

---

## 使用

在 Claude Code 中用 `/secretary` 呼叫秘書：

```
/secretary 幫我做一個 Markdown 轉 HTML 的 CLI
```

```
/secretary 我想要一個可以記錄每日心情的終端小工具
```

還沒想清楚？也可以諮詢：

```
/secretary 我在猶豫要用 REST 還是 GraphQL，你覺得呢
```

秘書會用結構化問答幫你收斂方向，確認後才開始推鍋。

### 聚合鍋紀錄

當各部門的 BLAME.md 累積了一定歷史後，可以執行：

```
/blame-reflect
```

掃描所有部門的鍋紀錄，將「下次怎麼避免」提煉成**常識（規則）**，將「背後的機制」提煉成**認知（模型）**，寫回各 BLAME.md 檔頭。

### 秘書接手後

1. 掃描 `.claude/agents/` 取得可用部門清單
2. 保存你的**原話逐字稿**
3. 每個部門啟動前先用人話告訴你「接下來要做的事」，你回 OK 才繼續
4. 完成後親自對照原話產出**秘書最終確認報告**
5. 呈報「完全達成 X / 部分達成 Y / 未達成 Z」
6. 通知 L1 ADM 進行文件聚合

你在過程中只需要：

- **OK**：繼續推
- **不 OK + 原因**：秘書會判斷該推給哪個部門重做

---

## 授權

> _「倉庫已經發出來了，接下來怎麼用就不是我的鍋了。」_

MIT
