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

格式：`<NNN>.<出口>：<正方/反方/收斂 狀態>` | 閘門：G1→G2→G3→G4
例：`001.計畫(G1)：收斂完成（待閘門） | 001.展望(G4)：正方進行中`

## 3. 子代理策略

計畫（G1）：diverge_count=<N> | 開發（G2）：sub_agent_strategy=<描述> | 驗收（G3）：audit_angles=<覆蓋率/一致性>

## 4. 技術債清單

| 編號 | 來源 | 描述 | 建議行動 |
|------|------|------|----------|

## 5. FAIL 紀錄

（同行為 FAIL：以收斂產出為起始基線重跑）

## 6. 交接摘要

首次使用時此欄位留空。G4 展望行為期間，管理者彙整 G4 正反方素材，以白話填入 3~5 行。下一輪 L0 前過去的老闆留下的記錄。例：
> 「正方展望處理 X，反方質疑時機。結論：收尾後開新 NNN 處理。」

## 7. 目錄與 G(n).md 格式

嵌套：`<slug>/<NNN>/G(n).md`（n=1~4）。FM：`slug|nnn|gate|status|created_at`；正文 3 section（正方提出→反方質疑→正方收斂），標題隱含 stance。質疑編號 D/E + 力度 H/M/L。status 值：PLANNED/DEVELOPED/VERIFIED/PROSPECTED。

## 8. 租約有效期

本節記錄 slug 期間新增的臨時規範（非功能目標、非交接摘要）。功能目標見第 1 節，交接摘要見第 6 節。
格式：`[租約編號] 規範描述 | 生效日期 | 升級至SOP / 隨歸檔失效`
歸檔前管理者須逐條標記處置方式。
範例：`[L1] 開發禁 commit 改為 G2 後可 commit | 2026-06-08 | 升級至SOP`
