# shiftblame

<p align="center">
  <em>「這不是我的鍋。」</em>
</p>

<p align="center">
  <strong>AI Agents 協作框架</strong> — 純 Markdown 定義檔，雙軌分軌：G1 外部研究規劃視角 ‖ G2 內部技術實作視角，每 <nnn> 正→反→收斂。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Made%20with-Markdown-1a1a1a.svg" alt="Made with Markdown"/>
  <img src="https://img.shields.io/badge/Track-Dual%20Parallel-6f42c1.svg" alt="Dual Parallel"/>
  <img src="https://img.shields.io/badge/Model-Propose%20First-21854d.svg" alt="Propose First"/>
</p>

---

## 目錄

- [這是什麼？](#-這是什麼)
- [為什麼需要 shiftblame？](#-為什麼需要-shiftblame)
- [雙軌分軌管線](#-雙軌分軌管線)
- [快速上手](#-快速上手)
- [專案結構](#-專案結構)
- [.shiftblame/ 運行時目錄](#shiftblame-運行時目錄)
- [核心原則](#-核心原則)
- [三層租約](#-三層租約)
- [觸發方式](#-觸發方式)
- [角色總覽](#-角色總覽)
- [選用：ponytail](#選用ponytail)
- [選用：外部工具](#選用外部工具)
- [PRD / PID / SOP 制度](#-prd--pid--sop-制度)
- [License](#-license)

---

## 這是什麼？

shiftblame 是一套**給 AI Agent 用的協作框架**。它定義嚴格的管線流程，讓 AI 角色在老闆（你）的監督下完成任務。

**核心思想：意圖揭露＋雙軌分軌＋先提案再質疑。** AI 的每步行動都必須先向老闆說明「要做什麼、為什麼」，經確認後才執行。不是事後解釋，是事前揭露。管線採「雙軌分軌」模式——G1（外部研究規劃視角）與 G2（內部技術實作視角）正方由主 session 身份切換、反方由子代理獨立對抗，走正→反→收斂。收斂分兩份各自結論，按兩份收斂結論實作。每個 slug 依規模開 1~N 個 <nnn>，每個 <nnn> = 一輪辯論。

整個框架**只有 Markdown 定義檔**，沒有程式碼。透過 Claude Code、Codex 或任何 Agent 框架的 Skill 系統運作，定義 AI 角色該怎麼行動。

> [!TIP]
> 如果你用 Claude Code CLI，把 skill 資料夾 symlink 到 `~/.claude/skills/` 就能用了。

---

## 為什麼需要 shiftblame？

| 問題 | shiftblame 怎麼解決 |
|------|---------------------|
| 直接叫 AI 寫碼，沒有檢查點 | 雙軌管線，每步都有獨立的質疑把關 |
| AI 偷偷做事 | **意圖揭露**：每步行動事前說明，老闆確認後才執行 |
| AI 自作主張改記憶 | 回饋即意圖：老闆的回饋是素材，禁止寫入記憶 |
| 設計和實作脫節 | **雙軌分軌**：G1 側重外部研究規劃、G2 側重內部技術實作，分軌進行 |
| AI 隨意加功能 | **視角分離**：G1 管需求邊界，G2 管技術實作，互不越權 |
| 出錯難追 | **迭代收斂**：<nnn> FAIL 以收斂產出為基線增量增加 |

---

## 雙軌分軌管線

每個任務（slug）走雙軌分軌管線，G1 與 G2 **分軌進行**（正方主 session 身份切換、反方子代理獨立），相輔相成不分先後：

```
老闆觸發 → 建立 slug
      │
      ▼
<nnn> 001：G1（外部研究規劃視角）‖ G2（內部技術實作視角）分軌進行
      │
      ├── 正方（分軌）：主 session 擔任 G1 提計畫 ‖ G2 提技術（身份切換）
      ├── 反方（分軌）：子代理擔任 G1 質疑計畫 ‖ G2 質疑技術（獨立對抗）
      └── 收斂：管理者分別收斂 G1（產 <task>）+ G2（產 <complete>）→ 合併基線
      │
      ▼
實作前規劃（獨立階段：依複雜度定實作策略＋明確化 <complete>）
      │
      ▼
EXECUTOR 逐項實作 <task> 至 <complete>（每項自驗通過即 commit）→ 老闆指示推進下一 <nnn>
老闆拍板 slug 結束（PASS，唯 slug 層級）→ 收尾
```

### 雙軌分工

| 視角 | 正方 | 反方 | 收斂 |
|:----:|------|------|------|
| G1 外部研究規劃 | 需求翻譯、5W1H、可行性評估 | 質疑遺漏/可行性/越權 | 管理者收斂計畫結論 |
| G2 內部技術實作 | 技術選型、GWT 測試、TDD 實作 | 質疑覆蓋率/品質/一致性 | 管理者收斂技術結論 |

**關鍵**：G1 側重需求與可行性（「能不能做」），G2 側重技術與實作（「怎麼做」），雙軌分軌不分先後、相輔相成。收斂分兩份各自結論，按兩份收斂結論實作。

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

框架會自動：啟動 → 呈現意圖 → 你確認 → 建立 slug → 雙軌分軌辯論。

### 3. 你的角色（老闆）

你只需要在每個閘門點位**確認或修正**，框架會推動 AI 角色完成其餘工作。

---

## 專案結構

> `skills/shiftblame/` 下皆為技能定義檔（短期租約），與 `.shiftblame/`（專案層）區分。

```
skills/shiftblame/
├── SKILL.md              # 入口：核心原則、啟動序列、觸發、管線概述
├── GATE.md               # 閘門原則、狀態序、<nnn> 生命週期、複審、收尾
├── ROLE/
│   ├── MANAGER.md        # 管理者角色（調度／收斂／初審／合併，不實作）
│   ├── EXECUTOR.md       # 執行者子代理（實作軌，不計入正反收斂）
│   ├── G1.md             # 外部研究規劃視角：需求翻譯、5W1H、可行性評估
│   └── G2.md             # 內部技術實作視角：技術選型、GWT 測試、TDD
├── TEMPLATES/            # 模板（REPO, ROADMAP, SOP, GRAPH, SLUG, PRD, PID）
└── TOOLS/                # 外部工具整合（具體設定集中此處）
```

---

## .shiftblame/ 運行時目錄

`.shiftblame/` 是框架的運行時工作區，**本地私密，不入 repo、不進 slug 鏈**。

```
.shiftblame/
├── <slug>/               # 當前任務
│   ├── SLUG.md           # 任務索引（目標、狀態、技術債、交接摘要）
│   └── <nnn>/            # 各輪迭代（每輪同時產出 G1.md + G2.md）
│       ├── G1.md         # 外部研究規劃視角產出
│       └── G2.md         # 內部技術實作視角產出
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
| 4 | **先提案再質疑** | G1/G2 雙軌分軌，各走正→反→收斂流程 |
| 5 | **迭代收斂** | 管理者以最後收斂為基線增量增加 |

---

## 三層租約

規範準則有效性的三層架構，長期位階最高，衝突時長期優先：

| 層級 | 期間 | 內容 | 載入時機 |
|:----:|------|------|----------|
| 長期 | 跨 slug | SOP.md | 每次啟動 |
| 中期 | 單 slug | SLUG.md §7 租約有效期 | 每次 START |
| 短期 | 單 <nnn> | SKILL+GATE+ROLE/（MANAGER+EXECUTOR+G1+G2） | 每個 <nnn> START |

---

## 觸發方式

| 觸發方式 | 行為 |
|----------|------|
| `/shiftblame <任意文字>` | 意圖線索 → 啟動序列 → 呈現意圖 → 確認 → 建立 slug |
| `/shiftblame`（有未歸檔） | 啟動序列 → 呈現清單 → 老闆選擇 → 分流 |
| `/shiftblame`（無未歸檔） | 啟動序列 → 提議 slug → 確認 |

**啟動序列**（每次觸發僅載入索引層）：

1. **未歸檔偵測** — 掃描 `.shiftblame/` 下未歸檔 SLUG.md
2. **四文件載入** — REPO → ROADMAP → SOP → GRAPH
3. **Repo 狀態** — git log / status / branch 摘要
4. **租約載入** — 三層租約（SOP｜SLUG §7｜SKILL+GATE+ROLE/）
5. **建立 slug** — `mkdir -p .shiftblame/<slug>/001` + `git checkout -b feat/<slug>`

---

## 角色總覽

### G1 — 外部研究規劃視角

**正方**：需求翻譯（8 項職責）、5W1H 規劃、可行性評估、品質定義。**不做技術決策**，僅回答「能不能做」。

**反方**：質疑遺漏/可行性/越權。7 個質疑方向、5 項越權防線。H/M/L 標註，不做決策。

### G2 — 內部技術實作視角

**正方**：從內部技術實作視角獨立提出技術選型（8 面向）、GWT 測試設計、測試規範（5 層策略）、TDD 紀律（紅燈→綠燈→重構）。不依賴當前 <nnn> 的 G1 產出。

**反方**：質疑測試涵蓋度/技術方案合理性/程式碼品質/一致性。7 個質疑方向、5 項越權防線。

### 管理者（MANAGER）

調度雙軌：正方主 session 身份切換（G1/G2）、反方開子代理獨立對抗；分別收斂雙軌、初審、合併/歸檔。管線 commit 歸 EXECUTOR（<task> 項自驗通過即 commit）；MANAGER 保留收尾 merge。**不自行實作**——收斂後由 EXECUTOR 實作軌承接（EXECUTOR 為臨時性單一職責子代理，不計入正反收斂軌）。複審 3 觸發點（收斂後／`<task>` 執行完／slug 全域）全老闆-gated、預設關閉。

---

## 選用：ponytail

shiftblame 可與 [ponytail](https://github.com/DietrichGebert/ponytail)（lazy senior dev 模式）並用。以下為 shiftblame 對此整合的詮釋與規則。

- **未安裝 ponytail**：shiftblame 完整可用，功能不受影響。
- **已安裝且生效時**：ponytail 的 lazy ladder（YAGNI、stdlib 優先、最短可運作解等，詳見 ponytail）套用於 shiftblame 流程的程式碼與產物產出。

> 作用面說明：shiftblame 為純 Markdown 定義檔框架，ponytail 主要作用於其中少量程式碼/腳本產出（如 G2 實作階段、`.shiftblame/tmp/` 探索測試）。

**衝突仲裁**：ponytail「最短化」與 shiftblame 定義檔明文要求的產出（證據鏈、收斂、GWT 測試、意圖揭露等）衝突時，以 **shiftblame 定義檔條款為準**——這些屬「使用者/框架明確要求的詳盡產出」，不適用最短化。完整規則見框架核心原則（[SKILL.md](skills/shiftblame/SKILL.md)「選用外部 skill 整合」）。

---

## 選用：外部工具

shiftblame 是 **platform-agnostic**——框架不綁單一平台／工具，卸除任一外部工具，核心流程仍完整可用。下列外部工具已安裝時優先使用，不可用方降級內部（降級留痕，不跳過既有足夠內建工具）：

- **SEARXNG-mcp**（研究／搜尋）：外部資訊研究與查證
- **ai-vision-mcp**（圖像識別）：視覺驗收粗篩（最終裁判仍是老闆的眼睛）
- **godot-mcp**（Godot 實作）：Godot 專案／場景／節點操作
- **codex**（獨立性工作）：反方獨立複審、成果驗收、外部查證

**未安裝任一工具時**：框架完整可用——研究用內建 web、驗收用獨立子代理＋老闆親驗、反方子代理獨立對抗（常態即如此）、實作由 EXECUTOR 承接。

> codex 不再是「特殊外部角色」，而是普通外部工具之一；framework 內 agent 對 codex 的所有外部需求一律走 `/codex:rescue`，禁側通道。

**衝突仲裁**：外部工具產出與 shiftblame 定義檔明文要求的產出衝突時，以 **shiftblame 定義檔條款為準**。完整規則見框架核心原則（[SKILL.md](skills/shiftblame/SKILL.md)「外部工具整合總則 §17.0–§17.3」）。

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
