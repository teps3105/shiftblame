# 跨模型三方 CLI 派工技術參考

> 來源：slug hermes-cli-proxy RES 研究結果 + 實際驗證修正（2026-05-05）。

## 核心發現

`delegate_task` 沒有直接的 per-task `model` 參數。跨模型 subagent 派工透過 `terminal()` 呼叫各 CLI 的非互動模式實現。

## ACP 支援現狀（2026-05-05 驗證）

| CLI | 版本 | `--acp` 支援 | 非互動模式 | 結論 |
|-----|------|-------------|-----------|------|
| Claude | 2.1.126 | **不支援** | `claude -p "prompt"` | 僅 `terminal()` 路徑 |
| Codex | 0.128.0 | **不支援** | `codex exec "prompt"` | 僅 `terminal()` 路徑 |
| Gemini | 0.40.1 | **支援** | `gemini -p "prompt"` | `acp_command` 或 `terminal()` 均可 |

## 模型指定路徑

1. **`terminal()` 呼叫非互動 CLI（標準路徑）**：subagent 透過 `terminal()` 呼叫各 CLI 的非互動模式進行實際工作。三方 CLI 均支援，為目前的主要派工路徑
2. **`acp_command` + `acp_args`（Gemini 專用）**：僅 Gemini CLI 原生支援 `--acp` 旗標，可作為 Gemini subagent 的 ACP 子程序模式。Claude CLI 和 Codex CLI 均不支援，不可使用此路徑
3. **`delegation.model`（全域）**：config.yaml 全域設定，所有 subagent 共用同一模型，無法實現三方不同模型

## `delegate_task` 參數

| 參數 | 層級 | 說明 |
|------|------|------|
| `acp_command` | 頂層 / tasks[i] | 覆寫 ACP 命令，指定外部 CLI |
| `acp_args` | 頂層 / tasks[i] | ACP 命令參數，預設 `["--acp", "--stdio"]` |

兩者均支援任務級別覆寫（tasks[i]），但目前僅 Gemini 可實際使用。

## 已知限制

- **`clarify()` 不可用**：subagent 無法使用 `clarify()`，需透過秘書中繼與老闆溝通
- **非 ACP 路徑無原生隔離**：透過 `terminal()` 呼叫外部 CLI 時，subagent 仍在 Hermes 原生環境中執行，CLI 的輸出需由 subagent 解析

## 派工範例

```
delegate_task(tasks=[
  {goal: "...Subagent-A...", context: "...", toolsets: ["terminal","file"]},
  {goal: "...Subagent-B...", context: "...", toolsets: ["terminal","file"]},
  {goal: "...Subagent-C...", context: "...", toolsets: ["terminal","file"]},
])
```

subagent 透過 `terminal()` 呼叫各自分配的非互動 CLI 進行實際工作。CLI 分配由秘書在 context 中提供（去識別化：不寫入 subagent 可讀取的通訊檔案）。
