# shiftblame

<p align="center">
  <em>「這不是我的鍋。」</em>
</p>

<p align="center">
  <strong>AI Agents 協作框架</strong> — 用純 Markdown 定義檔，讓 AI 角色在交錯式六階段管線中先實作再驗證。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Made%20with-Markdown-1a1a1a.svg" alt="Made with Markdown"/>
  <img src="https://img.shields.io/badge/Stage-6%20Phase%20Pipeline-6f42c1.svg" alt="6-Phase Pipeline"/>
  <img src="https://img.shields.io/badge/Model-Implement%20First-21854d.svg" alt="Implement First"/>
</p>

---

## 📑 目錄

- [這是什麼？](#-這是什麼)
- [為什麼需要 shiftblame？](#-為什麼需要-shiftblame)
- [六階段管線](#-六階段管線)
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

shiftblame 是一套**給 AI Agent 用的協作框架**。它定義了一套嚴格的管線流程，讓 AI 角色在老闆（你）的監督下完成任務。

**核心思想：意圖揭露 + 先實作再驗證。** AI 的每一步行動都必須先向老闆說明「我要做什麼、為什麼」，經確認後才執行。不是事後解釋，是事前揭露。管線採「先實作再驗證」模式——做中學、做中驗。

- 🤖 **AI 角色**：單一角色，全流程負責。計畫、開發、驗收、審計交替進行。可 commit。
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
| AI 自作主張改記憶 | 回饋即意圖：老闆的回饋是素材，禁止寫入記憶 |
| 設計和實作脫節 | **先實作再驗證**：做了再定義驗收標準，確保可交付 |
| 審計只是形式 | 審計失敗直接退回，不溯及既往 |
| 前後階段脫節 | 前置建檔：每階段結束前須先建立下一階段文件 |
| 一次失敗就要重來 | **迭代收斂**：FAIL 推進下一 NNN，直到老闆認可 |

---

## 🔄 六階段管線

每個任務（slug）都經過六個階段，**實作與審計交替進行**：

<p align="center">
  <img src="https://img.shields.io/badge/L0-實作計畫-blue" alt="L0"/>
  <img src="https://img.shields.io/badge/L1-審計計畫-red" alt="L1"/>
  <img src="https://img.shields.io/badge/L2-實作開發-blue" alt="L2"/>
  <img src="https://img.shields.io/badge/L3-審計開發-red" alt="L3"/>
  <img src="https://img.shields.io/badge/L4-實作驗收-blue" alt="L4"/>
  <img src="https://img.shields.io/badge/L5-審計驗收-red" alt="L5"/>
</p>

```
L0 實作計畫 ──→ L1 審計計畫 ──→ L2 實作開發 ──→ L3 審計開發 ──→ L4 實作驗收 ──→ L5 審計驗收
  (plan.md)       (red.md)        (task.md)       (blue.md)       (result.md)    (conclusion.md)
     │               │                │               │                │               │
     └── 審計失敗退回 ←──────────────┘               └── 審計失敗退回 ←───────────────┘
```

| 階段 | 名稱 | 產出 | 說明 |
|:----:|------|------|------|
| L0 | 實作計畫 | `plan.md` | 建立 5W1H 計畫邏輯，與老闆確認 |
| L1 | 審計計畫 | `red.md` | 檢查計畫有沒有偏差、遺漏、矛盾 |
| L2 | 實作開發 | `task.md` | 依計畫執行實作，commit |
| L3 | 審計開發 | `blue.md` | 檢查實作是否到位 |
| L4 | 實作驗收 | `result.md` | 定義 GWT 驗收標準 |
| L5 | 審計驗收 | `conclusion.md` | 審計驗收 → PASS 收尾 / FAIL 下一 NNN |

**偶數＝實作，奇數＝審計，三輪配對：計畫/開發/驗收。**

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

框架會自動：啟動 → 呈現意圖 → 你確認 → 進入六階段管線。

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
│   ├── PLAN.md           # L0 實作計畫
│   ├── RED.md            # L1 審計計畫
│   ├── TASK.md           # L2 實作開發
│   ├── BLUE.md           # L3 審計開發
│   ├── RESULT.md         # L4 實作驗收
│   └── CONCLUSION.md     # L5 審計驗收
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
│   └── <NNN>/            # 各輪迭代產物
│       └── {plan,red,task,blue,result,conclusion}.md
├── PRD/                  # 規劃文件
├── PID/                  # 開發標準
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
| 1 | **回饋即意圖** | 老闆回饋是素材，不直接執行，禁止寫入記憶 |
| 2 | **會話 ≠ 管線** | 會話由老闆自由管理，L0~L5 是管線概念 |
| 3 | **回溯原則** | 錯誤不以後續提交修正，回到未發生時間點重做 |
| 4 | **SOP 紀律** | 可更新 SOP，建立與修改皆需意圖揭露 |
| 5 | **PRD/PID 制度** | PRD 為規劃文件，PID 為開發標準 |
| 6 | **先實作再驗證** | 偶數實作、奇數審計，三輪配對（計畫/開發/驗收） |
| 7 | **迭代收斂** | FAIL 推進下一 NNN，直到老闆認可 |
| 8 | **前置建檔** | 每階段結束前須先建立下一階段文件 |
| 9 | **計畫語言** | L0 建立 5W1H 邏輯 → L4 定義 GWT 驗收標準 |

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

框架使用兩層計畫語言，但順序是**先思考、再實作、後驗收**：

### L0 — 5W1H 邏輯（思考）

| 維度 | 問題 | 範例 |
|------|------|------|
| **Who** | 對象是誰 | 終端使用者 / 目標模組 |
| **What** | 做什麼 | 新增登入功能 / 重構 auth middleware |
| **When** | 何時觸發 | 使用者開啟 App / API 呼叫時 |
| **Where** | 在哪發生 | 登入頁面 / `/api/auth/` |
| **Why** | 為什麼要做 | 目前無法登入 / 架構不支援 OAuth |
| **How** | 怎麼做 | 需求流程 / 技術方案 |

### L4 — GWT 驗收（驗證）

實作完成後，定義 Given-When-Then 驗收條件：

```
Given 前提條件
When  觸發動作
Then  預期結果
```

---

## 📋 PRD / PID / SOP 制度

<details>
<summary>📖 了解 PRD、PID、SOP 的角色與生命週期</summary>

### PRD — 產品需求文件

規劃文件。生命週期：`draft → active → completed → 歸檔`

存放位置：`.shiftblame/PRD/`

### PID — 產品實作文件

開發標準。生命週期：`draft → active → deprecated → 歸檔`

存放位置：`.shiftblame/PID/`

### SOP — 全局標準

可更新，追加式記錄（來源 + 日期）。建立與修改皆需意圖揭露（向老闆確認）。

存放位置：`.shiftblame/SOP.md`

</details>

---

## ❓ 常見問題

<details>
<summary>這個框架和直接叫 AI 寫程式碼有什麼不同？</summary>

直接叫 AI 寫程式碼是「一個人做完所有事」，沒有檢查點。shiftblame 把工作拆成六階段，每步都有獨立的審計把關，出錯時能明確知道是哪個環節的問題。

</details>

<details>
<summary>為什麼叫「shiftblame」？</summary>

「Shift Blame」= 推卸責任。在框架裡，每個階段只負責自己的工作。出了問題，你能清楚看見是哪個環節該負責。這不是逃避，而是**讓責任歸屬透明化**。

</details>

<details>
<summary>為什麼「先實作再驗證」而不是「先設計再實作」？</summary>

傳統軟體工程假設人類設計師可以事先想清楚所有需求。但 AI agent 的優勢在於快速實作和迭代。「先實作再驗證」讓 agent 先動手做，再回頭定義什麼是「做對了」，更符合敏捷迭代的直覺。

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

退回對應實作階段修復：L1 失敗退回 L0、L3 失敗退回 L2、L5 失敗退回 L4。問題記為技術債，不溯及既往。累積追加超過原計畫 50% 則退回 L0 重新規劃。

</details>

<details>
<summary>L5 FAIL 之後會怎樣？</summary>

同 slug 推進下一個 NNN 迭代（如 001 → 002 → 003），直到老闆認為合理可行為止。每次 NNN 都是完整的 L0~L5 循環。

</details>

---

## ⚖️ License

MIT License. 不接受外部貢獻。
