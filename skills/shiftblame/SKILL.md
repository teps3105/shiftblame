---
name: shiftblame
description: "AI Agents 協作框架。skills and docs encode: UTF-8。Use when: 開始(開始/start)→載入技能, 結束(結束/end)→載入技能, 手動(手動模式/規劃/文件/開發/維護/功能/新功能)→手動模式每階段L(n)'對話確認後執行L(n), 自動(自動模式/自動/auto)→自動模式僅L1'後L1~L5全自動。每個對話只執行一個角色階段。"
---
# shiftblame — AI Agents 協作框架

管理者由目前環境擔任，依狀態機閘門協調 PM 與 DEV 交替迭代。L3 紅隊攻擊與 L4 藍隊防禦依複雜度在對話內執行或開子代理。

## 編碼規則

本技能、`.shiftblame/` 文件與所有 Markdown 產物一律使用 UTF-8。讀取或寫入任何含中文文件時，必須使用明確 UTF-8 編碼；禁止依賴 Windows/PowerShell/終端預設編碼。具體操作規則見 `MANAGE.md`「編碼規則」。

## 角色與派工

| 員工 | 身份 | 詳見 |
|------|------|------|
| 管理者 | 目前環境 | MANAGE.md |
| 執行者 | 依複雜度（對話內 / 子代理） | ROLE/{PM,DEV}/RESULT.md |
| 攻擊者 | 依複雜度（對話內 / 子代理） | ROLE/{PM,DEV}/RED.md |
| 防禦者 | 依複雜度（對話內 / 子代理） | ROLE/{PM,DEV}/BLUE.md |

角色職責詳見 `ROLE/{PM,DEV}/TASK.md`。派工規格詳見 `MANAGE.md`。

## 入口導流

| 情境 | 必讀 |
|------|------|
| 閘門/狀態機 | `GATE.md` |
| 管理者操作 | `MANAGE.md` |
| PM 角色上下文 | `ROLE/PM/{TASK,RESULT,RED,BLUE,CONCLUSION}.md` |
| DEV 角色上下文 | `ROLE/DEV/{TASK,RESULT,RED,BLUE,CONCLUSION}.md` |
| 文件模板 | `TEMPLATES/` |
| 工具包 | `TOOLS/` |

## 模式

雙模式：**手動**（預設，每階段 L(n)' 對話確認後執行 L(n)）與 **自動**（僅 L1' 對話確認後 L1~L5 全自動執行）。部門依需求選擇：計畫事項→PM、開發事項→DEV。手動模式每個 L 階段前都有 L(n)' 宣告階段（純對話、不寫文件），管理者在對話中告訴老闆本階段計畫，老闆可持續修改需求，通過後共識寫入文件正式進入 L(n)。自動模式僅在開頭一次 L1' 對話，老闆同意後 L1~L5 全自動執行。PM L5 PASSED 後老闆決定歸檔或留至下一對話執行 DEV。詳見 `MANAGE.md`。

## 定義檔結構

```
skills/shiftblame/
├── SKILL.md              # 框架入口（導流）
├── GATE.md               # 閘門檢查與狀態機
├── MANAGE.md             # 管理者協調與操作
├── ROLE/                 # 角色上下文（含五階段產出格式）
│   ├── PM/
│   │   ├── TASK.md         # L1 執行任務
│   │   ├── RESULT.md       # L2 驗收成果
│   │   ├── RED.md          # L3 紅隊攻擊
│   │   ├── BLUE.md         # L4 藍隊防禦
│   │   └── CONCLUSION.md   # L5 最終結論（管理者）
│   └── DEV/
│       ├── TASK.md
│       ├── RESULT.md
│       ├── RED.md
│       ├── BLUE.md
│       └── CONCLUSION.md
├── TEMPLATES/            # 文件模板
│   ├── REPO.md
│   ├── ROADMAP.md
│   ├── GRAPH.md
│   ├── RAPID.md
│   └── SLUG.md           # 管理者協調用模板
└── TOOLS/                # 工具包
    ├── DESIGN.md         # 設計工具索引（前端設計等，必用）
    └── E2E.md            # 端到端驗證工具索引（網頁驗證等）
```

## 雙模式摘要

以下為雙模式的簡要摘要，**權威定義見 MANAGE.md（管線閘門表、上下文隔離）與 GATE.md（狀態機、退回規則）**。

| 模式 | L(n)' | 宣告 | 部門 | 分支 | worktree | 對話 |
|------|:-----:|:----:|------|:----:|:--------:|------|
| 手動 | 每階段（L1'~L5'） | 每階段 | PM 或 DEV（依需求） | feat/\<slug\>（跨部門）或 main（單一部門） | 否 | 單一或持久化（PM→DEV 接續） |
| 自動 | 僅 L1' | 單次（開頭） | PM 或 DEV（依需求） | feat/\<slug\> | 是 | 每角色新對話 |
