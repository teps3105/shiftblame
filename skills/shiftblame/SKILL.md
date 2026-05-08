---
name: shiftblame
description: "AI Agents 協作框架。Use when: '開始','start','開工','動工','go','begin'; or multi-agent workflow."
---
# shiftblame — AI Agents 協作框架
三名員工在同一 worktree 協作。管理者（主 session）協調；執行者/驗證者（子代理）透過 CLI。

## 角色
| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 主 session | task.md |
| 執行者 | 子代理（claude） | result.md |
| 紅隊 | 子代理（codex） | red.md |
| 藍隊 | 子代理（gemini） | blue.md |

詳見 `MANAGER.md` `STAFF.md`。

## 部門
| # | 部門 | 類型 |
|:-:|:----:|:----:|
| 0 | PRD | 產品 |
| 1 | QA | 品保 |
| 2 | DEV | 開發 |
| 3 | QC | 品管 |

詳見 `DEPT/*.md`。

## 定義檔 / gitignore
`MANAGER.md` `STAFF.md` `DEPT/{PRD,QA,DEV,QC}.md`

`.shiftblame/` 為本地工作目錄，須列入 `.gitignore` 不納入版本控制。

確認 `.shiftblame/REPO.md` 存在，不存在 → 報告「尚未初始化」。關鍵字觸發流程。

## 文件結構

```
.shiftblame/
├── REPO.md               # 專案現狀（本地私密）
└── <slug>/
    ├── worktree/          # git worktree（協作工作目錄）
    └── <DEPT>/<NNN>/
        ├── task.md       # 任務定義
        ├── result.md     # 執行結果
        ├── red.md        # 紅隊驗證
        └── blue.md       # 藍隊驗證
```