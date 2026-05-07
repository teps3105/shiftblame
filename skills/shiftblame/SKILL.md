---
name: shiftblame
description: >-
  框架入口。六部門四等級單向流程開發框架的調度核心。
  Use this skill when: the user says  "開始", "start", "開工", "let's go",
  "開始吧", "來吧", "動工", "起動", "開幹", "go", "begin", "go ahead",
  or any phrase signaling the start of a task/work/session.
---

> 所有路徑基於專案根目錄解析，執行時由 task.md 提供絕對路徑。

## 四等級流程

```
L1: 秘書研究 → 秘書收尾
L2: 秘書研究 → PRD → DEV → 秘書收尾
L3: 秘書研究 → QA → PRD → DEV → QC → 秘書收尾
L4: 秘書研究 → SEC → QA → PRD → DEV → QC → EXP → 秘書收尾
```

## 框架定義檔

所有框架定義檔存放在 **skill 目錄** `skills/shiftblame/`

| 檔案 | 內容 |
|------|------|
| `SKILL.md` | 框架入口 |
| `SECRETARY.md` | 秘書準則 |
| `MANAGER.md` | 管理者定義|
| `STAFF.md` | 員工呼叫規格 |
| `DEPT/SEC.md` | 資安部門定義 |
| `DEPT/QA.md` | 品保部門定義 |
| `DEPT/PRD.md` | 產品部門定義 |
| `DEPT/DEV.md` | 開發部門定義 |
| `DEPT/QC.md` | 品管部門定義 |
| `DEPT/EXP.md` | 體驗部門定義 |
