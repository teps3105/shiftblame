---
slug: <slug>
status: in_progress
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---

# <slug>

## 1. 本輪目標

（管理者填入本輪的功能目標）

## 2. 行為狀態紀錄

格式：`<NNN>.<行為>：<R1正/R1反/R2正/R2反 狀態>`
例：`001.計畫：R2反完成（待閘門） | 001.辯論：R1正進行中`

## 3. 子代理策略

計畫：diverge_count=<N> | 開發：sub_agent_strategy=<描述> | 驗收：audit_angles=<覆蓋率/一致性>

## 4. 技術債清單

| 編號 | 來源 | 描述 | 建議行動 |
|------|------|------|----------|

## 5. FAIL 紀錄

（同行為 FAIL 重計數：R2 產出為起始基線，覆寫不重建）

## 6. 辯論總結

首次使用時此欄位留空。管理者在 G4 閘門前以白話填入 3~5 行，說明雙方辯出了什麼結論與分歧。例：
> 「正方建議優先處理 X 技術債，反方質疑時機不宜。雙方共識為收尾後開新 NNN 優先處理。」

## 7. 目錄與產物格式

嵌套：`<slug>/<NNN>/<產物>-r{n}.md` | 全域：`.shiftblame/PRD/` `.shiftblame/PID/` `.shiftblame/SOP.md`
**正方 R1** FM: `slug|round|loop_round:1|stance:pro|status:<PLANNED|DEVELOPED|VERIFIED|DEBATED>|created_at|trigger`；正文：階段生命週期→行為內容（計畫:5W1H+變更清單+殘餘風險 / 開發:實作項目 / 驗收:GWT / 辯論:方向+時機+範圍）
**正方 R2**：同 R1 + `## R1 修正紀錄`（質疑編號/力度/接受駁回/說明）
**反方 R1** FM: `slug|round|loop_round:1|stance:con|created_at|trigger`；正文：質疑發現（C/D編號+力度 H/M/L+描述+證據）→結論
**反方 R2**：同 R1 + `## R1 遺留追蹤` + `## 差異審計`
**辯論產物**：DEBATE-R1/R2 用正方格式（狀態 DEBATED）；OBJECTION-R1/R2 用反方格式
