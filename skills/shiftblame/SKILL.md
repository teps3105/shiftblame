---
name: shiftblame
description: "AI Agents 協作框架。Use when: 開始(開始/start)→載入技能, 結束(結束/end)→載入技能, PM(PM模式/規劃/文件)→使用PM模式僅PM在主分支僅修改.shiftblame/內文件, FEATURE(FEATURE模式/功能模式/功能/feature/新功能)→使用FEATURE模式PM→(開新對話)→DEV→收尾(預設新功能), DEV(DEV模式/維護/主分支)→使用DEV模式僅DEV在主分支執行, AUTO(AUTO模式/自動模式)→使用AUTO模式PM→(開新對話)→DEV→收尾(需RAPID.md)。每個對話只執行一個角色階段。"
---
# shiftblame — AI Agents 協作框架

管理者由目前環境擔任，依狀態機閘門協調 PM 與 DEV 交替迭代。L3 外部攻擊與 L4 內部驗證依複雜度在對話內執行或開子代理。

## 角色與派工

| 員工 | 身份 | 詳見 |
|------|------|------|
| 管理者 | 目前環境 | MANAGE.md |
| 執行者 | 依複雜度（對話內 / 子代理） | ROLE/{PM,DEV}/EXECUTE.md |
| 外部攻擊 | 依複雜度（對話內 / 子代理） | ROLE/{PM,DEV}/ATTACK.md |
| 內部驗證 | 依複雜度（對話內 / 子代理） | ROLE/{PM,DEV}/DEFEND.md |

角色職責詳見 `ROLE/{PM,DEV}/START.md`。派工規格詳見 `MANAGE.md`。

## 入口導流

| 情境 | 必讀 |
|------|------|
| 閘門/狀態機 | `GATE.md` |
| 管理者操作 | `MANAGE.md` |
| PM 角色上下文 | `ROLE/PM/{START,EXECUTE,ATTACK,DEFEND,END}.md` |
| DEV 角色上下文 | `ROLE/DEV/{START,EXECUTE,ATTACK,DEFEND,END}.md` |
| 文件模板 | `TEMPLATES/` |
| 工具包 | `TOOLS/` |

## 模式

四模式：PM（PM only，僅 .shiftblame/）、FEATURE（功能模式，預設，每角色階段獨立對話）、DEV（DEV only）、AUTO（需 RAPID.md，每角色階段獨立對話）。每個對話只執行一個角色階段，PASSED 後開新對話。詳見 `MANAGE.md`。

## 定義檔結構

```
skills/shiftblame/
├── SKILL.md              # 框架入口（導流）
├── GATE.md               # 閘門檢查與狀態機
├── MANAGE.md             # 管理者協調與操作
├── ROLE/                 # 角色上下文（含五階段產出格式）
│   ├── PM/
│   │   ├── START.md      # L1 宣告（管理者）
│   │   ├── EXECUTE.md    # L2 產出（子代理）
│   │   ├── ATTACK.md     # L3 外部攻擊
│   │   ├── DEFEND.md     # L4 內部驗證
│   │   └── END.md        # L5 結論（管理者）
│   └── DEV/
│       ├── START.md
│       ├── EXECUTE.md
│       ├── ATTACK.md
│       ├── DEFEND.md
│       └── END.md
├── TEMPLATES/            # 文件模板
│   ├── REPO.md
│   ├── ROADMAP.md
│   ├── GRAPH.md
│   ├── RAPID.md
│   └── SLUG.md           # 管理者協調用模板
└── TOOLS/                # 工具包
    ├── RESEARCH.md       # 研究工具索引（前端設計、遊戲開發資源等）
    └── E2E-VERIFY.md     # 端到端驗證工具索引（網頁驗證等）
```

## 四模式摘要

以下為四模式的簡要摘要，**權威定義見 MANAGE.md（管線閘門表、上下文隔離）與 GATE.md（狀態機、退回規則）**。

| 模式 | Pass | BossConfirm | 分支 | worktree |
|------|:----:|:-----------:|------|:--------:|
| PM | 1（PM only） | Manual | main | 否 |
| FEATURE | 2（PM + DEV） | Manual | feat/\<slug\> | 否 |
| DEV | 1（DEV only） | Manual | main | 否 |
| AUTO | 2（PM + DEV） | Auto | feat/\<slug\> | 是 |
