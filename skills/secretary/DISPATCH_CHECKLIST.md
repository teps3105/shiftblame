# 派工前 Checklist

每次派工前逐條完成，不可跳過。

## 0. 模式確認

派工前確認本次 slug 的模式（初等 / 中等 / 高等）。模式已在 SKILL.md 運作流程步驟 6 確認，此處為覆核：

- **初等（basic）**：RES → MIS 收尾，不走 QA → SEC → PRD → DEV → QC 流程
- **中等（medium）**：RES → DEV（可多輪）→ QC → MIS(尾)
- **高等（full）**：依完整流程依序派工

模式可升級也可降級（縮小範圍），降級不可逆轉。若模式未確認，退回 SKILL.md 運作流程步驟 6 完成確認。

若本次 slug 含子循環（RES 研究結果拆分），確認以下事項：
- 各子循環的模式等級已在 meta.md 子循環紀錄表中明確標記
- 各子循環通訊目錄（`<DEPT>/cycle-N/`）已建立
- 子循環執行順序與依賴關係已在 meta.md 中記錄

## 1. 讀取專案資訊

```
Read .shiftblame/REPO.md
```

從 REPO.md 提取約束條件（不是做法）：
- REPO.md 由 RES 初始化（專案定位、方向、實作程度、待辦），由秘書在歸檔時更新
- 技術棧（語言、框架、測試工具）
- 測試指令（unit / integration 路徑與指令）
- 建置指令（build / compile）
- 部署方式（Docker / k8s / 其他）
- 已知約束（安全守則、狀態機、API 端點）

**REPO.md 不存在 = RES 尚未啟動。** 須先派工 RES 進行專案現狀釐清，完成後 REPO.md 才會建立。

**不讀 REPO.md 就派工 = 違規。**

## 2. Slug 名稱驗證（SEC-A-01）

```bash
[[ -z "$slug" ]] && fail    # 空字串
[[ "$slug" == *--* ]] && fail  # 雙連字號
[[ "$slug" =~ ^[a-z][a-z0-9-]{0,62}[a-z0-9]$ ]] || [[ "$slug" =~ ^[a-z0-9]$ ]] || fail
```

驗證失敗 → 不建任何目錄，回報老闆。

## 3. 寫入 task.md

task.md 只含**目標**和**約束**，不含任何做法指示。必須包含 YAML frontmatter 元數據區段。主執行者由步驟 13 動態調配選定（依 onwatch 額度狀態自動決定），並寫入 YAML frontmatter。

```yaml
---
lead_executor: <由步驟 13 動態調配選定的 PROXY 名稱>
observers: [<其他兩個 PROXY 名稱>]
current_mode: <basic / medium / full>
worktree_path: <.shiftblame/<slug>/worktree/>
---
```

```
=== task.md 必含 ===
- 目標：<老闆需求轉化的具體目標>
- 上游輸入：所有上游部門結論檔路徑
- 約束：worktree 路徑 + REPO.md 約束 + 需求釐清結果

=== task.md 禁止含 ===
- 分工指示（誰做什麼）← PROXY 自行決定
- 做法步驟（怎麼做）← PROXY 自行決定
- 產出格式指示（長什麼樣）← PROXY 自行決定
- 部門定義內容 ← PROXY 自行讀取 agents/<DEPT>.md
```


## 4. proxy_prompt 最小化

proxy_prompt 只含四樣東西：
1. task.md 路徑
2. 通訊目錄路徑
3. worktree 路徑
4. current_mode

```bash
# 以下禁止注入 prompt
- 部門定義（agents/<DEPT>.md 的內容）← PROXY 自己讀
- 分工建議（「建議 Claude 做前端、Codex 做後端」）← 違規
- 具體做法（「先跑 X 再跑 Y」）← 違規
- 產出模板 ← 違規
```

**注入做法 = 越權 = 違規。**

## 5. 部門特殊檢查

| 部門 | 派工前必做 |
|---|---|
| RES | 確認主執行者已由步驟 13 動態調配選定並寫入 task.md frontmatter、RES 獨立研究（不走兩階段派工） |
| MIS（初等模式） | 確認模式為初等模式、確認主執行者已由步驟 13 動態調配選定並寫入 task.md frontmatter、MIS 執行收尾 |
| MIS（中等/高等模式） | 確認主執行者已由步驟 13 動態調配選定、單一 worktree 已建立 |
| MIS（尾，復判前） | 確認 MIS 部門報告（consensus.md）已產出且完整、三方 PROXY result.md 均存在、定義檔變更與 task.md 一致 |
| QA | user journey 需求確認：主業務 view 是什麼？user 從哪個 view 點哪個按鈕觸發？寫不出 = 不派工 |
| QC | 檢查 QC agent type 工具清單是否含任務所需工具（Web SPA 需要 chrome-devtools-mcp）。不足 = 不硬派 |
| 所有部門 | 確認 `.gitignore` 含 `.shiftblame/` |
| 實作部門 | 確認主執行者 worktree 已建立且位於 slug 層級、確認採兩階段派工（先主執行者，等待 commit 後再派工觀測者） |
| 研究部門（RES/QA/SEC/PRD） | 確認採同時派工（三個 PROXY 同時派工，不走兩階段） |

## 6. QC 定位提醒

派工 QC 時 task.md 的目標中必須明確：QC 是破壞者（主動挖掘 BUG、邊緣案例、業務邏輯斷裂），不是規格驗收員。

## 7. 殭屍掃描注意

殭屍判準（無載入路徑）對「測試檔」失效（測試檔是 pytest 入口）。重構砍掉 N 個 endpoint 必對應 grep `tests/**/test_<module>*.py` 整批處置。任何補列「殘留 N 個」前必跑同性質 pattern 全掃。

## 8. 禁止在 main 上修改

所有框架定義檔的修改必須在 worktree 分支上執行，嚴禁直接在 main 分支上修改任何檔案。違反此規則視為嚴重違規，必須回滾並重新執行。此規範適用於所有 PROXY 及 MIS。

## 9. Worktree 洩漏偵測

派工前記錄 main 分支 git status 快照：
```bash
git -C <MAIN_REPO> status --porcelain > /tmp/main-status-before.txt
```
PROXY 完成後比對：
```bash
git -C <MAIN_REPO> status --porcelain > /tmp/main-status-after.txt
diff /tmp/main-status-before.txt /tmp/main-status-after.txt
```
若 main 出現新增的未提交變更 → 標記為 worktree 洩漏違規，退回 MIS 處理。

## 10. 兩階段派工確認（實作部門）

派工實作部門（DEV/QC/MIS）時，確認派工方式為兩階段：

- **第一階段**：僅派工主執行者（`run_in_background=true`），不派工觀測者
- **等待 commit**：主執行者完成後，驗證 worktree 中有對應 commit
- **第二階段**：確認 commit 後，同時派工兩位觀測者（`run_in_background=true`）

研究部門（RES/QA/SEC/PRD）不走兩階段，維持同時派工三個 PROXY。

## 11. RES 起點產出驗證

RES 啟動後（流程起點），秘書確認上游產出已落袋：

1. **REPO.md 讀取確認**：讀取 .shiftblame/REPO.md 作為專案現狀參考。
2. **執行準則確認**：確認 RES result 中含明確的執行準則
3. **老闆確認**：透過 AskUserQuestion 確認 RES 起點產出可接受

驗證不通過 → 退回 RES 補齊（不進入 QA）。

## 12. 模型額度檢視（全 CLI）

每次派工前，秘書讀取 onwatch 日誌（`~/.onwatch/data/.onwatch.log`），執行五個 provider 的額度狀態查詢。秘書動態判斷自身及各 CLI 的當前供應商（讀取 settings.json / settings.proxy.json 的 env 設定），不硬編碼供應商名稱。

供應商判斷規則（讀取各 CLI 的 settings.json / settings.proxy.json）：
- 若含 `ANTHROPIC_BASE_URL` → 該 URL 對應的供應商（如 api.z.ai → Z.ai，api.minimax.io → MiniMax）
- 若不含 `ANTHROPIC_BASE_URL` → Claude 官方訂閱（對應 onwatch `Anthropic poll complete` 資料）

### 12.1 額度查詢指令

```bash
# 讀取最近 onwatch 額度資料
tail -200 ~/.onwatch/data/.onwatch.log | grep -E "(Codex poll complete|Gemini poll complete|Anthropic poll complete|Z.ai poll complete|MiniMax poll complete)" | tail -30
```

### 12.2 額度報告格式（長條圖 + 秘書/PROXY 分離）

額度報告在秘書→老闆通訊層流通，不寫入 PROXY 可讀取的通訊檔案。秘書根據當前 settings.json / settings.proxy.json 動態判斷各 CLI 供應商與模型，對應 onwatch poll 資料。

報告必須：
1. 明確區分「秘書模型」與「三家 PROXY CLI」，標示各自使用的模型與供應商
2. 一律使用長條圖（█░）顯示各家 CLI 剩餘額度百分比

```
╔════════════════════════════════════════════════════╗
║              額度狀態長條圖（剩餘 %）               ║
╠════════════════════════════════════════════════════╣
║ 【秘書】<模型名> / <供應商>                        ║
║ ████████░░  <P>%                                   ║
║                                                    ║
║ 【Claude】<模型名> / <供應商>                       ║
║ ██████████  <P>%                                   ║
║                                                    ║
║ 【Codex】<模型名> / <供應商>                        ║
║ 5hr  ██████████  <P>%                              ║
║ 7day ███████░░░  <P>%                              ║
║                                                    ║
║ 【Gemini】<模型名> / <供應商>                       ║
║ pro  ██████████  <P>%                              ║
║ flash█████████░  <P>%                              ║
╚════════════════════════════════════════════════════╝
```

長條圖規則：
- 10 格寬度，每格代表 10%
- █ 表示已用額度區間，░ 表示剩餘額度區間
- 百分比為「剩餘額度」百分比

### 12.3 額度呈報老闆

秘書透過 AskUserQuestion 向老闆呈報各 CLI 額度摘要（使用 12.2 長條圖格式，含模型/供應商標示）：

```
AskUserQuestion({
  questions: [{
    question: "派工前額度呈報：\n\n╔════════════════════════════════════════════════════╗\n║              額度狀態長條圖（剩餘 %）               ║\n╠════════════════════════════════════════════════════╣\n║ （填入實際長條圖）                                  ║\n╚════════════════════════════════════════════════════╝\n\n是否繼續派工？",
    header: "額度呈報",
    options: [
      { label: "繼續派工", description: "按當前額度狀態繼續派工流程" },
      { label: "等待額度恢復", description: "暫停派工，等待額度恢復後再試" }
    ],
    multiSelect: false
  }]
})
```

### 12.4 秘書模型額度警告

讀取秘書當前供應商（從 settings.json env 設定判斷，不硬編碼供應商名稱）的 onwatch poll 資料。若供應商提供 tokens_percentage 指標且 tokens_percentage >= 80%，主動呈報老闆：

```
AskUserQuestion({
  questions: [{
    question: "秘書模型額度警告（tokens_percentage: <P>%）。是否切換供應商或休息？",
    header: "秘書模型額度警告",
    options: [
      { label: "切換供應商", description: "降載，改用其他供應商" },
      { label: "休息片刻", description: "等待額度恢復後再繼續" },
      { label: "繼續（無視警告）", description: "忽略警告，繼續當前操作" }
    ],
    multiSelect: false
  }]
})
```

此機制為秘書→老闆通訊層，不寫入 PROXY 可讀取的通訊檔案。

此警告機制為預警性質（閾值 80% 已用額度），與步驟 13.2 的排除條件（剩餘額度 < 10%）為不同維度：前者提醒注意，後者硬性排除。

### 12.5 去識別化合規

- 額度長條圖中標示各 CLI 的模型名與供應商（秘書→老闆通訊層，不寫入 PROXY 可讀取的通訊檔案）
- 秘書根據 settings.json / settings.proxy.json 動態判斷各 CLI 供應商與模型，不硬編碼對應關係
- 額度資訊僅在秘書→老闆通訊層流通，不寫入 PROXY 可讀取的通訊檔案
- onwatch poll 資料中的供應商名稱僅在秘書層內部使用

Claude 設定檔（settings.json、settings.proxy.json）鎖定不動。秘書不執行任何設定檔的編輯。

## 13. 動態調配決策

根據步驟 12 的 onwatch 額度資料，由秘書自動決定主執行者。取代固定輪流與指定主執行者機制。

### 13.1 調配資料來源

- onwatch 日誌（~/.onwatch/data/.onwatch.log）的 poll 資料
- 秘書動態判斷各 CLI 當前供應商（讀取 settings.json / settings.proxy.json 的 env 設定），不硬編碼供應商名稱
- 從對應供應商的 onwatch poll 取得額度資料

### 13.2 配方檔掃描與 CLI 指令動態組裝

派工前，秘書執行以下動作：

1. **掃描配方檔列表**：讀取 `~/.claude/cli-*.json` 取得所有可用配方檔
2. **動態選擇配方**：根據 task.md 中指定的供應商（不硬編碼供應商名稱），從配方檔中選擇對應該供應商的設定
3. **注入 --settings 參數**：由秘書在派工時動態注入 `--settings` 參數，指向所選定的配方檔

```
# 配方檔掃描範例
ls ~/.claude/cli-*.json  # 列出所有配方檔
# 根據 task.md frontmatter 中的供應商資訊動態選擇
```

此機制取代靜態的 `~/.claude/settings.proxy.json` 指向，由共識機制（consensus.md）決定 CLI 指令組裝方式。

### 13.2 排除條件

以下 CLI 額度吃緊時，排除其作為主執行者的候選資格：

| CLI | 排除條件 | 備註 |
|---|---|---|
| Codex | `five_hour remaining <= 10%` AND `seven_day remaining <= 10%` | 雙重額度吃緊 |
| Gemini | 所有模型的 `remaining < 10%` | 任一模型可用則不排除 |
| Claude | Claude PROXY 對應供應商（從 settings.proxy.json env 判斷）的 `remain/total < 10%` | OR 條件：任一指標達限額即排除 |

以上排除條件統一以「剩餘額度」為基準（剩餘 < 10% 即排除）。

### 13.3 動態調配演算法

```
1. 取得各 CLI 的當下額度狀態（來自步驟 12，透過動態供應商對應）
2. 排除已達限額的 CLI（依排除條件）
3. 若無任何 CLI 可用 → AskUserQuestion 向老闆呈報「全部 CLI 額度吃緊」，等待指示
4. 若只有一個 CLI 可用 → 該 CLI 為主執行者
5. 若多個 CLI 可用：
   a. 計算每個可用 CLI 的額度餘量分數。額度餘量分數 = 剩餘額度百分比（0-100）。差異 = |CLI_A分數 - CLI_B分數|（絕對值差）
   b. 按分數排序（分數高者優先）
   c. 若前兩名分數差異 < 20% → fallback 到公平序列的下一個（維持公平性）
   d. 若前兩名分數差異 >= 20% → 選擇分數最高者
6. 主執行者寫入 task.md frontmatter 的 lead_executor，observers 為其餘兩個 CLI
```

### 13.4 調配結果輸出

- **寫入 task.md frontmatter**：`lead_executor: <由步驟 13 動態調配選定的 CLI>`、`observers: [<其餘兩個 CLI>]`
- **不輸出**：調配原因（不寫入 PROXY 可讀取的通訊檔案）

### 13.5 Fallback 機制

當 onwatch 日誌無法讀取或額度資料不完整時，降級為公平序列 fallback：
- Fallback 順序：Claude → Codex → Gemini → Claude...
- **降級時須透過 AskUserQuestion 告知老闆**：「onwatch 不可用，暫時使用公平序列 fallback」

### 13.6 與步驟 3 的銜接

步驟 3 的主執行者選定說明已更新為「由步驟 13 動態調配選定」，YAML 註解同步更新。
