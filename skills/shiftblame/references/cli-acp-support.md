# 三方 CLI ACP 支援與沙箱現狀

> 驗證日期：2026-05-05。驗證方式：`--help` 輸出 + 實際執行測試。

## 結論

| CLI | 版本 | `--acp` | 沙箱 | 非互動指令 | 派工路徑 |
|---|---|---|---|---|---|
| Claude | 2.1.126 | 不支援 | 無（`-p` 模式自動跳過 workspace trust） | `claude -p "prompt"` | `terminal()` only |
| Codex | 0.128.0 | 不支援 | bubblewrap，**本環境無法啟動** | `codex exec --dangerously-bypass-approvals-and-sandbox "prompt"` | `terminal()` + 沙箱繞過 |
| Gemini | 0.40.1 | 支援 | 無預設沙箱 | `gemini -p "prompt"` | `acp_command` 或 `terminal()` |

## 沙箱詳細驗證

### Claude

`claude -p`（非互動模式）預設跳過 workspace trust dialog，檔案寫入與 shell 執行均無需額外旗標。

```bash
claude -p "echo hello"           # 正常
claude -p "touch /tmp/test.txt"  # 正常
```

若需完全跳過權限檢查可加 `--dangerously-skip-permissions`，但 `-p` 模式通常不需要。

### Codex

Codex CLI 預設使用 bubblewrap（bwrap）沙箱。在本環境（容器/VM）中，bwrap 無法啟動：

```bash
codex exec "echo hello"          # 失敗：bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted
codex exec -s read-only "echo"   # 失敗：同上
codex exec -s workspace-write "echo"  # 失敗：同上
codex exec --dangerously-bypass-approvals-and-sandbox "echo hello"  # 正常
```

所有沙箱模式均失敗。唯一可用路徑為加 `--dangerously-bypass-approvals-and-sandbox`。

此旗標名稱帶有「dangerously」前綴，正式文件建議僅用於外部沙箱環境。但本環境的 Hermes subagent 本身已有隔離，實際風險可控。

### Gemini

`gemini -p` 無預設沙箱限制，直接可用。

## 驗證方法

```bash
# ACP 支援確認
claude --help 2>&1 | grep -i acp    # 無結果
codex --help 2>&1 | grep -i acp     # 無結果
gemini --help 2>&1 | grep -i acp    # 有結果：--acp

# 沙箱確認
claude -p "touch /tmp/test.txt"  && echo "OK"
codex exec "touch /tmp/test.txt"   # 觀察是否 bwrap 錯誤
codex exec --dangerously-bypass-approvals-and-sandbox "touch /tmp/test.txt" && echo "OK"
```

## 關鍵事實

- `delegate_task` 沒有直接的 per-task `model` 參數
- `acp_command` + `acp_args` 支援任務級別覆寫（tasks[i]），但目前僅 Gemini 可實際使用
- 跨模型 subagent 派工的標準路徑是 subagent 透過 `terminal()` 呼叫各 CLI 的非互動模式
- Codex 在 `terminal()` 路徑下**必須**加 `--dangerously-bypass-approvals-and-sandbox`

## 教訓（hermes-cli-proxy slug）

1. RES 研究錯誤記錄 Claude CLI 支援 `--acp`（推斷自 Hermes delegate_task schema 文件，未實際驗證 CLI help 輸出）。錯誤結論寫入框架定義檔，需要額外 fix PR 修正。

**規則：涉及 CLI 能力宣告時，必須以 `--help` 輸出與實際執行為準，不可僅依賴 schema 文件或第三方文件推斷。**

2. 沙箱行為必須實測，不可僅從文件推斷。Codex 文件未明確說明在容器/VM 環境中 bwrap 會失敗，實測才發現。
