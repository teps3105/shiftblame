# shiftblame

<p align="center">
  <em>「這不是我的鍋。」</em>
</p>

<p align="center">
  <strong>AI Agents 協作框架</strong> — 純 Markdown 定義檔，RFC 2119 規範詞彙。注意力在協定層，文件層只放乾淨結論：G1需求研究 / G2技術分析 / G3實作計畫。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Made%20with-Markdown-1a1a1a.svg" alt="Made with Markdown"/>
  <img src="https://img.shields.io/badge/RFC-2119-6f42c1.svg" alt="RFC 2119"/>
</p>

---

## 這是什麼

一套**給 AI Agent 用的協作框架**。只有 Markdown 定義檔，沒有程式碼。透過 Claude Code、Codex 或任何 Agent 框架的 Skill 系統運作。

> All you need is feedback.
> 文件越乾淨，注意力越自由。
> **shiftblame = 轉移責任以保持注意力。** 注意力有限，框架把責任轉移到不同 agent、文件快照、與兩個注意力弧（`<slug>`／`<nnn>`），讓當下注意力保持乾淨聚焦。

核心是**兩層模型**：

| 層 | 職責 | 形狀 |
|----|------|------|
| **文件層** | 承載「現在的結論」 | 乾淨、線性、單一職責、結果式快照 |
| **協定層** | agent 如何讀寫文件 | 多視角注意力、迭代、emergent 收斂 |

注意力是 agent 對文件的**讀法**，不是文件的形狀。乾淨的線性文件正是 transformer 讀得最好的輸入——讓文件乾淨，與讓 agent 用注意力，是同一件事。舊版的「正方/反方/收斂」是在文件裡手工模擬注意力，徒增噪音又鎖死迭代；v4.0 把它移回協定層。

```
老闆 ──揭露意圖──▶ 迭代(讀 G1/G2 + codebase → 改寫快照,到穩定)
                       │ 穩定(重讀結論不再變)
                       ▼
                  G3 cross-attend ──▶ 執行(causal) ──▶ 證據
                       ▲                                    │
                       └──────── 未 PASS 退回迭代 ──────────┘
老闆 ──PASS──▶ 收尾歸檔
```

## 角色與三文件

老闆是三角外的主角；三角分工（規劃／實作／驗證）三者互斥以保獨立：

- **老闆**：需求／優先序／風險／PASS。握有兩個真 checkpoint：揭露意圖、PASS。
- **管理者**（規劃）：多視角讀 G1/G2+codebase，迭代到穩定，cross-attend 產 G3，派發、收尾。不實作、不審查。
- **執行者**（實作）：逐項 `<task>` 實作至 `<complete>`，自驗通過即 commit。
- **審查者 AUDITOR**（驗證）：`<complete>` 後獨立審 e2e 證據／未驗項／引用。不實作、不規劃。
- **G1** 需求研究（What/Why）→ `<task>` 候選
- **G2** 技術分析（How/Done）→ `<complete>`
- **G3** 實作計畫（Plan）→ `<plan>`

G1/G2 是兩個研究視角對同一份 codebase+意圖的結論（cross-attend），**不是先後階段**。G3 由 cross-attention 產生：計畫項逐一引用研究結論，非重抄。

## 安裝

把 `skills/shiftblame/` 連結或複製到你用的 agent 的 skill 目錄。

```bash
# macOS / Linux
ln -s ~/shiftblame/skills/shiftblame <你的 skill 目錄>/shiftblame

# Windows（以系統管理員開啟 cmd）
mklink /J "<你的 skill 目錄>\shiftblame" "D:\shiftblame\skills\shiftblame"
```

## 使用

```
/shiftblame 幫我重構登入流程
```

框架啟動 → 呈現意圖 → 你確認 → 建立 `<slug>` → 多視角迭代（讀 G1/G2+codebase → 改寫快照）→ 穩定 → G3 規劃 → 執行 → 證據回報 → 你 PASS。

兩個 checkpoint 之間全是自由迭代：結論還在變就繼續讀寫，重讀後不再變即穩定。任一時刻可退回迭代——不為了符合流程而卡死迭代。

不開框架的日常變更 MAY 直接於 main 提交，但提交規範（訊息格式、精準 add）仍適用。

## 文件結構

```
skills/shiftblame/
├── SKILL.md              # 主規範
├── GATE.md               # checkpoint、<nnn>、收尾
├── ROLE/
│   ├── MANAGER.md        # 管理者（規劃）
│   ├── EXECUTOR.md       # 執行者（實作）
│   └── AUDITOR.md        # 審查者（驗證）
└── TEMPLATES/            # 範本＝合法文件白名單
    ├── SOP.md            # 專案執行準則
    ├── ROADMAP.md        # 後續候選
    └── slug/             # 鏡射 .shiftblame/<slug>/ 產出
        ├── SLUG.md
        └── nnn/
            ├── G1.md     # 需求研究結論快照
            ├── G2.md     # 技術分析結論快照
            └── G3.md     # 實作計畫（cross-attend）
```

每個採用 shiftblame 的專案自成 `.shiftblame/` 工作區（MUST 經 `.gitignore` 排除於 repo 外）：

```
.shiftblame/
├── SOP.md                # 專案執行準則（長期租約，當下事實）
├── ROADMAP.md            # 後續候選
├── <slug>/               # 長程注意力弧（跨迭代穩定的任務）
│   ├── SLUG.md           # 任務索引（目標、狀態、技術債、交接摘要）
│   └── <nnn>/            # 短程注意力弧（當輪迭代 epoch，標籤非狀態機）
│       ├── G1.md         # 需求研究結論
│       ├── G2.md         # 技術分析結論
│       └── G3.md         # 實作計畫
├── tmp/                  # 非持久產出（探索性研究/草稿）
└── archive/              # 已歸檔任務（過去事實由 git 歷史承擔權威）
```

## 核心原則

1. **兩層模型**：注意力在協定層（讀＝多視角 self-attention），文件層只放乾淨的當下結論快照。文件越乾淨，注意力越自由。
2. **兩個真 checkpoint**：老闆揭露意圖、老闆 PASS。中間自由迭代；收斂是 emergent（重讀結論不再變＝穩定），不由流程閘門硬卡。
3. **文件五不變量**：單一職責、只寫結果不寫過程、冪等可重寫、狀態與內容分離、注意力在讀不在寫。
4. **證據優先 + 可查核引用**：不確定／新版本／外部 API／法規安全效能成本／無先例／與老闆直覺衝突——MUST 查證；每條事實陳述 MUST 附 `<檔案路徑>:<行號>`。
5. **三角互斥**：規劃／實作／驗證分屬管理者／執行者／審查者；實作與審查 MUST 不同人。

## 提交規範

- 訊息 `<type>: <繁中描述>`，描述 ≤20 codepoint。
- `.shiftblame/` MUST 經 `.gitignore` 排除。
- 開框架走 `feat/<slug>` 分支，管理者收尾 merge。

## License

MIT License. 不接受外部貢獻。
