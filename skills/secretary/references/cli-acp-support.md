# 三方 CLI ACP 支援現狀

> 驗證日期：2026-05-05。驗證方式：各 CLI `--help` 輸出。

## 結論

| CLI | 版本 | `--acp` | 非互動模式 | 派工路徑 |
|---|---|---|---|---|
| Claude | 2.1.126 | **不支援** | `claude -p` | `terminal()` only |
| Codex | 0.128.0 | **不支援** | `codex exec` | `terminal()` only |
| Gemini | 0.40.1 | **支援** | `gemini -p` | `acp_command` 或 `terminal()` |

## 驗證方法

```bash
# 確認 --acp 旗標是否存在
claude --help 2>&1 | grep -i acp    # 無結果
codex --help 2>&1 | grep -i acp     # 無結果
gemini --help 2>&1 | grep -i acp    # 有結果：--acp
```

## 關鍵事實

- `delegate_task` 沒有直接的 per-task `model` 參數
- `acp_command` + `acp_args` 支援任務級別覆寫（tasks[i]），但目前僅 Gemini 可實際使用
- 跨模型 subagent 派工的標準路徑是 subagent 透過 `terminal()` 呼叫各 CLI 的非互動模式
- Gemini 可選擇使用 `acp_command: "gemini", acp_args: ["--acp"]` 或同樣走 `terminal()` 路徑

## 教訓（hermes-cli-proxy slug）

RES 研究錯誤記錄 Claude CLI 支援 `--acp`（推斷自 Hermes delegate_task schema 文件，未實際驗證 CLI help 輸出）。錯誤結論寫入框架定義檔，需要額外 fix PR 修正。

**規則：涉及 CLI 能力宣告時，必須以 `--help` 輸出為準，不可僅依賴 schema 文件或第三方文件推斷。**
