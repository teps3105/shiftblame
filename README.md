# shiftblame

<p align="center">
  <em>「這不是我的鍋。」</em>
</p>

<p align="center">
  <strong>給 AI Agent 使用、以三權分立約束的回饋協作框架。</strong><br/>
  圖決定路徑，文字只解釋節點。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Made%20with-Markdown-1a1a1a.svg" alt="Made with Markdown"/>
  <img src="https://img.shields.io/badge/RFC-2119-6f42c1.svg" alt="RFC 2119"/>
  <img src="https://img.shields.io/badge/version-0.3.3-2ea44f.svg" alt="version 0.3.3"/>
</p>

---

## 這是什麼

shiftblame 用一張人類可讀的向量拓樸，約束 Agent 如何把需求交給研究、技術、計畫、開發與審查。完整權威圖與讀圖規則位於 [`skills/shiftblame/SKILL.md`](skills/shiftblame/SKILL.md)；本 README 是查詢入口，機制細節以 SKILL 為準。

核心原則：

- **問題陳述不等於修改授權。** SECRETARY 必須先分開揭露原始命題、意圖翻譯與候選方案，老闆授權後才可寫入。
- **三權分立。** G1（需求）、G2（技術）、G3（實作計畫）各由主導角色產出，互相制衡；三份兩兩雙向一致才可開發。一致以 G1 需求項為對齊軸，三對各須正向承接＋反向回指（判準見 SKILL §10）。
- **驗收先於實作。** G3 內部先依 G1 寫驗收，再依 G2 寫實作步驟，不得倒序。
- **G1/G2/G3 是活草稿。** 放行後三份文件不凍結——開發中發現與實作情境有出入，直接修正對應文件後繼續，不為流程而流程；只有改變方向／架構的重大變更才停止退回三權制衡。
- **repo 開發權集中。** 主對話 SECRETARY 是唯一 repo 開發執行者；子代理對 repo 一律唯讀。

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
G1 需求研究（AUDITOR 主導）
      │
      ▼
G2 技術分析（RESEARCHER 主導）
      │
      ▼
G3 先寫驗收，再寫實作步驟（PLANNER 主導）
      │
      ▼
SECRETARY 核對 §10 一致性
   ┌──┴──────────┐
 不一致           一致
   │              │
   └──▶ 回三權    SECRETARY 依 G3 開發 → commit → 證據
                         │
                         ▼
                   AUDITOR 對照 G1 複驗
                      │不符 → 回三權制衡
                      ▼
                nnn 完成（循環收斂）→ 輕量保鮮（更新 SLUG）
                      │
              ┌───────┴───────┐
        老闆開新 nnn      老闆：slug 結束
              │                 ▼
              ▼            老闆 PASS
        回三權制衡              │
        （新循環）              ▼
                       完整收尾保鮮（移 archive）
```

**`<nnn>` 完成是單一子需求循環收斂，不等於整個 `<slug>` 結束。** 老闆在同一 `<slug>` 開新 `<nnn>` 不需先 PASS；只有結束整個 `<slug>` 才走 PASS 與完整收尾保鮮。

讀圖規則：①沿箭頭前進，不得跳點；②下游發現缺口，沿退回箭頭處理；③每個節點只產出自己的內容；④圖文衝突時，以權威圖為準。

## 角色

| 角色 | 工作 |
|------|------|
| 老闆 | 提出命題、授權修改、做決策、最終 PASS |
| **SECRETARY（主對話固定）** | 揭露意圖、記錄路由、交接、收尾、文件保鮮、派發子代理、**親自核對 §10 一致性**；放行後**依 G3 親自執行 repo 開發、測試、commit、自驗**（唯一 repo 開發執行者）；執行**判決性工作**（commit 保留/reset、跨權協調、PASS、路由判定）；可提路由提議但不等於授權 |
| AUDITOR | 主導 G1（需求／驗收）；開發前後都派唯讀子代理獨立審核，再複核並回頭對照 G1（由子代理承載） |
| RESEARCHER | 主導 G2，承接 G1 並取得、複核外部獨立研究（由子代理承載） |
| PLANNER | 主導 G3 實作計畫，先寫驗收再寫實作步驟（供 SECRETARY 照表執行開發）；對 repo 唯讀，不執行開發（由子代理承載） |

**主對話永遠是 SECRETARY**——AUDITOR／RESEARCHER／PLANNER 的工作由子代理承載（角色為任務參數）；子代理對 repo 一律唯讀、工作區限 `.shiftblame/`，只寫自己主導的管理文件（G1／G2／G3）。MUST NOT 執行 repo 開發、測試或 commit。

## 三份文件

| 文件 | 回答 | 不做 |
|------|------|------|
| G1 需求研究 | What、Why、邊界、原始驗收條件 | 不寫技術解法 |
| G2 技術分析 | How、測試方式、技術風險 | 不改寫需求 |
| G3 實作計畫 | 先寫業務驗收，再寫實作步驟 | 不新增需求、不讓實作步驟先於驗收 |

## SOP 與 ROADMAP 的硬邊界

這兩份專案文件不是 Agent 的流水帳：

| 文件 | 只能寫 | MUST NOT 寫 |
|------|--------|--------------|
| SOP | 本專案跨 `<slug>` 長期有效、可查核的本地配置、具體執行規範、資料／服務邊界與驗證入口；可使用段落、表格、命令與來源標註 | 產品目標、ROADMAP 計畫、G1/G2/G3、中央流程副本、單一需求、過時規範、進度或流水帳 |
| ROADMAP | 用白話寫產品目標、固定邊界與尚未完成的想做計畫 | 未授權想法、已完成事項、技術方案、G1/G2/G3、排程、優先級、任務、進度或流水帳 |

欄位模板與拒絕規則以 [`skills/shiftblame/assets/SOP.md`](skills/shiftblame/assets/SOP.md) 及 [`skills/shiftblame/assets/ROADMAP.md`](skills/shiftblame/assets/ROADMAP.md) 為準；不符合模板准入條件的內容不得寫入。

每個 `<slug>` 結束時的文件保鮮是收尾的固定動作：ROADMAP 移除已完成條目並修正剩餘方向，SOP 依當前 codebase 更新事實並刪除過時內容。這是維護既有文件，不等於授權新增產品需求；新增方向與產品邊界仍須 owner 明確授權。

## 安裝

shiftblame 是一個通用 skills plugin 套件，所有 skill 定義位於 [`skills/`](skills/)。依你所使用的 agent 平台之 plugin 載入機制安裝即可，不綁定特定平台。

**安裝來源**

| 來源 | 用途 | 指向 |
|------|------|------|
| 本地目錄 | 開發、自用、測試 | 本 repo 根目錄 |
| Git（GitHub） | 分享、版本追蹤、更新 | `https://github.com/teps3105/shiftblame` |

## 使用

shiftblame skill 會依任務描述自動觸發（開發、審查、研究任務皆然）。直接描述目標即可：

```text
幫我用三權制衡流程重構登入流程
```

SECRETARY 會先揭露意圖，等待老闆指定路由；不得代替老闆判定。可依既有脈絡提出路由提議，但提議只能回報給老闆，不寫入 ROADMAP，也不等於授權。老闆指定後，SECRETARY 才忠實記錄與交接。

路由關係（是否建立／沿用 `<slug>`／`<nnn>` 只由老闆決定）：

| 路由 | 關係 |
|------|------|
| 沿用 `<nnn>` | 同一子需求的擴充 |
| 開新 `<nnn>` | 同一 `<slug>` 中的新子需求（前置：目前 `<nnn>` 已完成，不需先 PASS） |
| 開新 `<slug>` | 與既有功能幾乎無關的新功能 |
| 結束 `<slug>` | 老闆 PASS → 完整收尾保鮮 → 移 archive/ |
| 直接實行 | 明確的低複雜度設定或開關 |
| 框架演化 | 修改 shiftblame 自身；不開 slug，仍須先揭露方案取得授權 |

### sb-* 工作流指令

下列 `sb-*` 指令對應各階段轉換——條件成立時 agent 自動觸發該 skill 推進：

| 指令 | 用途 |
|------|------|
| [`sb-slug`](skills/sb-slug/SKILL.md) | 開新 slug；無後標提議，有後標視為授權 |
| [`sb-next`](skills/sb-next/SKILL.md) | 推進至下一個 nnn；無後標提議，有後標視為授權 |
| [`sb-resume`](skills/sb-resume/SKILL.md) | 繼續未完成的 slug／nnn，重走三權制衡 |
| [`sb-do`](skills/sb-do/SKILL.md) | 核對 §10 一致性，放行進入開發 |
| [`sb-review`](skills/sb-review/SKILL.md) | 開發收斂：提交證據 → 三者重審 → nnn 完成 |
| [`sb-end`](skills/sb-end/SKILL.md) | 結束 slug，執行完整收尾保鮮 |
| [`sb-save`](skills/sb-save/SKILL.md) | 記錄工作落點到 SLUG.md，供 sb-resume 恢復 |
| [`sb-req`](skills/sb-req/SKILL.md) | 開發途中回 G1 重新確認需求 |
| [`sb-meth`](skills/sb-meth/SKILL.md) | 開發途中回 G2 重新研究技術方法 |
| [`sb-plan`](skills/sb-plan/SKILL.md) | 開發途中回 G3 重新設計實作計畫 |
| [`sb-dice`](skills/sb-dice/SKILL.md) | 丟棄當前 slug 所有成果，回 main 重新討論 |
| [`sb-docs`](skills/sb-docs/SKILL.md) | 對 docs/ 文件提出修改需求 |
| [`sb-sop`](skills/sb-sop/SKILL.md) | 對 SOP 提出修改需求 |
| [`sb-roadmap`](skills/sb-roadmap/SKILL.md) | 對 ROADMAP 提出修改需求 |

## 文件結構

```text
shiftblame/                         # plugin 套件根（repo 根）
├── .codex-plugin/plugin.json      # plugin manifest（各平台對應 manifest）
├── .claude-plugin/marketplace.json
├── .agents/plugins/marketplace.json
└── skills/
    ├── shiftblame/
    │   ├── SKILL.md               # 權威拓樸、讀圖規則、分流、箭頭條件、收尾
    │   ├── references/            # 角色定義（按需讀）
    │   │   ├── AUDITOR.md
    │   │   ├── RESEARCHER.md
    │   │   └── PLANNER.md
    │   └── assets/                # 範本與固定資產
    │       ├── DOCS.md            # 專案 docs/ 系統文件寫法判準
    │       ├── SOP.md
    │       ├── ROADMAP.md
    │       └── SLUG.md             # 單檔含 SLUG 主體 + G1/G2/G3 三權範本
    └── sb-*/SKILL.md               # 各個可直接觸發的工作流 skill
```

每個專案的工作區位於 `.shiftblame/`，並且 MUST 經 `.gitignore` 排除，不得 commit。

## 提交規範

- 訊息：`<type>: <繁中描述>`，**單行、10～30 字**。MUST NOT 含任何追蹤編號（nnn、slug 名稱、issue/ticket 號）；純描述變更本身。
- 精準 `git add`；不得提交 `.shiftblame/`，不得夾帶範圍外檔案。
- 分支政策綁定 slug：開 `<slug>` 時 MUST 切 `<type>/<slug>` 分支；框架演化、緊急修復、輕量調整 MAY 直接在 main。
- 開發採多循環螺旋：每圈一個功能、先 commit 再驗收；不合格返工疊加新 commit。

## License

MIT License. 不接受外部貢獻。
