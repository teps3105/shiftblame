---
name: proxy
description: >-
  子代理呼叫機制定義。定義 Hermes 如何透過 hermes chat -q 統一呼叫子代理，
  包含呼叫規格、參數傳遞、toolsets 配置、去識別化實作、失敗處理、限額替換機制。
version: "1.0.0"
---

# PROXY.md — 子代理呼叫機制

## 呼叫介面

Hermes 透過 `hermes chat -q` 統一呼叫所有子代理。呼叫格式：

```bash
hermes chat -q "<prompt>" --provider <PROVIDER> --model <MODEL>
```

- `-q, --quiet`：非互動模式，輸出回應後退出
- `--provider <PROVIDER>`：模型供應商識別碼（由 MODEL.md 定義）
- `--model <MODEL>`：模型識別碼（由 MODEL.md 定義）

## 呼叫模式

### 研究任務（唯讀）

```bash
hermes chat -q "<prompt>" --provider <PROVIDER> --model <MODEL>
```

研究部門（RES/SEC/QA/PRD）使用此模式。子代理具備讀取權限，無寫入權限。

### 執行任務（可寫入）

```bash
hermes chat -q "<prompt>" --provider <PROVIDER> --model <MODEL>
```

執行部門（DEV/QC/EXP/MIS）使用此模式。子代理具備 worktree 讀寫權限。

> **注意**：Hermes 的 toolsets 機制控制子代理的工具存取範圍，而非 CLI flags。
> 寫入權限由 Hermes 的 delegate_task toolsets 參數控制。

## Toolsets 配置

子代理透過 Hermes delegate_task 取得工具集：

| toolset | 包含工具 | 用途 |
|---------|---------|------|
| `file` | read_file, write_file, patch, search_files | 檔案讀寫操作 |
| `terminal` | terminal | Shell 指令執行 |

研究部門 toolsets：`["file", "terminal"]`（唯讀場景）
執行部門 toolsets：`["file", "terminal"]`（含寫入場景，由 execution_model 控制）

## 去識別化實作

### 原則

子代理彼此僅知「使用不同模型」，不知底層模型名稱、供應商、具體能力差異。

### 實作方式

1. **通訊目錄命名**：`proxy-a/`、`proxy-b/`、`proxy-c/`（而非 `claude/`、`codex/`、`gemini/`）
2. **識別名稱**：Proxy-A、Proxy-B、Proxy-C（而非 Claude、Codex、Gemini）
3. **task.md 約束**：不含模型名稱、供應商名稱
4. **consensus.md 格式**：
   ```markdown
   # <DEPT> 共識
   ## 分工
   - Proxy-A：<工作項目>
   - Proxy-B：<工作項目>
   - Proxy-C：<工作項目>
   ```
5. **failure-notice.md**：Subagent 欄位使用 Proxy-A/B/C
6. **model 映射**：僅存於 MODEL.md（子代理不可讀取），秘書在 delegate_task 時查表代入

### 秘書派工流程中的去識別化

秘書透過 MODEL.md 查表取得 `--provider` 與 `--model` 參數，但在 task.md 中不寫入任何模型相關資訊。subagent 的 context 只含任務路徑，不含模型配置。

## 子代理自組織工作流程

1. **讀取任務**：讀取通訊目錄 `task.md` 取得目標 + 約束
2. **角色判斷**：根據 execution_model 區分處理方式：
   - `equal_consensus`（研究部門 RES/SEC/QA/PRD）：多方同時分析，不涉 worktree
   - `lead_executor`（執行部門 DEV/QC/EXP/MIS）：主執行者獨佔 worktree
3. **接入 Worktree**：僅主執行者（lead_executor 模式）接入 slug 層級共用 worktree
4. **讀取部門定義**：讀取 `DEPT/<DEPT>.md`
5. **辯論收斂**：閱讀他人提案，參與共識寫入 `consensus.md`
6. **執行分工**：直接使用工具執行分工任務
7. **回報結果**：寫入 `proxy-<N>/result.md`

## 失敗通知

子代理執行失敗後，在通訊目錄根層建立 `failure-notice.md`：

```markdown
# 失敗通知
- **Subagent**：Proxy-<N>
- **回報代碼**：<PROXY_UNAVAILABLE/RATE_LIMITED/...>
- **已完成**：<已完成的分工項目清單>
- **未完成**：<未完成的分工項目清單>
- **時間**：<ISO 8601>
```

## 失效偵測

| 回報代碼 | 情境 |
|----------|------|
| `PROXY_UNAVAILABLE` | Hermes 服務不可用 |
| `RATE_LIMITED` | 觸發速率限制（HTTP 429） |
| `QUOTA_EXCEEDED` | 配額用盡 |
| `TIMEOUT` | 執行超時 |
| `EXEC_FAILED` | 執行失敗 |
| `EMPTY_OUTPUT` | 輸出為空 |
| `AUTH_FAILURE` | 認證失敗 |
| `SERVICE_OVERLOADED` | 服務過載（HTTP 503/529） |

## 限額替換機制

當某個 proxy 子代理遇到限額錯誤（HTTP 429/503/529）或服務不可用時，啟動以下替換流程：

### 流程步驟

1. **偵測**：子代理偵測到 `RATE_LIMITED` 或 `SERVICE_OVERLOADED` 錯誤
2. **通知**：在通訊目錄建立 `failure-notice.md`（含回報代碼）
3. **秘書查表**：秘書偵測到限額錯誤後，查詢 MODEL.md 的備用模型列表
4. **替換映射**：將受限 proxy 的模型替換為備用模型（由 MODEL.md 定義）
5. **重新派工**：以替換後的模型重新派工同一任務
6. **記錄**：在 meta.md 中記錄替換事件（原始 proxy、替換模型、替換原因）
7. **不阻塞**：替換流程不阻塞主流程，其他 proxy 的工作不受影響

### 替換規則

- 備用模型列表由 MODEL.md 定義，每個 proxy 至少一個備用
- 替換時優先選擇非限額的備用模型
- 若所有備用模型均限額 → 回報秘書暫停
- 替換事件記錄於 meta.md，供後續審計

## 與現有 cli/*.md 的差異（歷史參考）

| 項目 | 舊架構（cli/*.md） | 新架構（PROXY.md） |
|------|-----------------|-------------------|
| 呼叫方式 | `claude -p` / `codex exec` / `gemini -p` | `hermes chat -q --provider X --model Y` |
| 權限控制 | 各 CLI 獨立 flags | Hermes toolsets 統一控制 |
| CLI 定義數量 | 3 個檔案 | 1 個檔案 |
| 模型綁定 | 各檔案硬編碼 CLI 名稱 | 完全解耦，由 MODEL.md 定義 |
| 子代理識別 | Claude/Codex/Gemini | Proxy-A/Proxy-B/Proxy-C |
| 通訊目錄 | claude/codex/gemini/ | proxy-a/proxy-b/proxy-c/ |
