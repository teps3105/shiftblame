# shiftblame

<p align="center">
  <em>「這不是我的鍋。」</em>
</p>

<p align="center">
  <strong>AI Agents 協作框架</strong> — 用純 Markdown 定義檔，讓 AI 角色在四行為管線中先提出再質疑，強制辯論後才收尾。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Made%20with-Markdown-1a1a1a.svg" alt="Made with Markdown"/>
  <img src="https://img.shields.io/badge/Stage-4%20Behavior%20Pipeline-6f42c1.svg" alt="4-Behavior Pipeline"/>
  <img src="https://img.shields.io/badge/Model-Propose%20First-21854d.svg" alt="Propose First"/>
</p>

---

## 目錄

- [這是什麼？](#-這是什麼)
- [為什麼需要 shiftblame？](#-為什麼需要-shiftblame)
- [四行為管線](#-四行為管線)
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

## 這是什麼？

shiftblame 是一套**給 AI Agent 用的協作框架**。它定義了一套嚴格的管線流程，讓 AI 角色在老闆（你）的監督下完成任務。

**核心思想：意圖揭露 + 先提出再質疑 + 強制辯論收尾。** AI 的每步行動都必須先向老闆說明「我要做什麼、為什麼」，經確認後才執行。不是事後解釋，是事前揭露。管線採「先提出再質疑」模式——每個行為都是正方提出、反方質疑的兩輪迴圈。驗收後還要強制經過辯論行為，確認下一步方向後才收尾。

- **AI 角色**：八個角色分工——正方（PLAN/TASK/RESULT/DEBATE）提出、反方（RED/BLUE/CONCLUSION/OBJECTION）質疑。
- **老闆（你）**：決定要做什麼、確認每個閘門、在辯論結論後拍板。

整個框架**只有 Markdown 定義檔**，沒有程式碼。它透過 Claude Code、Codex 或任何 Agent 框架的 Skill 系統運作，定義 AI 角色該怎麼行動。

> [!TIP]
> 如果你用 Claude Code（Claude Code CLI），把 skill 資料夾 symlink 到 `~/.claude/skills/` 就能用了。

---

## 為什麼需要 shiftblame？

| 問題 | shiftblame 怎麼解決 |
|------|---------------------|
| 直接叫 AI 寫碼，一人做完全部，沒有檢查點 | 四行為管線，每步都有獨立的質疑把關，出錯能明確定位是哪個環節的問題 |
| AI 偷偷做事，你不知道它做了什麼 | **意圖揭露**：每步行動事前說明，老闆確認後才執行 |
| AI 一次做太多，出錯難追 | 四行為管線，每步都有質疑關卡 |
| AI 自作主張改記憶 | 回饋即意圖：老闆的回饋是素材，禁止寫入記憶 |
| 設計和實作脫節 | **先提出再質疑**：正方提出方案，反方立刻質疑，暴露問題 |
| 審計只是形式 | 獨立子代理質疑，揭露風險供老闆決策 |
| 前後階段脫節 | 前置建檔：每行為結束前須先建立下一行為文件 |
| 一次失敗就要重來 | **迭代收斂**：閘門 FAIL 回同行為重計數，R2 產出為起始基線 |
| 驗收通過就沒下文了 | **強制辯論**：驗收後必須經過辯論行為，討論下一步方向才收尾 |

---

## 四行為管線

每個任務（slug）都經過四個行為，**正方提出與反方質疑交替進行**：

<p align="center">
  <img src="https://img.shields.io/badge/計畫行為-blue" alt="計畫"/>
  <img src="https://img.shields.io/badge/開發行為-blue" alt="開發"/>
  <img src="https://img.shields.io/badge/驗收行為-blue" alt="驗收"/>
  <img src="https://img.shields.io/badge/辯論行為-blue" alt="辯論"/>
</p>

```
計畫（PLAN/RED）──→ 開發（TASK/BLUE）──→ 驗收（RESULT/CONCLUSION）──→ 辯論（DEBATE/OBJECTION）
   plan.md/red.md      task.md/blue.md      result.md/conclusion.md      debate.md/objection.md
        │                   │                      │                            │
        └─ FAIL → 回同行為重計數（R2 產出為起始基線）────── 同左 ────────────── 同左
                            │
                            └─ 辯論 G4 決策：收尾（PASSED）/ 開新 NNN（計畫重跑）/ FAIL（異常路徑，辯論重計數）
```

每個行為內部恰好 2 輪正反交替：

```
R1 正（提出）→ R1 反（質疑）→ R2 正（修正）→ R2 反（再質疑）→ 閘門（老闆確認）
```

| 行為 | 正方角色 | 反方角色 | 產出 | 說明 |
|:----:|---------|---------|------|------|
| 計畫 | PLAN | RED | plan-r{n}.md, red-r{n}.md | 5W1H 規劃 + 質疑 |
| 開發 | TASK | BLUE | task-r{n}.md, blue-r{n}.md | 實作 + 質疑 |
| 驗收 | RESULT | CONCLUSION | result-r{n}.md, conclusion-r{n}.md | GWT 驗收 + 質疑 |
| 辯論 | DEBATE | OBJECTION | debate-r{n}.md, objection-r{n}.md | 下一步建議 + 質疑 |

### 辯論行為（管線第四階段）

辯論行為是驗收閘門 G3 PASS 後的**強制第四階段**，不可跳過。

- **DEBATE（正方）**：閱讀當前 slug 的計畫/開發/驗收最終產出，提出下一步建議（方向、時機、範圍）
- **OBJECTION（反方）**：質疑正方建議的遺漏、時機、可行性
- **G4 閘門決策**：收尾（PASSED）/ 開新 NNN（基於辯論結論的新方向，從計畫重跑）/ FAIL（異常路徑，辯論未收斂，重計數）

G3 判品質（做得好不好），G4 判方向（下一步做什麼）。兩者維度不同，「開新 NNN」不代表推翻驗收結論。

---

## 快速上手

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

框架會自動：啟動 → 呈現意圖 → 你確認 → 進入四行為管線。

### 3. 你的角色（老闆）

你只需要在每個閘門點位**確認或修正**，框架會推動 AI 角色完成其餘工作。

---

## 專案結構

```
skills/shiftblame/
├── SKILL.md              # 入口與觸發定義
├── GATE.md               # 閘門、狀態機、收尾規則
├── MANAGE.md             # 管理者協調與操作
├── ROLE/
│   ├── PLAN.md           # 計畫正方
│   ├── RED.md            # 計畫反方
│   ├── TASK.md           # 開發正方
│   ├── BLUE.md           # 開發反方
│   ├── RESULT.md         # 驗收正方
│   ├── CONCLUSION.md     # 驗收反方
│   ├── DEBATE.md         # 辯論正方
│   └── OBJECTION.md      # 辯論反方
├── TEMPLATES/            # 模板（SLUG, REPO, ROADMAP, SOP, GRAPH, PRD, PID）
└── TOOLS/                # 工具包（DESIGN, E2E）
```

---

## .shiftblame/ 運行時目錄

`.shiftblame/` 是框架的運行時工作區，**本地私密，不入 repo、不進 slug 鏈**。

```
.shiftblame/
├── <slug>/               # 當前任務
│   ├── SLUG.md           # 任務索引（目標、狀態、技術債、辯論總結）
│   └── <NNN>/            # 各輪迭代產物
│       └── {plan,red,task,blue,result,conclusion,debate,objection}-r{n}.md
├── PRD/                  # 規劃文件
├── PID/                  # 開發標準
├── SOP.md                # 全局標準
├── REPO.md               # 專案現狀
├── ROADMAP.md            # 未來規劃
├── GRAPH.md              # 知識圖譜
└── archive/              # 已歸檔任務
```

---

## 核心原則

| # | 原則 | 說明 |
|:-:|------|------|
| 1 | **回饋即意圖** | 老闆回饋是素材，不直接執行，禁止寫入記憶 |
| 2 | **會話 ≠ 管線** | 會話由老闆自由管理，四行為是管線概念 |
| 3 | **回溯原則** | 錯誤不以後續提交修正，回到未發生時間點重做 |
| 4 | **SOP 紀律** | 可更新 SOP，建立與修改皆需意圖揭露 |
| 5 | **PRD/PID 筆記本** | 老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈 |
| 6 | **先提出再質疑** | 正方提出→反方質疑，四行為各 2 輪正反迴圈 |
| 7 | **迭代收斂** | 閘門 FAIL 回同行為重計數，R2 產出為起始基線 |
| 8 | **前置建檔** | 每行為結束前須先建立下行為文件 |
| 9 | **計畫語言** | 計畫使用 5W1H 格式，驗收使用 GWT 格式 |
| 10 | **Shift Blame** | 閘門 PASS 前老闆的鍋；閘門 PASS 後 agent 的鍋 |
| 11 | **NNN=Commit** | 開發 PASS 後才 commit，每個 NNN 恰好一個 commit |
| 12 | **分支保護** | agent 禁止操作 main；所有變更走 `feat/<slug>`，收尾合併 |
| 13 | **強制辯論** | 驗收 G3 PASS 後強制進入辯論行為，不可跳過 |

---

## 觸發方式

| 觸發方式 | 行為 |
|----------|------|
| `/shiftblame <任意文字>` | 意圖線索 → 啟動序列 → 呈現意圖 → 確認 → 分流 |
| `/shiftblame`（有未歸檔） | 啟動序列 → 呈現清單 → 老闆選擇 → 分流 |
| `/shiftblame`（無未歸檔） | 啟動序列 → 提議 slug → 確認 |
| 驗收 PASS 後 FAIL | 自動觸發 → 同 slug 開新 NNN（計畫重跑） |
| 驗收 G3 PASS | 自動進入辯論行為（強制觸發，無需觸發表記載） |

**啟動序列**（每次觸發僅載入索引層）：
1. 未歸檄偵測 — 掃描 `.shiftblame/` 下未歸檔 SLUG.md
2. 四文件載入 — REPO → ROADMAP → SOP → GRAPH
3. Repo 狀態 — git log / status / branch 摘要

---

## 可追溯鏈

閘門 PASS 推進下行為，FAIL 回同行為重計數（R2 產出為起始基線，覆寫不重建）。

閘門 PASS 前是老闆的鍋：計畫可反覆修改。閘門 PASS 後是 agent 的鍋：commit 後 agent 為提交負責。

計畫使用 5W1H 格式（Who/What/When/Where/Why/How），驗收使用 GWT 格式（Given→When→Then）。辯論提出下一步建議方向。老闆可隨時跳過管線直接在 main 上操作，但責任屬於老闆，框架不提供質疑保障。

---

## PRD / PID / SOP 制度

<details>
<summary>了解 PRD、PID、SOP</summary>

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

## 為什麼叫「shiftblame」？

「Shift Blame」= 推卸責任。閘門 PASS 前是老闆的鍋——計畫可反覆修改。閘門 PASS 後是 agent 的鍋——後續問題開新 NNN 負責。

---

## License

MIT License. 不接受外部貢獻。
