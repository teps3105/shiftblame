# shiftblame

<p align="center">
  <em>「這不是我的鍋。」</em>
</p>

<p align="center">
  <strong>給 AI Agent 使用、讓人一眼看懂的回饋協作框架。</strong><br/>
  圖決定路徑，文字只解釋節點。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Made%20with-Markdown-1a1a1a.svg" alt="Made with Markdown"/>
  <img src="https://img.shields.io/badge/RFC-2119-6f42c1.svg" alt="RFC 2119"/>
</p>

---

## 這是什麼

shiftblame 用一張人類可讀的向量拓樸，約束 Agent 如何把需求交給研究、技術、計畫、開發與審查。完整權威圖位於 [`skills/shiftblame/SKILL.md`](skills/shiftblame/SKILL.md)。

核心原則：

- 問題陳述不等於修改授權。
- 秘書必須先揭露原始命題、意圖翻譯與候選方案。
- G1、G2、G3 依序交接，不得合併執行。
- G3 先依 G1 寫驗收，再依 G2 寫實作步驟。
- 計畫與開發結果都由 AUDITOR 回頭對照 G1。
- 不符合時回 G1 重走，而不是直接猜修法。

## 流程概覽

```text
老闆原始命題
      │
      ▼
SECRETARY 意圖揭露
      │ 無修改授權 → 停止寫入
      ▼
老闆指定路由
      │
      ▼
G1 需求研究
      │
      ▼
G2 技術分析
      │
      ▼
G3 先寫驗收，再寫計畫
      │
      ▼
AUDITOR 回顧 G1
   ┌──┴──────────┐
 不符           符合
   │              │
   └──▶ G1       開發 → 證據
                    │
                    ▼
              AUDITOR 對照 G1
                 │不符 → G1
                 ▼
               老闆 PASS
```

讀圖只有四條規則：

1. 沿箭頭前進，不得跳點。
2. 下游發現缺口，沿退回箭頭處理。
3. 每個節點只產出自己的內容。
4. 圖文衝突時，以權威圖為準。

## 角色

| 角色 | 工作 |
|------|------|
| 老闆 | 提出命題、授權修改、做決策、最終 PASS |
| SECRETARY | 揭露意圖、記錄老闆路由、交接與收尾；不得決定或建議新 `<slug>/<nnn>` |
| RESEARCHER | 依老闆指定路由先完成 G1，再由 G1 產出 G2 |
| DEVELOPER | 由 G2 產出 G3，通過回顧後開發並交證據 |
| AUDITOR | 開發前與開發後都回頭對照 G1；repo 唯讀 |

子代理只提供唯讀研究或審查意見；repo 寫入只在主對話 DEVELOPER 角色。

## 三份文件

| 文件 | 回答 | 不做 |
|------|------|------|
| G1 需求研究 | What、Why、邊界、原始驗收條件 | 不寫技術解法 |
| G2 技術分析 | How、測試方式、技術風險 | 不改寫需求 |
| G3 驗收與計畫 | 先寫業務驗收，再寫實作步驟 | 不新增需求、不讓計畫先於驗收 |

## 安裝

把 `skills/shiftblame/` 連結或複製到 Agent 的 skill 目錄。

```bash
# macOS / Linux
ln -s ~/shiftblame/skills/shiftblame <你的 skill 目錄>/shiftblame

# Windows（以系統管理員開啟 cmd）
mklink /J "<你的 skill 目錄>\shiftblame" "D:\shiftblame\skills\shiftblame"
```

## 使用

```text
/shiftblame 幫我重構登入流程
```

SECRETARY 會先揭露意圖，並等待老闆自行指定路由；不得代替老闆判定、列舉選項或提供偏向性提示。老闆指定後，SECRETARY 才能忠實記錄與交接。

同一大 `<slug>` 中的新子需求可由老闆決定開新 `<nnn>`；同一子需求的擴充留在同一 `<nnn>`；新 `<slug>` 原則上只用於幾乎無關的新功能。框架自身演化不開 slug，但仍必須先揭露修改方案並取得老闆授權。

## 文件結構

```text
skills/shiftblame/
├── SKILL.md              # 權威拓樸、讀圖規則、分流
├── GATE.md               # 箭頭條件、退回、收尾
├── ROLE/
│   ├── RESEARCHER.md
│   ├── DEVELOPER.md
│   └── AUDITOR.md
└── TEMPLATES/
    ├── SOP.md
    ├── ROADMAP.md
    └── slug/
        ├── SLUG.md
        └── nnn/
            ├── G1.md
            ├── G2.md
            └── G3.md
```

每個專案的工作區位於 `.shiftblame/`，並且 MUST 經 `.gitignore` 排除。

## 提交規範

- 訊息：`<type>: <繁中描述>`，單行、單一事項。
- 精準 `git add`，不得提交 `.shiftblame/`。
- 多人協作走 `feat/<slug>`；單人本地 MAY 直接 main。

## License

MIT License. 不接受外部貢獻。
