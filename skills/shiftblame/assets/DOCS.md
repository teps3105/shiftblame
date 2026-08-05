---
name: DOCS
revision: 0.5.0
---
# DOCS — 專案系統文件的寫法判準

> 本檔規範專案 `docs/` 系統文件的**寫法品質**，不改變流程與寫入授權（流程看 SKILL §0 主圖，授權看 SKILL §2、§5、§6）。判準提煉自 `dnd-prototype` `system-documentation-audit` 002 的三輪修正（rev1 code 導覽作廢、rev2 揣測意圖作廢、rev3 純實作陳述 PASS）。

## 0. 適用範圍（硬性釘死）

```mermaid
flowchart TD
    File[/待判文件/] --> Type{文件類型？}
    Type -- "docs/ 系統文件<br/>（描述 codebase 實際運作）" --> Apply["✅ 適用<br/>執行 §2 R1-R4 判準<br/>＋ §4 grep 查核"]
    Type -- ".shiftblame/ 管理文件<br/>（G1/G2/G3/SOP/ROADMAP/SLUG）" --> NoApply1["❌ MUST NOT 套用<br/>寫 Why／技術理由／需求動機<br/>是這些文件的法定職責<br/>套反向詞清單會誤殺核心內容"]
    Type -- ".shiftblame/SOP.md" --> NoApply2["❌ MUST NOT 套用<br/>SOP 保留真實路徑／命令／行號<br/>是法定職責，與 R3 有意分工：<br/>SOP 寫「怎麼跑／配置在哪」<br/>docs/ 寫「系統怎麼運作」"]
```

本檔的 grep 反向詞清單（§2）只在 `docs/` 執行；MUST NOT 對 `.shiftblame/` 或 SOP 執行。

## 1. 角色落點

```mermaid
flowchart LR
    ThisDoc["DOCS.md<br/>文件寫法品質通用判準<br/>（中央尺）"]
    ThisDoc --> RelG1["與 G1：驗收仍由 AUDITOR 主導的 G1 承載<br/>本規範 MAY 被 G1 引用為驗收依據<br/>MUST NOT 取代 G1"]
    ThisDoc --> RelS5["與 SKILL §5：本檔規範「怎麼寫才正確」（品質）<br/>§5 規範「誰能改、何時能改」（寫入權）<br/>兩者正交 · 本檔不授予寫入權"]
    ThisDoc --> RelRoute["本檔修改路由：框架演化<br/>（SKILL §0、§6）<br/>不開 slug · 先揭露方案取得授權"]
```

## 2. 寫法判準（MUST／MUST NOT）

> 四條判準各有職責，共同決定一份 docs/ 文件是否合格。下圖是判準間的分工與查核優先序：

```mermaid
flowchart TD
    Doc[/docs/ 文件段落/] --> R1{R1 只描述真實實作？}
    R1 -- 否 --> Fail1[不合格 · 寫成 code 複製品]
    R1 -- 是 --> R2{R2 不揣測意圖？}
    R2 -- 否 --> Fail2["不合格 · 含動機／感受詞<br/>（grep 反向詞清單）"]
    R2 -- 是 --> R3{R3 無 code 導覽特徵？}
    R3 -- 否 --> Fail3["不合格 · 行號／簽章／<br/>檔名作敘事主軸"]
    R3 -- 是 --> R4{R4 各領域覆蓋？}
    R4 -- 否 --> Fail4[不合格 · 缺領域／入口寫成 API 表]
    R4 -- 是 --> Pass[合格 · 可供 AUDITOR 引用為驗收依據]
```

### R1 只描述真實實作

```mermaid
flowchart LR
    R1["R1 只描述真實實作"]
    R1 --> R1Must["MUST：陳述系統現在實際怎麼運作<br/>操作→行為、條件→結果 · 與 codebase 一致"]
    R1 --> R1MustNot["MUST NOT：寫成 code 的複製品或劣化導覽（見 R3）"]
    R1 --> R1Ex["正例：玩家與輸入.md<br/>「點擊可通行且有互動物的格：<br/>該物有開關屬性（門）→ 走至其四鄰任一可達格；<br/>否則（如樓梯）→ 直接走進該格」"]
```

### R2 不揣測意圖

```mermaid
flowchart LR
    R2["R2 不揣測意圖"]
    R2 --> R2Must["MUST：只描述「系統做什麼」<br/>不寫「為什麼這樣設計」「玩家會感知什麼」<br/>意圖、感受、動機是虛構且無法驗證"]
    R2 --> R2MustNot["MUST NOT：出現動機／感受／理由詞<br/>或設計意圖段落"]
    R2 --> R2Grep["grep 反向詞清單：<br/>為了 · 讓玩家 · 避免 · 調和 · 用以 · 旨在 · 以便<br/>希望 · 確保 · 保證 · 會感覺 · 爽快 · 挫敗<br/>玩家感知 · 流暢（主觀評價時）<br/>為什麼設計 · 為什麼這樣設計<br/>設計理由 · 設計意圖"]
    R2 --> R2Ex["反例：rev2（作廢）含「玩家感知／為什麼這樣設計」段落<br/>「調和」「避免挫敗」「爽快」等詞<br/>活體殘留：戰鬥/戰鬥機制.md<br/>「此契約調和『視覺流暢』與『回合制邏輯』」"]
```

### R3 無 code 導覽特徵

```mermaid
flowchart LR
    R3["R3 無 code 導覽特徵"]
    R3 --> R3MustNot["MUST NOT：把文件寫成 code 的劣化複製品<br/>code 一改文件即過時，且不比直接讀 code 多任何價值"]
    R3 --> R3Grep["grep 特徵（MUST NOT 命中）：<br/>行號引用 :[0-9] · 行 [0-9] · :line<br/>簽章與內部名 func · enum · signal · var · const · await · _ 開頭私有<br/>常數賦值列舉 = [0-9] · = true · = false · （固定）<br/>檔案路徑作敘事主軸 .gd · src/... · 以檔名命名章節"]
    R3 --> R3Line["界線：偶爾為查證而引用檔名 MAY<br/>但拿檔名當章節骨架或敘事主軸 MUST NOT"]
    R3 --> R3Ex["反例：rev1（作廢）<br/>### Facing（src/entities/facing.gd）<br/>**數值刷新（:169-201）**<br/>表格欄「false→true」<br/>show_message / refresh PlayerStatsPanelUI 當主語"]
    R3 --> R3SOP["與 SOP 分工：R3 的「無 code 導覽」僅規範 docs/ 敘事體<br/>SOP 依其模板保留真實路徑／命令／行號是法定職責<br/>不在本判準拘束範圍（見 §0）"]
```

### R4 各領域覆蓋

```mermaid
flowchart LR
    R4["R4 各領域覆蓋"]
    R4 --> R4Must["MUST：codebase 每個系統有對應文件<br/>有入口總覽檔，用「各系統一句話實際行為 + 文件清單」串接<br/>無 API 表、無設計願景"]
    R4 --> R4MustNot["MUST NOT：缺領域<br/>入口檔寫成 API 表或設計願景"]
    R4 --> R4Ex["正例：系統架構.md<br/>「各系統實際行為」+「文件清單」"]
```

## 3. 隱性判準（六份範本一致做到、與 R1-R4 同源）

```mermaid
flowchart TD
    Implicit["隱性判準"]
    Implicit --> Num["數字保留<br/>MUST：描述行為所需的數字保留<br/>（25×18、三層、6×4 網格、48px、正交步成本 1.0 / 對角 √2、≤34% 紅）<br/>MUST NOT：變成常數定義列舉（MAP_W=25、const GRID=6）<br/>界線：「描述行為的量」保留，「程式常數定義」禁止"]
    Implicit --> Tab["表格化<br/>MUST：可比較的狀態／屬性／分類用表格<br/>（互動物行為表、敵人五狀態表、系統總覽表）<br/>MUST NOT：操作流程用條列<br/>不得為套表格而把流程壓成無操作價值的概括句"]
    Implicit --> XRef["跨文件引用<br/>MUST：同一規則只在一處定義<br/>他處用相對路徑指標<br/>（戰鬥規則見 戰鬥/戰鬥機制.md）<br/>MUST NOT：在多處重複定義造成雙重真相"]
    Implicit --> Title["章節標題<br/>MUST：用行為／規則／領域名命名<br/>（察覺條件、點擊分類、五狀態與各自行為）<br/>MUST NOT：用檔名／類別名／函式名命名"]
    Implicit --> Test["測試／配置歸屬<br/>MUST：docs/ 描述「測試驗證了哪些行為」<br/>（21 個戰鬥 smoke 驗察覺／進戰／先攻）<br/>MUST NOT：具體命令、配置檔路徑、版本值屬 SOP 職責"]
```

## 4. 可驗證方法（grep）

> grep 命中即判違規；例外須在文件內註明理由（如引用外部規格的固定名稱）。AUDITOR 複核時 MAY 直接以本圖查核。

```mermaid
flowchart LR
    subgraph Grep["grep 查核（於 docs/ 執行）"]
        direction TB
        G2["R2 不揣測意圖<br/>grep -rnE &quot;為了|讓玩家|避免|調和|用以|旨在|以便|希望|確保|保證|會感覺|爽快|挫敗|玩家感知|為什麼(這樣)?設計|設計(理由|意圖)&quot; docs/<br/>通過條件：0 命中"]
        G3["R3 無 code 導覽<br/>grep -rnE &quot;:[0-9]+|func |enum |signal |await |.gd&quot; docs/<br/>通過條件：0 命中（必要時補 = (true|false|[0-9]) 排除常數列舉）"]
        G4["R4 各領域覆蓋<br/>ls docs/ 對照入口總覽檔的文件清單<br/>通過條件：齊全且一致"]
    end
```

## 5. 邊界案例（灰色地帶判定）

```mermaid
flowchart TD
    Case[/灰色地帶情境/] --> Q{哪種？}
    Q -- 維度數字 --> C1["可以：「地圖 25×18」「三層迷霧」<br/>不可以：MAP_W=25、const LAYERS=3<br/>判準：數字保留原則（§3）"]
    Q -- 檔名引用 --> C2["可以：「屍體互動發放掉落物（見 實體與介面.md）」<br/>不可以：### Corpse（corpse.gd）：首互動發 loot<br/>判準：章節標題用行為名（§3）"]
    Q -- 測試描述 --> C3["可以：「39 個 headless smoke 驗戰鬥／移動／AI 規則」<br/>不可以：npx playwright test、scripts/ci/run_smoke.sh（屬 SOP）<br/>判準：測試／配置歸屬（§3）"]
    Q -- 動機偽裝 --> C4["可以：「裝備寫回戰鬥數值」（陳述事實）<br/>不可以：「為了確保戰鬥一致性，裝備寫回數值」<br/>判準：R2 不揣測意圖"]
```

## 6. 與其他文件的關係

```mermaid
flowchart TD
    This["DOCS.md"]
    This --> R1a["SKILL §5：規範 docs/ 的寫入權（預設不得改，須授權）<br/>本檔規範寫法品質 · 正交不衝突"]
    This --> R2a["SKILL §8：框架檔結構含本檔"]
    This --> R3a["SKILL §3：開發後 AUDITOR 對照 G1 驗收<br/>文件化工作裡 AUDITOR MAY 引用本檔作為 docs/ 驗收尺"]
    This --> R4a["assets/SOP.md §1.3：SOP 保留真實路徑／命令／行號<br/>與本檔 R3 分工（見 §0）"]
    This --> R5a["references/AUDITOR.md：本檔不取代 AUDITOR 主導的 G1 驗收"]
```
