<div align="center">

# 🍲 shiftblame

### 推鍋大師 · Push-Blame Pipeline for Claude Code

_一套給 [Claude Code](https://claude.com/claude-code) 用的 8 層專業分工推鍋流水線_

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-8a2be2.svg)](https://claude.com/claude-code)
[![Agents](https://img.shields.io/badge/agents-8-blue.svg)](#這是什麼)
[![Language](https://img.shields.io/badge/lang-繁體中文-red.svg)](#)

> _「這件事不歸我管 —— 但老闆說的話，我幫他記著。」_

**[這是什麼](#這是什麼)** · **[運作原理](#運作原理)** · **[安裝](#安裝)** · **[使用](#使用)** · **[設計理念](#設計理念)**

</div>

---

老闆（你）說一句話，秘書把需求從 **企劃 → 架構 → 規劃 → 測試 → 開發 → E2E → 稽核驗收 → 上線** 一路推到底。每一層都有專門的 agent 負責，每一層開工前還要先翻成人話請老闆預審，最後由秘書親自對照老闆原話確認達成進度。

還沒想清楚？秘書也能幫你**釐清方向**——用結構化問答收斂需求，確認後再推鍋。

**推鍋如流水，一路推到底。**

---

## 這是什麼

`shiftblame` 是一個 Claude Code 的 `.claude/` 配置包，內含：

- **1 個 skill**：`secretary`（秘書/鍋長）—— 老闆沒想清楚時諮詢釐清方向、接老闆需求、建立共享 worktree、逐層交棒、每層預審、合併進 main、最後原話對照
- **8 個 subagent**：一條完整的軟體工程流水線

| # | 角色 | 產出 | 職責 |
|---|------|------|------|
| 1 | `product-planner`    | `prd`    | 把老闆原話轉寫成 PRD |
| 2 | `system-architect`   | `dag`    | 技術選型、模組拓撲、檔案結構、介面簽章、部署方案 |
| 3 | `project-manager`    | `spec`   | 功能拆解、驗收條件、任務依賴 |
| 4 | `quality-assurance`  | `basis`  | 依 dag + spec 寫單元 / 整合測試（TDD 紅） |
| 5 | `feature-developer`  | `devlog` | 寫最小實作讓測試全綠（TDD 綠） |
| 6 | `quality-control`    | `e2e`    | 使用者視角 e2e 測試並實際執行 |
| 7 | `audit-reviewer`     | `audit`  | 整條鏈路驗收，回傳 ACCEPTED / REJECTED |
| 8 | `operations-engineer`| `ops`    | 在 main 依 dag 方案實際上線並驗證 |

每個 agent 只做自己份內的事，**絕不越權**。

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

前 7 棒都在同一個**共享 git worktree**（`~/.worktree/<repo>/<slug>`）和**同一個分支**上工作，所有修正都是 append-only commit。repo 根目錄的 `.worktree/<slug>` symlink 指向對應 worktree，支援多線並行推鍋。

第 7 棒 `audit-reviewer` 驗收通過後回傳 ACCEPTED，**由秘書親自執行合併**：`git rebase` + `git merge --squash` 壓成 main 上一個乾淨 commit。合併前秘書會再過一次預審閘門讓老闆確認。feature 分支保留供歷史追溯。

第 8 棒 `operations-engineer` 接手合併後的 main，依 dag 部署方案實際上線。

### 檔案結構

所有推鍋產物存在 **`~/.shiftblame/`**（使用者家目錄）。repo 根目錄有 `.shiftblame` symlink 指向它：

```
~/.shiftblame/
├── blame/                               # 所有 repo 共用的鍋紀錄
│   ├── product-planner/BLAME.md
│   ├── ...
│   ├── secretary/BLAME.md
│   └── boss/BLAME.md                    # 老闆的鍋
├── <repo>/                              # 每個 repo 各自一個目錄
│   ├── docs/
│   │   ├── prd/<slug>.md
│   │   ├── dag/<slug>.md
│   │   ├── spec/<slug>.md
│   │   ├── basis/<slug>.md
│   │   ├── devlog/<slug>.md
│   │   ├── e2e/<slug>.md
│   │   ├── audit/<slug>.md
│   │   └── ops/<slug>.md
│   └── report/
│       └── <YYYY-MM-DD_HHMMSS>-<slug>.md   # 秘書最終對照報告
```

### 老闆的鍋（blame/boss/）

老闆也會錯，老闆的鍋有兩種：

1. **大環境的鍋**：推鍋鏈卡住是因為環境缺條件（缺 API key、缺套件、缺權限⋯⋯）。判斷原則：「換一個更強的 agent 在同一個環境裡，做得了嗎？」做不了就是大環境的鍋。
2. **老闆明示直接修改**：老闆親口說「直接改」，秘書照辦，改壞了算老闆的鍋。老闆的回退方式很暴力：`git revert`。

### 老闆明示直接修改

老闆明確說「直接改」「直接修」「不用跑流程」時，秘書會跳過整條推鍋鏈，直接在 main 上改。commit 以 `BOSS-HOTFIX:` 為前綴。

改壞了？老闆自己扛，直接 `git revert` 回退。鍋記在 `blame/boss/BLAME.md`。

---

## 安裝

把本專案的 `.claude/` 複製（或 symlink）到你想用的 repo 根目錄：

```bash
git clone https://github.com/<owner>/shiftblame.git
cp -r shiftblame/.claude /path/to/your/project/
```

安裝完成後，在 Claude Code 中執行 `/shiftblame-link` 建立鍋目錄的 symlink：

```
/shiftblame-link
```

這會在 repo 根目錄建立 `.shiftblame/` 子目錄，內含兩個 symlink：
- `.shiftblame/<repo>` → `~/.shiftblame/<repo>/`（本 repo 的 docs + report）
- `.shiftblame/blame` → `~/.shiftblame/blame/`（跨 repo 共用的鍋紀錄）

---

## 使用

開 Claude Code 跟秘書說話即可：

```
幫我做一個 Markdown 轉 HTML 的 CLI
```

或：

```
/secretary 我想要一個可以記錄每日心情的終端小工具
```

還沒想清楚？也可以直接跟秘書諮詢：

```
我在猶豫要用 REST 還是 GraphQL，你覺得呢
```

```
我不確定這個功能該怎麼做比較好，幫我想想
```

秘書會用結構化問答幫你收斂方向，確認後才開始推鍋。

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

## 設計理念

1. **強制 TDD**：先寫紅燈再變綠，測試檔 dev 碰不得
2. **架構先行**：先定技術選型再拆任務
3. **每層留痕**：每個 agent 都要 commit 自己的產出
4. **預審閘門**：老闆可在任一層踩煞車，全程看不到內部角色名
5. **原話對照**：推鍋鏈再長，最後都要回到老闆當初說的那句話去驗證
6. **鍋有主**：每個角色都有 `~/.shiftblame/blame/<role>/BLAME.md`
7. **資訊隔離**：每個 agent 只看上游指定的檔案
8. **秘書合併**：本地 rebase + merge --squash 直接進 main，無 PR
9. **秘書判鍋**：秘書分析需求性質，直接從正確的層啟動推鍋鏈，不一定每次都從頭跑
10. **老闆明示直接改**：老闆親口說「直接改」就直接改，改壞算老闆的，`git revert` 回退
11. **諮詢模式**：老闆還沒想清楚時，秘書用結構化問答幫忙釐清方向，方向確認後才推鍋

---

## 授權

MIT License — 詳見 [LICENSE](./LICENSE)。

推鍋精神，從開源授權做起。
