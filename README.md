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
  <img src="https://img.shields.io/badge/version-1.9.1-2ea44f.svg" alt="version 1.9.1"/>
</p>

---

## 這是什麼

shiftblame 用一張人類可讀的向量拓樸，約束 Agent 如何調控時序進程——把需求交給需求定義、研究、規劃、測試、開發、驗收六個工作階段。完整權威圖與讀圖規則位於 [`skills/shiftblame/SKILL.md`](skills/shiftblame/SKILL.md)；本 README 是查詢入口，機制細節以 SKILL 為準。

核心原則：

- **段-檔承載與輪內單向。** 八段由四份文件承載成四條閉環軸——SLUG（intent/done 管理層出入口）、G1（requirement 定義＋verify 裁判）、G2（research 定義＋build 落地）、G3（plan 定義＋test 落地）；推進呈 Z 字形，落地段反向回指承載檔（test→G3 驗收排程、build→G2 技術方案、verify→G1 逐項 AC 判定）。輪內單向定律：每輪 requirement→research→plan 單向一次定稿；修正＝回 intent 開新輪（輪次計數記 flow-state，時序由 history 承擔；歷史不可變性由 git 承擔）。requirement 段建立在經查證的現況事實上（查證過程落 tmp）；G1 需求以 BDD 行為規格立法（Given/When/Then＋使用者＋失敗邊界＋消融——拿掉此需求使用者失去什麼可觀察價值）——字面研究死路。G 檔寫入權分區（定義區：G1→requirement／G2→research／G3→plan；回指區：G1←verify 判定／G2←build 偏離／G3←test 映射；放行時 CLI 對定義區 hash 封存）——跨區（落地段改定義區）＝綁架上游死路。對抗產物屬 RAM（tmp＋flow-state），禁入 G/SLUG（ROM）。

- **消融原則（方法論）。** 每個機制、組件與需求的存在價值由消融對照證明——拆掉會壞＝貢獻；拆掉沒差＝殘留走退役審查。六落點：G1 BDD 消融欄（偽需求即擋）、G2 組件消融貢獻（冗餘即淘汰）、G3 關鍵驗收的消融對照測試、verify 因果對照證據（停用功能→行為消失，排除巧合綠燈）、框架本體消融矩陣（`cli/test/sb-ablation.mjs`——每個 MUST 級機制「拆掉→防護消失」成對斷言，隨測試套件常設重跑）、演化提案消融前後對照格式。
- **所有輸入路由回 shiftblame:think。** 無論老闆輸入什麼——指令名、自然語言、計畫書——第一步都是路由回 shiftblame:think 理解背後意圖，不字面執行。shiftblame:think 是責任轉移線：之前是老闆的鍋（意圖沒打磨好），之後是 agents 的鍋（事情沒做好）。
- **問題陳述不等於修改授權。** shiftblame:think 先分開揭露原始命題、意圖翻譯與候選方案，老闆授權後才可寫入。
- **雙流模型。** 輸入＝獨立理解對象，不是鎖的鑰匙：每則老闆輸入記入**輸入流**（hooks 唯增事實——永不覆蓋、永不消費、無引句無時序跳躍）；agent 經 shiftblame:think 路由理解（調用 args＝理解宣告）落**理解流**（雜湊鏈唯增）。行動正當性來自理解宣告＋**必然曝光**（無引句、無前置攔截）（老闆每則輸入時未審理解全部展示、未覆蓋輸入可見——理解錯即越權、沒理解就動手，當場看到）。完成類鑰匙＝--boss-ok 留痕＋時點對抗＋理解流曝光。
- **提交對抗閘（對抗—修復—再對抗閉環機械化）。** 提交＝對抗時點（機制時點，非階段；所有 repo 統一）——`sb adversarial <報告檔>`：MUST 外部唯讀子代理對抗、報告落檔後引用，機械驗（檔在 .shiftblame 內＋判定行＋判定「通過」才可發章）；`sb commitmsg` 發章只驗不消費，hooks 於實際 commit 時消費並焚章（一對一）。返工修復必然終於 commit，「修復→全綠→提交」不對抗的路徑機械上不存在；對抗 MUST 子代理，無自代介面（工具不可用即阻塞等待）。
- **返工直通（時點①分流）。** 老闆驗收後指示即意圖檢測輸入——時點①意圖揭露必含返工性質判定（實作級／定義級→`--rerun` 直通免停靠；根本性→完整確認停靠），顯示提醒老闆當場糾正；對抗邊與完成時點永不減免，直通留痕於完成時點曝光彙總。
- **兩層文件模型。** 文件↔實況對照是一等公民：永續層（docs/、SOP、ROADMAP、README、skills/）是唯一需與實況對照的文件——提交時陳述對照閘機械驗其 sb 命令／旗標引用 ↔ CLI 實況（單一真相取自 sb.mjs 源碼），引用不存在的機制即擋；MUST 級機制的行為測試附文件陳述錨（文件刪除漂移即紅燈）；永續層文件隨程式碼即時變更且文件先行——build 段先把永續層文件改到目標狀態再依文件寫實作碼，不一致回頭修文件再繼續（same-commit：改了什麼就行為什麼文件）並走與程式碼相同的流程與對抗——提交對抗的標準攻擊點含 staged 程式碼變更 vs 文件零變更正當性與註釋行為一致性。當下層（G1/G2/G3/SLUG）是開發工作文件——用後即归檔、過時無罪；查現況看永續層與實況，查脈絡才看當下層。
- **研究／返工外部性閘。** 外部工具調用是機械底線：hooks 於 PreToolUse 偵測外部調用（WebSearch／WebFetch／webReader 查證、Agent 外部唯讀子代理）標記 `externalEvidence`；`requirement→research` 進段與 `--rerun` 返工時重置，`research→plan` 邊與返工後首個推進邊機械驗「至少一次外部調用」，零外部推不過。規模自由（一次精準查證到完整調研皆可），大型研究（陌生領域、多方案抉擇、高風險選型）MUST 由外部唯讀子代理承擔主要調研——研究與返工以外部工具調用打底（內部自我檢驗即外部性閘擋下）。
- **決策權中央集權。** 所有判決（放行、合格/返工、commit、路由、reset、PASS）由主對話秘書獨佔；臨時檢閱意見只作輸入。
- **秘書是唯一持久角色與階段承載者。** 主對話連續切換需求定義→研究→規劃→測試→實作→驗收等工作狀態；狀態不是身份或委派邊界，因此不因流程推進反覆切換上下文。
- **階段完成不是停點。** 主對話吸收每段產出、更新 `Goal／Core／Verified／Open／Next` 並立即續跑。局部綠燈、壓縮將至與老闆沉默都不授權停止；進度回報不等於 final。
- **段-檔承載閉環（Z 字形）。** 八段由四份文件承載：SLUG 承載 intent/done（管理層出入口）；G1 閉環＝requirement（定義）＋verify（裁判——逐項 AC 判定）；G2 閉環＝research（定義）＋build（落地——實作回指 G2）；G3 閉環＝plan（定義）＋test（落地——測試碼回指驗收排程）。落地段反向回收承載檔——文件定義後於落地邊復活當裁判。任何 G2/G3 與 G1 不一致＝回 intent 開新輪由 requirement 段重定義——G1 定義權唯一。
- **純技術裁定不外包給老闆。** repo／第一方文件／實機證據不足或矛盾、無法可靠裁定時，主對話必須立即取得一次外部子代理的自包含唯讀技術意見，複核後自行裁定；不必先反覆失敗。只有產品語義、G1 成功集合、範圍、成本／風險容忍或新授權才交由老闆決定。
- **三時點對抗＋adversarialLog point 條目對照。** plan→test（①對抗方向）、verify→test（②對抗成果）、verify→done（③對抗成果）——推進帶 `--adversarial` 宣告，CLI 逐字對照 SLUG.md 時點對抗記錄，不一致即擋；複核結論每項裁定綁可查證出處，反向對抗判定成立才推進。對抗 MUST 外部唯讀子代理——無自代介面：工具不可用即阻塞等待至可用；報告落檔＋`sb adversarial <報告檔>` 宣告（判定「通過」才可發章）。外援只提供輸入，不接管工作狀態或裁定；技術證據不足時另強制一次唯讀技術意見。
- **階段內認知控制。** 任務依 fast／full／loop 分級；長程工作以 `Goal／Core／Verified／Open／Next` 短帳本跨 seam 保持狀態，所有「已驗證」都要附方法與涵蓋範圍。
- **最小充分解。** 依序選擇重用既有能力、標準函式庫、平台原生能力、既有依賴與最少可用實作；修 bug 修共用根因，不簡化安全、資料保護、無障礙或明確需求。
- **資產分離與流程代號禁入。** `.shiftblame/tmp/` 是 agents 自由傾倒區——流程閘門零依賴（唯一例外：commit 留痕即生即滅）；專案工具鏈或專案運行產生的檔案（日誌、快取、匯出物）屬專案資產歸專案位置，驗收引用以**節錄快照**為證據。tmp 只準寫入、不準清理，清理由老闆手動執行。流程代號（ms 編號、G1/G2/G3 引用、AC-ID、sb 指令名、流程歷史）與程式碼保持正交——註解、識別字、字串與測試名稱皆同；流程資訊由 commit message 與 `.shiftblame/` 承載，AC-ID 與測試的映射由 G3 承載。
- **不開 slug 的事直接做。** 框架演化、微修或老闆指定不開 slug 的輕量變更，直接實行不建骨架；一旦開 slug，一律完整三面向制衡，無中途降級。
- **回頭自由重修。** 成果不滿意隨時返工（verify→test／done→test／任意→intent），返工疊加新 commit——重修走 done→test 邊（開新 ms 僅回應老闆主動新需求）。
- **假測試判返工。** 走執行層時序的測試 MUST 有真實斷言、對應 G1 驗收項或可觀察行為；無斷言／測實作細節／mock 過度／形式化湊數的假測試，秘書判決時判返工回測試階段。
- **寫測試與跑測試以狀態分離。** 測試狀態回指 G3 驗收排程（AC-ID 映射 G1 驗收項）定義「過」後即鎖定；綠燈路徑＝實作修正（測試全程唯讀）。紅燈只有兩條路：實作問題回實作狀態，或附定義錯誤理由回測試狀態重新定義。
- **測試可自動化，驗收必須是使用者行為。** G3 每項驗收 MUST 可重現執行；CI 綠燈與結構正確不能單獨判定完成，仍須逐項提供 G1 使用者可觀察的 BEHAVIOR 證據。
- **測試先行（觸發重流程時）。** 執行層執行順序固定：測試階段回指 G3 驗收排程寫測試（紅燈）→ 實作階段回指 G2 寫實作 → 驗收階段依 G3 操作、對 G1 逐項 AC 判定到綠燈。先寫測試再實作，與定義層「驗收先於實作」對齊。
- **驗收先於實作。** G3 內部先依 G1 寫驗收，依序：先回讀 G1 寫驗收，再依 G2 寫實作步驟。
- **G1 是封存契約。** plan→test 放行時 CLI 將 G1 的 SHA-256 封存於 flow-state.json，後續每次推進重算核對；G2／G3 的一切改寫（含 CONFORMS 單調細化）經回 intent 開新輪至定義段執行（G1 不變時重新放行同 hash 重封存；history 留時序）。契約不足或衝突＝回 intent 開新輪重定義後重新放行。
- **回 intent 前先清帳。** 回 intent 重走前，working tree MUST 乾淨：可保留成果先依 `sb commitmsg` 精準提交，不應保留的變更明確捨棄。
- **驗收使用者需求，不驗收結構幻象。** G1 每項需求使用唯一 AC-ID 與 BEHAVIOR 契約；G3 驗收表逐項排程並映射測試。CI 綠燈或結構正確不能單獨判定完成；必填 AC 必須有 commit 與實際操作／觀察的 SATISFIED 行為證據（引用專案輸出以節錄快照為證）——判決由秘書判定，時點②對抗承擔查核（verify 邊核對 git 一致性）。
- **commit 集權。** commit 一律由主對話秘書執行且必過 `sb commitmsg`（hooks 留痕硬擋）；build 段完成即存檔（commit 先於驗收）。

## 流程概覽

```mermaid
flowchart TD
    Boss([老闆任何輸入]) --> Think["shiftblame:think · 全域路由（不屬於任何段）<br/>═══ 責任轉移線 ═══"]
    Think -- 補充／修正 --> I["回 intent 同 ms 重走"]
    Think -- 確認／開工 --> Exec["分發執行"]

    subgraph Eight["八段 · 一個 ms 走一次"]
        direction LR
        I[intent 意圖<br/>老闆確認] --> A[requirement 需求<br/>G1] --> R[research 研究<br/>G2] --> P[plan 計畫<br/>G3＋§10＋時點①對抗]
        P -- "放行 --boss-ok --adversarial" --> T[test 測試<br/>定稿 commit]
        T --> B[build 實作<br/>存檔 commit]
        B --> V[verify 驗收<br/>判決＋時點②對抗<br/>＝中間態]
    end
    Exec --> Eight
    V -- 功能循環 --adversarial --> T
    V -- 重修／追加（回頭自由） --> I
    V -- "老闆授權 --boss-ok＋--adversarial" --> D[done 完成態]
    D -- 重修（零旗標） --> T
    D -- "開新 ms 留痕" --> I
    D -- "PASS 留痕 → sb end" --> E([收尾歸檔＋archive])
```

**所有老闆輸入第一步路由回 shiftblame:think，不字面執行指令。** shiftblame:think 是責任轉移線——之前是老闆的鍋（意圖沒打磨好），之後是 agents 的鍋（事情沒做好）。純技術裁定由 agents 查證、必要時取得外部子代理唯讀意見後自行負責；只有產品語義、範圍、風險容忍、授權或 PASS 等非技術決策才路由回 shiftblame:think。

**done 是 ms 完成態，不等於 slug 結束。** 老闆說「開新 ms」（留痕）開新輪；說「PASS」（留痕）＋`sb end` 才結束 slug（收尾歸檔＋archive）。未宣稱 done 前流程停在 verify 中間態——成果不滿意隨時重修（verify→test 或回 intent，零旗標）。

讀圖規則：①沿箭頭逐段前進；②下游發現缺口，沿退回箭頭處理；③每個節點只產出自己的內容；④圖文衝突時，以權威圖為準。

## 秘書與工作階段

**秘書（主對話）是唯一持久角色與階段承載者**。工作階段是同一上下文中的狀態，不是角色身份或固定委派邊界。

```mermaid
flowchart TB
    SEC["秘書（主對話）<br/>唯一持久角色 · 調控時序進程"]
    subgraph Consult["定義層 · 定義該做什麼 · 輪內單向定律"]
        direction LR
        G1["需求定義狀態 · G1<br/>主對話 · 一次定稿"] -->|向前對齊| G2["研究狀態 · G2<br/>主對話 · 外部證據打底"]
        G2 -->|向前對齊| G3["規劃狀態 · G3<br/>主對話 · 對齊推進"]
    end
    subgraph Build["執行層 · 落地段反向回指承載檔（Z 字形）"]
        direction LR
        TST["測試狀態 · G3 落地邊<br/>主對話"] --> DEV["實作狀態 · G2 落地邊<br/>主對話"]
        DEV --> ACC["驗收狀態 · G1 裁判邊<br/>主對話"]
    end
    SEC -- 調控時序 --> Consult
    SEC -- 調控時序<br/>讀 <repo>/.shiftblame/tmp/ 判決 --> Build
    G1 == "G1 閉環<br/>定義→裁判" ==> ACC
    G2 == "G2 閉環<br/>定義→落地" ==> DEV
    G3 == "G3 閉環<br/>定義→落地" ==> TST
```

> - **老闆**：提出命題，決定產品語義、範圍、成本／風險容忍與授權，做最終 PASS；不代答實作方式、API、根因、測試或證據解讀等純技術題。
> - **秘書（主對話）**：連續承載所有工作狀態，負責意圖揭露、G1-G3、測試、實作、驗收、放行、判決、commit、路由與 PASS。未授權前唯讀。
> - **定義層**：主對話依序切換需求定義、研究、規劃狀態，產出 G1、G2、G3。
> - **執行層**：主對話依序切換測試、實作、驗收狀態，落地 G1、G2、G3；測試定稿 commit 與判決的 git 一致性核對讓同一執行者不能跨狀態偷改判準。
> - **臨時外部子代理檢閱**：三個固定時點強制對抗（放行前方向、判決前成果、收斂複驗成果）＋純技術不可可靠裁定時強制技術意見；其他高風險情境按需取得。無自代介面：子代理不可用即阻塞等待至可用。不移交工作狀態或裁定權。

## 三份文件

- **G1 需求研究** — 回答 What、Why、邊界、原始驗收條件。不寫技術解法。
- **G2 技術分析** — 回答 How、測試方式、技術風險。不改寫需求。
- **G3 實作計畫** — 先寫業務驗收，再寫實作步驟。不新增需求、不讓實作步驟先於驗收。

## SOP 與 ROADMAP 的硬邊界

這兩份專案文件不是 Agent 的流水帳：

- **SOP** — 只能寫：本專案跨 `<slug>` 長期有效、可查核的本地配置、執行規範、資料／服務邊界與驗證入口。內容排除：產品目標、ROADMAP 計畫、G1/G2/G3、中央流程副本、單一需求、進度或流水帳。
- **ROADMAP** — 只能寫：用白話寫產品目標、固定邊界與尚未完成的想做計畫。內容排除：未授權想法、已完成事項、技術方案、G1/G2/G3、排程、優先級、進度或流水帳。

欄位模板與拒絕規則以 [`skills/shiftblame/assets/SOP.md`](skills/shiftblame/assets/SOP.md) 及 [`skills/shiftblame/assets/ROADMAP.md`](skills/shiftblame/assets/ROADMAP.md) 為準；寫入內容依模板准入條件。

文件與實況對照是一等公民（兩層文件模型）：永續層（ROADMAP、SOP、`<repo>/docs/`、`<repo>/README.md`）隨造成變化的程式碼同批更新（same-commit，文件先行——文件先改到目標狀態、碼依文件而寫）——ROADMAP 移除已完成條目並修正剩餘方向、SOP 刪除被取代的值並同步段落、docs 與專案 README 對照 codebase 補齊或刪除。收尾只是機械歸檔（當下層工作文件移至 archive），零文件改寫。同批對照屬維護既有文件；新增方向與產品邊界仍須 owner 明確授權。

## 安裝

shiftblame 是一個通用 skills plugin 套件，所有 skill 定義位於 [`skills/`](skills/)，並內建 [`hooks/`](hooks/) 反偏移機械注入（SessionStart／UserPromptSubmit／Stop／PreToolUse：不變量卡、節點提醒（Stop 靜默）、commit 留痕硬擋）。依你所使用的 agent 平台之 plugin 載入機制安裝即可，不綁定特定平台。

**hooks 生效說明**：hooks 同時提供路徑安全與**狀態寫入矩陣**防護——破壞性命令（各語言遞迴刪除／覆蓋）配相對路徑即硬擋，`git clean/reset --hard` 未以 `-C` 絕對錨定即擋；**雙流模型**（每則老闆輸入記入輸入流唯增事實——永不覆蓋消費；shiftblame:think 調用 args＝理解宣告落理解流，雜湊鏈唯增；無鎖無解鎖命令——行動正當性＝理解宣告＋必然曝光：老闆每則輸入時未審理解全部展示、未覆蓋輸入可見；完成類鑰匙＝--boss-ok 留痕＋時點對抗）；`SessionStart` 於壓縮後自動注入動態狀態卡（段位／輸入流與理解流狀態——抗上下文壓縮）；**兩種觸發樣態**：老闆以 shiftblame:think 調用形式輸入（`/shiftblame:think`、`$shiftblame:think` 或裸名 `shiftblame:think` 開頭）＝主動觸發→停等——理解六欄呈現即停，hooks 於 hold 期間硬擋寫入類工具與流程推進（唯讀、外部查證、tmp 傾倒自由），老闆回覆即解凍（確認→分發；修正→重呈現仍停等）；一般輸入＝被動觸發→理解宣告落流＋事後曝光、直接續跑；寫檔工具比對段（測試碼僅 test 段、實作碼限 build／ended）；**staged 系統檔不入庫**（`git commit` 前讀 `git diff --cached --name-only` 事實清單——一律 root 錨定絕對展開後判 `.shiftblame/`，`sb commitmsg` 發章前同判據）；**路徑展開元規則**（一切路徑判斷 root 錨定絕對展開；git 重定向 GIT_DIR／`--git-dir` 與 alias 定義即擋）；`git commit` 驗留痕；`sb` CLI 一律錨定專案根。閘門只讀 git 事實與 flow-state.json——`.shiftblame/tmp/` 是唯一自由傾倒區，流程零依賴。**hooks 為單一 `command` 型配置，多平台相容**（ZCode 與 Codex 的 hooks schema 交集：`command` 型＋`${CLAUDE_PLUGIN_ROOT}`（兩端皆展開）＋秒級 `timeout`）——同一份 hooks.json 兩端生效，不為個別平台綁專屬配置。ZCode 安裝 plugin 後 hooks 直接生效；Codex（0.149+，hooks 已 stable 預設啟用）安裝或更新 plugin 後須在 CLI 內以 `/hooks` 審閱並信任一次（信任綁定 hook 檔 hash，hook 變更後需重新信任——未信任時 hooks 不跑，CLI 閘擋時會附 hooks 健康警示）。**hooks 心跳**：每次 hooks 成功執行更新 `flow-state.json` 的 `hooksHeartbeat` 欄位（運行狀態單一載體）——CLI 的外部證據閘被擋時對照心跳區分「老闆未授權」（心跳新鮮）與「hooks 故障／未信任」（心跳停滯或無記錄——記錄缺失≠授權缺失，修 hooks 而非繞閘；fail-closed 不變，診斷只揭露不降級）。hooks 故障時靜默放行，不阻斷工作。

**安裝來源**

- **本地目錄**——開發、自用、測試；指向本 repo 根目錄。
- **Git（GitHub）**——分享、版本追蹤、更新；指向 `https://github.com/teps3105/shiftblame`。

## 使用

shiftblame skill 會依任務描述自動觸發（開發、審查、研究任務皆然）。直接描述目標即可：

```text
幫我用三面向制衡流程重構登入流程
```

**所有老闆輸入第一步一定是路由回 shiftblame:think，而不是字面指令。** 無論老闆輸入什麼——指令名、自然語言、一長串計畫書——agents 不直接執行字面指令，先回 shiftblame:think 理解背後意圖、結構化呈現讓老闆確認，確認後才分發到對應流程。若輸入本身是對上一份理解的確認，shiftblame:think 直接消費並分發（確認一次即完成）。shiftblame:think 之前是老闆責任（意圖沒打磨好是老闆的鍋），之後是 agents 責任（事情沒做好是 agents 的鍋）。

路由關係（是否建立／沿用 `<slug>`／`<nnn>` 只由老闆決定，在 shiftblame:think 中拍板）：

- **沿用 `<nnn>`**——同一子需求的擴充。
- **開新 `<nnn>`**——同一 `<slug>` 中的新子需求（前置：目前 `<nnn>` 已完成，不需先 PASS）。
- **開新 `<slug>`**——與既有功能幾乎無關的新功能。
- **結束 `<slug>`**——老闆 PASS → 完整收尾歸檔 → 移 <repo>/.shiftblame/archive/。
- **直接實行（不開 slug）**——框架演化、微修或老闆指定不開 slug 的輕量變更。
- **框架演化**——修改 shiftblame 自身；不開 slug，仍須先揭露方案取得授權。

### 流程狀態機（npm CLI：sb）

流程規範以腳本鎖死（閘門只讀 git 事實與 flow-state，推進需顯式鑰匙；見 SKILL §7）——每個 slug 開始跑 `sb init <slug>`，每個階段推進跑 `sb next <node>`，閘門過了（exit 0）才推進。一般階段沿用既有授權，不帶 `--boss-ok`；只有最終 PASS 與顯式修約等真正語義決策留痕：

```bash
npm install -g <shiftblame repo>/cli
sb init <slug>                     # 開 slug：建立 .shiftblame/flow-state.json
sb state                           # 目前節點與各下一步前置條件
sb next test --boss-ok --adversarial  # 放行邊（§10＋時點①對抗＋adversarialLog point 條目對照＋G1 hash 封存）
sb next verify                     # 進驗收（working tree 乾淨＝實作已存檔，git 判定）
sb next done --boss-ok --adversarial  # 完成邊（需老闆「done」留痕＋時點③對抗＋adversarialLog point 條目對照）
sb next intent                     # 回頭自由：補充／重修／追加（同 ms 重走，零旗標）
sb end --boss-ok                   # PASS（done 態；需老闆「PASS」留痕）→ 收尾歸檔＋archive
sb commitmsg "<訊息>"               # 提交訊息機械驗證（hooks 留痕硬擋提交）
```

### shiftblame:* 功能型技能

**shiftblame:think 是唯一閘口**——所有輸入先過 shiftblame:think 理解、對齊、分發，下列指令是 shiftblame:think 分發後的執行目標，老闆不直達：

- [`shiftblame:think`](skills/think/SKILL.md)——全域路由（唯一閘口，不屬於任何段）；所有輸入第一步路由回此：補充／修正→回 intent 同 ms 重走；確認／開工→分發執行。
- [`shiftblame:resume`](skills/resume/SKILL.md)——繼續未完成的 slug／nnn，重走三面向制衡。
- [`shiftblame:save`](skills/save/SKILL.md)——記錄工作落點到 <repo>/.shiftblame/<slug>/SLUG.md，供 shiftblame:resume 恢復。
- [`shiftblame:dice`](skills/dice/SKILL.md)——依證據選擇最小充分範圍，丟棄未提交變更、當前功能、當前 ms 或整個 slug。

## 文件結構

```text
shiftblame/                         # plugin 套件根（repo 根）
├── .codex-plugin/plugin.json      # plugin manifest（各平台對應 manifest）
├── .claude-plugin/marketplace.json
├── .agents/plugins/marketplace.json
├── cli/                            # npm CLI：sb 流程狀態機與契約／證據閘門
│   ├── package.json               # package: shiftblame-cli
│   └── bin/sb.mjs                 # init/state/next/end/commitmsg
└── skills/
    ├── shiftblame/
    │   ├── SKILL.md               # 權威拓樸、讀圖規則、分流、箭頭條件、收尾
    │   ├── references/            # 工作階段定義（按需讀）
    │   │   ├── REQUIREMENT.md         # 定義層
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
    └── */SKILL.md               # 功能型技能：shiftblame:think 全域路由＋save/resume/dice（文件操作由流程與寫入矩陣直接承載）
```

每個專案的工作區位於 `<repo>/.shiftblame/`（`<repo>` = 使用者專案根目錄的絕對路徑），並且 MUST 經 `.gitignore` 排除（入庫路徑封閉）。工作區為**結構分檔**（定義單檔、使用分檔）：

```text
<repo>/.shiftblame/                # 各專案工作區（MUST 經 .gitignore 排除；樹內子項由樹根錨定）
├── SOP.md
├── ROADMAP.md
├── <slug>/                        # 結構分檔：SLUG 主體 + 每 nnn 一子目錄
│   ├── SLUG.md                    # SLUG 主體（§1-§7；不含 G1/G2/G3）
│   └── nnn/                       # 每個 <nnn> 一個子目錄
│       ├── G1.md                  # 需求／驗收標準（requirement 段產出）
│       ├── G2.md                  # 技術分析（研究階段產出）
│       └── G3.md                  # 實作計畫（規劃階段產出）
├── tmp/                           # 流程產物短期落點：執行證據與臨時檢閱產物；專案工具鏈日誌／快取不收編，只準寫入不準清理
└── archive/
```

## 提交規範

- 訊息：`<type>: <繁中描述>`，**單行、10～30 字**、純描述變更本身——追蹤編號（nnn、slug 名稱、issue/ticket 號）歸分支名與 merge 訊息。
- 精準 `git add`——提交範圍＝本次功能相關檔案（`.shiftblame/` 外）。
- 分支政策綁定 slug：開 `<slug>` 時 MUST 切 `<type>/<slug>` 分支；框架演化、緊急修復、輕量調整 MAY 直接在 main。
- 開發採多循環螺旋：功能是 commit 單位、里程碑是驗收節點；不合格返工疊加新 commit。

## License

MIT License. 不接受外部貢獻。
