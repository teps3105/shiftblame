# shiftblame

<p align="center">
  <em>「這不是我的鍋。」</em>
</p>

<p align="center">
  <strong>AI Agents 協作框架</strong> — 純 Markdown 定義檔，RFC 2119 規範詞彙。G1+G2 正反收斂 + G3 執行規劃。
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

```
老闆說 → G1(Why/What) ‖ G2(How/Done) → 收斂 → G3(Plan) → 執行 → 證據 → 老闆 PASS
         正方主session＋反方子代理            管理者    執行者           ↑
         ←────────────── 未 PASS 回老闆 ─────────────────────────────────┘
```

## 角色與三軌

- **老闆**：需求／優先序／風險／PASS-FAIL。
- **管理者**：G1+G2 收斂、G3 規劃、派發、初審、收尾。不實作。
- **執行者**：逐項 `<task>` 實作至 `<complete>`，自驗通過即 commit。
- **G1** 外部研究規劃視角（Why/What）→ `<task>`
- **G2** 內部技術實作視角（How/Done）→ `<complete>`
- **G3** 共識後執行規劃層（Plan/Verify，非正反收斂）→ `<plan>`

正方由主 session 身份切換；反方由子代理獨立上下文對抗。

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

框架啟動 → 呈現意圖 → 你確認 → 建立 slug → G1/G2 正反收斂 → G3 規劃 → 執行 → 證據回報 → 你 PASS。

不開框架的日常變更 MAY 直接於 main 提交，但提交規範（訊息格式、精準 add）仍適用。

## 文件結構

```
skills/shiftblame/
├── SKILL.md              # 主規範
├── GATE.md               # 閘門與 <nnn> 生命週期
├── ROLE/
│   ├── MANAGER.md        # 管理者
│   └── EXECUTOR.md       # 執行者
└── TEMPLATES/            # 範本＝合法文件白名單
    ├── SOP.md            # 專案執行準則
    ├── ROADMAP.md        # 後續候選
    └── slug/             # 鏡射 .shiftblame/<slug>/ 產出
        ├── SLUG.md
        └── nnn/
            ├── G1.md
            ├── G2.md
            └── G3.md
```

每個採用 shiftblame 的專案自成 `.shiftblame/` 工作區（MUST 經 `.gitignore` 排除於 repo 外）：

```
.shiftblame/
├── SOP.md                # 專案執行準則（長期租約，當下事實）
├── ROADMAP.md            # 後續候選
├── <slug>/               # 當前任務
│   ├── SLUG.md           # 任務索引（目標、狀態、技術債、交接摘要）
│   └── <nnn>/            # 各輪迭代
│       ├── G1.md         # 外部研究規劃視角產出
│       ├── G2.md         # 內部技術實作視角產出
│       └── G3.md         # 共識後執行規劃
├── tmp/                  # 非持久產出
└── archive/              # 已歸檔任務（過去事實由 git 歷史承擔權威）
```

## 核心原則

1. **回饋即意圖**：老闆每次說話即意圖，管理者揭露後執行。
2. **證據優先**：不確定、新版本、外部 API、法規/安全/效能/成本、無先例、與老闆直覺衝突——MUST 查證。
3. **實作/審查互斥**：管理者改碼 MUST 走第三方驗證。
4. **寫當下事實**：禁日誌式、禁教訓式。過去事實以 git 歷史為權威。
5. **單一權威**：目標只寫 SOP；文件交叉引用不重複。

## 提交規範

- 訊息 `<type>: <繁中描述>`，描述 ≤20 codepoint。
- `.shiftblame/` MUST 經 `.gitignore` 排除。
- 開框架走 `feat/<slug>` 分支，管理者收尾 merge。

## License

MIT License. 不接受外部貢獻。
