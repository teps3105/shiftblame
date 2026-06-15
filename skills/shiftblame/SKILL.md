---
name: shiftblame
description: "AI Agents 協作框架。UTF-8。回饋即意圖，不直接執行。雙軌平行正→反→收斂。"
---
# shiftblame — AI Agents 協作框架

正反回饋迴圈框架。雙軌平行：G1 計畫視角 + G2 技術視角。每次變更皆走 slug 管線，依規模決定 NNN 輪數。

## 核心原則

1. **回饋即意圖**：老闆每次說話即觸發意圖揭露，管理者必須先揭露理解到的意圖，確認後才執行
2. **SOP 約束**：SOP 為各專案執行準則，建立與修改皆需意圖揭露
3. **PRD/PID 筆記本**：老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈。非 slug 鏈文件依性質分流：需求類歸 `PRD/`、標準類歸 `PID/`，各自按主題建子資料夾歸類（同時含兩者以主要意圖歸類，見「`.shiftblame/` 內部佈局」）
4. **先提案再質疑**：G1/G2 雙軌平行，各走正→反→收斂流程
5. **迭代收斂**：管理者以最後收斂為基線增量增加
6. **變更前先體驗**：任何修正/優化類變更，管理者必須與老闆共同完整體驗一次產品，記錄使用者體驗、缺陷、BUG 等問題，再開始修正。記錄的問題寫入當輪 slug 的反方/收斂或 SOP 已知問題區
7. **Slug 前置硬閘門**：任何程式碼或產品變更前，必須先建立 `.shiftblame/<slug>/<NNN>/` 文件夾，開啟 G1/G2 子代理，回收子代理輸出並由管理者收斂寫入 `G1.md`/`G2.md` 後，才能開始實作
8. **SHIFTBLAME 文件不提交**：`.shiftblame/` 永遠只作本地流程紀錄，不得 stage、commit 或 push
9. **本地產物不污染 git**：啟動腳本、建置流程、服務 PID、Web export 產物與 runtime 輸出等本地產物須納入 `.gitignore` 或明確標示為可提交正式產物
10. **目標統一寫入 SOP**：所有長期目標、當前目標、目標附加條件都只能寫入 SOP，不另創其他平行目標文件
11. **固定雙子代理**：永遠只開兩個子代理（G1 計畫視角 + G2 技術視角），不得增開
12. **子代理續用與雙軌隔離**：子代理身份可續用；G1/G2 分開運作、分開產出、分開收斂，再由管理者合併為實作基線

## 檔案結構

```
skills/shiftblame/
├── SKILL.md          # 框架入口（本文件）
├── GATE.md           # 閘門與收尾
├── MANAGE.md         # 調度與交接
├── ROLE/
│   ├── G1.md         # 計畫視角角色
│   └── G2.md         # 技術視角角色
├── TEMPLATES/        # 模板
└── TOOLS/            # 工具包
```

- **SKILL.md**：框架入口，定義核心原則、啟動序列、觸發規則、管線概述
- **GATE.md**：閘門原則、狀態序、NNN 生命週期、收尾流程
- **MANAGE.md**：管理者調度流程、分支保護、會話紀律
- **ROLE/G1.md**：計畫視角的正方/反方/收斂職責（需求翻譯、5W1H、可行性評估）
- **ROLE/G2.md**：技術視角的正方/反方/收斂職責（技術選型、GWT 測試、TDD）
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
        ├── G1.md                # 計畫視角（正方/反方/收斂）
        └── G2.md                # 技術視角（正方/反方/收斂）
```

**Slug 鏈文件白名單（嚴格）**：每個 `<slug>/` 僅含 `SLUG.md` 與 `<NNN>/` 資料夾；每個 `<NNN>/` 僅含 `G1.md` 與 `G2.md`。NNN 內禁止新增其他文件，收斂與實作內容附於 `G1.md`/`G2.md` 末尾。其餘需求/設計/研究文件依性質歸 `PRD/` 或 `PID/`（見核心原則 3）。

## 啟動序列

每次觸發**僅載入索引層**，按需讀取所需檔案。依序：

1. **文件夾狀態偵測**：檢視 `.shiftblame/` 根目錄目前狀態——未歸檔 SLUG.md 與已 PASSED 仍未歸檔的殘留 slug 文件夾（只看當下，archive 可被隨時清空，不對照歷史）。若有殘留，先歸檔再繼續（見 GATE.md 收尾）
2. **四文件載入**：REPO.md → ROADMAP.md → SOP.md → GRAPH.md
3. **Repo 狀態**：git log、status、branch
4. **租約載入**：三層租約（SOP｜SLUG §7｜SKILL+GATE+MANAGE+ROLE/G1+G2）。若長期未載入回入口閘門 FAIL
5. **建立 slug**：`mkdir -p .shiftblame/<slug>/001` + `git checkout -b feat/<slug>`

## 觸發

`/shiftblame <文字>` 啟動序列→呈現意圖→確認→建立 slug。`/shiftblame`（無參數）呈現未歸檔清單供選擇或提議新 slug。觸發後不直接執行，呈現意圖由老闆決定。

## 管線

**雙軌平行 slug 管線**：G1(計畫視角) ‖ G2(技術視角) 同時進行，每 NNN 收斂後實作。

- 每個 slug 依規模開 1~N 個 NNN
- 每個 NNN = 一輪正→反→收斂
- G1/G2 雙軌平行：計畫問題歸 G1，技術問題歸 G2
- 收斂分兩份各自結論，按兩份收斂結論實作
- NNN PASS → commit；FAIL → 開新 NNN 以收斂為基線增量增加
- 分支 `feat/<slug>`
- 閘門→GATE.md；角色→ROLE/；管理→MANAGE.md；模板→TEMPLATES/
