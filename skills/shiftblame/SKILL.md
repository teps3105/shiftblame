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

詳見 `MANAGER.md` `STAFF.md`。跨 CLI 必須使用 `STAFF.md` 定義的完整非互動指令。

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

技能包必須自含共用檢查腳本；全域 `AGENTS.md`、`CLAUDE.md`、`GEMINI.md` 不存放於技能定義檔，必須由 `scripts/install-global-entrypoints.sh` 寫入或更新。安裝後只要 `skills/shiftblame` symlink 存在，即可從該技能目錄載入 scripts。不得依賴 `.claude/.codex/.gemini/settings.json` 觸發流程。

## Scripts 呼叫規則

管理者依下列時機直接呼叫本技能目錄內 scripts：

- 載入或觸發 shiftblame 技能前：`bash <skill>/scripts/skill-trigger-check.sh`
- 建立任務：`bash <skill>/scripts/task-init.sh <slug> <DEPT> [NNN]`
- 派工給子代理或外部 CLI 前：`bash <skill>/scripts/task-dispatch-check.sh`
- 閘門詢問老闆前：`bash <skill>/scripts/gate-prereq-check.sh`
- 子代理或外部 CLI 回來後：`bash <skill>/scripts/subagent-output-check.sh`
- QC 通過並收尾後：`bash <skill>/scripts/slug-archive.sh [slug]`
- 安裝或更新全域入口檔：`bash <skill>/scripts/install-global-entrypoints.sh`

`<skill>` 為目前 CLI 的技能 symlink 目錄，例如 `~/.codex/skills/shiftblame`、`~/.claude/skills/shiftblame` 或 `~/.gemini/skills/shiftblame`。

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

```
skills/shiftblame/
├── SKILL.md
├── MANAGER.md
├── STAFF.md
├── scripts/              # hooks / 檢查 / 初始化 / 歸檔 / 全域入口寫入腳本
└── DEPT/
```
