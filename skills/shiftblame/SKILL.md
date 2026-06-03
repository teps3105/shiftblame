---
name: shiftblame
description: "AI Agents 協作框架。Use when: 開始(開始/start)→載入技能, 結束(結束/end)→載入技能, DOC(DOC模式/文件模式)→使用DOC模式僅PM在主分支僅修改.shiftblame/內文件, FEATURE(FEATURE模式/功能模式/功能/feature/新功能)→使用FEATURE模式PM→DEV→PM→DEV→收尾(預設新功能), MAIN(MAIN模式/維護/主分支)→使用MAIN模式僅DEV在主分支執行, AUTO(AUTO模式/自動模式)→使用AUTO模式PM→DEV→PM→DEV→收尾(需RAPID.md)."
---
# shiftblame — AI Agents 協作框架

管理者由目前環境擔任，依狀態機閘門協調 PM 與 DEV 交替迭代。紅藍隊固定使用本環境子代理。

## 角色與派工

| 員工 | 身份 | 詳見 |
|------|------|------|
| 管理者 | 目前環境 | MANAGE.md |
| 執行者 | 本環境子代理 | EXECUTE.md |
| 紅隊 | 本環境子代理 | EXECUTE.md |
| 藍隊 | 本環境子代理 | EXECUTE.md |

角色職責詳見 `ROLE.md`。派工規格詳見 `EXECUTE.md`。

## 入口導流

| 情境 | 必讀 |
|------|------|
| 流程開始 | `START.md` |
| 流程結束 | `END.md` |
| 閘門/狀態機 | `GATE.md` |
| 管理者操作 | `MANAGE.md` |
| 派工/模式 | `EXECUTE.md` |
| 角色定義 | `ROLE.md` |

## 模式

四模式：DOC（PM only，僅 .shiftblame/）、FEATURE（功能模式，預設）、MAIN（DEV only）、AUTO（需 RAPID.md）。詳見 `EXECUTE.md`。

## 文件結構

```
.shiftblame/               # 本地私密，.gitignore
├── REPO.md               # 專案現狀
├── ROADMAP.md            # 穩定產品路線圖
├── PRD/                  # 產品需求文件（非強制）
├── SOP/                  # 標準作業程序（非強制）
├── archive/              # 已歸檔 slug
├── tmp/                  # 臨時檔案
└── <slug>/
    ├── SLUG.md            # 開發筆記
    └── <ROLE>/<NNN>/       # FEATURE/AUTO: PM/DEV；DOC/MAIN: 扁平
```

## 定義檔

| 檔案 | 說明 |
|------|------|
| GATE.md | 閘門檢查與狀態機 |
| MANAGE.md | 管理者協調與操作 |
| EXECUTE.md | 子代理派工 + 四模式定義 |
| ROLE.md | 角色定義（PM + DEV） |
| START.md | 流程開始定義 |
| END.md | 流程結束定義 |
| TEMPLATES/ | 文件模板 |
| TOOLS/ | 工具包 |
