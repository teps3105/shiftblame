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
- G1、G2、G3 各由主導角色產出，互相制衡並須兩兩一致；一致以 G1 需求項為對齊軸，三對各須正向承接＋反向回指（判準見 `SKILL.md` §10，§1.3 轉述）。
- G3 內部先依 G1 寫驗收，再依 G2 寫實作步驟。
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
                 │不符 → 回三權制衡
                 ▼
           nnn 完成（循環收斂）
                 │
           輕量保鮮（更新 SLUG）
                 │
         ┌───────┴───────┐
   老闆開新 nnn      老闆：slug 結束
         │                 ▼
         ▼            老闆 PASS
   回三權制衡              │
   （新循環）              ▼
                    完整收尾保鮮
                    （移 archive）
```

`<nnn>` 完成是單一子需求循環收斂，不等於整個 `<slug>` 結束。老闆在同一 `<slug>` 開新 `<nnn>` 不需先 PASS；只有結束整個 `<slug>` 才走 PASS 與完整收尾保鮮。

讀圖只有四條規則：

1. 沿箭頭前進，不得跳點。
2. 下游發現缺口，沿退回箭頭處理。
3. 每個節點只產出自己的內容。
4. 圖文衝突時，以權威圖為準。

## 角色

| 角色 | 工作 |
|------|------|
| 老闆 | 提出命題、授權修改、做決策、最終 PASS |
| **SECRETARY（主對話固定）** | 揭露意圖、記錄老闆路由、交接、收尾與文件保鮮；派發子代理、**親自核對 §10 一致性**；不得自行決定，可提出路由提議但不等於授權 |
| RESEARCHER | 主導 G2，承接 G1 並取得、複核外部獨立研究（由子代理承載，角色為任務參數） |
| PLANNER | 主導 G3，先寫驗收再寫計畫（供 SECRETARY 照表執行開發）；對 repo 唯讀，不執行開發（由子代理承載） |
| **SECRETARY（主對話）** | 主導 G3 計畫產出後，**依 G3 親自執行 repo 開發、測試、commit、自驗**（唯一 repo 開發執行者）；沿用原 SECRETARY 職責（揭露意圖、記錄路由、交接、收尾、保鮮、核對 §10） |
| AUDITOR | 開發前與開發後都派發唯讀子代理獨立審核，再複核並回頭對照 G1（由子代理承載） |

**主對話永遠是 SECRETARY**——AUDITOR／RESEARCHER／PLANNER 的工作由子代理承載（角色為任務參數）；子代理對 repo 一律唯讀、工作區限 `.shiftblame/`，只寫自己主導的管理文件（G1／G2／G3）。repo 開發、測試、commit、自驗與**判決性工作**（改需求方向、跨權協調、決定 commit 保留/reset、PASS、路由判定）MUST 由主對話 SECRETARY 執行。

## 三份文件

| 文件 | 回答 | 不做 |
|------|------|------|
| G1 需求研究 | What、Why、邊界、原始驗收條件 | 不寫技術解法 |
| G2 技術分析 | How、測試方式、技術風險 | 不改寫需求 |
| G3 驗收與計畫 | 先寫業務驗收，再寫實作步驟 | 不新增需求、不讓計畫先於驗收 |

## SOP 與 ROADMAP 的硬邊界

這兩份專案文件不是 Agent 的流水帳：

| 文件 | 只能寫 | MUST NOT 寫 |
|------|--------|--------------|
| SOP | 本專案跨 `<slug>` 長期有效、可查核的本地配置、具體執行規範、資料／服務邊界與驗證入口；可使用段落、表格、命令與來源標註 | 產品目標、ROADMAP 計畫、G1/G2/G3、中央流程副本、單一需求、過時規範、進度或流水帳 |
| ROADMAP | 用白話寫產品目標、固定邊界與尚未完成的想做計畫 | 未授權想法、已完成事項、技術方案、G1/G2/G3、排程、優先級、任務、進度或流水帳 |

欄位模板與拒絕規則以 [`skills/shiftblame/assets/SOP.md`](skills/shiftblame/assets/SOP.md) 及 [`skills/shiftblame/assets/ROADMAP.md`](skills/shiftblame/assets/ROADMAP.md) 為準；不符合模板准入條件的內容不得寫入。

每個 `<slug>` 結束時，文件保鮮是收尾的固定動作：ROADMAP 移除已完成條目並修正剩餘方向，SOP 依當前 codebase 更新事實並刪除過時內容。這是維護既有文件，不等於授權新增產品需求；新增方向與產品邊界仍須 owner 明確授權。

## README 的作用

README 是專案對外的說明文件與門面，讓外部讀者知道專案是什麼、能做什麼、如何在公開且可重現的前提下開始使用，以及要去哪裡看更多資料。README 可以寫公開的功能、支援平台、公開安裝方式、公開限制、示範入口與貢獻說明。

README 不承載個人化或內部配置。個人工作站路徑、內網 IP／埠號、SSH alias、namespace、Pod／PVC、私有憑證、machine-id、內部拓撲、owner-only 命令、內部部署細節與一次性維運筆記，應放在專案 `.shiftblame/SOP.md` 或受保護的內部文件，不得因為方便 agent 查找而寫入 README。

## 安裝

shiftblame 是一個 Codex plugin 套件（根目錄含 `.codex-plugin/plugin.json`）。安裝後自動提供 `shiftblame` 與各個 `sb-*` skills，不需手動 symlink。

**方式一：從本地目錄安裝（開發／自用）**

1. 開啟 **Settings → Plugin Management → Discover**。
2. 點 **`+`** 新增 marketplace，來源選「本地目錄」，指向本 repo 根目錄。
3. 在 **Installed** 分頁啟用 `shiftblame`。

**方式二：從 Git 安裝（分享／版本追蹤）**

把本 repo 推到 GitHub 後，以 Git URL 或 GitHub repo 作為 marketplace 來源加入，再啟用 plugin。

安裝完成後，skill 自動被發現；plugin 啟用即生效，無需複製檔案到 skill 目錄。

## 使用

shiftblame skill 會依任務描述自動觸發（開發、審查、研究任務皆然）。直接描述你的目標即可，例如：

```text
幫我用三權制衡流程重構登入流程
```

SECRETARY 會先揭露意圖，並等待老闆自行指定路由；不得代替老闆判定。可依既有脈絡提出路由提議，但提議只能回報給老闆，不能寫入 ROADMAP，也不等於授權。老闆指定後，SECRETARY 才能忠實記錄與交接。

同一大 `<slug>` 中的新子需求可由老闆決定開新 `<nnn>`；同一子需求的擴充留在同一 `<nnn>`；新 `<slug>` 原則上只用於幾乎無關的新功能。框架自身演化不開 slug，但仍必須先揭露修改方案並取得老闆授權。

## 文件結構

```text
shiftblame/                         # plugin 套件根（repo 根）
├── .codex-plugin/plugin.json      # plugin manifest
└── skills/
    ├── shiftblame/
    │   ├── SKILL.md               # 權威拓樸、讀圖規則、分流、箭頭條件、收尾
    │   ├── references/            # 角色定義（按需讀）
    │   │   ├── RESEARCHER.md
    │   │   ├── PLANNER.md
    │   │   └── AUDITOR.md
    │   └── assets/                # 範本與固定資產
    │       ├── DOCS.md            # 專案 docs/ 系統文件寫法判準
    │       ├── SOP.md
    │       ├── ROADMAP.md
    │       └── SLUG.md             # 單檔含 SLUG 主體 + G1/G2/G3 三權範本
    └── sb-*/SKILL.md               # 各個可直接觸發的工作流 skill
```

每個專案的工作區位於 `.shiftblame/`，並且 MUST 經 `.gitignore` 排除。

## 提交規範

- 訊息：`<type>: <繁中描述>`，單行、單一事項。
- 精準 `git add`，不得提交 `.shiftblame/`。
- 多人協作走 `feat/<slug>`；單人本地 MAY 直接 main。

## License

MIT License. 不接受外部貢獻。
