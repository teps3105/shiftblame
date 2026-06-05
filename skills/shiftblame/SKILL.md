---
name: shiftblame
description: "AI Agents 協作框架。skills and docs encode: UTF-8。Use when: 開始(開始/start)→載入技能, 結束(結束/end)→載入技能, 雙對話(雙對話/規劃/文件/開發/維護/功能/新功能/品管/維運/品質校正)→雙對話制度。每個對話只執行一個階段。觸發(觸發/trigger/繼續/continue/接續/搜尋/未歸檔/新slug)→意圖確認。"
---
# shiftblame — AI Agents 協作框架

管理者由目前環境擔任，依雙對話制度協調研究品管（PM）與開發維運（DEV）交替迭代。雙對話制度：對話一負責 L0~L2（研究期/開發期），對話二負責 L3~L5（品管期/維運期），兩個對話不可混合。面向由對話階段自動綁定：研究期/開發期=研究/開發面向，品管期/維運期=品管/維運面向。L3 紅隊攻擊與 L4 藍隊防禦依複雜度在對話內執行或開子代理。

## 編碼規則

本技能、`.shiftblame/` 文件與所有 Markdown 產物一律使用 UTF-8。讀取或寫入任何含中文文件時，必須使用明確 UTF-8 編碼；禁止依賴 Windows/PowerShell/終端預設編碼。具體操作規則見 `MANAGE.md`「編碼規則」。

## 角色與派工

| 員工 | 身份 | 詳見 |
|------|------|------|
| 管理者 | 目前環境 | MANAGE.md |
| 執行者 | 依複雜度（對話內 / 子代理） | ROLE/{PM,DEV}/RESULT.md |
| 攻擊者 | 依複雜度（對話內 / 子代理） | ROLE/{PM,DEV}/RED.md |
| 防禦者 | 依複雜度（對話內 / 子代理） | ROLE/{PM,DEV}/BLUE.md |

角色職責詳見 `ROLE/{PM,DEV}/TASK.md`。面向差異詳見各角色定義檔的「面向差異」段。派工規格詳見 `MANAGE.md`。

| 部門 | 角色中文名 | 對話一（L0~L2） | 對話二（L3~L5） |
|------|----------|:-----------:|:-----------:|
| PM | 研究品管 | 研究期 | 品管期 |
| DEV | 開發維運 | 開發期 | 維運期 |

## 觸發規格

`/shiftblame` 後可接任意文字作為意圖線索，也可不接後標。

| 觸發方式 | 行為 |
|---------|------|
| `/shiftblame <任意文字>` | 後標為意圖線索 → 讀取上下文 → 呈現理解到的意圖 → 對話確認 → 進 L0 |
| `/shiftblame`（無後標，有未歸檔 SLUG.md） | 搜尋未歸檔 SLUG.md → 呈現清單 → 老闆選擇 → 確認意圖 |
| `/shiftblame`（無後標，無未歸檔 slug） | 新 slug 溝通模式 → 分析 REPO.md / ROADMAP.md / PID.md / GRAPH.md → 提議下一個 slug → 對話確認 |

**規則**：觸發後不直接執行，先與老闆對話確認意圖。意圖確認完成後才進入 L0 規劃確認。

## 入口導流

| 情境 | 必讀 |
|------|------|
| 閘門/狀態機 | `GATE.md` |
| 管理者操作 | `MANAGE.md` |
| PM 角色上下文 | `ROLE/PM/{PLAN,TASK,RESULT,RED,BLUE,CONCLUSION}.md` |
| DEV 角色上下文 | `ROLE/DEV/{PLAN,TASK,RESULT,RED,BLUE,CONCLUSION}.md` |
| 文件模板 | `TEMPLATES/` |
| 工具包 | `TOOLS/` |

## 模式

**雙對話制度**：六階段流程拆分為兩個對話，不可混合。

- **對話一（執行對話）**：L0 規劃確認(plan.md) → L1 執行任務(task.md) → L2 驗收成果(result.md) → STOP → 提醒老闆開新對話做驗證
- **對話二（品管/品控對話）**：L3 紅隊攻擊(red.md) → L4 藍隊防禦(blue.md) → L5 結論+收尾(conclusion.md) → 提醒老闆開新對話或收尾

部門依需求選擇：研究事項→PM（研究品管）、開發事項→DEV（開發維運）。面向由對話階段自動綁定，老闆不再指定。不溯及既往：L3~L5 問題記為技術債，由下一輪 NNN 處理。同類對話串接：對話一→對話一→…；對話二→對話二→…。老闆控制分期切換。上下文管理由老闆自行決定。PM PASSED 後交接 DEV。詳見 `MANAGE.md`。

## 定義檔結構

```
skills/shiftblame/
├── SKILL.md              # 框架入口（導流）
├── GATE.md               # 閘門檢查與狀態機
├── MANAGE.md             # 管理者協調與操作
├── ROLE/                 # 角色上下文（含六階段產出格式）
│   ├── PM/
│   │   ├── PLAN.md         # L0 規劃確認（對話一）
│   │   ├── TASK.md         # L1 執行任務（對話一）
│   │   ├── RESULT.md       # L2 驗收成果（對話一）
│   │   ├── RED.md          # L3 紅隊攻擊（對話二）
│   │   ├── BLUE.md         # L4 藍隊防禦（對話二）
│   │   └── CONCLUSION.md   # L5 結論+收尾（對話二）
│   └── DEV/
│       ├── PLAN.md         # L0 規劃確認（對話一）
│       ├── TASK.md         # L1 執行任務（對話一）
│       ├── RESULT.md       # L2 驗收成果（對話一）
│       ├── RED.md          # L3 紅隊攻擊（對話二）
│       ├── BLUE.md         # L4 藍隊防禦（對話二）
│       └── CONCLUSION.md   # L5 結論+收尾（對話二）
├── TEMPLATES/            # 文件模板
│   ├── REPO.md
│   ├── ROADMAP.md
│   ├── GRAPH.md
│   ├── PID.md
│   └── SLUG.md           # 管理者協調用模板
└── TOOLS/                # 工具包
    ├── DESIGN.md         # 設計工具索引（前端設計等，必用）
    └── E2E.md            # 端到端驗證工具索引（網頁驗證等）
```

## 雙對話摘要

以下為雙對話制度的簡要摘要，**權威定義見 MANAGE.md（管線閘門表、上下文隔離）與 GATE.md（狀態機、退回規則）**。

| 項目 | 說明 |
|------|------|
| 對話一 | L0~L2（研究期/開發期），面向自動綁定 |
| 對話二 | L3~L5（品管期/維運期），面向自動綁定 |
| 串接 | 同類對話串接（對話一→對話一→…；對話二→對話二→…） |
| 分期切換 | 老闆控制（執行期→品管期/品控期） |
| 問題處理 | 不溯及既往，記為技術債，下一輪 NNN 處理 |
| 上下文 | 由老闆自行決定壓縮/清理 |
| 部門 | 研究事項→PM（研究品管）、開發事項→DEV（開發維運） |
| 分支 | feat/\<slug\>（跨部門）或 main（單一部門，預設） |
| 工作樹 | 不使用，DEV 預設在主 repo 分支執行 |

## 跨部門全景流程

完整功能開發（PM→DEV）的全景流程：

```
PM 研究期（對話一）  PM 品管期（對話二）  DEV 開發期（對話一）  DEV 維運期（對話二）
    L0 規劃確認         L3 紅隊攻擊         L0 規劃確認         L3 紅隊攻擊
    L1 執行任務         L4 藍隊防禦         L1 執行任務         L4 藍隊防禦
    L2 驗收成果         L5 結論+收尾        L2 驗收成果         L5 結論+收尾
         ↓                   ↓                   ↓                   ↓
      APPROVED            PASSED             APPROVED            PASSED
                              ↓                                       ↓
                         handoff.md                              歸檔更新 4 檔
                              ↓
                        DEV 開發期開始
```

- PM PASSED 後建立 `shared/handoff.md` 交接給 DEV
- DEV PASSED 後歸檔，更新 REPO.md / ROADMAP.md / PID.md / GRAPH.md
- 技術債循環：對話二發現問題 → 新 NNN 對話一處理 → 對話二驗證
