---
name: shiftblame
description: "AI Agents 協作框架。UTF-8。回饋即意圖，不直接執行。雙軌平行正→反→收斂。"
---
# shiftblame — AI Agents 協作框架

正反回饋迴圈框架。雙軌平行：G1 計畫視角 + G2 技術視角。每次變更皆走 slug 管線，依規模決定 NNN 輪數。

## 核心原則

1. **回饋即意圖**：老闆每次說話即觸發意圖揭露，管理者必須先揭露理解到的意圖，確認後才執行
2. **SOP 約束**：可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
3. **PRD/PID 筆記本**：老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈
4. **先提案再質疑**：G1/G2 雙軌平行，各走正→反→收斂流程
5. **迭代收斂**：管理者以最後收斂為基線增量增加

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

## 啟動序列

每次觸發**僅載入索引層**，按需讀取所需檔案。依序：

1. **未歸檔偵測**：掃描 `.shiftblame/` 下未歸檔 SLUG.md
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
