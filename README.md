<div align="center">

# 🍲 shiftblame

### 推鍋

_一套明確責任歸屬的 Agents 開發框架_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-8a2be2.svg)](https://claude.com/claude-code)
[![Agents](https://img.shields.io/badge/agents-16-blue.svg)](#這是什麼)
[![Language](https://img.shields.io/badge/lang-繁體中文-red.svg)](#)

> _「這不是我的鍋。」_

**[誰的鍋](#誰的鍋)** · **[運作原理](#運作原理)** · **[安裝](#安裝)** · **[使用](#使用)**

</div>

---

需求從企劃推到上線，經過 **L1–L4 四級 agent**。每一層該誰負責、出了事該找誰，白紙黑字記在鍋紀錄裡。

還沒想清楚？秘書也能幫你**釐清方向**——用結構化問答收斂需求，確認後再推鍋。

---

## 誰的鍋？

每個角色都有自己的 `~/.shiftblame/blame/<role>/BLAME.md`，犯錯就記，下次避雷。

### 老闆的鍋

| 情境 | 為什麼是老闆的鍋 | 回退方式 |
|------|------------------|----------|
| **大環境問題**：缺 API key、缺套件、缺權限⋯⋯ | 「換更強的 agent 在同一環境裡做得了嗎？」做不了 = 環境的鍋 = 老闆的鍋 | 老闆補好環境條件後重啟 |
| **老闆明示直接修改**：親口說「直接改」「不用跑流程」 | 老闆下令跳過流程，改壞了自己扛。commit 以 `BOSS-HOTFIX:` 為前綴 | `git revert` |

### 秘書的鍋

| 情境 | 為什麼是秘書的鍋 |
|------|------------------|
| **判鍋判錯**：起點層判斷錯誤導致重工 | 秘書職責就是判斷該從哪層開始 |
| **退回判錯**：老闆說不 OK 時退回了錯誤的層 | 秘書職責就是判斷根因在哪層 |
| **合併出包**：rebase / merge --squash 過程出錯 | 合併是秘書親自執行的 |

### 各層 agent 的鍋

| 角色 | 典型犯錯情境 |
|------|-------------|
| `product-planner` | PRD 漏掉老闆明確提到的需求、自作主張加了老闆沒說的東西 |
| `system-architect` | 技術選型不可行、模組拆分導致後續無法實作 |
| `project-manager` | 驗收條件與 PRD 矛盾、任務依賴排錯導致卡關 |
| `quality-assurance` | **測試主管**：拆分任務不當導致測試工程師產出衝突、收合不完整、測試涵蓋度不足。底下三個測試工程師（unit-test-engineer / integration-test-engineer / e2e-test-engineer）的鍋也由主管扛 |
| `feature-developer` | **開發主管**：拆分任務不當導致職能工程師產出衝突、收合不完整、實作偏離 spec、引入新 bug。底下兩個職能工程師（frontend-engineer / backend-engineer）的鍋也由主管扛 |
| `quality-control` | e2e 場景遺漏關鍵流程、環境設定錯誤導致假綠 |
| `security-auditor` | 該抓的沒抓到（放水）、退回理由不具體導致重工、安全掃描遺漏 |
| `cloud-engineer` | 部署步驟與 dag 不符、上線後 smoke test 沒跑或漏驗 |
| `mis-engineer` | 環境盤點遺漏、安裝了錯誤版本的工具 |
| `infra-engineer` | 基建配置錯誤、CI/CD pipeline 不正確 |

### 行政文書的鍋

| 情境 | 為什麼是行政文書的鍋 |
|------|---------------------|
| **聚合遺漏**：未掃描到應聚合的舊文件 | 文件聚合是行政文書唯一職責 |
| **REPO.md 格式錯亂**：聚合後內容不完整或格式錯誤 | 聚合品質由行政文書負責 |
| **誤刪 STM 檔案**：刪掉應保留的最新 3 筆 | 保留規則由行政文書執行 |

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
 老闆原話       ┌──────────────────────┐
 留底           │ 諮詢模式             │
   │            │ 結構化問答釐清方向   │
   │            │ 確認後才推鍋         │
   │            └──────────┬───────────┘
   │                       │
   │◄──────────────────────┘
   ▼
 ┌─────────────────────────┐
 │ 秘書預審（翻成人話）    │ ← 每一層啟動前都要過這個閘門
 │ 老闆只回「OK / 不 OK」  │   老闆不需要知道內部有哪些角色
 └─────────┬───────────────┘
           │
   ┌───────┴────────┐
   │                │
  OK                不 OK（附原因或新需求）
   │                │
   ▼                ▼
 啟動該層     秘書判斷根因在哪層，
 agent        把鍋丟給正確的人重跑
   │
   ▼
 產出文件 + commit
   │
   ▼
 下一層繼續（再走一次預審）
```

### 四級架構

| 級別 | 定位 | 模型 | 成員 |
|------|------|------|------|
| **L1** | 日常支援 | sonnet | MIS 工程師、行政文書 |
| **L2** | 日常維運 | sonnet | 雲端工程師、基建工程師 |
| **L3** | 開發執行 | sonnet | 品管、開發經理（+前端、後端）、品保（+3 測試工程師） |
| **L4** | 規劃決策 | **opus** | 企劃師、架構師、專案經理、資安稽核 |

### 推鍋鏈

| # | 級別 | 角色 | 產出 | 主要工作 |
|---|------|------|------|---------|
| 1 | L4 | product-planner    | prd    | 把老闆原話轉 PRD |
| 2 | L4 | system-architect   | dag    | 技術選型、模組拓撲、檔案結構、介面簽章、部署方案 |
| — | L1 | mis-engineer       | env    | 讀 dag 盤點環境、安裝工具 |
| — | L2 | infra-engineer     | infra  | 基建需求（若 MIS 轉介） |
| 3 | L4 | project-manager    | spec   | 功能拆解、驗收條件、任務依賴 |
| 4 | L3 | quality-assurance  | basis  | 依 dag + spec 寫測試（TDD 紅）= **QA 定規則** |
| 5 | L3 | feature-developer  | devlog | 寫最小實作讓測試全綠（TDD 綠），子 agent：前端 + 後端 |
| 6 | L3 | quality-control    | e2e    | 使用者視角 e2e 測試並實際執行 = **QC 依規則驗收** |
| 7 | L4 | security-auditor   | audit  | 整條鏈路驗收 + 安全掃描 |
| 8 | L2 | cloud-engineer     | ops    | 在 main 依 dag 方案實際上線 |

**L1 行政文書**不參與推鍋鏈主流程，只在鏈路完成後進行文件聚合。

### 檔案結構

```
~/.shiftblame/                                        # 推鍋產物（家目錄）
├── blame/                                            # 鍋紀錄（所有 repo 共用）
│   ├── L1/
│   │   ├── ADM/LEAD/BLAME.md                        # 行政文書
│   │   └── MIS/LEAD/BLAME.md                        # MIS
│   ├── L2/
│   │   ├── OPS/
│   │   │   ├── LEAD/BLAME.md                        # 維運主管
│   │   │   ├── cloud/BLAME.md                       # 雲端工程師
│   │   │   └── infra/BLAME.md                       # 基建工程師
│   │   └── AUTO/
│   │       ├── LEAD/BLAME.md                        # 自動化主管
│   │       ├── ci/BLAME.md                          # CI 工程師
│   │       └── cd/BLAME.md                          # CD 工程師
│   ├── L3/
│   │   ├── PM/LEAD/BLAME.md                         # 專案經理
│   │   ├── DEV/
│   │   │   ├── LEAD/BLAME.md                        # 開發主管
│   │   │   ├── fe/BLAME.md                          # 前端
│   │   │   └── be/BLAME.md                          # 後端
│   │   └── QA/
│   │       ├── LEAD/BLAME.md                        # 品保主管
│   │       ├── unit/BLAME.md                        # 單元測試
│   │       ├── integ/BLAME.md                       # 整合測試
│   │       └── e2e/BLAME.md                         # E2E 測試
│   ├── L4/
│   │   ├── PRD/LEAD/BLAME.md                        # 企劃師
│   │   ├── ARC/LEAD/BLAME.md                        # 架構師
│   │   ├── QC/
│   │   │   ├── LEAD/BLAME.md                        # 品管主管
│   │   │   ├── edge/BLAME.md                        # 邊緣測試
│   │   │   └── fuzz/BLAME.md                        # 模糊測試
│   │   └── SEC/
│   │       ├── LEAD/BLAME.md                        # 資安主管
│   │       ├── red/BLAME.md                         # 紅隊
│   │       └── blue/BLAME.md                        # 藍隊
│   ├── secretary/BLAME.md
│   └── boss/BLAME.md
└── <repo>/                                           # 每個 repo 各自一個目錄
    ├── L1/
    │   └── MIS/<slug>.md                            # env 環境準備
    ├── L2/
    │   ├── OPS/<slug>.md                            # ops 部署紀錄
    │   └── AUTO/<slug>.md                           # 自動化紀錄
    ├── L3/
    │   ├── PM/<slug>.md                             # spec 規格
    │   ├── DEV/<slug>.md                            # devlog 開發筆記
    │   └── QA/<slug>.md                             # basis 測試設計
    ├── L4/
    │   ├── PRD/<slug>.md                            # prd 需求
    │   ├── ARC/<slug>.md                            # dag 架構
    │   ├── QC/<slug>.md                             # e2e 品管報告
    │   └── SEC/<slug>.md                            # audit 稽核報告
    ├── report/
    │   └── <YYYY-MM-DD_HHMMSS>-<slug>.md            # 秘書最終對照報告
    └── REPO.md                                      # 文件聚合檔（長期記憶）

~/.worktree/                                 # 共享 worktree（家目錄）
└── <repo>/
    └── <slug>/                              # 前 7 棒的工作目錄

<repo>/                                      # repo 根目錄
├── .shiftblame/                             # symlink 目錄
│   ├── <repo> → ~/.shiftblame/<repo>/       # 本 repo 的 docs + report
│   └── blame → ~/.shiftblame/blame/         # 鍋紀錄
└── .worktree/
    └── <slug> → ~/.worktree/<repo>/<slug>/  # worktree symlink
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

### 初始化鍋目錄

安裝完成後，在目標 repo 中執行：

```
/shiftblame-link
```

這會在 repo 根目錄建立 `.shiftblame/` symlink 指向 `~/.shiftblame/`。每個要用推鍋的 repo 都要跑一次。

---

## 使用

在 Claude Code 中用 `/secretary` 顯式呼叫秘書：

```
/secretary 幫我做一個 Markdown 轉 HTML 的 CLI
```

```
/secretary 我想要一個可以記錄每日心情的終端小工具
```

還沒想清楚？也可以直接跟秘書諮詢：

```
/secretary 我在猶豫要用 REST 還是 GraphQL，你覺得呢
```

```
/secretary 我不確定這個功能該怎麼做比較好，幫我想想
```

秘書會用結構化問答幫你收斂方向，確認後才開始推鍋。

### 聚合鍋紀錄

當各角色的 BLAME.md 累積了一定歷史後，可以執行：

```
/shiftblame-reflect
```

這會掃描所有角色的鍋紀錄，將「下次怎麼避免」提煉成**常識（規則）**，將「背後的機制」與「為什麼這條規則有效」提煉成**認知（模型）**，重新寫回各角色的 BLAME.md 檔頭。

> **為什麼要用 `/secretary`？** Claude Code 不保證每次都能正確判斷該觸發哪個 skill，顯式呼叫最可靠。

秘書接手後會：

1. 保存你的**原話逐字稿**
2. 取 slug、建立共享 worktree
3. 在每一層啟動前先用人話告訴你「接下來要做的事」，你回 OK 才繼續
4. 全鏈路跑完後，親自對照原話產出**秘書最終確認報告**
5. 呈報「完全達成 X / 部分達成 Y / 未達成 Z」
6. 通知**行政文書**進行文件聚合——各部門目錄只保留最新 3 筆，其餘聚合至 `REPO.md`

你在過程中只需要：

- ✅ **OK**：繼續推
- ❌ **不 OK + 原因**：秘書會自己判斷該退回哪一層重跑

---

## 授權

> _「倉庫已經發出來了，接下來怎麼用就不是我的鍋了。」_

MIT 
