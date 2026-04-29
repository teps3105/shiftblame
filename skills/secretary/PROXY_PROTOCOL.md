# PROXY 自組織通訊協定

秘書是純調度器：設定邊界，下達任務，讓 PROXY 自行協調。不干預分工。

## 通訊目錄結構

```
~/.shiftblame/<repo>/<slug>/<DEPT>/
├── task.md              # 秘書下達的任務（所有 PROXY 共享）
├── dept.md              # 部門定義（從 agents/<DEPT>.md 讀取）
├── consensus.md         # 三方共識（任一 PROXY 可發起）
├── claude/{proposal,result}.md
├── codex/{proposal,result}.md
└── gemini/{proposal,result}.md
```

## 秘書派工步驟

1. 驗證 slug 名稱（SEC-A-01，見 DISPATCH_CHECKLIST.md）
2. 建立通訊目錄：`mkdir -p ~/.shiftblame/<repo>/<slug>/<DEPT>/{claude,codex,gemini}`
3. 寫入 `task.md`（部門任務 + 上游產出參照）
4. 寫入 `dept.md`（部門定義 + 產出規格）
5. 同步派工（同一則訊息發出所有 PROXY Agent 呼叫）

## Agent() 呼叫

```
Agent(subagent_type="shiftblame:CLAUDE_PROXY", prompt=proxy_prompt, name="<slug>-claude")
Agent(subagent_type="shiftblame:CODEX_PROXY", prompt=proxy_prompt, name="<slug>-codex")
Agent(subagent_type="shiftblame:GEMINI_PROXY", prompt=proxy_prompt, name="<slug>-gemini")
```

- 不指定 model，各 CLI 用自家 default
- 三個 PROXY 各自啟動外部 CLI（`claude -p` / `codex exec` / `gemini -p`）
- proxy_prompt 含：WORKTREE 絕對路徑、DISCUSSION 位置、任務內容

## PROXY 職責

- 讀取任務、分析能力匹配
- 與其他 PROXY 溝通辯論、分配職責
- 執行分配到的工作
- 產出寫入指定路徑
- 只有「無法確定老闆意圖」才標記上報

## 單點失效補救

| 情境 | 秘書動作 |
|---|---|
| 單一 PROXY 失敗 | 不動作，其他 PROXY 自行吸收 |
| 二個 PROXY 失敗 | 剩餘獨立完成，告知老闆降級為單體 |
| 全部失敗 | 回報老闆暫停 |
| PROXY 標記「需要裁決」 | AskUserQuestion 轉呈老闆 |

## 資料存取限制（金字塔累積制）

| 部門 | 可讀範圍 |
|---|---|
| QA | QA.md + QA/ |
| SEC | QA + SEC |
| PRD | QA + SEC + PRD |
| DEV | QA + SEC + PRD + DEV |
| QC | QA + SEC + PRD + DEV + QC |
| MIS | 全部（REPO.md + 所有部門） |

嚴格禁止讀下游部門的檔案。
