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
例：`001.計畫：R2反完成（待閘門） | 001.開發：R1正進行中`

## 3. 子代理策略

計畫：diverge_count=<N> | 開發：sub_agent_strategy=<描述> | 驗收：audit_angles=<覆蓋率/一致性>

## 4. 技術債清單

| 編號 | 來源 | 描述 | 建議行動 |
|------|------|------|----------|

## 5. FAIL 紀錄
（同行為 FAIL 重計數：R2 產出為起始基線，覆寫不重建）

## 6. 待收尾整理
## 目錄

嵌套：`<slug>/<NNN>/<產物>-r{n}.md` | 全域：`.shiftblame/PRD/` `.shiftblame/PID/` `.shiftblame/SOP.md`

## 產物格式

### 正方 R1（stance=pro, loop_round=1）
FM: `slug|round|loop_round:1|stance:pro|status:<PLANNED|DEVELOPED|VERIFIED>|created_at|trigger`
正文：階段生命週期→行為內容（計畫:5W1H+變更清單+殘餘風險 / 開發:實作項目+變更摘要 / 驗收:GWT+綜合結論）

### 正方 R2（stance=pro, loop_round=2）
同 R1 + 新增 `## R1 修正紀錄`（質疑編號/力度/接受駁回/說明）

### 反方 R1（stance=con, loop_round=1）
FM: `slug|round|loop_round:1|stance:con|created_at|trigger`
正文：階段生命週期→質疑摘要→質疑發現（C/D編號+力度 H/M/L+描述+證據）→結論（風險+建議）

### 反方 R2（stance=con, loop_round=2）
同 R1 + `## R1 遺留追蹤`（質疑編號/R1力度/R2正方回應/殘餘風險）+ `## 差異審計`
