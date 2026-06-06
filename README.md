# shiftblame

<p align="center">
  <em>「這不是我的鍋。」</em>
</p>

<p align="center">
  <strong>AI Agents 協作框架</strong> — 用純 Markdown 定義檔，讓 PM 與 DEV 兩個 AI 角色交替審計、各司其職。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Made%20with-Markdown-1a1a1a.svg" alt="Made with Markdown"/>
  <img src="https://img.shields.io/badge/Stage-6%20Phase%20Pipeline-6f42c1.svg" alt="6-Phase Pipeline"/>
  <img src="https://img.shields.io/badge/Agents-2%20Roles%20×%206%20Phases-21854d.svg" alt="2 Roles × 6 Phases"/>
</p>

---

## 📑 目錄

- [這是什麼？](#-這是什麼)
- [為什麼需要 shiftblame？](#-為什麼需要-shiftblame)
- [六階段管線](#-六階段管線)
- [PM 與 DEV 分工](#-pm-與-dev-分工)
- [快速上手](#-快速上手)
- [專案結構](#-專案結構)
- [.shiftblame/ 運行時目錄](#shiftblame-運行時目錄)
- [核心原則](#-核心原則)
- [觸發方式](#-觸發方式)
- [計畫語言：5W1H → GWT](#-計畫語言5w1h--gwt)
- [PRD / PID / SOP 制度](#-prd--pid--sop-制度)
- [常見問題](#-常見問題)
- [License](#-license)

---

## 🤔 這是什麼？

shiftblame 是一套**給 AI Agent 用的協作框架**。它定義了一套嚴格的管線流程，讓兩個 AI 角色（PM 和 DEV）在老闆（你）的監督下完成任務。

**核心思想：意圖揭露。** AI 的每一步行動都必須先向老闆說明「我要做什麼、為什麼」，經確認後才執行。不是事後解釋，是事前揭露。

- 🧑‍💼 **PM（研究需求）**：負責需求釐清、品質定義、設計規格。不碰 repo。
- 👨‍💻 **DEV（開發維運）**：負責技術規劃、程式碼實作、commit 推送。可變更 repo。
- 👑 **老闆（你）**：決定要做什麼、確認每個階段、最終拍板。

整個框架**只有 Markdown 定義檔**，沒有程式碼。它透過 Claude Code、Codex 或任何 Agent 框架的 Skill 系統運作，定義 AI 角色該怎麼行動。

> [!TIP]
> 如果你用 Claude Code（Claude Code CLI），把 skill 資料夾 symlink 到 `~/.claude/skills/` 就能用了。

---

## 💡 為什麼需要 shiftblame？

| 問題 | shiftblame 怎麼解決 |
|------|---------------------|
| AI 偷偷做事，你不知道它做了什麼 | **意圖揭露**：每步行動事前說明，老闆確認後才執行 |
| AI 一次做太多，出錯難追 | 六階段管線，每步都有審計關卡 |
| PM 和 DEV 權責不清 | 寫入權分化：PM 不碰 repo，DEV 可 commit |
| AI 自作主張改記憶 | 回饋即意圖：老闆的回饋是素材，禁止寫入記憶 |
| 計畫和實作混在一起 | 計畫語言分離：先 5W1H 邏輯，再翻譯為 GWT 可執行語言 |
| 審計只是形式 | 審計失敗直接退回，不溯及既往 |
| 前後階段脫節 | 前置建檔：每階段結束前須先建立下一階段文件 |

---

## 🔄 六階段管線

每個任務（slug）都經過六個階段，工作與審計交替進行：

<p align="center">
  <img src="https://img.shields.io/badge/L0-計畫-blue" alt="L0"/>
  <img src="https://img.shields.io/badge/L1-審計計畫-red" alt="L1"/>
  <img src="https://img.shields.io/badge/L2-翻譯-blue" alt="L2"/>
  <img src="https://img.shields.io/badge/L3-審計翻譯-red" alt="L3"/>
  <img src="https://img.shields.io/badge/L4-實作-blue" alt="L4"/>
  <img src="https://img.shields.io/badge/L5-審計實作-red" alt="L5"/>
</p>

```
L0 計畫 ──→ L1 審計計畫 ──→ L2 翻譯 ──→ L3 審計翻譯 ──→ L4 實作 ──→ L5 審計實作
  (plan.md)    (red.md)       (task.md)    (blue.md)       (result.md)  (conclusion.md)
     │            │              │            │                │             │
     └── 審計失敗退回 ←─────────┘            └── 審計失敗退回 ←────────────┘
```

| 階段 | 名稱 | 產出 | 說明 |
|:----:|------|------|------|
| L0 | 計畫 | `plan.md` | 建立 5W1H 邏輯，與老闆確認需求/技術計畫 |
| L1 | 審計計畫 | `red.md` | 檢查計畫有沒有偏差、遺漏、矛盾 |
| L2 | 翻譯 | `task.md` | 將 5W1H 翻譯為 GWT 可執行語言 |
| L3 | 審計翻譯 | `blue.md` | 檢查翻譯是否正確對應計畫 |
| L4 | 實作 | `result.md` | 依 GWT 執行實作，DEV commit |
| L5 | 審計實作 | `conclusion.md` | 檢查實作是否到位，通過即 PASSED |

**每個階段通過審計才能往下走。審計失敗 → 退回對應工作階段修復。**

---

## 👥 PM 與 DEV 分工

```
  PM 閘門                              DEV 閘門
┌────────────────────┐              ┌────────────────────┐
│  L0 業務 5W1H      │              │  L0 技術 5W1H      │
│      ↓             │              │      ↓             │
│  L1 審計計畫       │   交接       │  L1 審計計畫       │
│      ↓             │ ──────────→  │      ↓             │
│  L2 業務 GWT       │  (L5 PASSED) │  L2 技術 GWT       │
│      ↓             │              │      ↓             │
│  L3 審計翻譯       │              │  L3 審計翻譯       │
│      ↓             │              │      ↓             │
│  L4 規格實作       │              │  L4 程式碼實作     │
│      ↓             │              │      ↓             │
│  L5 審計實作       │              │  L5 審計實作       │
│      ↓             │              │      ↓             │
│  PASSED            │              │  PASSED → 收尾     │
└────────────────────┘              └────────────────────┘
```

| 部門 | 職責 | 寫入權 | 產物位置 |
|------|------|--------|----------|
| PM（研究需求） | 需求釐清、品質定義、設計規格 | ❌ 不碰 repo | `.shiftblame/<slug>/PM/` |
| DEV（開發維運） | 技術規劃、程式碼實作、commit | ✅ 可變更 repo | `.shiftblame/<slug>/DEV/` |

**PM PASSED → 交接 DEV。DEV PASSED → 歸檔並更新四文件。**

---

## 🚀 快速上手

### 1. 安裝

```bash
# macOS / Linux
ln -s ~/shiftblame/skills/shiftblame ~/.claude/skills/shiftblame

# Windows（以系統管理員開啟 cmd）
mklink /J "%USERPROFILE%\.claude\skills\shiftblame" "D:\shiftblame\skills\shiftblame"
```

### 2. 在 Claude Code 中觸發

```
/shiftblame 幫我重構登入流程
```

框架會自動：啟動 → 呈現意圖 → 你確認 → 分流 PM 或 DEV → 進入六階段管線。

### 3. 你的角色（老闆）

你只需要在每個閘門點位**確認或修正**，框架會推動 AI 角色完成其餘工作。

---

## 📁 專案結構

```
skills/shiftblame/
├── SKILL.md              # 入口與觸發定義
├── GATE.md               # 閘門、狀態機、收尾規則
├── MANAGE.md             # 管理者協調與操作
├── ROLE/
│   ├── PM/               # PM 六角色定義
│   │   ├── PLAN.md       # L0 計畫
│   │   ├── RED.md        # L1 審計計畫
│   │   ├── TASK.md       # L2 翻譯
│   │   ├── BLUE.md       # L3 審計翻譯
│   │   ├── RESULT.md     # L4 規格實作
│   │   └── CONCLUSION.md # L5 審計實作
│   └── DEV/              # DEV 六角色定義（同結構）
├── TEMPLATES/            # 模板（SLUG, REPO, ROADMAP, SOP, GRAPH, PRD, PID）
└── TOOLS/                # 工具包（DESIGN, E2E）
```

> [!NOTE]
> 所有定義檔 ≤ 50 行/檔。UTF-8 編碼（含中文文件）。

---

## 📦 .shiftblame/ 運行時目錄

`.shiftblame/` 是框架的運行時工作區，**本地私密，不入 repo**：

```
.shiftblame/
├── <slug>/               # 當前任務
│   ├── SLUG.md           # 任務索引（目標、狀態、技術債）
│   ├── PM/<NNN>/         # PM 各輪產物
│   │   └── {plan,red,task,blue,result,conclusion}.md
│   └── DEV/<NNN>/        # DEV 各輪產物（同結構）
├── PRD/                  # PM 規劃文件
├── PID/                  # DEV 開發標準
├── SOP.md                # 全局標準
├── REPO.md               # 專案現狀
├── ROADMAP.md            # 未來規劃
├── GRAPH.md              # 知識圖譜
└── archive/              # 已歸檔任務
```

---

## 📜 核心原則

| # | 原則 | 說明 |
|:-:|------|------|
| 1 | **寫入權分化** | PM 不碰 repo；DEV 全階段可 commit |
| 2 | **回饋即意圖** | 老闆回饋是素材，不直接執行，禁止寫入記憶 |
| 3 | **PM 程式碼邊界** | PM 可讀碼研究，但不得定義實作方式 |
| 4 | **會話 ≠ 管線** | 會話由老闆自由管理，L0~L5 是管線概念 |
| 5 | **回溯原則** | 錯誤不以後續提交修正，回到未發生時間點重做 |
| 6 | **SOP 紀律** | PM/DEV 皆可更新 SOP，建立與修改皆需意圖揭露 |
| 7 | **PRD/PID 制度** | PRD 為 PM 規劃文件，PID 為 DEV 開發標準 |
| 8 | **計畫語言** | L0 建立 5W1H 邏輯 → L2 翻譯為 GWT 可執行語言 |
| 9 | **前置建檔** | 每階段結束前須先建立下一階段文件 |
| 10 | **交接紀律** | L4 result 禁含交接聲明，僅 L5 PASSED 後生效 |

---

## 🎯 觸發方式

| 觸發方式 | 行為 |
|----------|------|
| `/shiftblame <任意文字>` | 意圖線索 → 啟動序列 → 呈現意圖 → 確認 → 分流 |
| `/shiftblame`（有未歸檔） | 啟動序列 → 呈現清單 → 老闆選擇 → 分流 |
| `/shiftblame`（無未歸檔） | 啟動序列 → 提議 slug → 確認 |

**啟動序列**（每次觸發僅載入索引層）：
1. 未歸檔偵測 — 掃描 `.shiftblame/` 下未歸檔 SLUG.md
2. 四文件載入 — REPO → ROADMAP → SOP → GRAPH
3. Repo 狀態 — git log / status / branch 摘要

---

## 🗣️ 計畫語言：5W1H → GWT

框架使用兩層計畫語言確保思考與執行分離：

### L0 — 5W1H 邏輯（思考）

| 維度 | 問題 | PM 範例 | DEV 範例 |
|------|------|---------|----------|
| **Who** | 對象是誰 | 終端使用者 | 目標模組 |
| **What** | 做什麼 | 新增登入功能 | 重構 auth middleware |
| **When** | 何時觸發 | 使用者開啟 App | API 呼叫時 |
| **Where** | 在哪發生 | 登入頁面 | `/api/auth/` |
| **Why** | 為什麼要做 | 目前無法登入 | 現有架構不支援 OAuth |
| **How** | 怎麼做 | 需求層面的流程 | 技術層面的方案 |

### L2 — GWT 翻譯（執行）

5W1H 翻譯為 Given-When-Then 可驗收條件：

```
Given 前提條件
When  觸發動作
Then  預期結果
```

---

## 📋 PRD / PID / SOP 制度

<details>
<summary>📖 了解 PRD、PID、SOP 的角色與生命週期</summary>

### PRD — 產品需求文件（PM）

PM 撰寫的規劃文件。生命週期：`draft → active → completed → 歸檔`

存放位置：`.shiftblame/PRD/`

### PID — 產品實作文件（DEV）

DEV 撰寫的開發標準。生命週期：`draft → active → deprecated → 歸檔`

存放位置：`.shiftblame/PID/`

### SOP — 全局標準

PM/DEV 皆可更新，追加式記錄（來源 + 日期）。建立與修改皆需意圖揭露（向老闆確認）。

存放位置：`.shiftblame/SOP.md`

</details>

---

## ❓ 常見問題

<details>
<summary>這個框架和直接叫 AI 寫程式碼有什麼不同？</summary>

直接叫 AI 寫程式碼是「一個人做完所有事」，沒有檢查點。shiftblame 把工作拆成六階段，每步都有獨立的審計角色把關，出錯時能明確知道是哪個環節的問題。

</details>

<details>
<summary>為什麼叫「shiftblame」？</summary>

「Shift Blame」= 推卸責任。在框架裡，每個角色只負責自己的階段——PM 不碰程式碼，DEV 不碰需求。出了問題，你能清楚看見是哪個環節該負責。這不是逃避，而是**讓責任歸屬透明化**。

</details>

<details>
<summary>PM 和 DEV 可以是同一個 AI 模型嗎？</summary>

可以。PM 和 DEV 是角色定義，不是不同的模型。同一個 Claude 實例在不同階段切換角色，也支援跨模型協作（例如 PM 用 Claude、DEV 用 Codex）。

</details>

<details>
<summary>為什麼所有定義檔限制 ≤ 50 行？</summary>

強制精簡。每份文件只表達一個概念，避免 AI 在長文件中迷失焦點。這也讓老闆（你）更容易快速審閱。

</details>

<details>
<summary>可以跳過某些階段嗎？</summary>

管線模式下不行，六階段是強制閘門。但你隨時可以切換為 **main 直接執行模式**跳過管線，由老闆直接指示 AI 完成——差別在於：責任屬於老闆，框架不提供審計保障。

</details>

<details>
<summary>審計失敗會怎樣？</summary>

退回對應工作階段修復：L1 失敗退回 L0、L3 失敗退回 L2、L5 失敗退回 L4。問題記為技術債，不溯及既往。累積追加超過原計畫 50% 則退回 L0 重新規劃。

</details>

---

## ⚖️ License

MIT License. 不接受外部貢獻。
