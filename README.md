<div align="center">

# 🍲 shiftblame

### 推鍋

_一套給 [Claude Code](https://claude.com/claude-code) 用的 8 層專業分工推鍋流水線_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-8a2be2.svg)](https://claude.com/claude-code)
[![Agents](https://img.shields.io/badge/agents-8-blue.svg)](#這是什麼)
[![Language](https://img.shields.io/badge/lang-繁體中文-red.svg)](#)

> _「這不是我的鍋。」_

**[誰的鍋](#誰的鍋)** · **[運作原理](#運作原理)** · **[安裝](#安裝)** · **[使用](#使用)**

</div>

---

老闆（你）說一句話，秘書把需求從 **企劃 → 架構 → 規劃 → 測試 → 開發 → E2E → 稽核驗收 → 上線** 一路推到底。每一層都有專門的 agent 負責，每一層開工前還要先翻成人話請老闆預審，最後由秘書親自對照老闆原話確認達成進度。

還沒想清楚？秘書也能幫你**釐清方向**——用結構化問答收斂需求，確認後再推鍋。

**推鍋如流水，一路推到底。**

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
| `quality-assurance` | 測試沒涵蓋 spec 的驗收條件、測試寫錯（不該過的會過） |
| `feature-developer` | 實作偏離 spec、引入新 bug、改了測試檔 |
| `quality-control` | e2e 場景遺漏關鍵流程、環境設定錯誤導致假綠 |
| `audit-reviewer` | 該抓的沒抓到（放水）、退回理由不具體導致重工 |
| `operations-engineer` | 部署步驟與 dag 不符、上線後 smoke test 沒跑或漏驗 |

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

### 檔案結構

```
~/.shiftblame/                               # 推鍋產物（家目錄）
├── blame/                                   # 鍋紀錄（所有 repo 共用）
│   ├── product-planner/BLAME.md
│   ├── system-architect/BLAME.md
│   ├── project-manager/BLAME.md
│   ├── quality-assurance/BLAME.md
│   ├── feature-developer/BLAME.md
│   ├── quality-control/BLAME.md
│   ├── audit-reviewer/BLAME.md
│   ├── operations-engineer/BLAME.md
│   ├── secretary/BLAME.md
│   └── boss/BLAME.md
└── <repo>/                                  # 每個 repo 各自一個目錄
    ├── docs/
    │   ├── prd/<slug>.md
    │   ├── dag/<slug>.md
    │   ├── spec/<slug>.md
    │   ├── basis/<slug>.md
    │   ├── devlog/<slug>.md
    │   ├── e2e/<slug>.md
    │   ├── audit/<slug>.md
    │   └── ops/<slug>.md
    └── report/
        └── <YYYY-MM-DD_HHMMSS>-<slug>.md   # 秘書最終對照報告

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

> **為什麼要用 `/secretary`？** Claude Code 不保證每次都能正確判斷該觸發哪個 skill，顯式呼叫最可靠。

秘書接手後會：

1. 保存你的**原話逐字稿**
2. 取 slug、建立共享 worktree
3. 在每一層啟動前先用人話告訴你「接下來要做的事」，你回 OK 才繼續
4. 全鏈路跑完後，親自對照原話產出**秘書最終確認報告**
5. 呈報「完全達成 X / 部分達成 Y / 未達成 Z」

你在過程中只需要：

- ✅ **OK**：繼續推
- ❌ **不 OK + 原因**：秘書會自己判斷該退回哪一層重跑

---

## 授權

> _「倉庫已經發出來了，接下來怎麼用就不是我的鍋了。」_

MIT 
