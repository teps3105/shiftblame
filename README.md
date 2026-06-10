# shiftblame

<p align="center">
  <em>「這不是我的鍋。」</em>
</p>

<p align="center">
  <strong>AI Agents 協作框架</strong> — 純 Markdown 定義檔，雙模式：slug 管線二出口＋體驗者獨立產出，簡易正→反→收斂模式。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Made%20with-Markdown-1a1a1a.svg" alt="Made with Markdown"/>
  <img src="https://img.shields.io/badge/Pipeline-2%20Outlet-6f42c1.svg" alt="2-Outlet Pipeline"/>
  <img src="https://img.shields.io/badge/Model-Propose%20First-21854d.svg" alt="Propose First"/>
</p>

---

## 目錄

- [這是什麼？](#-這是什麼)
- [為什麼需要 shiftblame？](#-為什麼需要-shiftblame)
- [二出口管線](#-二出口管線)
- [簡易模式](#-簡易模式)
- [快速上手](#-快速上手)
- [專案結構](#-專案結構)
- [.shiftblame/ 運行時目錄](#shiftblame-運行時目錄)
- [核心原則](#-核心原則)
- [三層租約](#-三層租約)
- [觸發方式](#-觸發方式)
- [角色總覽](#-角色總覽)
- [PRD / PID / SOP 制度](#-prd--pid--sop-制度)
- [License](#-license)

---

## 這是什麼？

shiftblame 是一套**給 AI Agent 用的協作框架**。它定義嚴格的管線流程，讓 AI 角色在老闆（你）的監督下完成任務。

**核心思想：意圖揭露＋先提案再質疑＋體驗者獨立產出。** AI 的每步行動都必須先向老闆說明「要做什麼、為什麼」，經確認後才執行。不是事後解釋，是事前揭露。管線採「先提案再質疑」模式——每個閘門走正→反→收斂流程。G2 為 NNN 迭代出口，收斂後提交；體驗者獨立完成 FEATURE.md 後收尾。小型變更使用簡易模式：同樣正→反→收斂，不開 slug，直接在 main commit。

整個框架**只有 Markdown 定義檔**，沒有程式碼。透過 Claude Code、Codex 或任何 Agent 框架的 Skill 系統運作，定義 AI 角色該怎麼行動。

> [!TIP]
> 如果你用 Claude Code CLI，把 skill 資料夾 symlink 到 `~/.claude/skills/` 就能用了。

---

## 為什麼需要 shiftblame？

| 問題 | shiftblame 怎麼解決 |
|------|---------------------|
| 直接叫 AI 寫碼，沒有檢查點 | 二出口管線，每步都有獨立的質疑把關 |
| AI 偷偷做事 | **意圖揭露**：每步行動事前說明，老闆確認後才執行 |
| AI 自作主張改記憶 | 回饋即意圖：老闆的回饋是素材，禁止寫入記憶 |
| 設計和實作脫節 | **先提案再質疑**：正方提案→反方質疑→管理者收斂 |
| 驗收通過就沒下文 | **體驗者獨立產出**：G2 通過後體驗者以使用者視角獨立完成 FEATURE.md |
| 出錯難追 | **迭代收斂**：閘門 FAIL 以收斂產出為基線增量增加 |

---

## 二出口管線

每個任務（slug）經過二個出口＋體驗者階段，**正方提案與反方質疑交替進行**：

```
計畫（G1）──→ 開發（G2）────↻ 可反覆開 NNN ──→ 體驗者（獨立完成）──→ 收尾
  G1.md          G2.md                              FEATURE.md
    │               │                                    │
    └─ FAIL → 以收斂為基線增量增加 ────── 同左           │
                         │                               │
                         └─ PASS → 交接給體驗者 → 獨立完成 → 管理者收尾
```

### 出口與角色分工

| 階段 | 議題 | 正方 | 反方 | 收斂 |
|:----:|------|------|------|------|
| G1 | 計畫 | 需求翻譯、5W1H、可行性評估 | 質疑遺漏/可行性/越權 | 管理者收斂（僅 .shiftblame/） |
| G2 | 開發 | 技術選型、GWT 測試、TDD 實作 | 質疑覆蓋率/品質/一致性 | 管理者收斂（含實作+提交） |
| 體驗者 | 產品體驗 | 獨立完成，不走正反辯論 | — | 管理者品質確認+收尾 |

每個閘門走正→反→收斂流程：

```
正方（多子代理多視角提案）→ 反方（多子代理多視角質疑）→ 管理者收斂 → 老闆 PASS/FAIL
```

老闆 FAIL 以收斂為基線增量增加。G2 可反覆開 NNN 迭代；PASS 後交接給體驗者。體驗者獨立完成 FEATURE.md，交回管理者收尾。

---

## 簡易模式

用於不需開 slug 的小型變更。完整正→反→收斂流程，管理者收斂並執行變更，直接在 main commit（僅 repo 檔案；.shiftblame/ 不入 repo）。

```
老闆指定簡易模式
      │
      ▼
START（載入租約→揭露目標→暫停等老闆確認）不可跳過
      │
      ▼
正方多子代理多視角（提案）→ 反方多子代理多視角（質疑）→ 管理者收斂（含執行變更）
      │
      ▼
老闆 PASS ── FAIL → 以收斂為基線增量增加
      │
      ▼
管理者在 main commit（僅 repo 檔案）→ 結束
```

| 角色 | 職責 |
|------|------|
| 正方子代理 | 多視角提出變更方案 |
| 反方子代理 | 多視角質疑方案風險 |
| 管理者 | 調度、收斂、執行變更、commit |
| 老闆 | 指定模式、確認 PASS/FAIL |

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

框架會自動：啟動 → 呈現意圖（含模式選擇）→ 你確認 → 進入 slug 管線或簡易模式。

### 3. 你的角色（老闆）

你只需要在每個閘門點位**確認或修正**，框架會推動 AI 角色完成其餘工作。

---

## 專案結構

> `skills/shiftblame/` 下皆為技能定義檔（短期租約），與 `.shiftblame/`（專案層）區分。

```
skills/shiftblame/
├── SKILL.md              # 入口：核心原則、啟動序列、觸發、出口迴圈
├── GATE.md               # 閘門原則、狀態序、閘門生命週期、收尾
├── MANAGE.md             # 管理者調度流程、分支保護、會話紀律
├── EXPERIENCE.md         # 體驗者職責、體驗流程、產出品質、回歸規則
├── ROLE/
│   ├── G1.md             # 計畫出口：需求翻譯、5W1H、可行性評估
│   └── G2.md             # 開發出口：技術選型、GWT 測試、TDD
├── TEMPLATES/            # 模板（REPO, ROADMAP, SOP, GRAPH, SLUG, FEATURE, PRD, PID）
└── TOOLS/                # 工具包
```

---

## .shiftblame/ 運行時目錄

`.shiftblame/` 是框架的運行時工作區，**本地私密，不入 repo、不進 slug 鏈**。

```
.shiftblame/
├── <slug>/               # 當前任務
│   ├── SLUG.md           # 任務索引（目標、狀態、技術債、交接摘要）
│   ├── FEATURE.md        # 體驗者產出（產品體驗紀錄）
│   └── <NNN>/            # 各輪迭代
│       └── G1.md / G2.md
├── PRD/                  # 需求筆記本
├── PID/                  # 開發標準筆記本
├── SOP.md                # 全局標準（長期租約）
├── REPO.md               # 專案現狀
├── ROADMAP.md            # 未來規劃
├── GRAPH.md              # 可視化圖譜
├── tmp/                  # 非持久產出
├── archive/              # 已歸檔任務
```

---

## 核心原則

| # | 原則 | 說明 |
|:-:|------|------|
| 1 | **回饋即意圖** | 老闆每次說話即觸發意圖揭露，管理者必須先揭露理解到的意圖，確認後才執行 |
| 2 | **SOP 約束** | 可更新 SOP 作為全局標準，建立與修改皆需意圖揭露 |
| 3 | **PRD/PID 筆記本** | 老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈 |
| 4 | **先提案再質疑** | G1/G2 各走正→反→收斂流程；體驗者階段獨立產出 FEATURE.md |
| 5 | **迭代收斂** | 管理者以最後收斂為基線增量增加 |

---

## 三層租約

規範準則有效性的三層架構，長期位階最高，衝突時長期優先：

| 層級 | 期間 | 內容 | 載入時機 |
|:----:|------|------|----------|
| 長期 | 跨 slug | SOP.md | 每次啟動 |
| 中期 | 單 slug | SLUG.md §7 租約有效期 | slug 管線 START |
| 短期 | 單閘門 | SKILL+GATE+MANAGE+EXPERIENCE＋閘門對應 ROLE | 每個閘門 START（G1 載 G1.md，G2 載 G2.md） |

簡易模式僅載入長期（SOP）＋短期（SKILL+GATE+MANAGE+EXPERIENCE），不載中期。

---

## 觸發方式

| 觸發方式 | 行為 |
|----------|------|
| `/shiftblame <任意文字>` | 意圖線索 → 啟動序列 → 呈現意圖（含模式）→ 確認 → 分流 |
| `/shiftblame`（有未歸檔） | 啟動序列 → 呈現清單 → 老闆選擇 → 分流 |
| `/shiftblame`（無未歸檔） | 啟動序列 → 提議 slug → 確認 |

**啟動序列**（每次觸發僅載入索引層）：

1. **未歸檔偵測** — 掃描 `.shiftblame/` 下未歸檔 SLUG.md
2. **四文件載入** — REPO → ROADMAP → SOP → GRAPH
3. **Repo 狀態** — git log / status / branch 摘要
4. **租約載入** — slug 管線：三層租約；簡易模式：長期＋短期
5. **模式判斷** — 老闆確認時指定 slug 管線或簡易模式

---

## 角色總覽

### G1 — 計畫出口

**正方**：需求翻譯（8 項職責）、5W1H 規劃、可行性評估、品質定義。**不做技術決策**，僅回答「能不能做」。

**反方**：質疑遺漏/可行性/越權。7 個質疑方向、5 項越權防線。H/M/L 標註，不做決策。

### G2 — 開發出口

**正方**：承接 G1 產出，技術選型（8 面向）、GWT 測試設計、測試規範（5 層策略）、TDD 紀律（紅燈→綠燈→重構）。

**反方**：質疑測試涵蓋度/技術方案合理性/程式碼品質/一致性。7 個質疑方向、5 項越權防線。

### 體驗者

G2 最終 NNN PASS 後接管。獨立完成，不走正反辯論。以使用者視角檢驗 G2 產出，比對 G1 目標，產出 FEATURE.md（完成項目、未完成項目、BUG、改善建議、下一步）。

### 管理者

調度子代理、收斂（含執行變更）、閘門管理、提交/合併/歸檔。依任務複雜度決定子代理數量與視角。

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

## License

MIT License. 不接受外部貢獻。
