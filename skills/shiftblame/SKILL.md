---
name: shiftblame
description: "AI Agents 協作框架。Use when: '開始','start','開工','動工','go','begin'; or multi-agent workflow."
---
# shiftblame — AI Agents 協作框架
三名員工在同一工作目錄協作。主開發環境只支援 Claude Code 或 Codex CLI，不使用 Gemini 做主開發。支援兩種工作區模式：**worktree**（獨立工作樹，預設）或 **direct**（主 repo 直接開發）。紅藍隊派工模式只支援 **gemini**（Gemini 依序產出紅隊與藍隊，預設）與 **solo**（全部子代理，不啟用 Gemini）。管理者與執行者同樣由目前所在 CLI 環境擔任；Gemini 限額或 429 時依 `STAFF.md` 降級策略補位。

## 角色
| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 目前 CLI（claude/codex） | task.md |
| 執行者 | 目前 CLI（claude/codex） | result.md |
| 紅隊 | Gemini 或本環境子代理 | red.md |
| 藍隊 | Gemini 或本環境子代理 | blue.md |

固定呼叫映射：

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| Claude Code | claude | gemini 或本環境子代理 | gemini 或本環境子代理 |
| Codex CLI | codex | gemini 或本環境子代理 | gemini 或本環境子代理 |

詳見 `MANAGER.md` `STAFF.md`。跨 CLI 紅藍隊只允許使用 `STAFF.md` 定義的 Gemini 非互動指令，不得呼叫 Claude Code 或 Codex 作為紅隊 / 藍隊。

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

全域 `AGENTS.md`、`CLAUDE.md` 的 managed block 由管理者依 `GATE.md` 全域入口安裝段落寫入或更新。不得依賴 `.claude/.codex/settings.json` 觸發流程。

## 閘門狀態機

管理者依 `GATE.md` 定義的狀態機執行閘門檢查：G0 初始化 → G1 派工 → G2 審查 → G3 歸檔。每次狀態轉移前驗證必要檔案，不通過則中止並報告缺件。詳見 `GATE.md`。

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
    ├── worktree/          # git worktree（worktree 模式專用；direct 模式無此目錄）
    └── <DEPT>/<NNN>/
        ├── task.md       # 任務定義
        ├── result.md     # 執行結果
        ├── red.md        # 紅隊驗證
        └── blue.md       # 藍隊驗證
```

```
skills/shiftblame/
├── SKILL.md
├── GATE.md               # 狀態機閘門定義
├── MANAGER.md
├── STAFF.md
└── DEPT/
```
