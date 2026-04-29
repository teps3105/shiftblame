# PROXY 自組織通訊協定

秘書是純調度器：設定邊界，下達任務，讓 PROXY 自行協調。不干預分工。

## 通訊目錄結構

```
~/.shiftblame/<repo>/<slug>/<DEPT>/
├── task.md              # 秘書下達的任務（所有 PROXY 共享）
├── dept.md              # 部門定義（從 agents/<DEPT>.md 讀取）
├── consensus.md         # 三方共識（分工 + 產出結論）
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
Agent(subagent_type="shiftblame:CLAUDE_PROXY", prompt=proxy_prompt, name="<slug>-claude", run_in_background=true)
Agent(subagent_type="shiftblame:CODEX_PROXY", prompt=proxy_prompt, name="<slug>-codex", run_in_background=true)
Agent(subagent_type="shiftblame:GEMINI_PROXY", prompt=proxy_prompt, name="<slug>-gemini", run_in_background=true)
```

- 使用 `Agent` tool + `run_in_background: true`，禁用 `TeamCreate`
- 不指定 model，各 CLI 用自家 default
- 三個 PROXY 各自啟動外部 CLI（`claude -p` / `codex exec` / `gemini -p`）
- proxy_prompt 含：WORKTREE 絕對路徑、DISCUSSION 位置、任務內容

## 派工規則

- **預設三個全派**（Claude + Gemini + Codex），發揮各自優勢
- **秘書不分工**：三方收到相同 task.md，由 PROXY 自行協調分工
- **補派至少 2 個**：退回重做時同步派至少 2 個 PROXY
- **所有部門必須在 worktree**：prompt 必須明確指定工作目錄為 `/home/derek/.worktree/<repo>/<slug>/`
- **Gemini 需 credentials 注入**：prompt 開頭必含 `export GEMINI_API_KEY=$(python3 -c "import json; print(json.load(open('/home/derek/.gemini/oauth_creds.json'))['access_token'])")`

## 退回規則

- **採增量**：task.md 只列需補強項目，PROXY 在既有產出上修改
- **重用通訊目錄**：清空既有 proposal/result/consensus（`rm -f`），不另開新資料夾

## 共識流程

```
各自提出分工提案 → 辯論收斂（最多 2 輪）→ 寫入 consensus.md → 各自執行分工 → 寫入 result.md
```

consensus.md 內容：
```markdown
# <DEPT> 共識
## 分工
- Claude：<任務>
- Codex：<任務>
- Gemini：<任務>
## 產出結論
<三方同意的部門產出內容>
## 分歧（如有）
<未收斂項目，留待秘書裁決>
```

## PROXY 職責

- 讀取任務、分析能力匹配、提出分工
- 辯論收斂、執行分工、寫入 result.md
- **獨自執行時必須回報**：通訊目錄中只看到自己的 proposal → 停止並回報
- **權限拒絕必須報錯**：在 result.md 記錄，不可假裝完成

## 單點失效補救

| 情境 | 處理 |
|---|---|
| 單一 PROXY 失敗 | 其他自行吸收 |
| 二個 PROXY 失敗 | 剩餘獨立完成，共識降級為單體 |
| 全部失敗 | 回報秘書暫停 |
| 共識含分歧項 | 秘書 AskUserQuestion 轉呈老闆裁決 |
| result 含 permission error | 標注「執行不完整」，秘書重新派工 |

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
