# shiftblame

<p align="center">
  <em>「這不是我的鍋。」</em>
</p>

<p align="center">
  <strong>給 AI Agent 使用、以時序制衡約束的回饋協作框架。</strong><br/>
  圖決定路徑，文字只解釋節點。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Made%20with-Markdown-1a1a1a.svg" alt="Made with Markdown"/>
  <img src="https://img.shields.io/badge/RFC-2119-6f42c1.svg" alt="RFC 2119"/>
  <img src="https://img.shields.io/badge/version-0.9.5-2ea44f.svg" alt="version 0.9.5"/>
</p>

---

## 這是什麼

shiftblame 用一張人類可讀的向量拓樸，約束 Agent 如何調控時序進程——把需求交給審計、研究、規劃、測試、開發、驗收六個工作階段。完整權威圖與讀圖規則位於 [`skills/shiftblame/SKILL.md`](skills/shiftblame/SKILL.md)；本 README 是查詢入口，機制細節以 SKILL 為準。

核心原則：

- **一次定律。** 定義層單向一次推進——G1 需求一次確認定稿後，薄研究（G2）、薄規劃（G3）直接推進到實作，不在定義流程打轉。每階段一次產出、產出即定稿、向前對齊；§10 兩兩一致於放行前一次核對，缺漏由責任面向一次補正，重大例外才退回。
- **所有輸入路由回 sb-think。** 無論老闆輸入什麼——指令名、自然語言、計畫書——第一步都是路由回 sb-think 理解背後意圖，不字面執行。sb-think 是責任轉移線：之前是老闆的鍋（意圖沒打磨好），之後是 agents 的鍋（事情沒做好）。
- **問題陳述不等於修改授權。** sb-think 先分開揭露原始命題、意圖翻譯與候選方案，老闆授權後才可寫入。
- **決策權中央集權。** 所有判決（放行、合格/返工、commit、路由、reset、PASS）由主對話秘書獨佔；子代理只提供輸入，不做決策。
- **秘書是唯一持久角色。** 主對話永遠是秘書，職責是調控時序進程到合適工作階段。工作階段（審計→研究→規劃→測試→實作→驗收）是時序上的活動節點，不是角色身份——全部去人化。
- **三面向雙面結構。** G1/G2/G3 不只在定義層——每個面向都有定義與落地兩面：測試＝G1 落地（驗收條件可執行化）、實作＝G2 落地（技術方案落地為碼）、驗收＝G3 落地（照計畫執行收證據）；執行層時序與定義層 G1→G2→G3 正向同構。任何 G2/G3 與 G1 不一致退回 G1 重新正確定義——G1 定義權唯一，G2/G3 不得自行詮釋吸收。
- **承載歸屬依對外視窗控制。** 涉及對外視窗控制的階段（研究 G2、開發 G2）由主對話親自執行；不涉及對外視窗的階段（審計 G1、規劃 G3、測試 G3、驗收 G1）由秘書派發子代理執行。子代理完全不碰對外視窗。
- **認知探索外包、控制驗證留主對話。** 研究/實作階段的無副作用認知工作（讀 codebase、grep、查證）外包給唯讀探索子代理；需要對外視窗的實機驗證留主對話——避免 context 爆炸，控制權不外流。
- **不開 slug 的事直接做。** 框架演化、微修或老闆指定不開 slug 的輕量變更，直接實行不建骨架；一旦開 slug，一律完整三面向制衡，無中途降級。
- **預設直接修正。** 功能（commit 單位）未觸發重流程條件（① 行為改變 ② 介面改變 ③ 多檔協同 ④ 跨層級 ⑤ 老闆指定）時，秘書直接改並 commit——不為每個功能走執行層時序。
- **假測試判返工。** 走執行層時序的測試 MUST 有真實斷言、對應 G1 驗收項或可觀察行為；無斷言／測實作細節／mock 過度／形式化湊數的假測試，秘書判決時判返工回測試階段。
- **寫測試與跑測試分離。** 測試階段依 G1 寫測試定義「過」、驗收階段照 G3 跑 CI 測試驗收「完成」——分離確保不能「自己寫自己跑放水」。**測試鎖定**：測試碼一經測試階段定義即鎖定，任何角色（實作、驗收、秘書）不得為了綠燈逕改——紅燈只有兩條路：實作問題返工回實作、測試定義有誤返工回測試子代理重新定義；判決前機械核對測試碼未被竄改。
- **測試可自動化。** G3 每項驗收 MUST 設計成可自動化執行（CI 可跑、驗收階段子代理獨立執行），不依賴對外視窗——無法自動化者是 G3 測試設計缺陷，回規劃階段重新設計，不由主對話代跑。
- **測試先行＝G1 先落地（觸發重流程時）。** 執行層執行順序固定：測試階段依 G1 寫測試（紅燈）→ 實作階段依 G2 寫實作 → 驗收階段照 G3 跑 CI 到綠燈。先寫測試再實作，與定義層「驗收先於實作」對齊。
- **驗收先於實作。** G3 內部先依 G1 寫驗收，再依 G2 寫實作步驟，不得倒序。
- **G1 是封存契約。** 放行時 CLI 保存完整 G1 快照並記錄 SHA-256，後續每次推進核對原檔與快照；局部技術模型只能在不改變 G1 滿足集合下單調細化 G2／G3。契約不足或衝突時停止，記錄原條款／新條款／影響範圍，經老闆確認後 `sb amend --boss-ok` 修約並重新放行。
- **回指 G1 前先清帳。** 修約或開新 ms 回到審計階段前，working tree MUST 乾淨：可保留成果先依 `sb-commit` 精準提交，不應保留的變更明確捨棄；不得讓未分類工作污染下一輪需求定義。
- **commit 集權。** 子代理可在秘書授權範圍內寫 repo，但 commit 一律由秘書於判決合格後獨佔執行。

## 流程概覽

```mermaid
flowchart TD
    Boss([老闆任何輸入]) --> Think["sb-think · 唯一閘口<br/>理解 · 對齊 · 分發<br/>═══ 責任轉移線 ═══"]
    Think --> Route{老闆拍板路由}
    Route -- "開 slug" --> Start["sb-start 建骨架"] --> Check
    Route -- "不開 slug<br/>（框架演化／微修）" --> Direct["直接實行"]

    subgraph Check["定義層三面向制衡 · 一次定律：單向一次推進"]
        direction LR
        G1["G1 需求<br/>審計階段<br/>子代理<br/>一次確認定稿"] -->|薄研究<br/>向前對齊| G2["G2 技術<br/>研究階段<br/>主對話<br/>一次定稿"]
        G2 -->|薄規劃<br/>向前對齊| G3["G3 計畫<br/>規劃階段<br/>子代理<br/>一次定稿"]
    end

    Check --> Consist{秘書核對<br/>§10 一致性<br/>一次核對}
    Consist -- 缺漏 · 責任面向一次補正 --> Check
    Consist -- 一致 · 放行 --> Dev

    subgraph Dev["開發 · 秘書依 G3 里程碑推進 · 逐個功能推進時序"]
        direction TB
        MS["里程碑"] --> Loop
        subgraph Loop["執行層時序 · G1→G2→G3 依序落地（與定義層同構）· 判決歸秘書"]
            direction LR
            T["① 測試階段 · G1 落地<br/>子代理 · 依 G1 寫測試<br/>定義「過」（鎖定）"] --> D["② 實作階段 · G2 落地<br/>主對話 · 依 G2 寫實作碼"]
            D --> A["③ 驗收階段 · G3 落地<br/>子代理 · 照 G3 跑 CI 測試<br/>驗收「完成」"]
            A --> Judge{秘書讀 <repo>/.shiftblame/tmp/ 判決<br/>含測試鎖定核對}
            Judge -- 合格 --> Commit["秘書 commit（獨佔）"]
            Judge -- "返工（實作→實作<br/>測試定義→測試）" --> T
        end
        Loop -- 里程碑所有功能 commit --> MA{"老闆確認價值<br/>審計階段對照封存 G1 複驗"}
        MA -- 不符 --> Loop
        MA -- 合格 --> Next{還有下一個<br/>里程碑？}
        Next -- 是 --> MS
    end

    Next -- 否 --> NnnDone["nnn 完成<br/>（循環收斂）"]
    NnnDone --> LightFresh["輕量保鮮<br/>更新 SLUG"]
    LightFresh --> Decide{"需要老闆決策？"}
    Decide -- 是（PASS／開新nnn／重大例外） --> Think
    Decide -- 否 --> Dev
    Think -- 老闆拍板結束 slug --> Pass([老闆 PASS])
    Pass --> FullFresh["完整收尾保鮮<br/>移 archive"]
```

**所有老闆輸入第一步路由回 sb-think，不字面執行指令。** sb-think 是責任轉移線——之前是老闆的鍋（意圖沒打磨好），之後是 agents 的鍋（事情沒做好）。執行中不需老闆決策的事 agents 自主處理，需要決策才路由回 sb-think。

**`<nnn>` 完成是單一子需求循環收斂，不等於整個 `<slug>` 結束。** 老闆在同一 `<slug>` 開新 `<nnn>` 不需先 PASS；只有結束整個 `<slug>` 才走 PASS 與完整收尾保鮮。

讀圖規則：①沿箭頭前進，不得跳點；②下游發現缺口，沿退回箭頭處理；③每個節點只產出自己的內容；④圖文衝突時，以權威圖為準。

## 秘書與工作階段

**秘書（主對話）是唯一持久角色**，職責是調控時序進程到合適的工作階段。工作階段不是角色身份，全部去人化——它們是時序上的活動節點，由秘書調控推進、在每階段決定自己做或派發子代理。

```mermaid
flowchart TB
    SEC["秘書（主對話）<br/>唯一持久角色 · 調控時序進程"]
    subgraph Consult["定義層 · 定義該做什麼 · 一次定律：單向一次推進"]
        direction LR
        G1["審計階段 · G1<br/>子代理 · 一次定稿"] -->|向前對齊| G2["研究階段 · G2<br/>主對話 · 薄研究"]
        G2 -->|向前對齊| G3["規劃階段 · G3<br/>子代理 · 薄規劃"]
    end
    subgraph Build["執行層 · G1→G2→G3 依序落地（與定義層同構）"]
        direction LR
        TST["測試階段 · G1 落地<br/>子代理"] --> DEV["實作階段 · G2 落地<br/>主對話"]
        DEV --> ACC["驗收階段 · G3 落地<br/>子代理"]
    end
    SEC -- 調控時序 --> Consult
    SEC -- 調控時序<br/>讀 <repo>/.shiftblame/tmp/ 判決 --> Build
    G1 == "定義↔落地<br/>測試" ==> TST
    G2 == "定義↔落地<br/>實作" ==> DEV
    G3 == "定義↔落地<br/>驗收" ==> ACC
```

> - **老闆**：提出命題、授權修改、做決策、最終 PASS。
> - **秘書（主對話，唯一持久角色）**：調控時序進程——意圖揭露、記錄路由、放行、判決合格/返工、獨佔 commit、路由判定、PASS。未授權前唯讀。
> - **定義層（定義該做什麼）**：審計階段→G1（子代理）、研究階段→G2（主對話）、規劃階段→G3（子代理）。G1/G3 對 repo 唯讀；G2 由主對話親為。
> - **執行層（G1→G2→G3 依序落地）**：測試階段→依 G1 寫測試（子代理，G1 落地）、實作階段→依 G2 寫實作（主對話，G2 落地）、驗收階段→照 G3 跑 CI 測試（子代理，G3 落地）。
> - **承載歸屬依對外視窗控制**：研究/開發（G2 面向）涉及對外視窗，由主對話執行；審計/規劃/測試/驗收（G1/G3 面向）不涉及對外視窗，由子代理執行。子代理是無思想的外包執行單元，無決策權、無對外視窗控制權、不可 commit。細節見 SKILL §3。

## 三份文件

- **G1 需求研究** — 回答 What、Why、邊界、原始驗收條件。不寫技術解法。
- **G2 技術分析** — 回答 How、測試方式、技術風險。不改寫需求。
- **G3 實作計畫** — 先寫業務驗收，再寫實作步驟。不新增需求、不讓實作步驟先於驗收。

## SOP 與 ROADMAP 的硬邊界

這兩份專案文件不是 Agent 的流水帳：

- **SOP** — 只能寫：本專案跨 `<slug>` 長期有效、可查核的本地配置、執行規範、資料／服務邊界與驗證入口。MUST NOT 寫：產品目標、ROADMAP 計畫、G1/G2/G3、中央流程副本、單一需求、進度或流水帳。
- **ROADMAP** — 只能寫：用白話寫產品目標、固定邊界與尚未完成的想做計畫。MUST NOT 寫：未授權想法、已完成事項、技術方案、G1/G2/G3、排程、優先級、進度或流水帳。

欄位模板與拒絕規則以 [`skills/shiftblame/assets/SOP.md`](skills/shiftblame/assets/SOP.md) 及 [`skills/shiftblame/assets/ROADMAP.md`](skills/shiftblame/assets/ROADMAP.md) 為準；不符合模板准入條件的內容不得寫入。

每個 `<slug>` 結束時的文件保鮮是收尾的固定動作：ROADMAP 移除已完成條目並修正剩餘方向，SOP 依當前 codebase 更新事實並刪除過時內容，`<repo>/docs/` 與 `<repo>/README.md` 盤點是否與 codebase 一致（過時更新、移除的系統刪文件、新完成的補文件）。這是維護既有文件，不等於授權新增產品需求；新增方向與產品邊界仍須 owner 明確授權。

## 安裝

shiftblame 是一個通用 skills plugin 套件，所有 skill 定義位於 [`skills/`](skills/)。依你所使用的 agent 平台之 plugin 載入機制安裝即可，不綁定特定平台。

**安裝來源**

- **本地目錄**——開發、自用、測試；指向本 repo 根目錄。
- **Git（GitHub）**——分享、版本追蹤、更新；指向 `https://github.com/teps3105/shiftblame`。

## 使用

shiftblame skill 會依任務描述自動觸發（開發、審查、研究任務皆然）。直接描述目標即可：

```text
幫我用三面向制衡流程重構登入流程
```

**所有老闆輸入第一步一定是路由回 sb-think，而不是字面指令。** 無論老闆輸入什麼——指令名、自然語言、一長串計畫書——agents 不直接執行字面指令，先回 sb-think 理解背後意圖、結構化呈現讓老闆確認，確認後才分發到對應流程。sb-think 之前是老闆責任（意圖沒打磨好是老闆的鍋），之後是 agents 責任（事情沒做好是 agents 的鍋）。

路由關係（是否建立／沿用 `<slug>`／`<nnn>` 只由老闆決定，在 sb-think 中拍板）：

- **沿用 `<nnn>`**——同一子需求的擴充。
- **開新 `<nnn>`**——同一 `<slug>` 中的新子需求（前置：目前 `<nnn>` 已完成，不需先 PASS）。
- **開新 `<slug>`**——與既有功能幾乎無關的新功能。
- **結束 `<slug>`**——老闆 PASS → 完整收尾保鮮 → 移 <repo>/.shiftblame/archive/。
- **直接實行（不開 slug）**——框架演化、微修或老闆指定不開 slug 的輕量變更。
- **框架演化**——修改 shiftblame 自身；不開 slug，仍須先揭露方案取得授權。

### 流程狀態機（npm CLI：sb）

流程規範以腳本鎖死（不自知推進與四假對策，見 SKILL §1.8）——每個 slug 開始跑 `sb init <slug>`，每個階段推進跑 `sb next <node>`，閘門不過（exit 1）不得推進；老闆拍板點必須 `--boss-ok` 留痕：

```bash
npm install -g <shiftblame repo>/cli
sb init <slug>                     # 開 slug：建立 .shiftblame/flow-state.json
sb state                           # 目前節點與各下一步前置條件
sb next release --boss-ok          # 放行閘（G3 失敗模式＋實作步驟＋§10 核對記錄）
sb amend --boss-ok                 # G1 顯式修約（須先寫 amendment.md 且 working tree 乾淨）
sb lock <測試碼...>                 # 測試定稿：斷言初篩＋sha256 鎖定
sb next verdict                    # 判決閘（測試鎖定 hash＋驗收報告反證/未驗段）
sb report                          # 自包含外部審計報告 → tmp/report-*.md（開新 slug/ms 前強制；開發中老闆隨時）
sb commitmsg "<訊息>"               # 提交訊息機械驗證（任何 commit 前必過，sb-commit 技能）
```

### 子代理安裝（npm CLI：sb-agents）

子代理定義不隨 plugin 攜帶（避免與各平台載入機制重複導入）——由 npm CLI `sb-agents` 安裝到各平台**使用者層** agents 目錄：

```text
npm install -g ./cli        # 從 repo 安裝（或 npm i -g shiftblame-agents）
sb-agents install --platform all              # 安裝到 zcode/claude/codex 三平台
sb-agents install --platform zcode --model "custom:xxx:yyy"   # 指定模型
sb-agents list                                  # 檢視已安裝狀態
```

- 中性定義來源：`cli/templates/*.md`（四階段 audit／plan／test／verify＋四配套 explore／operate／vision／analyze，共 8 檔）。
- 安裝目標：zcode → `~/.zcode/agents/*.md`、claude → `~/.claude/agents/*.md`、codex → `~/.codex/agents/*.toml`。
- `model` 為配置點：`--model` 指定時寫入；未指定採平台默認語義值（zcode 省略欄位＝繼承默認、claude 填 `inherit`、codex 註解標示）。
- 已存在檔案預設略過（`--force` 覆蓋）——不覆寫使用者的既有配置。

### sb-* 工作流指令

**sb-think 是唯一閘口**——所有輸入先過 sb-think 理解、對齊、分發，下列指令是 sb-think 分發後的執行目標，老闆不直達：

- [`sb-think`](skills/sb-think/SKILL.md)——唯一閘口；所有輸入第一步路由回此，不字面執行，先理解意圖再分發。
- [`sb-start`](skills/sb-start/SKILL.md)——新需求路由；建骨架（開 slug 或 nnn）→ 三面向制衡。
- [`sb-resume`](skills/sb-resume/SKILL.md)——繼續未完成的 slug／nnn，重走三面向制衡。
- [`sb-do`](skills/sb-do/SKILL.md)——核對 §10 一致性，放行進入開發。
- [`sb-end`](skills/sb-end/SKILL.md)——結束 slug，執行完整收尾保鮮。
- [`sb-save`](skills/sb-save/SKILL.md)——記錄工作落點到 <repo>/.shiftblame/<slug>/SLUG.md，供 sb-resume 恢復。
- [`sb-dice`](skills/sb-dice/SKILL.md)——丟棄當前 slug 所有成果，回 main 重新討論。
- [`sb-docs`](skills/sb-docs/SKILL.md)——對 <repo>/docs/ 文件提出修改需求。
- [`sb-report`](skills/sb-report/SKILL.md)——整理自包含外部審計報告，供無法讀取 repo 的外部 agent 審計當前節點。
- [`sb-commit`](skills/sb-commit/SKILL.md)——提交規範封裝：任何 commit 前經範圍盤點＋sb commitmsg 機械驗證。
- [`sb-sop`](skills/sb-sop/SKILL.md)——對 SOP 提出修改需求。
- [`sb-roadmap`](skills/sb-roadmap/SKILL.md)——對 ROADMAP 提出修改需求。
- [`sb-todo`](skills/sb-todo/SKILL.md)——將老闆想在當前 slug 增加的功能加入 SLUG §3 待辦清單。

## 文件結構

```text
shiftblame/                         # plugin 套件根（repo 根）
├── .codex-plugin/plugin.json      # plugin manifest（各平台對應 manifest）
├── .claude-plugin/marketplace.json
├── .agents/plugins/marketplace.json
├── cli/                            # npm CLI（sb 流程狀態機閘門＋sb-agents 子代理定義安裝）
│   ├── package.json               # bin: sb-agents
│   ├── bin/sb-agents.mjs          # install/list（--platform zcode|claude|codex|all、--model、--force）
│   └── templates/                  # 中性定義唯一來源（audit/plan/test/verify/explore/operate/vision/analyze）
└── skills/
    ├── shiftblame/
    │   ├── SKILL.md               # 權威拓樸、讀圖規則、分流、箭頭條件、收尾
    │   ├── references/            # 工作階段定義（按需讀）
    │   │   ├── AUDIT.md         # 定義層
    │   │   ├── RESEARCH.md
    │   │   ├── PLAN.md
    │   │   ├── VERIFY.md        # 執行層
    │   │   ├── BUILD.md
    │   │   └── TEST.md
    │   └── assets/                # 範本與固定資產
    │       ├── DOCS.md            # 專案 docs/ 系統文件寫法判準
    │       ├── SOP.md             # SOP 准入欄位中央模板（複製來源）
    │       ├── ROADMAP.md         # ROADMAP 准入欄位中央模板（複製來源）
    │       └── SLUG.md             # 定義單檔：SLUG 主體 + G1/G2/G3 三面向範本（複製來源）
    └── sb-*/SKILL.md               # sb-think 唯一閘口、sb-start 新需求路由、其他為 sb-think 分發目標
```

每個專案的工作區位於 `<repo>/.shiftblame/`（`<repo>` = 使用者專案根目錄的絕對路徑），並且 MUST 經 `.gitignore` 排除，不得 commit。工作區為**結構分檔**（定義單檔、使用分檔）：

```text
<repo>/.shiftblame/                # 各專案工作區（MUST 經 .gitignore 排除；樹內子項由樹根錨定）
├── SOP.md
├── ROADMAP.md
├── <slug>/                        # 結構分檔：SLUG 主體 + 每 nnn 一子目錄
│   ├── SLUG.md                    # SLUG 主體（§1-§7；不含 G1/G2/G3）
│   └── nnn/                       # 每個 <nnn> 一個子目錄
│       ├── G1.md                  # 需求／驗收標準（審計階段產出）
│       ├── G2.md                  # 技術分析（研究階段產出）
│       └── G3.md                  # 實作計畫（規劃階段產出）
├── tmp/                           # 子代理間唯一溝通橋樑：跨子代理結論存此；秘書讀此轉發派發
└── archive/
```

## 提交規範

- 訊息：`<type>: <繁中描述>`，**單行、10～30 字**。MUST NOT 含任何追蹤編號（nnn、slug 名稱、issue/ticket 號）；純描述變更本身。
- 精準 `git add`；不得提交 `<repo>/.shiftblame/`，不得夾帶範圍外檔案。
- 分支政策綁定 slug：開 `<slug>` 時 MUST 切 `<type>/<slug>` 分支；框架演化、緊急修復、輕量調整 MAY 直接在 main。
- 開發採多循環螺旋：功能是 commit 單位、里程碑是驗收節點；不合格返工疊加新 commit。

## License

MIT License. 不接受外部貢獻。
