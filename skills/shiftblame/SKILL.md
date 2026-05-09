---
name: shiftblame
description: "AI Agents 協作框架。Use when: '開始','start','開工','動工','go','begin'; or multi-agent workflow."
---
# shiftblame — AI Agents 協作框架
三名員工在同一 worktree 協作。管理者與執行者同樣由目前所在 CLI 環境擔任；紅隊/藍隊預設由另外兩個 CLI 擔任，限額或 429 時依 `STAFF.md` 降級策略補位。

## 角色
| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 目前 CLI（claude/codex/gemini） | task.md |
| 執行者 | 目前 CLI（claude/codex/gemini） | result.md |
| 紅隊 | 非目前 CLI 之一 | red.md |
| 藍隊 | 非目前 CLI 之一 | blue.md |

角色映射依環境自動決定：

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| Claude CLI | claude | codex | gemini |
| Codex CLI | codex | claude | gemini |
| Gemini CLI | gemini | claude | codex |

詳見 `MANAGER.md` `STAFF.md`。跨 CLI 必須使用 `STAFF.md` 定義的完整非互動指令；Claude 不可只用 `claude -p`，必須帶 `--dangerously-skip-permissions --output-format text -p`。

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

## 權限 / ignore 規則

`.shiftblame/` 通常會被 `.gitignore` 排除，因此部分 CLI 的檔案工具（例如 `read_file`、內建檔案讀取器）會拒絕讀取其中內容。所有管理者與跨 CLI 員工在讀寫 `.shiftblame/` 時必須使用 shell 指令：

- 讀取：`cat`、`sed -n`、`test -f`、`find`
- 寫入：shell heredoc、CLI 自身檔案寫入、或目前環境允許的 patch/write 工具
- 禁止：要求員工用 `read_file` 讀 `.shiftblame/` 內檔案

派工 prompt 必須明確寫入：「`.shiftblame/` 檔案只能用 shell/cat/sed 讀取，不要使用 read_file 或內建檔案讀取工具」。

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
