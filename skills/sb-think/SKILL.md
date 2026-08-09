---
name: sb-think
description: 唯一閘口；所有老闆輸入第一步路由回此，不字面執行指令，先理解意圖再分發。
---
# sb-think — 唯一閘口

> **本指令在流程中的位置**：老闆任何輸入的第一站——責任轉移線，think 之前是老闆的鍋，think 之後是 agents 的鍋

```mermaid
sequenceDiagram
    participant B as 老闆
    participant T as sb-think
    participant A as agents

    Note over B: 老闆責任區<br/>意圖沒打磨好是老闆的鍋

    B->>T: 任何輸入（指令名或自然語言）

    Note over T: ═══ 責任轉移線 ═══<br/>① 載入脈絡（SOP/ROADMAP/archive/當前slug）<br/>② 不字面執行 先理解背後意圖<br/>③ 結構化呈現理解

    T->>B: 呈現「我理解你要什麼」
    B-->>T: 確認／修正（反覆打磨至滿意）

    Note over T: 老闆滿意後分發
    T->>A: 分發到對應流程

    Note over A: agents 責任區<br/>事情沒做好是 agents 的鍋

    loop 執行中
        A->>A: 自主判斷：這需要老闆決策嗎？
        alt 不需要 · 常態修正／技術細節
            A->>A: 自主處理 不回 sb-think
        else 需要 · PASS／開新ms／重大例外／路由變更
            A-->>T: 路由回 sb-think
            T->>B: 呈現決策點
            B-->>T: 拍板
            T->>A: 重新分發
        end
    end
```

## 絕對規則

**所有老闆輸入第一步一定是路由回 sb-think，而不是字面指令。** 無論老闆輸入什麼——`sb-do`、`sb-save`、`sb-start`、自然語言、甚至一長串計畫書——agents 不直接執行字面指令，先回 sb-think 理解背後意圖。

- **指令字面 ≠ 老闆意圖。** 老闆可能打錯指令、意圖不同於指令字面、或需要附帶條件。sb-think 的職責是揭開字面背後的意圖，不假設「打了什麼就是要做什麼」。
- **沒有任何輸入能繞過理解。** 即使老闆附帶一長串計畫書，sb-think 仍要把計畫書結構化映射成可驗證的需求理解讓老闆確認——計畫書可能含矛盾、遺漏邊界、混入解法、或過度設計。
- **脈絡與字面衝突時，sb-think 浮現張力。** 例如老闆打「開新需求」卻偵測到未完成的儲存點——sb-think 把這個張力呈現給老闆裁決，不自行猜測或字面執行。

## 責任模型

```mermaid
flowchart LR
    Z1["sb-think 之前<br/>老闆責任<br/>意圖沒打磨好 = 老闆的鍋"]
    Z2["═══ sb-think ═══"]
    Z3["sb-think 之後<br/>agents 責任<br/>事情沒做好 = agents 的鍋"]
    Z1 --> Z2 --> Z3
```

sb-think 是老闆與 agents 之間的權責交接面，不是流程裡的一個步驟。過了這條線，球就在 agents 那邊。

## sb-think 內部流程

```mermaid
sequenceDiagram
    participant B as 老闆
    participant T as sb-think

    B->>T: 輸入（任何指令名或自然語言）
    Note over T: ① 載入脈絡<br/>SOP／ROADMAP／archive／當前 slug（§9）
    Note over T: ② 意圖結構化<br/>六欄呈現（命題/翻譯/邊界/<br/>候選方案/修改範圍/授權狀態）
    T->>B: 呈現理解（圖表 + 結構化）
    B-->>T: 審視
    alt 理解有誤／遺漏／要追加修改
        Note over T: ③ 修正理解
        T->>B: 重新呈現
        B-->>T: 再次審視
    else 滿意
        Note over T: ④ 分發 · 老闆拍板路由
    end
```

關鍵原則：

- **無差別理解，不預判深度。** sb-think 對所有意圖做同一件事——忠實結構化呈現「我理解老闆要做什麼」。不因操作類型預判「這次不用認真理解」——任何意圖都可能被錯漏。
- **深度由老闆滿意度決定。** 新需求自然打磨多輪，放行確認可能一輪就過——但這是老闆的產出，不是 sb-think 的預判。
- **意圖結構化涵蓋六欄。** sb-think 的結構化呈現涵蓋六欄（原始命題、意圖翻譯、邊界／未知、候選方案、預計修改、授權狀態），轉為圖表結構。

## 分發路由

老闆確認理解正確後，sb-think 分發到對應流程。**分發新需求時依 SKILL §0.1 規模分級提議級別（S/M/L）**——判準速查：S 級＝無行為變化／單點低風險；M 級＝單一功能行為有變；L 級＝多功能／跨層／介面契約改變。級別與路由一起由老闆拍板，記入 SLUG §4。

```mermaid
flowchart LR
    T["sb-think 老闆滿意"] --> R{"路由"}
    R -- "新需求（M/L 級）" --> S["sb-start<br/>建骨架 → 制衡"]
    R -- "S 級微修" --> D7["直接實行"]
    R -- 放行 --> D1["sb-do"]
    R -- 存檔 --> D2["sb-save"]
    R -- 恢復 --> D3["sb-resume"]
    R -- 結束 --> D4["sb-end"]
    R -- 丟棄 --> D5["sb-dice"]
    R -- 改文件 --> D6["sb-docs/sop/roadmap"]
    R -- 框架演化 --> D8["改框架"]
```

sb-start、sb-do、sb-save 等都是 sb-think 分發後的執行目標，老闆不直達——任何輸入第一步都路由回 sb-think。

## 執行中的自主性

sb-think 分發後，agents 在執行中保有自主判斷權：

- **不需要老闆決策**（常態修正、技術細節、繼續推進）→ agents 自主處理，**不路由回 sb-think**。
- **需要老闆決策**（PASS、開新 ms、重大例外、路由變更）→ 統一路由回 sb-think，老闆確認後才重新分派。

agents 不是無腦執行器——判斷「要不要回 sb-think」本身就是 agents 的職責。這個判斷權沒被沒收；被收緊的是入口端，agents 不能再「看到老闆指令就直接啟動」。

## 邊界

- **sb-think 是閘口，不是執行器。** 它只做理解、對齊、分發；實際執行（建骨架、開發、存檔等）由分發目標負責。
- **所有輸入無一例外過 sb-think。** 包含老闆附帶的計畫書、簡單確認操作、自然語言意圖。
- **sb-think 承載意圖揭露職責。** 意圖理解與揭露由 sb-think 的圖表結構化呈現承載（§2 定義 checkpoint 與授權原則）。
- **sb-think 產出不留實體文件。** 圖表是討論載體，對齊完直接進流程；理解過程不留檔。
- **路由由老闆決定。** sb-think 可附帶路由建議（基於 §9 脈絡），但最終路由由老闆拍板。
