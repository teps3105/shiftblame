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
  <img src="https://img.shields.io/badge/version-1.2.0-2ea44f.svg" alt="version 1.2.0"/>
</p>

---

## 這是什麼

shiftblame 用一張人類可讀的向量拓樸，約束 Agent 如何調控時序進程——把需求交給審計、研究、規劃、測試、開發、驗收六個工作階段。完整權威圖與讀圖規則位於 [`skills/shiftblame/SKILL.md`](skills/shiftblame/SKILL.md)；本 README 是查詢入口，機制細節以 SKILL 為準。

核心原則：

- **一次定律。** 定義層單向一次推進——G1 承接 sb-think 已確認的完整語義直接定稿，薄研究（G2）、薄規劃（G3）直接推進到實作，不在 G1 或階段邊界重問。每階段一次產出、產出即定稿、向前對齊；§10 兩兩一致於放行前一次核對，缺漏由責任面向一次補正，重大例外才退回。
- **所有輸入路由回 sb-think。** 無論老闆輸入什麼——指令名、自然語言、計畫書——第一步都是路由回 sb-think 理解背後意圖，不字面執行。sb-think 是責任轉移線：之前是老闆的鍋（意圖沒打磨好），之後是 agents 的鍋（事情沒做好）。
- **問題陳述不等於修改授權。** sb-think 先分開揭露原始命題、意圖翻譯與候選方案，老闆授權後才可寫入。
- **確認綁定決策，不綁階段。** 同一份 sb-think 理解只確認一次；確認訊息直接被消費並分發，audit、release、ms-done 等工作狀態邊界不得再次詢問或要求 `--boss-ok`。只有語義範圍改變、顯式修約、精確破壞性操作與最終 PASS 才建立新決策。
- **決策權中央集權。** 所有判決（放行、合格/返工、commit、路由、reset、PASS）由主對話秘書獨佔；臨時檢閱意見只作輸入。
- **秘書是唯一持久角色與階段承載者。** 主對話連續切換審計→研究→規劃→測試→實作→驗收等工作狀態；狀態不是身份或委派邊界，因此不因流程推進反覆切換上下文。
- **階段完成不是停點。** `1.0.x` 移除階段子代理後，主對話承擔原本由上層隱性完成的吸收責任：吸收每段產出、更新 `Goal／Core／Verified／Open／Next` 並立即續跑。局部綠燈、壓縮將至與老闆沉默都不授權停止；進度回報不等於 final。
- **三面向雙面結構。** G1/G2/G3 不只在定義層——每個面向都有定義與落地兩面：測試＝G1 落地（驗收條件可執行化）、實作＝G2 落地（技術方案落地為碼）、驗收＝G3 落地（照計畫執行收證據）；執行層時序與定義層 G1→G2→G3 正向同構。任何 G2/G3 與 G1 不一致退回 G1 重新正確定義——G1 定義權唯一，G2/G3 不得自行詮釋吸收。
- **純技術裁定不外包給老闆。** repo／第一方文件／實機證據不足或矛盾、無法可靠裁定時，主對話必須立即取得一次外部子代理的自包含唯讀技術意見，複核後自行裁定；不必先反覆失敗。只有產品語義、G1 成功集合、範圍、成本／風險容忍或新授權才交由老闆決定。
- **對抗檢閱三時點強制。** 計畫放行前強制子代理**對抗方向**、每個功能驗收後判決前強制**對抗成果**、收斂複驗強制**對抗成果**，記錄落 `tmp/review-plan|verify|converge-*.md`（含「對抗要點」「複核結論」「反向對抗」「附錄」四段；複核結論每項裁定綁可查證出處，反向對抗判定不成立即擋——複核造假是執行者誠信違規，不是設計極限）並經 CLI 閘門查核；層內連續、層間停靠——放行邊界揭露簡報後停等老闆確認（`sb next test --boss-ok`），不得無縫銜接；direct 豁免僅限 agent 自行發現的微修，老闆意圖不豁免。外部子代理不可用時，主對話切換身分以對抗者立場執行最嚴厲攻擊並標示降級來源，放行／判決／收斂時向老闆揭露。外援只提供輸入，不接管工作狀態或裁定；技術證據不足時另強制一次唯讀技術意見，其餘高風險情境按需取得。
- **階段內認知控制。** 任務依 fast／full／loop 分級；長程工作以 `Goal／Core／Verified／Open／Next` 短帳本跨 seam 保持狀態，所有「已驗證」都要附方法與涵蓋範圍。
- **最小充分解。** 依序選擇重用既有能力、標準函式庫、平台原生能力、既有依賴與最少可用實作；修 bug 修共用根因，不簡化安全、資料保護、無障礙或明確需求。
- **不開 slug 的事直接做。** 框架演化、微修或老闆指定不開 slug 的輕量變更，直接實行不建骨架；一旦開 slug，一律完整三面向制衡，無中途降級。
- **預設直接修正。** 僅限不改變使用者可觀察行為，須以 `tmp/direct-change.md` 聲明 `USER_OBSERVABLE=NO` 並填實理由；此路徑不得取代 G1 驗收。
- **假測試判返工。** 走執行層時序的測試 MUST 有真實斷言、對應 G1 驗收項或可觀察行為；無斷言／測實作細節／mock 過度／形式化湊數的假測試，秘書判決時判返工回測試階段。
- **寫測試與跑測試以狀態分離。** 測試狀態依 G1 定義「過」後即鎖定；實作與驗收狀態不得為綠燈修改測試。紅燈只有兩條路：實作問題回實作狀態，或附定義錯誤理由回測試狀態重新定義。
- **測試可自動化，驗收必須是使用者行為。** G3 每項驗收 MUST 可重現執行；CI 綠燈與結構正確不能單獨判定完成，仍須逐項提供 G1 使用者可觀察的 BEHAVIOR 證據。
- **測試先行＝G1 先落地（觸發重流程時）。** 執行層執行順序固定：測試階段依 G1 寫測試（紅燈）→ 實作階段依 G2 寫實作 → 驗收階段照 G3 跑 CI 到綠燈。先寫測試再實作，與定義層「驗收先於實作」對齊。
- **驗收先於實作。** G3 內部先依 G1 寫驗收，再依 G2 寫實作步驟，不得倒序。
- **G1 是封存契約。** 放行時 CLI 保存完整 G1 快照並記錄 SHA-256，後續每次推進核對原檔與快照；局部技術模型只能在不改變 G1 滿足集合下單調細化 G2／G3。契約不足或衝突時停止，記錄原條款／新條款／影響範圍，經老闆確認後 `sb amend --boss-ok` 修約並重新放行。
- **回指 G1 前先清帳。** 修約或開新 ms 回到審計階段前，working tree MUST 乾淨：可保留成果先依 `sb-commit` 精準提交，不應保留的變更明確捨棄；不得讓未分類工作污染下一輪需求定義。
- **驗收使用者需求，不驗收結構幻象。** G1 每項需求使用唯一 AC-ID 與 BEHAVIOR 契約；G3、測試鎖定、驗收報告逐項回指。CI 綠燈或結構正確不能單獨判定完成；必填 AC 必須有錨定 G1 hash、ms、commit，以及實際輸出／日誌／截圖證據檔 SHA-256 的 SATISFIED 行為證據，收斂時缺一即擋。
- **commit 集權。** commit 一律由主對話秘書依 `sb-commit` 執行；實作完成先 commit 建立不可變待驗對象，再驗收與判決。

## 流程概覽

```mermaid
flowchart TD
    Boss([老闆任何輸入]) --> Think["sb-think · 唯一閘口<br/>理解 · 對齊 · 分發<br/>═══ 責任轉移線 ═══"]
    Think --> Route{老闆拍板路由}
    Route -- "開 slug" --> Start["sb-start 建骨架"] --> Check
    Route -- "不開 slug<br/>（框架演化／微修）" --> Direct["直接實行"]

    subgraph Check["定義層三面向制衡 · 一次定律：單向一次推進"]
        direction LR
        G1["G1 需求<br/>審計狀態<br/>承接 sb-think 已確認語義<br/>直接定稿"] -->|薄研究<br/>向前對齊| G2["G2 技術<br/>研究狀態<br/>主對話<br/>一次定稿"]
        G2 -->|薄規劃<br/>向前對齊| G3["G3 計畫<br/>規劃狀態<br/>主對話<br/>一次定稿"]
    end

    Check --> Consist{秘書核對<br/>§10 一致性<br/>一次核對}
    Consist -- 缺漏 · 責任面向一次補正 --> Check
    Consist -- "對抗方向檢閱＋§10 一致<br/>停靠揭露後放行" --> Dev

    subgraph Dev["開發 · 秘書依 G3 里程碑推進 · 逐個功能推進時序"]
        direction TB
        MS["里程碑"] --> Loop
        subgraph Loop["執行層時序 · G1→G2→G3 依序落地（與定義層同構）· 判決歸秘書"]
            direction LR
            T["① 測試狀態 · G1 落地<br/>主對話 · 依 G1 寫測試<br/>定義「過」（鎖定）"] --> D["② 實作狀態 · G2 落地<br/>主對話 · 依 G2 寫實作碼"]
            D --> Commit["③ 秘書 commit 存檔<br/>建立不可變待驗對象"]
            Commit --> A["④ 驗收狀態 · G3 落地<br/>主對話 · 照 G3 跑 CI 與行為驗收"]
            A --> Judge{秘書判決<br/>對抗成果檢閱複核<br/>測試鎖定與行為證據核對}
            Judge -- 合格 --> Done["本功能完成"]
            Judge -- "返工（實作→實作<br/>測試定義→測試）" --> T
        end
        Loop -- 里程碑所有功能 commit --> MA{"秘書審計價值<br/>對照封存 G1 複驗<br/>＋對抗成果檢閱"}
        MA -- 不符 --> Loop
        MA -- 合格 --> Next{還有下一個<br/>里程碑？}
        Next -- 是 --> MS
    end

    Next -- 否 --> NnnDone["nnn 完成<br/>（循環收斂）"]
    NnnDone --> LightFresh["輕量保鮮<br/>更新 SLUG"]
    LightFresh --> Decide{"需要老闆決策？"}
    Decide -- 是（PASS／開新nnn／產品語義或授權重大例外） --> Think
    Decide -- 否 --> Dev
    Think -- 老闆拍板結束 slug --> Pass([老闆 PASS])
    Pass --> FullFresh["完整收尾保鮮<br/>移 archive"]
```

**所有老闆輸入第一步路由回 sb-think，不字面執行指令。** sb-think 是責任轉移線——之前是老闆的鍋（意圖沒打磨好），之後是 agents 的鍋（事情沒做好）。純技術裁定由 agents 查證、必要時取得外部子代理唯讀意見後自行負責；只有產品語義、範圍、風險容忍、授權或 PASS 等非技術決策才路由回 sb-think。

**`<nnn>` 完成是單一子需求循環收斂，不等於整個 `<slug>` 結束。** 老闆在同一 `<slug>` 開新 `<nnn>` 不需先 PASS；只有結束整個 `<slug>` 才走 PASS 與完整收尾保鮮。

讀圖規則：①沿箭頭前進，不得跳點；②下游發現缺口，沿退回箭頭處理；③每個節點只產出自己的內容；④圖文衝突時，以權威圖為準。

## 秘書與工作階段

**秘書（主對話）是唯一持久角色與階段承載者**。工作階段是同一上下文中的狀態，不是角色身份或固定委派邊界。

```mermaid
flowchart TB
    SEC["秘書（主對話）<br/>唯一持久角色 · 調控時序進程"]
    subgraph Consult["定義層 · 定義該做什麼 · 一次定律：單向一次推進"]
        direction LR
        G1["審計狀態 · G1<br/>主對話 · 一次定稿"] -->|向前對齊| G2["研究狀態 · G2<br/>主對話 · 薄研究"]
        G2 -->|向前對齊| G3["規劃狀態 · G3<br/>主對話 · 薄規劃"]
    end
    subgraph Build["執行層 · G1→G2→G3 依序落地（與定義層同構）"]
        direction LR
        TST["測試狀態 · G1 落地<br/>主對話"] --> DEV["實作狀態 · G2 落地<br/>主對話"]
        DEV --> ACC["驗收狀態 · G3 落地<br/>主對話"]
    end
    SEC -- 調控時序 --> Consult
    SEC -- 調控時序<br/>讀 <repo>/.shiftblame/tmp/ 判決 --> Build
    G1 == "定義↔落地<br/>測試" ==> TST
    G2 == "定義↔落地<br/>實作" ==> DEV
    G3 == "定義↔落地<br/>驗收" ==> ACC
```

> - **老闆**：提出命題，決定產品語義、範圍、成本／風險容忍與授權，做最終 PASS；不代答實作方式、API、根因、測試或證據解讀等純技術題。
> - **秘書（主對話）**：連續承載所有工作狀態，負責意圖揭露、G1-G3、測試、實作、驗收、放行、判決、commit、路由與 PASS。未授權前唯讀。
> - **定義層**：主對話依序切換審計、研究、規劃狀態，產出 G1、G2、G3。
> - **執行層**：主對話依序切換測試、實作、驗收狀態，落地 G1、G2、G3；測試鎖定與 commit 讓同一執行者不能跨狀態偷改判準。
> - **臨時外部子代理檢閱**：三個固定時點強制對抗（放行前方向、判決前成果、收斂複驗成果）＋純技術不可可靠裁定時強制技術意見；其他高風險情境按需取得。不可用時主對話以身分切換自攻執行最嚴厲攻擊並標示降級。不移交工作狀態或裁定權。

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

shiftblame 是一個通用 skills plugin 套件，所有 skill 定義位於 [`skills/`](skills/)，並內建 [`hooks/`](hooks/) 反偏移機械注入（SessionStart／UserPromptSubmit／PreToolUse：不變量卡、節點提醒、commit 印章硬擋）。依你所使用的 agent 平台之 plugin 載入機制安裝即可，不綁定特定平台。

**hooks 生效說明**：hooks 同時提供路徑安全防護——破壞性命令（各語言遞迴刪除／覆蓋）配相對路徑即硬擋，`git clean/reset --hard` 未以 `-C` 絕對錨定即擋；`sb` CLI 一律錨定專案根。ZCode 安裝 plugin 後 hooks 直接生效；Codex（0.149+，hooks 已 stable 預設啟用）安裝或更新 plugin 後須在 CLI 內以 `/hooks` 審閱並信任一次（信任綁定 hook 檔 hash，hook 變更後需重新信任）。hooks 故障時靜默放行，不阻斷工作。

**安裝來源**

- **本地目錄**——開發、自用、測試；指向本 repo 根目錄。
- **Git（GitHub）**——分享、版本追蹤、更新；指向 `https://github.com/teps3105/shiftblame`。

## 使用

shiftblame skill 會依任務描述自動觸發（開發、審查、研究任務皆然）。直接描述目標即可：

```text
幫我用三面向制衡流程重構登入流程
```

**所有老闆輸入第一步一定是路由回 sb-think，而不是字面指令。** 無論老闆輸入什麼——指令名、自然語言、一長串計畫書——agents 不直接執行字面指令，先回 sb-think 理解背後意圖、結構化呈現讓老闆確認，確認後才分發到對應流程。若輸入本身是對上一份理解的確認，sb-think 直接消費並分發，不得要求確認第二次。sb-think 之前是老闆責任（意圖沒打磨好是老闆的鍋），之後是 agents 責任（事情沒做好是 agents 的鍋）。

路由關係（是否建立／沿用 `<slug>`／`<nnn>` 只由老闆決定，在 sb-think 中拍板）：

- **沿用 `<nnn>`**——同一子需求的擴充。
- **開新 `<nnn>`**——同一 `<slug>` 中的新子需求（前置：目前 `<nnn>` 已完成，不需先 PASS）。
- **開新 `<slug>`**——與既有功能幾乎無關的新功能。
- **結束 `<slug>`**——老闆 PASS → 完整收尾保鮮 → 移 <repo>/.shiftblame/archive/。
- **直接實行（不開 slug）**——框架演化、微修或老闆指定不開 slug 的輕量變更。
- **框架演化**——修改 shiftblame 自身；不開 slug，仍須先揭露方案取得授權。

### 流程狀態機（npm CLI：sb）

流程規範以腳本鎖死（不自知推進與五假對策，見 SKILL §1.8）——每個 slug 開始跑 `sb init <slug>`，每個階段推進跑 `sb next <node>`，閘門不過（exit 1）不得推進。一般階段沿用既有授權，不帶 `--boss-ok`；只有最終 PASS 與顯式修約等真正語義決策留痕：

```bash
npm install -g <shiftblame repo>/cli
sb init <slug>                     # 開 slug：建立 .shiftblame/flow-state.json
sb state                           # 目前節點與各下一步前置條件
sb next release                    # 放行閘（查 §10 記錄＋對抗方向檢閱記錄 review-plan-*.md）
sb next pass --boss-ok             # 已取得最終 PASS 決策後留痕
sb amend --boss-ok                 # G1 顯式修約（須先寫 amendment.md 且 working tree 乾淨）
sb lock <測試碼...>                 # 測試定稿：斷言＋AC-ID 回指＋G1/測試 hash 鎖定
sb next verdict                    # 判決閘（測試鎖定 hash＋驗收報告反證/未驗段＋對抗成果檢閱 review-verify-*.md）
sb report                          # 自包含外部審計報告 → tmp/report-*.md（開新 slug/ms 前強制；開發中老闆隨時）
sb commitmsg "<訊息>"               # 提交訊息機械驗證（任何 commit 前必過，sb-commit 技能）
```

### sb-* 工作流指令

**sb-think 是唯一閘口**——所有輸入先過 sb-think 理解、對齊、分發，下列指令是 sb-think 分發後的執行目標，老闆不直達：

- [`sb-think`](skills/sb-think/SKILL.md)——唯一閘口；所有輸入第一步路由回此，不字面執行，先理解意圖再分發。
- [`sb-start`](skills/sb-start/SKILL.md)——新需求路由；建骨架（開 slug 或 nnn）→ 三面向制衡。
- [`sb-resume`](skills/sb-resume/SKILL.md)——繼續未完成的 slug／nnn，重走三面向制衡。
- [`sb-do`](skills/sb-do/SKILL.md)——強制對抗方向檢閱、核對 §10 一致性，層間停靠揭露後放行進入開發。
- [`sb-end`](skills/sb-end/SKILL.md)——結束 slug，執行完整收尾保鮮。
- [`sb-save`](skills/sb-save/SKILL.md)——記錄工作落點到 <repo>/.shiftblame/<slug>/SLUG.md，供 sb-resume 恢復。
- [`sb-dice`](skills/sb-dice/SKILL.md)——依證據選擇最小充分範圍，丟棄未提交變更、當前功能、當前 ms 或整個 slug。
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
├── cli/                            # npm CLI：sb 流程狀態機與契約／證據閘門
│   ├── package.json               # package: shiftblame-cli
│   └── bin/sb.mjs                 # init/state/next/amend/lock/report/commitmsg
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
├── tmp/                           # 執行證據、查證結果與臨時檢閱產物
└── archive/
```

## 提交規範

- 訊息：`<type>: <繁中描述>`，**單行、10～30 字**。MUST NOT 含任何追蹤編號（nnn、slug 名稱、issue/ticket 號）；純描述變更本身。
- 精準 `git add`；不得提交 `<repo>/.shiftblame/`，不得夾帶範圍外檔案。
- 分支政策綁定 slug：開 `<slug>` 時 MUST 切 `<type>/<slug>` 分支；框架演化、緊急修復、輕量調整 MAY 直接在 main。
- 開發採多循環螺旋：功能是 commit 單位、里程碑是驗收節點；不合格返工疊加新 commit。

## License

MIT License. 不接受外部貢獻。
