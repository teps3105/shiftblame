---
name: shiftblame
description: "AI Agents 協作框架。UTF-8。回饋即意圖，不直接執行。二出口×正→反→收斂＋體驗者獨立產出。"
---
# shiftblame — AI Agents 協作框架

正反回饋迴圈框架。雙模式：slug 管線 + 簡易模式。會話由老闆自由管理。

## 核心原則

1. **回饋即意圖**：老闆每次說話即觸發意圖揭露，管理者必須先揭露理解到的意圖，確認後才執行
2. **SOP 約束**：可更新 SOP 作為全局標準，建立與修改皆需意圖揭露
3. **PRD/PID 筆記本**：老闆的筆記本，agent 可參考與協助整理，不進 slug 鏈
4. **先提案再質疑**：G1/G2 各走正→反→收斂流程；體驗者階段獨立產出 FEATURE.md
5. **迭代收斂**：管理者以最後收斂為基線增量增加

## 檔案結構

```
skills/shiftblame/
├── SKILL.md          # 框架入口（本文件）
├── GATE.md           # 閘門與收尾
├── MANAGE.md         # 調度與交接
├── EXPERIENCE.md     # 產品體驗
├── ROLE/
│   ├── G1.md         # 計畫出口角色
│   └── G2.md         # 開發出口角色
├── TEMPLATES/        # 模板
└── TOOLS/            # 工具包
```

- **SKILL.md**：框架入口，定義核心原則、啟動序列、觸發規則、出口迴圈概述
- **GATE.md**：閘門原則、狀態序、閘門生命週期、收尾流程
- **MANAGE.md**：管理者調度流程、分支保護、會話紀律
- **EXPERIENCE.md**：體驗者職責、體驗流程、產出品質規範
- **ROLE/G1.md**：計畫出口的正方/反方/收斂職責（需求翻譯、5W1H、可行性評估）
- **ROLE/G2.md**：開發出口的正方/反方/收斂職責（技術選型、GWT 測試、TDD）
- **TEMPLATES/**：各文件模板（REPO、ROADMAP、SOP、GRAPH、PRD、PID、SLUG、FEATURE）

## 啟動序列

每次觸發**僅載入索引層**，按需讀取所需檔案。依序：

1. **未歸檔偵測**：掃描 `.shiftblame/` 下未歸檔 SLUG.md
2. **四文件載入**：REPO.md → ROADMAP.md → SOP.md → GRAPH.md
3. **Repo 狀態**：git log、status、branch
4. **租約載入**：slug 管線載入三層租約（SOP｜SLUG §7｜閘門對應之 ROLE/G1.md 或 ROLE/G2.md + SKILL+GATE+MANAGE+EXPERIENCE）；簡易模式載入 SOP（長期）+ SKILL+GATE+MANAGE+EXPERIENCE（短期）。若長期未載入回入口閘門 FAIL
5. **模式判斷**：老闆確認時指定 slug 管線或簡易模式。簡易模式同角色分工但不開 slug、不開分支、無 G(n).md，直接在 main commit

## 觸發

`/shiftblame <文字>` 啟動序列→呈現意圖（含模式）→確認→分流。`/shiftblame`（無參數）呈現未歸檔清單供選擇或提議新 slug。觸發後不直接執行，呈現意圖須含執行模式，由老闆決定。

## 出口迴圈

**Slug 管線**：G1(計畫)→G2(開發 NNN)→體驗者獨立完成(FEATURE.md)→管理者收尾。

- G1/G2 各走正→反→收斂流程（正方提案→反方質疑→管理者收斂）
- G2 為 NNN 迭代出口，收斂後提交；體驗者不提交；收尾時管理者提交文件更新
- 分支 `feat/<slug>`
- 閘門→GATE.md；角色→ROLE/；管理→MANAGE.md；體驗→EXPERIENCE.md；模板→TEMPLATES/

**簡易模式**：START（不可跳過）→正方多子代理多視角提案→反方多子代理多視角質疑→管理者收斂（含執行變更）→老闆 PASS→管理者在 main commit（僅 repo 檔案）。同角色分工，不開 slug、不開分支、無 G(n).md。觸發權在老闆。FAIL 以收斂為基線增量增加。
