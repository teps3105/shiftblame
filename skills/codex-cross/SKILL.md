---
name: codex-cross
description: >-
  Codex 並行交叉驗證：每個部門派工時同步啟動 Codex CLI 做相同任務，
  兩者產出後交叉比對，分歧呈報老闆裁決。
  Use this skill when: the user requests codex parallel cross-validation,
  or says "並行交叉" / "codex cross" / "交叉驗證".
---

# Codex 並行交叉驗證

## 定位

可選的第二 AI 體系並行驗證。每個部門派工時，Claude agent 和 Codex CLI **同時做同一件事**，各自產出後由秘書交叉比對。

**為什麼不是事後審閱或盲測**：事後審閱只是製造資訊不對稱的文件產出；盲測在沒有上下文的情況下做不出有價值的判斷。並行執行才能真正利用兩個 AI 體系的互補性——不同模型有不同擅長領域和盲點，做同一件事才能暴露各自的盲區。

## 適用部門

**全部 6 個部門**（QA / SEC / PRD / DEV / QC / MIS）。每個部門的驗證價值不同：

- **QA**：兩個 AI 獨立定義斷言，可能覆蓋不同的用戶行為
- **SEC**：兩個 AI 獨立做資安稽核，可能發現不同類型的漏洞
- **PRD**：兩個 AI 獨立設計架構，可能提出不同的技術方案
- **DEV**：兩個 AI 獨立寫碼，不同的實作方式可能暴露不同 bug
- **QC**：兩個 AI 用不同方式攻擊應用，最能發揮互補性
- **MIS**：兩個 AI 獨立規劃部署，可能識別不同風險

## CLI 能力偵測協議

**不硬編碼 Codex 的功能清單**。每次調用前動態偵測，OpenAI 迭代時自動獲益。

### 偵測步驟

秘書在每次並行啟動前執行：

```bash
# 1. CLI 可用性
which codex || echo "CODEX_UNAVAILABLE"

# 2. 動態偵測可用功能
codex exec --help 2>&1

# 3. 預設模型
grep '^model\s*=' ~/.codex/config.toml | head -1 | sed 's/.*=\s*"\(.*\)"/\1/'
```

### 指令組裝規則

秘書根據 `--help` 輸出動態組裝 `codex exec` 指令：

1. 解析 `--help` 找出可用 flag
2. 根據偵測結果填入參數：
   - 有 `-m` → 填入步驟 3 偵測到的模型（若無模型設定則不加 `-m`）
   - 有 `-s` / `--sandbox` → 按部門類型選 sandbox 等級
   - 有 `--full-auto` → 加上（全自動執行）
   - 有 `--ephemeral` → 加上（不持久化 session）
   - 有 `-o` → 指定輸出檔案
   - 有 `-C` → 指定工作目錄
   - 有 `--image` → 可接受圖片輸入（如需要）
   - 有新 flag → 自動納入
3. 不硬編碼任何 flag 的存在假設

### Sandbox 等級

| 部門類型 | sandbox | 理由 |
|---|---|---|
| QA / SEC（純文件） | `read-only` | 只需讀取上游產出，產出透過 `-o` 寫入 |
| PRD / DEV / QC / MIS（產碼） | `workspace-write` | 需要寫入 worktree |

## 並行執行流程

```
秘書準備任務 prompt（含完整上游上下文）
       │
       ├──────────────────────┐
       │                      │
       ▼                      ▼
  Claude Agent            Codex CLI
  (Agent tool)           (Bash, run_in_background)
  正常 worktree          獨立 codex worktree
       │                      │
       ▼                      ▼
  slug.md               slug.codex.md
       │                      │
       └──────────┬───────────┘
                  ▼
          秘書交叉比對
                  │
        ┌─────────┴─────────┐
        │                   │
    一致                分歧
        │                   │
        ▼                   ▼
   繼續下一部門      呈報老闆裁決
```

### 執行步驟

1. **準備 prompt**：秘書組裝與 Claude agent 完全相同的任務 prompt + 完整上游上下文
2. **啟動 Codex**（背景執行）：`Bash` with `run_in_background: true`
3. **啟動 Claude**（前景執行）：`Agent()` 派工
4. **等待兩者完成**
5. **交叉比對**：讀取 `slug.md` + `slug.codex.md`
6. **呈報結果**：收斂項只報數量，分歧項逐條呈報

## Codex Worktree（產碼部門）

PRD / DEV / QC / MIS 需要獨立的 Codex worktree，避免與 Claude agent 的 worktree 衝突。

### 建立

```bash
git worktree add /home/derek/.worktree/<repo>/<slug>-codex -b feat/<slug>-codex
```

### 清理

循環收尾時與主 worktree 一併清理：
```bash
rm -rf /home/derek/.worktree/<repo>/<slug>-codex
git worktree prune
git branch -d feat/<slug>-codex
```

## Codex Prompt 建構

秘書從上游部門目錄讀取所有產出，組裝成 prompt。**與 Claude agent 完全相同的上下文 + 任務**，但**不約束手段**——讓 Codex 自己決定用什麼方式完成（CLI、computer use、多模態等）。

```
你是 <部門職稱>。

任務：<與派工單完全相同的任務描述>

== 上游產出 ==
<逐一部門讀取：QA → SEC → ... → 最近上游>

== 輸出要求 ==
<與 Claude agent 相同的產出格式>
將產出寫入：<slug>.codex.md
```

### 不約束手段

prompt 中**禁止**出現「你只能用 X」「你不可以用 Y」等手段限制。Codex 自行決定用什麼工具完成任務——這正是並行交叉的價值所在。兩個 AI 用不同方式做同一件事，才能暴露各自的盲區。

## 交叉比對協議

### 比對維度

秘書讀取 Claude 產出（`slug.md`）和 Codex 產出（`slug.codex.md`），逐項比對：

| 標記 | 定義 | 關注度 |
|---|---|---|
| `CONVERGED` | 兩者都發現/同意的事項 | 低（高可信度） |
| `CLAUDE_ONLY` | Claude 找到但 Codex 沒找到 | 中（Codex 盲點） |
| `CODEX_ONLY` | Codex 找到但 Claude 沒找到 | **高**（Claude 盲點，重點關注） |
| `CONFLICT` | 兩者結論矛盾 | **高**（需要裁決） |

### 比對產出

寫入 `~/.shiftblame/<repo>/<DEPT>/<slug>.cross.md`：

```markdown
# <部門> 交叉比對

## 收斂（N 項）
<摘要列出兩者一致的關鍵結論>

## Claude 獨有
| # | 項目 | 說明 |
|---|---|---|
| 1 | <Claude 發現> | <簡述> |

## Codex 獨有
| # | 項目 | 說明 |
|---|---|---|
| 1 | <Codex 發現> | <簡述> |

## 衝突
| # | Claude 結論 | Codex 結論 | 影響 |
|---|---|---|---|
| 1 | <A> | <B> | <衝突的實際影響> |
```

### 老闆報告格式

只有分歧項（CLAUDE_ONLY / CODEX_ONLY / CONFLICT）呈報老闆：

```
## <部門> 交叉比對分歧
| # | 類型 | Claude | Codex | 影響 |
|---|---|---|---|---|
| 1 | CODEX_ONLY | — | <Codex 發現> | <可能影響> |
| 2 | CONFLICT | <Claude 說 A> | <Codex 說 B> | <衝突影響> |

共 N 個分歧項 / M 個收斂項
```

收斂項不逐條報告，只報數量。老闆只需裁決分歧。

## 錯誤處理

| 情境 | 處理 |
|---|---|
| Codex CLI 不存在（`which codex` 失敗） | 跳過並行，Claude 正常執行，不阻擋 |
| `codex exec --help` 解析失敗 | 用最保守的指令組裝（只加 `--full-auto`） |
| Codex 執行超時 | Bash 設 300000ms，超時 → 跳過並行 |
| Codex 非零 exit code | 跳過比對，Claude 產出照常呈報 |
| Codex 產出為空 | 跳過比對，Claude 產出照常呈報 |
| Codex worktree 建立失敗 | 降級為 sandbox-only 模式（不加 `-C`，只產出文件） |

**原則：Codex 任何失敗都不阻擋流程。** 並行交叉是可選的品質強化，不是閘門。

## 完整指令範本

以下是秘書動態組裝的範例（實際指令由能力偵測結果決定）：

```bash
# 能力偵測
CODEX_MODEL=$(grep '^model\s*=' ~/.codex/config.toml | head -1 | sed 's/.*=\s*"\(.*\)"/\1/')

# 讀取上游產出
UPSTREAM=$(cat /home/derek/.shiftblame/<repo>/<UPSTREAM_DEPT>/*.md)

# 組裝並執行（背景）
codex exec \
  -m "$CODEX_MODEL" \
  -s workspace-write \
  --full-auto \
  --ephemeral \
  -C /home/derek/.worktree/<repo>/<slug>-codex \
  -o /home/derek/.shiftblame/<repo>/<DEPT>/<slug>.codex.md \
  "你是 <部門職稱>。任務：<完整任務描述>

== 上游產出 ==
$UPSTREAM

== 輸出要求 ==
<產出格式>
將產出寫入 <slug>.codex.md"
```

$ARGUMENTS
