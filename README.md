# shiftblame · 推鍋大師

> 「這件事不歸我管 —— 但老闆說的話，我幫他記著。」

一套給 [Claude Code](https://claude.com/claude-code) 用的**多層級專業分工流水線**。老闆（你）說一句話，秘書把需求從**企劃 → 架構 → 規劃 → 測試 → 開發 → E2E → 稽核驗收 → 上線**一路推到底，每一層都有專門的 agent 負責，每一層開工前還要先翻成人話請老闆預審，最後由秘書親自對照老闆原話確認達成進度。

推鍋如流水，一路推到底。

---

## 這是什麼

`shiftblame` 是一個 Claude Code 的 `.claude/` 配置包，內含：

- **1 個 skill**：`shiftblame`（秘書/鍋長本人）—— 接老闆需求、建立共享 worktree、逐層交棒、每層預審、最後原話對照
- **8 個 subagent**：一條完整的軟體工程流水線

| # | 角色 | 產出 | 職責 |
|---|------|------|------|
| 1 | `product-planner`    | `prd`    | 把老闆原話轉寫成 PRD |
| 2 | `system-architect`   | `dag`    | 技術選型、模組拓撲、檔案結構、介面簽章、部署方案 |
| 3 | `project-manager`    | `spec`   | 功能拆解、驗收條件、任務依賴 |
| 4 | `quality-assurance`  | `basis`  | 依 dag + spec 寫單元 / 整合測試（TDD 紅） |
| 5 | `feature-developer`  | `devlog` | 寫最小實作讓測試全綠（TDD 綠） |
| 6 | `quality-control`    | `e2e`    | 使用者視角 e2e 測試並實際執行 |
| 7 | `audit-reviewer`     | `audit`  | 整條鏈路驗收；ACCEPTED 則本地 rebase + merge --squash 合併 main |
| 8 | `operations-engineer`| `ops`    | 在 main 依 dag 方案實際上線並驗證 |

每個 agent 只做自己份內的事，**絕不越權**：feature-developer 不准改測試、system-architect 不准寫程式、audit-reviewer 不准放水、秘書不准自己寫任何一個字的 prd。

---

## 運作原理

```
 老闆原話留底
      │
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

前 7 棒都在同一個**共享 git worktree**（`shiftblame-worktrees/<slug>`）和**同一個分支**（`shiftblame/<slug>`）上工作，所有修正都是 append-only commit，完整修正歷史保留在分支上。不砍 worktree、不砍分支、不 force push。

第 7 棒 `audit-reviewer` 驗收通過後，**在本地** `git rebase` 保持線性 + `git merge --squash` 把整條鏈路壓成 main 上的一個乾淨 commit 並 `git push origin main`，**不開 PR、不用 `gh`、不用 MCP github 工具**。feature 分支保留不刪，供歷史追溯。

第 8 棒 `operations-engineer` 接手合併後的 main，依 dag 指定的部署方案實際上線，產出 ops 紀錄並 commit 回 main。

### 檔案結構

```
shiftblame/
├── docs/                     # 產物依 docs-name 分類（團隊歷史）
│   ├── prd/<slug>.md         # by product-planner
│   ├── dag/<slug>.md         # by system-architect
│   ├── spec/<slug>.md        # by project-manager
│   ├── basis/<slug>.md       # by quality-assurance
│   ├── devlog/<slug>.md      # by feature-developer
│   ├── e2e/<slug>.md         # by quality-control
│   ├── audit/<slug>.md       # by audit-reviewer
│   ├── ops/<slug>.md         # by operations-engineer
│   └── secretary/<slug>.md   # 秘書最終對照報告
├── blame/                    # 鍋紀錄依角色名分類
│   ├── product-planner/
│   ├── system-architect/
│   ├── project-manager/
│   ├── quality-assurance/
│   ├── feature-developer/
│   ├── quality-control/
│   ├── audit-reviewer/
│   ├── operations-engineer/
│   └── secretary/            # 秘書自己的鍋也要入庫
└── blame-boss/               # 老闆的鍋 —— 只能怪大環境
    └── <slug>-<YYYY-MM-DD>.md
```

每個 agent 開工前都會 `Glob` 自己的 `shiftblame/docs/<docs-name>/*.md`（學團隊做事方式）與 `shiftblame/blame/<role>/*.md`（學過去踩過的雷）。

### 老闆的鍋（blame-boss/）

老闆也會錯，但老闆不能怪自己 —— 老闆只能怪「**大環境**」。當推鍋鏈中某一層卡住是因為**環境根本不具備完成條件**（缺 API key、缺套件、缺權限、外部服務掛掉、配額用完⋯⋯），秘書會親自複核確認這真的是大環境問題，然後把鍋寫進 `shiftblame/blame-boss/`，推鍋鏈暫停並用人話告訴老闆缺什麼。老闆去「**補充資源**」後告訴秘書，秘書會先**實際驗證資源到位**才重啟卡住的那一層。

判斷原則：「換一個更強的 agent 在同一個環境裡，這件事做得了嗎？」做不了就是大環境的鍋，做得了就是 agent 自己的鍋。秘書負責戳破試圖偷懶甩鍋的 agent，也負責別讓老闆白白退回幾次才發現缺的是 API key。

---

## 安裝

把本專案的 `.claude/` 複製（或 symlink）到你想用的 repo 根目錄：

```bash
git clone https://github.com/<owner>/shiftblame.git
cp -r shiftblame/.claude /path/to/your/project/
```

或只抓需要的部分：

```bash
# 只要 skill
cp -r shiftblame/.claude/skills/shiftblame /path/to/your/project/.claude/skills/

# 只要 agents
cp -r shiftblame/.claude/agents /path/to/your/project/.claude/
```

---

## 使用

開 Claude Code 跟秘書說話即可：

```
幫我做一個 Markdown 轉 HTML 的 CLI
```

或：

```
/shiftblame 我想要一個可以記錄每日心情的終端小工具
```

秘書接手後會：

1. 保存你的**原話逐字稿**
2. 取 slug、建立共享 worktree
3. 在每一層啟動前先用人話告訴你「接下來要做的事」，你回 OK 才繼續
4. 全鏈路跑完後，親自對照原話產出**秘書最終確認報告**
5. 呈報「完全達成 X / 部分達成 Y / 未達成 Z」

你在過程中只需要：

- ✅ **OK**：繼續推
- ❌ **不 OK + 原因**：例如「這不是我要的」「不要用這個套件」「還要加一個 xxx」——
  秘書會自己判斷這鍋該退回哪一層重跑，你不需要知道內部角色有誰

---

## 設計理念

1. **強制 TDD**：`quality-assurance` 先寫紅燈，`feature-developer` 才能動手變綠。測試檔 dev 碰不得
2. **架構先行**：`system-architect` 在 `project-manager` 之前定案 —— 先決定要用什麼工具、檔案擺哪、介面長怎樣，再拆任務與驗收條件
3. **每層留痕**：每個 agent 都要 commit 自己的產出，feature 分支上會累積 7 個結構化 commit，main 上再加 `audit` squash merge 與 `operations-engineer` 的 ops commit
4. **預審閘門**：老闆可以在任一層踩煞車。翻成人話是秘書的本職；老闆全程看不到內部角色名
5. **原話對照**：推鍋鏈再長，最後都要回到「老闆當初說的那句話」去驗證
6. **鍋有主**：每個角色都有自己的 `shiftblame/blame/<role>/` 目錄，犯錯必須入庫。秘書的鍋最重，因為她統籌全局
7. **不跨層讀檔**：每個 agent 只看上游指定的檔案，避免變成「一個人腦補整條鏈路」
8. **本地合併 + 無 PR**：`audit-reviewer` 本地 rebase + merge --squash 直接進 main，不開 PR、不依賴 GitHub CLI 或 MCP 工具

---

## 授權

MIT License — 詳見 [LICENSE](./LICENSE)。

這個專案已經發出來了。接下來要怎麼用、拿去怎麼改、推鍋推到誰頭上、老闆罵誰，那就不是我能管的了。

推鍋精神，從開源授權做起。
