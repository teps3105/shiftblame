# CLI Sandbox Pitfalls（2026-05-05 實戰驗證）

> 路徑 C 架構下 subagent 透過 `terminal()` 呼叫外部 CLI 時的已知阻擋。

## 現況摘要

| CLI | 狀態 | 阻擋原因 | 影響 |
|-----|------|---------|------|
| Claude CLI (`claude -p`) | ❌ 被阻擋 | Unicode 安全掃描 + 300s timeout | 主執行者 Subagent-A 無法透過 CLI 完成工作 |
| Codex CLI (`codex exec`) | ❌ 被阻擋 | bwrap sandbox 權限限制 | 觀測者 Subagent-B 無法透過 CLI 執行 code review |
| Gemini CLI (`gemini -p`) | ✅ 正常 | — | 觀測者 Subagent-C 成功透過 CLI 執行 code review |

## 觸發條件

- Subagent（`delegate_task`）透過 `terminal()` 呼叫 CLI
- CLI 執行涉及讀取/寫入 worktree 中的檔案
- Claude CLI 額外受 Unicode 內容觸發的安全掃描阻擋

## 實際降級行為

當 CLI 呼叫被阻擋時，subagent 自動降級為使用原生 Hermes 工具（`read_file`、`write_file`、`terminal` 直接執行 bash 指令）完成工作。此為路徑 A（原生 delegate_task subagent 自己做），非路徑 C（subagent 透過 CLI 做實際工作）。

**降級結果**：工作仍可完成，但架構上不符合路徑 C 規範。品質不受影響（本案例中產出通過所有驗證）。

## 秘書處理建議

1. **派工時**：在 context 中告知 subagent「若分配的 CLI 呼叫失敗，可降級使用原生工具完成工作，並在 result.md 中記錄降級原因」
2. **閘門時**：不因 CLI 降級而退回（基礎設施問題，非能力問題），但須在閘門報告中記錄降級事件
3. **長期**：調查 Claude/Codex 的 sandbox 設定，或改用 Gemini 作為主力 CLI

## 複現指令

```bash
# Claude CLI 阻擋（subagent 內透過 terminal()）
claude -p "在 worktree 中執行 grep 和編輯" --dangerously-skip-permissions
# 預期：被 Unicode 安全掃描阻擋或 300s timeout

# Codex CLI 阻擋（subagent 內透過 terminal()）
codex exec "review worktree 中的程式碼" --dangerously-bypass-approvals-and-sandbox --ephemeral
# 預期：bwrap sandbox 權限限制

# Gemini CLI 正常
gemini -p "review worktree 中的程式碼" --yolo --skip-trust
# 預期：正常執行
```
