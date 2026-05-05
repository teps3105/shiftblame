# Hermes Agent 派工適配

PROXY_PROTOCOL.md 記載的 `Agent(subagent_type="shiftblame:CLAUDE_PROXY", ...)` 為 Claude Code 原生 Agent API。在 Hermes Agent 中，實際派工使用 `delegate_task` 工具，參數結構不同但語意等價。

## delegate_task 對應關係

| PROXY_PROTOCOL.md 概念 | Hermes Agent delegate_task |
|---|---|
| `Agent(subagent_type, prompt, name, run_in_background)` | `delegate_task(tasks, toolsets)` |
| `prompt`（proxy_prompt） | `tasks[i].context` |
| `subagent_type`（CLAUDE/CODEX/GEMINI_PROXY） | 不指定（delegate_task 自行管理） |
| `run_in_background=true` | delegate_task 預設非阻塞 |
| `isolation="worktree"` | 不適用（subagent 透過 terminal 存取） |

## 研究部門派工模式（equal_consensus）

研究部門（RES/SEC/QA/PRD）同時派工三個 subagent，使用 `delegate_task` 的 `tasks` 陣列：

```python
delegate_task(
    tasks=[
        {
            "context": "task.md 路徑: <path>\n通訊目錄路徑: <path>\ncurrent_mode: <L5>\n部門定義: <path>/agents/<DEPT>.md\n專案根目錄: <path>",
            "goal": "執行 <DEPT> 任務（Subagent-A）。你是 Subagent-A。讀取 task.md 後，讀取 agents/<DEPT>.md 了解部門職責，再讀取上游報告與 REPO.md。與其他兩位 subagent 辯論收斂後，由 leader 彙整寫入 consensus.md。各自執行分工後寫入 proxy-a/result.md。使用繁體中文（台灣）產出。",
            "toolsets": ["terminal", "file"]
        },
        {
            "context": "...（同上，Subagent-B）",
            "goal": "...（同上，Subagent-B）",
            "toolsets": ["terminal", "file"]
        },
        {
            "context": "...（同上，Subagent-C）",
            "goal": "...（同上，Subagent-C）",
            "toolsets": ["terminal", "file"]
        }
    ],
    toolsets=["terminal", "file"]
)
```

### context 內容（對應 proxy_prompt）

研究部門 context 最小化，僅含 4 項：
1. task.md 絕對路徑
2. 通訊目錄絕對路徑
3. current_mode（L2/L3/L4/L5）
4. 部門定義絕對路徑（agents/<DEPT>.md）
5. 專案根目錄（供 subagent 讀取 REPO.md 和上游報告）

**不含 worktree 路徑**（研究部門不接觸 worktree）。

### goal 內容

goal 為 subagent 的具體任務描述。注意：
- 指定 subagent 身份（Subagent-A/B/C）
- 要求讀取 task.md → agents/<DEPT>.md → 上游報告 → REPO.md
- 要求寫入對應 proxy-{a,b,c}/result.md
- 要求與其他 subagent 辯論收斂、leader 彙整 consensus.md
- 指定產出語言

### toolsets

研究部門固定使用 `["terminal", "file"]`。terminal 用於執行驗證指令（如 npm audit），file 用於讀寫通訊目錄。

## 執行部門派工模式（兩階段）

執行部門（DEV/QC/EXP/MIS）需兩階段派工。在 Hermes Agent 中：

**第一階段（主執行者）**：
```python
delegate_task(
    tasks=[{
        "context": "task.md 路徑: <path>\n通訊目錄路徑: <path>\nworktree_path: <path>\ncurrent_mode: <L5>\n部門定義: <path>/agents/<DEPT>.md\n你是主執行者（<CLI>）",
        "goal": "...",
        "toolsets": ["terminal", "file"]
    }],
    toolsets=["terminal", "file"]
)
```

**等待主執行者完成** → 驗證 worktree commit → **第二階段（觀測者）**：
```python
delegate_task(
    tasks=[
        {"context": "...", "goal": "...（觀測者-1）", "toolsets": [...]},
        {"context": "...", "goal": "...（觀測者-2）", "toolsets": [...]}
    ],
    toolsets=["terminal", "file"]
)
```

## 閘門檢查程序（研究部門）

每個研究部門完成後，執行以下閘門檢查：

1. **讀取 consensus.md**：驗證產出完整（含共識要點、必要章節）
2. **確認三方 result.md 存在**：proxy-a/result.md、proxy-b/result.md、proxy-c/result.md
3. **確認無 failure-notice.md**：`test -f <path>/failure-notice.md` 應為 NONE
4. **向老闆匯報**：使用 clarify() 呈報共識摘要 + 三方工作情況
5. **取得確認**：三選項（繼續/重做/暫停），「繼續」則同 turn 內派工下一部門

### 閘門匯報格式

```
【<DEPT> 閘門檢查】
- [x] consensus.md 完整（N 行，必要章節齊全）
- [x] 三方 result.md 均存在
- [x] 無 failure-notice.md
- [x] 結論：<ACCEPTED/REJECTED/ALERT>

【三方工作情況】
- Subagent-A：<摘要>
- Subagent-B：<摘要>
- Subagent-C：<摘要>

【關鍵結論】
- <要點 1>
- <要點 2>
```

## 觀測到的穩定模式（2026-05-05 art-generate L5 驗證）

以下模式在 art-generate 重構 L5 流程中穩定出現（RES → SEC → QA → PRD，4 個研究部門均如此）：

1. **Subagent-C 傾向擔任 consensus 彙整者**：C 常讀取 A/B 的 result.md 後寫入最終 consensus.md
2. **SEC 需要專案根目錄**：SEC subagent 執行 `npm audit` 需要在專案根目錄下，context 必須含專案根目錄路徑
3. **PRD 耗時最長**：PRD 需要閱讀大量上游報告 + 原始碼 + 進行架構設計，耗時約為其他研究部門的 2-4 倍
4. **QA TBD 決策由 PRD 處理**：QA 標記的 TBD 項目在 PRD 階段解決，PRD 需要在 context 中特別提及 QA TBD
5. **研究部門 context 不含 worktree_path**：嚴格遵守 PROXY_PROTOCOL.md 規範

## 常見陷阱

1. **context 含做法指示**：違反 PROXY_PROTOCOL.md 秘書禁止含分工/做法規則。goal 可含任務描述，但 context 僅含路徑。
2. **漏給部門定義路徑**：subagent 需自行讀取 agents/<DEPT>.md，context 必須含此路徑。
3. **忘記更新 meta.md**：每次派工前須更新 meta.md 的派工紀錄表。
4. **閘門跳過 failure-notice.md 檢查**：必須明確檢查，不能假設無失敗。
