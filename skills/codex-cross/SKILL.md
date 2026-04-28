---
name: codex-cross
description: >-
  圖靈×馮諾伊曼雙體系發散驗證：Claude（圖靈派）與 Codex（馮諾伊曼派）
  同一任務不同哲學方向發散，產出交叉比對，分歧呈報老闆裁決。
  Use this skill when: the user requests codex parallel cross-validation,
  or says "並行交叉" / "codex cross" / "交叉驗證".
---

# 圖靈×馮諾伊曼 雙體系發散驗證

## 定位

預設的雙體系發散驗證。每個部門派工時，Claude agent（圖靈派）和 Codex CLI（馮諾伊曼派）**同時解決同一問題，但朝不同哲學方向發散**，各自產出後由秘書交叉比對。老闆可在預審時選擇「單模式」跳過 Codex。

## 圖靈派 vs 馮諾伊曼派

兩個體系不是做同一件事再比對，而是**同一問題、不同解法思維**：

| 維度 | Claude（圖靈派） | Codex（馮諾伊曼派） |
|---|---|---|
| 核心思維 | 可計算性：這個問題本質是什麼？能不能形式化證明正確？ | 可建造性：這個系統怎麼組裝？架構怎麼支撐規模？ |
| 推理風格 | 演繹——從公理推結論，追求邏輯完備 | 歸納——從經驗找規律，追求工程可行 |
| 品質標準 | 正確性優先：斷言完備、邊界窮舉、形式推導 | 穩健性優先：容錯設計、降級策略、防禦性編程 |
| 盲點 | 過度抽象，忽略工程約束（效能、遷移成本） | 過度務實，忽略邏輯漏洞（邊界條件、不變量破壞） |
| QA 偏向 | 定義完備的行為斷言，窮舉狀態空間 | 定義攻擊路徑，模擬真實威脅向量 |
| SEC 偏向 | 形式化安全模型，權限邊界推導 | 滲透測試導向，工具鏈攻擊面分析 |
| PRD 偏向 | 抽象架構設計，模組介面契約 | 技術選型與實作路徑，權衡取捨 |
| DEV 偏向 | TDD 先驗證再實作，確保正確 | 快速原型疊代，確保可運行 |
| QC 偏向 | 邏輯反例搜尋，形式化反證 | 混亂測試，真實環境破壞 |
| MIS 偏向 | 部署流程完備性驗證 | 環境差異與操作風險排查 |

**發散的價值**：圖靈派的盲點正是馮諾伊曼派的強項，反之亦然。兩者不是競爭誰做得更好，而是**合作覆蓋對方的盲區**。

## 適用部門

**全部 6 個部門**（QA / SEC / PRD / DEV / QC / MIS）。每個部門的發散方向不同：

- **QA**：圖靈派窮舉行為斷言 vs 馮諾伊曼派定義攻擊路徑
- **SEC**：圖靈派形式化安全模型 vs 馮諾伊曼派滲透測試導向
- **PRD**：圖靈派抽象架構契約 vs 馮諾伊曼派技術選型權衡
- **DEV**：圖靈派 TDD 先驗後實 vs 馮諾伊曼派快速原型疊代
- **QC**：圖靈派邏輯反例搜尋 vs 馮諾伊曼派真實環境破壞
- **MIS**：圖靈派部署完備性驗證 vs 馮諾伊曼派環境差異風險排查

## CLI 能力偵測協議

**不硬編碼 Codex 的功能清單或模型名稱**。每次調用前動態偵測，OpenAI 迭代時自動獲益。

### 偵測步驟

秘書在每輪首次並行派工前執行：

```bash
# 1. CLI 可用性
which codex || echo "CODEX_UNAVAILABLE"

# 2. 動態偵測最新可用模型（即時查詢 API，不讀 config）
codex debug models 2>&1 | python3 -c "
import json, sys
data = json.load(sys.stdin)
models = [m for m in data['models'] if m.get('visibility') != 'hide']
models.sort(key=lambda m: m.get('priority', 999))
best = models[0] if models else None
if best:
    print(best['slug'])
else:
    print('NO_MODEL')
"

# 3. 動態偵測可用 flag
codex exec --help 2>&1
```

### 模型選取規則

1. `codex debug models` 回傳 JSON 模型目錄，每個模型有 `priority`（數字越小越新）
2. 過濾 `visibility != 'hide'` 的模型
3. 按 `priority` 升序排列，取第一個 = **最新可用模型**
4. 寫入派工單 `CODEX_MODEL` 欄位
5. 偵測失敗時 fallback：讀取 `~/.codex/config.toml` 的 `model` 欄位（靜態備援）
6. config 也沒有 → 不加 `-m` flag，讓 Codex 用自己的預設

### 指令組裝規則

秘書根據 `--help` 輸出動態組裝 `codex exec` 指令：

1. 解析 `--help` 找出可用 flag
2. 根據偵測結果填入參數：
   - 有 `-m` → 填入步驟 2 偵測到的最新模型
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
秘書準備任務 prompt（含完整上游上下文 + 方向引導）
       │
       ├──────────────────────┐
       │                      │
       ▼                      ▼
  Claude Agent            Codex CLI
  (Agent tool)           (Bash tool, codex exec)
  圖靈派方向引導          馮諾伊曼派方向引導
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

1. **準備雙 prompt**：秘書組裝相同的任務 + 上游上下文，但分別注入圖靈派 / 馮諾伊曼派方向引導
2. **同步派出**：**同一則訊息中同時發出 `Agent()` + `Bash()` tool call**，Claude 和 Codex 並行啟動
3. **等待兩者完成**
4. **交叉比對**：讀取 `slug.md` + `slug.codex.md`
5. **呈報結果**：收斂項只報數量，分歧項逐條呈報

### 同步派工格式

秘書在同一則訊息中發出一個 Agent tool call + 一個 Bash tool call：

```python
# Claude agent（圖靈派）— 用 Agent tool
Agent(
  subagent_type="shiftblame:<DEPT>",
  prompt="你是 <部門職稱>，你是圖靈派的推理者。\n\n...\n\n任務：<任務描述>\n\n== 上游產出 ==\n...\n\n== 輸出要求 ==\n...",
  model="<haiku|sonnet|opus>",
  name="<slug>-claude"
)

# Codex（馮諾伊曼派）— 用 Bash 直接呼叫 codex exec
# codex exec 本身就是 agent 系統，不需要包裝
Bash(
  command="codex exec -m <CODEX_MODEL> <flags> '<馮諾伊曼派 prompt>'",
  description="Codex agent: <部門> <任務摘要>",
  timeout=300000,
  run_in_background=true
)
```

**為什麼不用 Agent tool 包 Codex**：Codex CLI 是獨立的 agent 系統，有自己的模型、工具鏈、sandbox。用 `Agent(subagent_type="general-purpose")` 包裝等於強迫 Claude 模型模擬 Codex——模型體系不同，工具鏈不同，結果是四不像。直接 `Bash` 呼叫 `codex exec` 才是正確的介面。

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

## Codex Prompt 建構（馮諾伊曼派方向）

秘書從上游部門目錄讀取所有產出，組裝成 prompt。**與 Claude agent 相同的上下文 + 任務目標**，但 prompt 開頭注入馮諾伊曼派方向引導，使 Codex 朝系統建造、工程可行、穩健容錯的方向發散。

```
你是 <部門職稱>，你是馮諾伊曼派的實踐者。

你的思維方式：可建造性優先。關注系統怎麼組裝、架構怎麼支撐規模、
容錯設計怎麼做、降級策略怎麼安排。追求工程可行與穩健性，
而非邏輯完備。用歸納法從經驗找規律，不從公理推結論。

任務：<與派工單完全相同的任務描述>

== 上游產出 ==
<逐一部門讀取：QA → SEC → ... → 最近上游>

== 輸出要求 ==
<與 Claude agent 相同的產出格式>
將產出寫入：<slug>.codex.md
```

### Claude Prompt 方向引導（圖靈派）

對應地，秘書在派工 Claude agent 時，prompt 開頭注入圖靈派方向引導：

```
你是 <部門職稱>，你是圖靈派的推理者。

你的思維方式：可計算性優先。關注問題本質是什麼、能不能形式化證明正確、
邊界條件是否窮舉、不變量是否成立。追求邏輯完備與正確性，
而非工程妥協。用演繹法從公理推結論，不從經驗猜規律。
```

### 不約束手段

prompt 中**禁止**出現「你只能用 X」「你不可以用 Y」等工具限制。兩個體系各自決定用什麼工具完成任務。方向引導只影響**思維方式**，不限制**執行手段**。

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
| `codex debug models` 失敗 | fallback 讀 `~/.codex/config.toml` 的 model 欄位 |
| `codex exec --help` 解析失敗 | 用最保守的指令組裝（只加 `--full-auto`） |
| Codex 執行超時 | Bash 設 300000ms，超時 → 跳過比對 |
| Codex 非零 exit code | 跳過比對，Claude 產出照常呈報 |
| Codex 產出為空 | 跳過比對，Claude 產出照常呈報 |
| Codex worktree 建立失敗 | 降級為 sandbox-only 模式（不加 `-C`，只產出文件） |

**原則：Codex 任何失敗都不阻擋流程。** 並行交叉是品質強化，不是閘門。

## 完整指令範本

以下是秘書動態組裝的範例（實際指令由能力偵測結果決定）：

```bash
# 1. 動態偵測最新模型
CODEX_MODEL=$(codex debug models 2>&1 | python3 -c "
import json, sys
data = json.load(sys.stdin)
models = [m for m in data['models'] if m.get('visibility') != 'hide']
models.sort(key=lambda m: m.get('priority', 999))
print(models[0]['slug'] if models else 'NO_MODEL')
")

# 2. 讀取上游產出
UPSTREAM=$(cat /home/derek/.shiftblame/<repo>/<UPSTREAM_DEPT>/*.md)

# 3. 組裝並執行 codex exec（背景）
codex exec \
  -m "$CODEX_MODEL" \
  -s workspace-write \
  --full-auto \
  --ephemeral \
  -C /home/derek/.worktree/<repo>/<slug>-codex \
  -o /home/derek/.shiftblame/<repo>/<DEPT>/<slug>.codex.md \
  "你是 <部門職稱>，你是馮諾伊曼派的實踐者。

你的思維方式：可建造性優先。關注系統怎麼組裝、架構怎麼支撐規模、
容錯設計怎麼做、降級策略怎麼安排。追求工程可行與穩健性，
而非邏輯完備。用歸納法從經驗找規律，不從公理推結論。

任務：<完整任務描述>

== 上游產出 ==
$UPSTREAM

== 輸出要求 ==
<產出格式>
將產出寫入 <slug>.codex.md"
```

$ARGUMENTS
