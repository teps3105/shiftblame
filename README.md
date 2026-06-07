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
- [可追溯鏈](#-可追溯鏈)
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
| 直接叫 AI 寫碼，一人做完全部，沒有檢查點 | 六階段管線，每步都有獨立的審計把關，出錯能明確定位是哪個環節的問題 |
| AI 偷偷做事，你不知道它做了什麼 | **意圖揭露**：每步行動事前說明，老闆確認後才執行 |
| AI 一次做太多，出錯難追 | 六階段管線，每步都有審計關卡 |
| AI 自作主張改記憶 | 回饋即意圖：老闆的回饋是素材，禁止寫入記憶 |
| 設計和實作脫節 | **先實作再驗證**：AI 的優勢在於快速實作和迭代，先動手做再回頭定義什麼是「做對了」，更符合敏捷直覺 |
| 審計只是形式 | 獨立子代理審計，揭露風險供老闆決策 |
| 前後階段脫節 | 前置建檔：每階段結束前須先建立下一階段文件 |
| 一次失敗就要重來 | **迭代收斂**：L3 PASS 前 FAIL 回同 NNN；L3 PASS 後 FAIL 開新 NNN |

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
     └── L3 PASS 前 FAIL → 回同 NNN L0 │ L3 PASS 後 FAIL → 開新 NNN ──┘
```

| 階段 | 名稱 | 產出 | 說明 |
|:----:|------|------|------|
| L0 | 實作計畫 | `plan.md` | 建立 5W1H 計畫邏輯，與老闆確認 |
| L1 | 審計計畫 | `red.md` | 檢查計畫有沒有偏差、遺漏、矛盾 |
| L2 | 實作開發 | `task.md` | 依計畫執行實作，L3 PASS 後 commit（**agent 的鍋**） |
| L3 | 審計開發 | `blue.md` | 檢查實作是否到位 |
| L4 | 實作驗收 | `result.md` | 定義 GWT 驗收標準 |
| L5 | 審計驗收 | `conclusion.md` | 審計驗收 → PASS 收尾 / FAIL 開新 NNN |

**偶數＝實作，奇數＝審計，三輪配對：計畫/開發/驗收。**
**L0~L3 PASS 前老闆的鍋（FAIL 回同 NNN）；L3 PASS 後 agent 的鍋（FAIL 開新 NNN）。**

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

---

## 📦 .shiftblame/ 運行時目錄

`.shiftblame/` 是框架的運行時工作區，**本地私密，不入 repo、不進 slug 鏈**。slug 鏈（L0~L5 + commit）影響的範圍僅限主 repo 的檔案。

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
| 5 | **PRD/PID 筆記本** | 老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈 |
| 6 | **先實作再驗證** | 偶數實作、奇數審計，三輪配對（計畫/開發/驗收） |
| 7 | **迭代收斂** | L3 PASS 前 FAIL 回同 NNN；L3 PASS 後 FAIL 開新 NNN |
| 8 | **前置建檔** | 每階段結束前須先建立下一階段文件 |
| 9 | **計畫語言** | L0 建立 5W1H 邏輯 → L4 定義 GWT 驗收標準 |
| 10 | **Shift Blame** | L0~L3 PASS 前老闆的鍋；L3 PASS 後 agent 的鍋（FAIL 開新 NNN） |
| 11 | **NNN=Commit** | L3 PASS 後才 commit，每個 NNN 恰好一個 commit |
| 12 | **分支保護** | agent 禁止操作 main；所有變更走 `feat/<slug>`，收尾合併 |

---

## 🎯 觸發方式

| 觸發方式 | 行為 |
|----------|------|
| `/shiftblame <任意文字>` | 意圖線索 → 啟動序列 → 呈現意圖 → 確認 → 分流 |
| `/shiftblame`（有未歸檔） | 啟動序列 → 呈現清單 → 老闆選擇 → 分流 |
| `/shiftblame`（無未歸檔） | 啟動序列 → 提議 slug → 確認 |
| L3 PASS 後 FAIL | 自動觸發 → 同 slug 開新 NNN（L0 重跑）|

**啟動序列**（每次觸發僅載入索引層）：
1. 未歸檔偵測 — 掃描 `.shiftblame/` 下未歸檔 SLUG.md
2. 四文件載入 — REPO → ROADMAP → SOP → GRAPH
3. Repo 狀態 — git log / status / branch 摘要

---

## 🔗 可追溯鏈

pass 推進下一階段，fail 回同 NNN L0（L3 PASS 前）；L3 PASS 後 fail 開新 NNN。

L0~L3 PASS 前是老闆的鍋：計畫可反覆修改。L3 PASS 後是 agent 的鍋：commit 後 agent 為提交負責，後續任何問題開新 NNN。

L0 計畫使用 5W1H 格式（Who/What/When/Where/Why/How），L4 驗收使用 GWT 格式（Given→When→Then）。老闆可隨時跳過管線，直接在 main 上操作（文件修正等人工操作），但責任屬於老闆，框架不提供審計保障。agent 不得使用此模式。

---

## 📋 PRD / PID / SOP 制度

<details>
<summary>📖 了解 PRD、PID、SOP</summary>

### PRD — 需求筆記本

老闆記錄需求的筆記本。Agent 可參考內容、協助整理，模板提供格式參考。

存放位置：`.shiftblame/PRD/`

### PID — 標準筆記本

老闆記錄開發標準的筆記本。Agent 可參考內容、協助整理，模板提供格式參考。

存放位置：`.shiftblame/PID/`

### SOP — 全局標準

可更新，追加式記錄（來源 + 日期）。建立與修改皆需意圖揭露（向老闆確認）。

存放位置：`.shiftblame/SOP.md`

</details>

---

## ❓ 為什麼叫「shiftblame」？

「Shift Blame」= 推卸責任。L0~L3 PASS 前是老闆的鍋——計畫可反覆修改。L3 PASS 後是 agent 的鍋——開新 NNN 負責。

---

## ⚖️ License

MIT License. 不接受外部貢獻。
