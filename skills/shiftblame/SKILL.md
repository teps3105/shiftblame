---
name: shiftblame
description: "AI Agents 協作框架。Use when: '開始','start','開工','動工','go','begin'; or multi-agent workflow."
---
# shiftblame — AI Agents 協作框架
三名員工在同一 worktree 協作。管理者（主 session）協調；執行者為目前所在 CLI 環境，紅隊/藍隊由另外兩個 CLI 擔任。

## 角色
| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 主 session | task.md |
| 執行者 | 目前 CLI（claude/codex/gemini） | result.md |
| 紅隊 | 非目前 CLI 之一 | red.md |
| 藍隊 | 非目前 CLI 之一 | blue.md |

角色映射依環境自動決定：

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| Claude CLI | claude | codex | gemini |
| Codex CLI | codex | claude | gemini |
| Gemini CLI | gemini | claude | codex |

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
├── archive/              # 歷史紀錄（已完成任務）   
└── <slug>/
    ├── worktree/          # git worktree（協作工作目錄）
    └── <DEPT>/<NNN>/
        ├── task.md       # 任務定義
        ├── result.md     # 執行結果
        ├── red.md        # 紅隊驗證
        └── blue.md       # 藍隊驗證
```
