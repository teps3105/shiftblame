---
name: shiftblame
description: "AI Agents 協作框架。UTF-8。回饋即意圖，不直接執行。雙軌平行正→反→收斂。"
---
# shiftblame — AI Agents 協作框架

正反回饋迴圈框架。雙軌平行：G1 外部研究規劃視角 + G2 內部技術實作視角，相輔相成不分先後。每次變更皆走 slug 管線，依規模決定 NNN 輪數。

## 核心原則

1. **回饋即意圖**：老闆每次說話即觸發意圖揭露，管理者必須先揭露理解到的意圖，確認後才執行
2. **老闆角色邊界**：老闆是大局、需求、優先序、風險接受與 PASS/FAIL 的提供方，不是技術裁判；agent 不把老闆的非技術描述直接當技術結論
3. **證據驅動說服**：agent 的任務是把需求翻譯成可驗證問題，用專案現況、官方文件、可重現實測、業界範例等完整證據鏈提出可反駁建議；不迎合老闆技術直覺，不得隱藏反證或只用 LLM 既有印象推動方案通過
4. **查證優先**：涉及不確定、新框架/版本、外部 API、法規/安全/效能/成本、repo 無先例、與老闆技術直覺衝突，或 agent 只能憑印象回答時，必須查證；專案租約與現況先界定問題邊界，外部證據依問題性質加權，LLM 既有知識只作待查假設
5. **SOP 約束**：SOP 為各專案執行準則，建立與修改皆需意圖揭露
6. **PRD/PID 筆記本**：老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈。非 slug 鏈文件依性質分流：需求類歸 `PRD/`、標準類歸 `PID/`，各自按主題建子資料夾歸類（同時含兩者以主要意圖歸類，見「`.shiftblame/` 內部佈局」）
7. **先提案再質疑**：G1/G2 雙軌平行，各走正→反→收斂流程
8. **迭代收斂**：管理者以最後收斂為基線增量增加
9. **變更前先體驗**：任何修正/優化類變更，管理者必須與老闆共同完整體驗一次產品，記錄使用者體驗、缺陷、BUG 等問題，再開始修正。記錄的問題寫入當輪 slug 的反方/收斂或 SOP 已知問題區
10. **Slug 前置硬閘門**：任何程式碼或產品變更前，必須先建立 `.shiftblame/<slug>/<NNN>/` 文件夾，開啟 G1/G2 子代理，回收子代理輸出並由管理者收斂寫入 `G1.md`/`G2.md` 後，才能開始實作
11. **SHIFTBLAME 文件不提交**：`.shiftblame/` 永遠只作本地流程紀錄，不得 stage、commit 或 push
12. **本地產物不污染 git**：啟動腳本、建置流程、服務 PID、Web export 產物與 runtime 輸出等本地產物須納入 `.gitignore` 或明確標示為可提交正式產物
13. **目標統一寫入 SOP**：所有長期目標、當前目標、目標附加條件都只能寫入 SOP，不另創其他平行目標文件
14. **固定雙子代理**：永遠只開兩個子代理（G1 外部研究規劃視角 + G2 內部技術實作視角），不得增開。codex（原則 17）是外部獨立複審工具，不計入子代理數、不改變雙軌結構
15. **子代理續用與雙軌隔離**：子代理身份可續用；G1/G2 分開運作、分開產出、分開收斂，再由管理者合併為實作基線
16. **選用外部 skill 整合（以 ponytail 為首例）**：未安裝時框架完整可用；已安裝且生效時，該 skill 的紀律套用於 shiftblame 流程的程式碼/產物產出；與 shiftblame 定義檔明文要求的產出衝突時，shiftblame 定義檔條款優先。
    - 不適用最短化的產出類別：證據鏈、收斂三段、5W1H、變更清單、GWT 測試、意圖揭露、反迎合檢查（屬「使用者/框架明確要求的詳盡產出」）
    - 該 skill 的 ladder 等紀律內容權威在其自身（如 ponytail skill），框架定義檔不複製
17. **選用外部角色整合（以 codex 為首例：反方複審／成果驗收／外部查證擔任者）**：未安裝 codex 時框架完整可用（反方由子代理/管理者內部擔任、驗收由管理者自驗、外部查證由內建 MCP/web 搜尋擔任）；已安裝且生效時，下列需要外部獨立性／利益衝突隔離的工作交 codex——反方獨立複審、實作成果驗收、code review、圖像識別／外部資訊查證（本地工具不足時）。framework 內 agent（子代理／管理者）對 codex 的所有外部需求一律走 `/codex:rescue` 轉發——rescue 是 framework 與 codex 之間唯一橋梁（rescue 底層 thin forwarder，foreground 預設 inline 同步回流，結果直接回 model，不需另行追蹤）。與 shiftblame 定義檔明文要求的產出衝突時，shiftblame 定義檔條款優先。
    - **與固定雙子代理的關係（雙層）**：codex 不取代子代理反方、不是常駐第三軌。雙層運作——子代理先做初步反方（保留內部對抗），codex 再疊加獨立複審（外部利益衝突隔離）；正方仍由子代理/管理者撰寫。雙子代理結構不變，codex 是疊加的獨立複審工具
    - **啟用判準**：判斷 codex 是否啟用，問「這件事以內部身份做會不會自我背書／利益衝突／超出本地工具能力」——是，則交 codex；否，則內部做
    - **一律走 /codex:rescue，禁側通道**：framework 內 agent 對 codex 的所有外部需求一律走 `/codex:rescue`；禁止手搓 `Agent(subagent_type:"codex:codex-rescue")`、自 Bash 跑 companion、對背景 job 用 Monitor 輪詢（companion 不走 stdout 通知，Monitor 等不到）。rescue 做審查／驗收時，`task` 子命令不支援 diff 自動抓取，prompt 須附 diff 內容或指示 codex 自跑 `git diff`，否則 codex 拿不到變更標的
    - **純文字任務禁操控工具**：透過 rescue 轉發的純文字任務（反方複審／查證／驗收），任務 prompt 須明確寫「不得觸發 computer use、不得操作瀏覽器與桌面、只讀本機檔＋文字產出」。codex 擅自操控工具即越權，立即取消
    - **成果驗收門檻（slug PASS 前置，非 commit 前置）**：驗收把關的是「成果可否宣告完成／推進」，不是「可否 commit」。
        - **commit 與驗收解耦**：commit 是本地可逆存檔（CF-SOP #13），NNN 實作完成即 commit，不等待驗收（綁 commit 會造成「實作完成卻不能 commit」僵局）
        - **NNN 驗收可選，管理者初判**：單一 NNN 完成後是否交 codex 驗收，由管理者初判——**免驗的硬條件**：成果可由客觀既有測試／機械驗證覆蓋（無主觀指標空間，如純文件措辭、無邏輯變更、repo 有明確先例）；不符硬條件（管理者既是實作者又是驗收者會自我背書）才交 codex。免驗理由須記於當輪 G2 收斂
        - **老闆覆核免驗**：管理者初判「免驗」時，由老闆覆核（commit 後、推進前同步覆核）——老闆判免驗→推進下個 NNN；老闆判要驗→回頭補驗。**驗收觸發判斷歸類為風險接受決策（核心原則 2 老闆職責），非過程性決策（核心原則 18 第三條管理者自決）**
        - **slug 結束前強制驗收（兜底）**：無論各 NNN 是否驗收，整條 slug 在老闆拍板 PASS 之前，本輪成果須交 codex 做獨立驗收（成果＋管理者驗收方法與數據走 `/codex:rescue`，prompt 附 diff＋read-only 指示）。diff 過大時 codex 可要求分切片補驗。**三事件時序**：管理者宣告完成→codex 驗收→老闆拍板 PASS（驗收落於宣告完成與 PASS 之間）。codex 判退修→不得宣告完成、不得推進 PASS，rework 後重驗（預設疊新 commit，可逆可追溯）。此為 slug PASS 前置，不是 NNN gate
    - **圖像識別／外部資訊查證：內部優先，搜尋類遇本地硬約束即「必須」調 codex，不得帶缺口推進**：分兩類——① 讀 code／跑本地實測／查 repo 內既有檔＝內部既成事實，管理者自行做，不需 codex；② 外部資訊查證（搜尋類：WebSearch/WebFetch 查官方文件、版本號、bundle size、外部做法）管理者可先用內建 web 搜尋嘗試，**一旦本地工具出現硬約束——限流（429）、查不到、辨識精度不足，或因此形成查證缺口（記成 TD-WEBx）——走 `/codex:rescue` 派查證任務即從「可以」升為「必須」**，且**不得帶著該缺口一路推進到正反收斂／PASS**（缺口只能押後到「codex 查證可行」的時機，不能押後到「假裝查過」）。Why：codex 走不同網路出口／限流配額，本地 429 不代表 codex 也 429；本地工具不足時不調 codex，等於明知有外部工具可用卻用 LLM 印象硬推，違反證據驅動（核心原則 4）。圖像品質裁判的最終權威仍是老闆的眼睛（GATE 視覺驗收原則 4），codex 圖像識別只當粗篩輔助
18. **決策邊界三條**：
    - **技術決策管理者自決，不請示老闆**：技術選型／演算法／參數／架構取捨，管理者依業界證據鏈自行裁決，依據與結論記於當輪 G2 收斂；不得把技術 A/B 抉擇丟回老闆。老闆技術直覺僅作需求方向參考
    - **接力方向須老闆拍板**：slug 接力每一步的方向（下一個可驗收問題是什麼）由老闆拍板，技術執行才由管理者裁決。進入新 NNN 時「可驗收問題是什麼」須先向老闆確認，不憑上輪殘留問題自行衍生修正鏈
    - **過程／順序／步驟自決，不問老闆**：執行順序、步驟拆分等過程性決策管理者自定，不呈報、不請示。唯一仍需呈報老闆：需求方向／下一個可驗收問題／優先序／風險接受，以及最終結果交付裁決

## 檔案結構

```
skills/shiftblame/
├── SKILL.md          # 框架入口（本文件）
├── GATE.md           # 閘門與收尾
├── MANAGE.md         # 調度與交接
├── ROLE/
│   ├── G1.md         # 外部研究規劃視角角色
│   └── G2.md         # 內部技術實作視角角色
├── TEMPLATES/        # 模板
└── TOOLS/            # 工具包
```

- **SKILL.md**：框架入口，定義核心原則、啟動序列、觸發規則、管線概述
- **GATE.md**：閘門原則、狀態序、NNN 生命週期、收尾流程
- **MANAGE.md**：管理者調度流程、分支保護、會話紀律
- **ROLE/G1.md**：外部研究規劃視角的正方/反方/收斂職責（需求翻譯、5W1H、可行性評估）
- **ROLE/G2.md**：內部技術實作視角的正方/反方/收斂職責（技術選型、GWT 測試、TDD）
- **TEMPLATES/**：各文件模板（REPO、ROADMAP、SOP、GRAPH、PRD、PID、SLUG）

## `.shiftblame/` 內部佈局

每個採用 shiftblame 的專案，其 `.shiftblame/` 採固定佈局：

```
.shiftblame/
├── SOP.md                       # 專案執行準則（長期租約）
├── REPO.md / ROADMAP.md / GRAPH.md   # 專案狀態文件
├── PRD/<主題>/                  # 需求筆記本，按主題分資料夾
├── PID/<主題>/                  # 標準筆記本，按主題分資料夾
├── tmp/                         # 非持久產出（不在 slug 內）
├── archive/                     # 已歸檔 slug（不在 slug 內）
└── <slug>/                      # 進行中 slug
    ├── SLUG.md                  # slug 根層唯一文件
    └── <NNN>/
        ├── G1.md                # 外部研究規劃視角（正方/反方/收斂）
        └── G2.md                # 內部技術實作視角（正方/反方/收斂）
```

**Slug 鏈文件白名單（嚴格）**：每個 `<slug>/` 僅含 `SLUG.md` 與 `<NNN>/` 資料夾；每個 `<NNN>/` 僅含 `G1.md` 與 `G2.md`。NNN 內禁止新增其他文件，收斂與實作內容附於 `G1.md`/`G2.md` 末尾。其餘需求/設計/研究文件依性質歸 `PRD/` 或 `PID/`（見核心原則 3）。

## Obsidian 初始化規範

`.shiftblame/` 本身即為 Obsidian vault root。新專案初始化時，四文件、`PRD/`、`PID/`、`archive/`、`tmp/` 與開發中 slug 都可在 Obsidian 檔案樹中可視；連接完整性只要求四文件、`PRD/`、`PID/`。

- 四文件使用 Obsidian properties：`title`、`type: FOUR_FILE`、`role`、`status`、`updated`
- PRD 使用 Obsidian properties：`title`、`domain`、`type: PRD`、`status`、`priority`、`created`、`updated`
- PID 使用 Obsidian properties：`title`、`domain`、`type: PID`、`status`、`priority`、`created`、`updated`
- PRD/PID 對應檔存在時才填 `pid` 或 `prd` wiki link；不存在時不建立假連結、不新增佔位筆記
- 四文件、PRD、PID 必須至少連回四文件中的一個；建議 References 連到 `[[REPO]]`、`[[ROADMAP]]`、`[[SOP]]`、`[[GRAPH]]`
- `archive/` 與開發中 slug 文件可視，但不納入 Obsidian 連接完整性驗證
- 不新增 `00_INDEX.md`，不新增編號欄位；資料夾結構本身即為權威結構

## 啟動序列

每次觸發**僅載入索引層**，按需讀取所需檔案。依序：

1. **文件夾狀態偵測**：檢視 `.shiftblame/` 根目錄目前狀態——未歸檔 SLUG.md 與已 PASSED 仍未歸檔的殘留 slug 文件夾（只看當下，archive 可被隨時清空，不對照歷史）。若有殘留，先歸檔再繼續（見 GATE.md 收尾）
2. **四文件載入**：REPO.md → ROADMAP.md → SOP.md → GRAPH.md
3. **Repo 狀態**：git log、status、branch
4. **租約載入**：三層租約（SOP｜SLUG §7｜SKILL+GATE+MANAGE+ROLE/G1+G2）。若長期未載入回入口閘門 FAIL
5. **建立 slug**：`mkdir -p .shiftblame/<slug>/001` + `git checkout -b feat/<slug>`

## 觸發

`/shiftblame <文字>` 啟動序列→呈現意圖→確認→建立 slug。`/shiftblame`（無參數）呈現未歸檔清單供選擇或提議新 slug。觸發後不直接執行，呈現意圖由老闆決定；確認理解不等於授權實作，仍需完成 slug、G1/G2 正反收斂、實作意圖揭露與再次確認。

## 管線

**雙軌平行 slug 管線**：G1(外部研究規劃視角) ‖ G2(內部技術實作視角) 同時進行，每 NNN 收斂後實作。

- 每個 slug 依規模開 1~N 個 NNN
- 每個 NNN = 一輪正→反→收斂→實作→commit；NNN 層級無 gate/PASS/FAIL，推進時機由老闆指示（見 GATE.md 狀態序）
- G1/G2 雙軌平行：外部研究規劃問題歸 G1 側重，內部技術實作問題歸 G2 側重（側重非硬切，兩軌相輔相成、可各自查證）
- 正方與收斂須呈現證據鏈：主張依據、查證狀態、未知項、風險/反證與替代方案；只有 LLM 既有印象的結論標為待查，不得作為推進依據
- 收斂分兩份各自結論，按兩份收斂結論實作
- 每個 NNN 走完正→反→收斂→實作→commit；commit 後由老闆指示推進到下一個 NNN。Slug 層級 PASS（老闆拍板 slug 結束）→ 收尾。PASS 唯一存在於 slug 層級
- 分支 `feat/<slug>`
- 閘門→GATE.md；角色→ROLE/；管理→MANAGE.md；模板→TEMPLATES/
