# shiftblame

<p align="center">
  <em>「這不是我的鍋。」</em>
</p>

<p align="center">
  <strong>AI Agents 協作框架</strong> — 純 Markdown 定義檔，RFC 2119 規範詞彙，ISO 文件結構。雙軌分軌：G1 外部研究規劃視角 ‖ G2 內部技術實作視角，每 `<nnn>` 正→反→收斂。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Made%20with-Markdown-1a1a1a.svg" alt="Made with Markdown"/>
  <img src="https://img.shields.io/badge/RFC-2119-6f42c1.svg" alt="RFC 2119"/>
  <img src="https://img.shields.io/badge/Structure-ISO-21854d.svg" alt="ISO Structure"/>
  <img src="https://img.shields.io/badge/Track-Dual%20Parallel-c9271f.svg" alt="Dual Parallel"/>
</p>

---

## 目錄

- [這是什麼？](#這是什麼)
- [為什麼需要 shiftblame？](#為什麼需要-shiftblame)
- [適用範圍](#適用範圍)
- [規範詞彙（RFC 2119）](#規範詞彙rfc-2119)
- [雙軌分軌管線](#雙軌分軌管線)
- [快速上手](#快速上手)
- [文件體系](#文件體系)
- [`.shiftblame/` 運行時目錄](#shiftblame-運行時目錄)
- [核心原則](#核心原則)
- [三層租約](#三層租約)
- [角色總覽](#角色總覽)
- [外部工具整合](#外部工具整合)
- [License](#license)

---

## 這是什麼？

shiftblame 是一套**給 AI Agent 用的協作框架**。它以 RFC 2119 規範詞彙與 ISO 文件結構，定義嚴格的管線流程，讓 AI 角色在老闆（你）的監督下完成任務。

**核心思想：意圖揭露 + 雙軌分軌 + 先提案再質疑。** AI 的每步行動 MUST 先向老闆揭露「要做什麼、為什麼」，MUST 經確認後方執行。管線採「雙軌分軌」——G1（外部研究規劃視角）與 G2（內部技術實作視角）正方由主 session 身份切換、反方由子代理獨立對抗，走正→反→收斂。每個 slug 依規模開 1~N 個 `<nnn>`，每個 `<nnn>` = 一輪辯論。

整個框架**只有 Markdown 定義檔**，沒有程式碼。透過 Claude Code、Codex 或任何 Agent 框架的 Skill 系統運作。

> [!TIP]
> 如果你用 Claude Code CLI，把 skill 資料夾 symlink 到 `~/.claude/skills/`（或 `~/.zcode/skills/`）就能用了。

---

## 為什麼需要 shiftblame？

| 問題 | shiftblame 如何處理 |
|------|---------------------|
| 直接叫 AI 寫碼，沒有檢查點 | 雙軌管線，每步都有獨立子代理質疑把關 |
| AI 偷偷做事 | **意圖揭露**：每步行動 MUST 事前說明，老闆確認後方執行 |
| 設計和實作脫節 | **雙軌分軌**：G1 側重外部研究規劃、G2 側重內部技術實作，分軌進行 |
| AI 隨意加功能 | **視角分離**：G1 管需求邊界，G2 管技術實作，各有路由出口 |
| 實作者自審 | **實作與審查互斥**：管理者 MUST 獨立 review 執行者產出；管理者自行改碼時 MUST 補第三方佐證 |
| 出錯難追 | **迭代收斂**：管理者以最後收斂為基線增量增加 |

---

## 適用範圍

框架並非所有變更都適用。分流如下（見 [SKILL.md](skills/shiftblame/SKILL.md) §4）：

| 情境 | 框架 | 分支 |
|------|:----:|------|
| 複雜系統功能開發 | **MUST** 開 | `feat/<slug>` |
| 解決 issue | **MUST** 開 | `feat/<slug>` |
| 研究、探討、設計、維護等日常行為 | **MAY** 不開 | 直接於 main |

不開框架時，提交規範（訊息格式、精準 add）**MUST 仍然適用**。

---

## 規範詞彙（RFC 2119）

框架所有定義檔使用 RFC 2119 / RFC 8174 規範詞彙。大寫 = 規範詞，小寫 = 一般用詞。

| 詞彙 | 中文 | 語義 |
|------|------|------|
| **MUST** / **REQUIRED** / **SHALL** | 必須 | 絕對要求 |
| **MUST NOT** / **SHALL NOT** | 必須不 | **分流標記**：此路徑 MUST 改走指定替代路由出口 |
| **SHOULD** / **RECOMMENDED** | 應 | 強烈建議；偏離時 MUST 記錄理由 |
| **SHOULD NOT** | 應不 | 分流標記：建議改走替代路由；有合理理由得維持並記錄 |
| **MAY** / **OPTIONAL** | 得 | 可選，不施加任何要求 |

> **MUST NOT／SHOULD NOT 的核心語義**：標記某路徑後，該條款 MUST 附帶替代路由出口。任何行為 MUST 有對應路由；互斥場景 MUST 交叉比對尋找更適合的路由出口。

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
執行者逐項實作 <task> 至 <complete>（每項自驗通過即 commit）
      → 管理者揭露升級鏈選項 → 老闆選擇擔任者 → 獨立 code review＋e2e 證據審核
      → 管理者揭露結果／未驗項 → 老闆指示推進下一 <nnn>
老闆拍板 slug 結束（PASS，唯 slug 層級）→ 收尾
```

### 雙軌分工

| 視角 | 正方 | 反方 | 收斂 |
|:----:|------|------|------|
| **G1** 外部研究規劃 | 需求翻譯、5W1H、可行性評估 | 質疑遺漏/可行性/越權 | 管理者收斂計畫結論，產 `<task>` |
| **G2** 內部技術實作 | 技術選型、GWT 測試、TDD | 質疑覆蓋率/品質/一致性 | 管理者收斂技術結論，產 `<complete>` |

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

## 文件體系

框架定義檔採 ISO 文件結構，每檔有 `doc_id`、`parent`、`revision`，並以 §章節交叉引用：

```
skills/shiftblame/
├── SKILL.md              # SBM-SKILL：主規範（範圍、術語、原則、管線、提交規範）
├── GATE.md               # SBM-GATE：閘門、<nnn> 生命週期、複審、收尾
├── ROLE/
│   ├── MANAGER.md        # SBM-RM-MGR：管理者（調度／收斂／初審／合併）
│   └── EXECUTOR.md       # SBM-RM-EXE：執行者子代理（實作軌）
├── TEMPLATES/            # 模板—結構＝合法文件白名單
│   ├── SOP.md            # SBM-TM-SOP：專案執行準則
│   ├── ROADMAP.md        # SBM-TM-RM：後續候選
│   └── slug/             # 鏡射 .shiftblame/<slug>/ 產出結構
│       ├── SLUG.md       # SBM-TM-SLUG：開發狀態記錄
│       └── nnn/          # 佔位符，實例化為 001/002 等
│           ├── G1.md     # SBM-TM-G1：外部研究規劃視角
│           └── G2.md     # SBM-TM-G2：內部技術實作視角
└── TOOLS/                # TOOLS/<功能英文大寫>/<具體工具>.md
```

---

## `.shiftblame/` 運行時目錄

`.shiftblame/` 是框架的運行時工作區。MUST 經 `.gitignore` 排除於 repo 外、MUST NOT 進入 slug 鏈。

```
.shiftblame/
├── <slug>/               # 當前任務
│   ├── SLUG.md           # 任務索引（目標、狀態、技術債、交接摘要）
│   └── <nnn>/            # 各輪迭代（每輪同時產出 G1.md + G2.md）
│       ├── G1.md         # 外部研究規劃視角產出
│       └── G2.md         # 內部技術實作視角產出
├── SOP.md                # 專案紀律（長期租約，當下事實）
├── ROADMAP.md            # 後續候選
├── tmp/                  # 非持久產出
├── archive/              # 已歸檔任務（過去事實由 git 歷史承擔權威）
```

---

## 核心原則

框架 19 條核心原則（見 [SKILL.md](skills/shiftblame/SKILL.md) §5）。摘要：

| # | 原則 | 語義 |
|:-:|------|------|
| 1 | **回饋即意圖** | 老闆每次說話即觸發意圖揭露，管理者 MUST 先揭露理解到的意圖，MUST 經確認後方執行 |
| 2 | **老闆角色邊界** | 老闆提供大局／需求／優先序／風險接受／PASS-FAIL；技術裁判由管理者承擔 |
| 3 | **證據驅動說服** | 將需求翻譯為可驗證問題，以完整證據鏈提可反駁建議 |
| 4 | **查證優先** | 不確定／新框架版本／外部 API 等情境 MUST 查證 |
| 5 | **SOP 約束與文件體系** | SOP=當下紀律／ROADMAP=後續候選；過去事實以 git 歷史為權威；日誌式／教訓式表述 MUST 改寫為當下結構性事實 |
| 9 | **Slug 前置硬閘門** | 變更前 MUST 先建 slug 結構、完成雙軌收斂後方進入實作 |
| 13 | **固定雙軌** | 正反收斂 MUST 只走 G1+G2；執行者歸屬實作軌，收斂軌維持 G1+G2 |
| 14 | **實作與審查互斥** | 管理者 MUST 獨立 review 執行者產出；管理者自行改碼時 MUST 補第三方佐證 |
| 18 | **決策邊界三條** | ① 技術決策管理者自決 ② 接力方向老闆拍板 ③ 過程順序管理者自決 |

> 完整 19 條見 [SKILL.md §5](skills/shiftblame/SKILL.md)。

---

## 三層租約

規範準則有效性的三層架構，長期位階最高，衝突時長期優先：

| 層級 | 期間 | 內容 | 載入時機 |
|:----:|------|------|----------|
| 長期 | 跨 slug | SOP.md | 每次啟動；未載入 → 入口閘門 FAIL |
| 中期 | 單 slug | SLUG.md §6 租約有效期 | 每次 START |
| 短期 | 單 `<nnn>` | SKILL + GATE + ROLE/ + TEMPLATES/ | 每個 `<nnn>` START |

---

## 角色總覽

### G1 — 外部研究規劃視角

**正方**：需求翻譯、5W1H 規劃、可行性評估、品質定義。技術決策 MUST 交 G2，僅回答「能不能做」。

**反方**：質疑遺漏/可行性/越權。H/M/L 標註，專司質疑。

### G2 — 內部技術實作視角

**正方**：技術選型（遵循最短解決策階梯）、GWT 測試設計、TDD 紀律（紅燈→綠燈→重構）。

**反方**：質疑測試涵蓋度/技術方案合理性/程式碼品質/一致性、過度工程審查。

### 管理者（MANAGER）

調度雙軌、分別收斂 G1/G2、合併為一致基線、初審覆核、合併歸檔。管線 commit 歸執行者；管理者保留收尾 merge。實作交執行者承接；post-EXECUTOR 管理者 MUST 揭露升級鏈選項 → 老闆選擇擔任者 → MUST 獨立 code review。

### 執行者（EXECUTOR）

獨立實作軌子代理，承接合併基線，執行 `<task>` 至 `<complete>` 逐項達成。每項 `<task>` 自驗通過即 MUST commit。達成 `<complete>` 為實作完成，非 PASS。

---

## 外部工具整合

框架以自帶流程為骨幹，外部工具為升級鏈選項。**卸除任一外部工具，核心流程仍完整可用**（降級鏈）。工具檔採 `TOOLS/<功能英文大寫>/<具體工具>.md`，按行為功能載入：

| 目錄 | 行為功能 |
|------|----------|
| AUDIT/ | 獨立 code review、成果驗收、外部複審 |
| E2E/ | web、Godot、TapTap Maker runtime/e2e 驗證 |
| MEDIA/ | mmx 與 TapTap Maker 資產生成 |
| DESIGN/ | 設計工具（open-design） |
| RESEARCH/ | 查證工具（searxng） |
| VISION/ | 視覺粗篩（ai-vision） |
| IMPLEMENTATION/ | 專案實作工具 |

**衝突仲裁**：外部工具產出與框架定義檔條款衝突時，以框架定義檔為準。

> 完整規則見 [SKILL.md §5.16–§5.17](skills/shiftblame/SKILL.md)。

---

## License

MIT License. 不接受外部貢獻。
