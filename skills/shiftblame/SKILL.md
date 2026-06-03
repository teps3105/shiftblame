---
name: shiftblame
description: "AI Agents 協作框架。Use when: 開始(開始/start)→載入技能, 結束(結束/end)→載入技能, PM(PM模式/規劃/文件)→使用PM模式僅PM在主分支僅修改.shiftblame/內文件, FEATURE(FEATURE模式/功能模式/功能/feature/新功能)→使用FEATURE模式PM→(開新對話)→DEV→收尾(預設新功能), DEV(DEV模式/維護/主分支)→使用DEV模式僅DEV在主分支執行, AUTO(AUTO模式/自動模式)→使用AUTO模式PM→(開新對話)→DEV→收尾(需RAPID.md)。每個對話只執行一個角色階段。"
---
# shiftblame — AI Agents 協作框架

管理者由目前環境擔任，依狀態機閘門協調 PM 與 DEV 交替迭代。紅藍隊固定使用本環境子代理。

## 角色與派工

| 員工 | 身份 | 詳見 |
|------|------|------|
| 管理者 | 目前環境 | MANAGE.md |
| 執行者 | 本環境子代理 | ROLE/{PM,DEV}/EXECUTE.md |
| 紅隊 | 本環境子代理 | ROLE/{PM,DEV}/ATTACK.md |
| 藍隊 | 本環境子代理 | ROLE/{PM,DEV}/DEFEND.md |

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
│   │   ├── ATTACK.md     # L3 紅隊（子代理）
│   │   ├── DEFEND.md     # L4 藍隊（子代理）
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
    ├── OPEN-DESIGN.md
    └── NEXGAME.md
```

## 四模式形式定義

### PM 模式

| 屬性 | 值 |
|------|-----|
| Pass | 1（PM only） |
| BossConfirm | Manual（全閘門 L1-L5） |
| 分支 | main |
| worktree | 否 |
| 修改範圍 | 僅 `.shiftblame/` 內文件 |

觸發詞：`PM/PM模式/規劃/文件`。PM only 主分支操作。**限定只能修改 `.shiftblame/` 內的文件**。PASSED → COMMITTED → PUSHED → ARCHIVED → UPDATED。

### FEATURE 模式（功能模式，預設新功能）

| 屬性 | 值 |
|------|-----|
| Pass | 2（PM + DEV） |
| BossConfirm | Manual（全閘門 L1-L5） |
| 分支 | feat/\<slug\> |
| worktree | 否 |
| MaxIter | ∞ |

觸發詞：`功能/feature/新功能`。管線：PM→（開新對話）→DEV→（開新對話）→PM→…→收尾。DEV PASSED 且無後續 PM 需求時進入收尾。每角色階段獨立對話，PASSED 後強制停止並開新對話。PASSED → MERGED → PUSHED → ARCHIVED → UPDATED。

### DEV 模式

| 屬性 | 值 |
|------|-----|
| Pass | 1（DEV only） |
| BossConfirm | Manual（全閘門 L1-L5） |
| 分支 | main |
| worktree | 否 |
| MaxIter | 1 |

觸發詞：`DEV/DEV模式/維護/主分支`。DEV only 主分支。PASSED → COMMITTED → PUSHED → ARCHIVED → UPDATED。

### AUTO 模式（需 RAPID.md）

| 屬性 | 值 |
|------|-----|
| Pass | 2（PM + DEV） |
| BossConfirm | Auto（全閘門 L1-L5） |
| 分支 | feat/\<slug\> |
| worktree | 是 |
| MaxIter | ≤2 |

僅在存在 `.shiftblame/RAPID.md` 時可用。等同 FEATURE 模式但全閘門 BossConfirm 自動通過，使用 worktree 隔離。管線：PM→（開新對話）→DEV→（開新對話）→PM→…→收尾。DEV PASSED 且無後續 PM 需求時進入收尾。每角色階段獨立對話。BossConfirm 自動：L1 宣告非空→通過；L2 格式有效→通過；L5 五檔齊全→通過。攻防上限 3 輪。迭代上限 PM/002 + DEV/002。PASSED → MERGED → PUSHED → WORKTREE REMOVE → ARCHIVED → UPDATED。
