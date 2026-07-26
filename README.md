# shiftblame

<p align="center">
  <em>「這不是我的鍋。」</em>
</p>

<p align="center">
  <strong>AI Agents 協作框架</strong> — 純 Markdown 定義檔，RFC 2119 規範詞彙。注意力在協定層，文件層只放乾淨結論：G1需求研究 / G2技術分析 / G3開發計畫。
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
> **shiftblame = 轉移責任以保持注意力。** 注意力有限，框架把責任轉移到不同角色、子代理外包、文件快照、與兩個注意力弧（`<slug>`／`<nnn>`），讓當下注意力保持乾淨聚焦。

核心是**兩層模型**：

| 層 | 職責 | 形狀 |
|----|------|------|
| **文件層** | 承載「現在的結論」 | 乾淨、線性、單一職責、結果式快照 |
| **協定層** | agent 如何讀寫文件 | 多視角注意力、迭代、emergent 收斂 |

注意力是 agent 對文件的**讀法**，不是文件的形狀。乾淨的線性文件正是 transformer 讀得最好的輸入——讓文件乾淨，與讓 agent 用注意力，是同一件事。

```
老闆 ──揭露意圖──▶ 秘書(預設角色:翻譯需求/建 slug/派發/checkpoint/收尾)
                       │ 開 <slug> 觸發三軌
                       ▼
             迭代(讀 G1/G2/G3 + codebase → 改寫快照,到穩定)
                       │ 穩定
                       ▼
                  G3 計畫 ──▶ 開發(causal) ──▶ 證據
                       ▲                                    │
                       └──── AUDITOR 驗收不過 → 回 G1 ──────┘
老闆 ──PASS──▶ 收尾歸檔
```

## 角色與三文件

老闆是主角；**秘書是 skill 載入即生效的預設角色**（老闆的幕僚）；**三軌角色於開 `<slug>` 時觸發**，是主對話內的角色切換（非子代理）：

- **老闆**：需求／優先序／風險／PASS。握有兩個真 checkpoint：揭露意圖、PASS。
- **秘書**（預設）：老闆的幕僚。核心＝**翻譯需求**（老闆意圖→可驗證問題）、建 `<slug>`、派發、checkpoint、收尾。非決策者（決策歸老闆）；不開發、不審查、不親研究。
- **研究者 RESEARCHER**（研究）：相鄰 G1、G2。視角＝需求／Why／邊界。
- **開發者 DEVELOPER**（開發）：相鄰 G2、G3。寫檔／測試／操作在此，主對話親為。
- **審查者 AUDITOR**（審查）：相鄰 G3、G1。驗收不過 → 回 G1。

**子代理 ＝ 外包、唯讀、不承擔責任**；僅承接主對話角色派發的研究／審查等獨立唯讀任務。子代理產出非權威，責任回主對話。

文件不是角色的映射——**每份文件是兩個角色在邊上雙向溝通、妥協的產物**（角色是頂點、文件是邊）：

```
                 RESEARCHER
                ╱          ╲
          G1 ╱   (需求)      ╲ G2 (技術)
            ╱                  ╲
      AUDITOR ──── G3 ────── DEVELOPER
                   (計畫)
```

- **G1** 需求研究（What/Why）→ `<task>` 候選
- **G2** 技術分析（How/Done）→ `<complete>`
- **G3** 開發計畫（Plan）→ `<plan>`

驗收不過 → 回 **G1** 重新研究（需求根因），非盲目改開發——這是 TDD 的 Red→回 G1→重走→Green。

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

框架啟動 → 秘書承接意圖 → 呈現 → 你確認 → 建立 `<slug>` → 觸發三軌迭代（讀 G1/G2/G3+codebase → 改寫快照）→ 穩定 → G3 開發計畫 → 開發 → 證據回報 → 你 PASS。

兩個 checkpoint 之間全是自由迭代：結論還在變就繼續讀寫，重讀後不再變即穩定。任一時刻可退回迭代——不為了符合流程而卡死迭代。

> **框架自身的演化不走 slug 流程**（避免 bootstrap 循環）；直接於主對話釐清 → 改檔 → 自洽檢查。

不開框架的日常變更 MAY 直接於 main 提交，但提交規範（訊息格式、精準 add）仍適用。

## 文件結構

```
skills/shiftblame/
├── SKILL.md              # 主規範 + 預設角色（秘書）
├── GATE.md               # checkpoint、<nnn>、收尾、複審
├── ROLE/
│   ├── RESEARCHER.md     # 研究者（研究軌，相鄰 G1、G2）
│   ├── DEVELOPER.md      # 開發者（開發軌，相鄰 G2、G3）
│   └── AUDITOR.md        # 審查者（審查軌，相鄰 G3、G1）
└── TEMPLATES/            # 範本＝合法文件白名單
    ├── SOP.md            # 專案執行準則
    ├── ROADMAP.md        # 待開發業務需求
    └── slug/             # 鏡射 .shiftblame/<slug>/ 產出
        ├── SLUG.md
        └── nnn/
            ├── G1.md     # 需求研究
            ├── G2.md     # 技術分析
            └── G3.md     # 開發計畫
```

每個採用 shiftblame 的專案自成 `.shiftblame/` 工作區（MUST 經 `.gitignore` 排除於 repo 外）。

## 核心原則

1. **兩層模型**：注意力在協定層（讀＝多視角 self-attention），文件層只放乾淨的當下結論快照。文件越乾淨，注意力越自由。
2. **兩個真 checkpoint**：老闆揭露意圖、老闆 PASS。中間自由迭代；收斂是 emergent（重讀結論不再變＝穩定），不由流程閘門硬卡。
3. **文件六不變量**：單一職責、只寫結果不寫過程、冪等可重寫、狀態與內容分離、注意力在讀不在寫、資料型內容表格化。
4. **文件＝角色間妥協產物**：角色是頂點、文件是邊；G1／G2／G3 各為兩個角色雙向溝通的產物（G1＝研究↔審查、G2＝研究↔開發、G3＝開發↔審查），構成 TDD 回饋閉環；驗收不過 → 回 G1。
5. **子代理外包唯讀**：子代理不承擔責任，僅提供獨立唯讀成果；寫檔／測試／操作只在主對話。
6. **證據優先 + 可查核引用**：不確定／新版本／外部 API／法規安全效能成本／無先例／與老闆直覺衝突——MUST 查證；每條事實陳述 MUST 附 `<檔案路徑>:<行號>`。

## 提交規範

- 訊息 `<type>: <繁中描述>`，單行可掃過；繁中描述 SHOULD 約 10~50 字。
- `.shiftblame/` MUST 經 `.gitignore` 排除。
- 開框架走 `feat/<slug>` 分支，秘書收尾 merge。

## License

MIT License. 不接受外部貢獻。
