# shiftblame · 推鍋大師

> 「這件事不歸我管 —— 但老闆說的話，我幫他記著。」

一套給 [Claude Code](https://claude.com/claude-code) 用的**多層級專業分工流水線**。老闆（你）說一句話，秘書把需求從**企劃 → 規格 → 架構 → 測試 → 開發 → E2E → QA 驗收 → 部署**一路推到底，每一層都有專門的 agent 負責，每一層開工前還要先翻成人話請老闆預審，最後由秘書親自對照老闆原話確認達成進度。

推鍋如流水，一路推到底。

---

## 這是什麼

`shiftblame` 是一個 Claude Code 的 `.claude/` 配置包，內含：

- **1 個 skill**：`shiftblame`（秘書/鍋長本人）—— 接老闆需求、建立共享 worktree、逐層交棒、每層預審、最後原話對照
- **8 個 subagent**：一條完整的軟體工程流水線
  - `planner` — 寫 PRD（產品需求文件）
  - `product-manager` — 寫 spec（可驗收規格）
  - `architect` — 畫架構（技術選型、檔案結構、部署方案）
  - `test-engineer` — 寫測試（TDD 紅階段）
  - `developer` — 寫實作（TDD 變綠）
  - `e2e-specialist` — 端對端測試並實際執行
  - `qa` — 整條鏈路驗收，ACCEPTED 自動開 PR 並合併到 main
  - `deploy` — 在 main 上執行部署方案

每個 agent 只做自己份內的事，**絕不越權**：developer 不准改測試、architect 不准寫程式、QA 不准放水、秘書不准自己寫任何一個字的 PRD。

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

每一層都在同一個**共享 git worktree**（`shiftblame-worktrees/<slug>`）和**同一個分支**（`shiftblame/<slug>`）上工作，所有修正都是 append-only commit，完整修正歷史保留在分支上。不砍 worktree、不砍分支、不 force push。

### 檔案分類

每個 agent 都有兩個專屬目錄：

- **`blame-docs/<team>/`** — 正經文件（團隊歷史、過去的做事慣例）
- **`blame/<team>/`** — 鍋紀錄（自己犯過的錯、下次怎麼避免）

每個 agent 開工前都會 glob 自己的這兩個目錄學習歷史與避雷。秘書也有自己的 `blame/secretary/` —— 秘書自己犯錯被抓包時也要入庫。

另外還有一個特別目錄：

- **`blame-boss/`** — 老闆的鍋（但老闆只能怪大環境）

老闆也會錯，但老闆不能怪自己 —— 老闆只能怪「**大環境**」。當推鍋鏈中某一層卡住是因為**環境根本不具備完成條件**（缺 API key、缺套件、缺權限、外部服務掛掉、配額用完⋯⋯），秘書會親自複核確認這真的是大環境問題，然後把鍋寫進 `blame-boss/`，推鍋鏈暫停並用人話告訴老闆缺什麼。老闆去「**補充資源**」後告訴秘書，秘書會先實際驗證資源到位才重啟卡住的那一層。

判斷原則很簡單：「換一個更強的 agent 在同一個環境裡，這件事做得了嗎？」做不了就是大環境的鍋，做得了就是 agent 自己的鍋。秘書負責戳破試圖偷懶甩鍋的 agent，也負責別讓老闆白白退回幾次才發現缺的是 API key。

---

## 安裝

把本專案的 `.claude/` 複製（或 symlink）到你想用的 repo 根目錄：

```bash
git clone https://github.com/<owner>/shiftblame.git
cp -r shiftblame/.claude /path/to/your/project/
```

或者只抓需要的部分：

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

1. **強制 TDD**：test-engineer 先寫紅燈，developer 才能動手變綠。測試檔 developer 碰不得
2. **每層留痕**：每個 agent 都要 commit 自己的產出，分支上會累積 7~9 個結構化 commit
3. **預審閘門**：老闆可以在任一層踩煞車。翻成人話是秘書的本職
4. **原話對照**：推鍋鏈再長，最後都要回到「老闆當初說的那句話」去驗證
5. **鍋有主**：每個角色都有自己的 `blame/` 目錄，犯錯必須入庫。秘書的鍋最重，因為她統籌全局
6. **不跨層讀檔**：每個 agent 只看上一層給它的檔案，避免變成「一個人腦補整條鏈路」

---

## 授權

MIT License — 詳見 [LICENSE](./LICENSE)。

這個專案已經發出來了。接下來要怎麼用、拿去怎麼改、推鍋推到誰頭上、老闆罵誰，那就不是我能管的了。

推鍋精神，從開源授權做起。
