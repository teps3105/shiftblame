# PROXY 自組織通訊協定

秘書是純邊界設定者：定義「要達成什麼」和「不能碰什麼」，不定義「怎麼做」。「怎麼做」由 PROXY 自行協商。

## 去識別化

CLI 彼此僅知使用三種不同 CLI 框架，不知底層模型。派工時不可指定具體 AI 模型或暗示 CLI 能力差異。

### 模型配置規範

- 當前對話（秘書）：透過預設 ~/.claude/settings.json 路由，鎖死不動。供應商由 settings.json env 設定決定，秘書動態讀取確認，不硬編碼供應商名稱
- claude -p PROXY：由秘书動態指定 CLI 配方檔（掃描 ~/.claude/cli-*.json 取得可用配方，根據供應商動態選擇），不靜態指向 settings.proxy.json。供應商由配方檔 env 設定決定，秘書動態讀取確認，不硬編碼供應商名稱
- Codex PROXY：透過 ~/.codex/config.toml 的 model 欄位，可切換
- Gemini PROXY：透過 ~/.gemini/settings.json 的 selected_model 欄位，可切換

**僅 Codex 和 Gemini 需要模型切換。Claude 相關設定檔（settings.json 和 settings.proxy.json）嚴禁修改。**

### 去識別化範圍

- task.md、consensus.md、result.md：不包含模型名稱
- PROXY 可讀取的通訊檔案：不包含模型名稱
- 模型使用資訊僅存在於「秘書→老闆」通訊層（AskUserQuestion 對話），不寫入任何 PROXY 可讀取的通訊檔案

### 秘書權限

- 秘書僅負責讀取 ~/.onwatch/data/.onwatch.log 取得配額狀態
- 秘書透過 AskUserQuestion 向老闆呈報各 CLI 配額狀態
- 秘書不執行任何 CLI 設定檔的編輯
- 模型調整由老闆決定後手動執行

## 通訊目錄結構

```
.shiftblame/<slug>/
├── meta.md              # 秘書寫入：記錄每輪派工的主執行者、當前模式等狀態
├── worktree/            # 實作部門主執行者使用的單一共用 worktree
└── <DEPT>/
    ├── task.md              # 秘書寫入：目標 + 約束（含 YAML frontmatter）
    ├── consensus.md         # PROXY 寫入：分工 + 做法共識 + 產出結構
    ├── failure-notice.md   # PROXY 寫入：失敗通知
    ├── claude/{proposal,result}.md
    ├── codex/{proposal,result}.md
    └── gemini/{proposal,result}.md
```

### 子循環通訊目錄

當 RES 研究後將需求拆分為多個子循環時，多個子循環共用同一 slug 通訊目錄。子循環以 `cycle-N` 子目錄區分：

```
.shiftblame/<slug>/
├── meta.md              # slug 級別狀態（含子循環紀錄）
├── worktree/            # 所有子循環共用同一 worktree
├── RES/
│   ├── cycle-1/
│   │   ├── task.md
│   │   ├── consensus.md
│   │   └── ...
│   └── cycle-2/
│       ├── task.md
│       ├── consensus.md
│       └── ...
└── DEV/
    ├── cycle-1/
    │   └── ...
    └── cycle-2/
        └── ...
```

- 各子循環可為不同模式等級
- 子循環下的部門通訊目錄為 `<DEPT>/cycle-N/`
- 無子循環時維持原有結構（`<DEPT>/` 直接存放）

## meta.md 格式（秘書寫入）

meta.md 位於通訊目錄根層（`.shiftblame/<slug>/meta.md`），由秘書在每輪派工時維護。記錄 slug 級別的跨部門狀態。

```markdown
# <slug> 狀態

## 派工紀錄
| 部門 | 主執行者 | 觀測者 | 模式 | 輪次 | 時間 |
|------|---------|--------|------|------|------|
| RES | Claude | Codex, Gemini | full | 1 | 2026-01-01T00:00:00Z |
| QA | Codex | Claude, Gemini | full | 1 | 2026-01-01T01:00:00Z |

## 當前狀態
- current_mode: full
- 上次派工部門：QA
- 下次主執行者由步驟 13 動態調配決定

## 模式變更紀錄
- 2026-01-01T02:00:00Z：降級 medium（原因：範圍縮小，不可逆轉）

## 子循環紀錄
| 子循環 | 模式 | 部門 | 狀態 | 時間 |
|--------|------|------|------|------|
| cycle-1 | basic | RES | 完成 | 2026-01-01T00:00:00Z |
| cycle-2 | medium | RES → DEV → QC → MIS | 進行中 | 2026-01-01T01:00:00Z |
```

> **註**：子循環紀錄表僅在需求拆分為多個子循環時才存在。無子循環時省略此區段。

## 動態增量紀錄

| 增量輪次 | 新增需求 | 模式 | 派工部門 | 狀態 | 時間 |
|----------|---------|------|---------|------|------|
| 1 | <需求描述> | basic | RES | 完成 | 2026-01-01T00:00:00Z |

> **註**：動態增量紀錄表僅在使用「繼續補強」功能時才存在。無動態增量時省略此區段。

## task.md 格式（秘書寫入）

task.md 只包含兩樣東西：**目標**和**約束**。必須包含 YAML frontmatter 元數據區段。

```markdown
---
lead_executor: <由步驟 13 動態調配選定的 PROXY 名稱>
observers: [<其他兩個 PROXY 名稱>]
current_mode: <basic / medium / full>
worktree_path: <.shiftblame/<slug>/worktree/>
---

# <DEPT> 任務

## 目標
<老闆的需求摘要，轉化為該部門需要達成的具體目標>

## 上游輸入
- QA 部門報告：<路徑>（如適用）
- SEC 部門報告：<路徑>（如適用）
- ...（所有上游部門結論檔路徑）

## 約束
- worktree 路徑：<路徑>
- 技術棧：<從 REPO.md 提取>
- 需求釐清結果：<如有>
- 其他不可違反的限制

## 禁止含
- 分工指示（誰做什麼）← PROXY 自行決定
- 做法步驟（怎麼做）← PROXY 自行決定
- 產出格式指示（長什麼樣）← PROXY 自行決定
- 部門定義內容 ← PROXY 自行讀取 agents/<DEPT>.md
```

**秘書禁止在 task.md 中寫「建議分工」或「做法步驟」。** 寫了 = 違規。

## 秘書派工步驟

1. 驗證 slug 名稱（SEC-A-01，見 DISPATCH_CHECKLIST.md）
2. 建立通訊目錄：`mkdir -p .shiftblame/<slug>/<DEPT>/{claude,codex,gemini}` 並初始化或更新 `meta.md`
3. 主執行者由步驟 13 動態調配選定（見 DISPATCH_CHECKLIST.md 步驟 13），並寫入 `task.md`（目標 + 約束，包含 YAML frontmatter）
4. 依部門類型選擇派工方式：
   - **實作部門（DEV/QC/MIS）**：兩階段派工（見下方）
   - **研究部門（RES/QA/SEC/PRD）**：同時派工三個 PROXY（prompt 只含 task.md 路徑 + 通訊目錄路徑 + worktree 路徑 + current_mode）

### 實作部門兩階段派工步驟

1. **第一階段**：僅派工主執行者（lead_executor），使用 `run_in_background=true`
2. **等待完成**：輪詢主執行者的 result.md，確認其完成回報
3. **驗證 commit**：確認 worktree 中有主執行者產出的 commit（`git -C <worktree> log --oneline -1`）
4. **第二階段**：確認 commit 後，同時派工兩位觀測者（observers），使用 `run_in_background=true`
5. 等待觀測者完成驗證
6. 秘書基於三份 result.md 彙整寫入 consensus.md（驗證摘要，見下方）

觀測者在主執行者 commit 後才開始檢閱，確保檢閱對象為已提交的穩定狀態。

### 實作部門共識產出

實作部門（DEV/QC/MIS）採兩階段派工，觀測者獨立驗證而非辯論收斂。consensus.md 產出方式與研究部門不同：

- **研究部門**：consensus.md 由主執行者透過辯論收斂產出（部門產出）
- **實作部門**：consensus.md 由秘書在觀測者全部完成後，基於三份 result.md 彙整寫入（驗證摘要）

此為事實彙整（基於三份 result.md 的客觀摘要），非部門分析產出，不違反「秘書不得代建 MIS 部門報告」原則。MIS 部門報告的實質內容在各 PROXY 的 result.md 中。

實作部門 consensus.md 格式：
```markdown
# <DEPT> 驗證摘要

## 主執行者
- <CLI>：<已完成的工作摘要>

## 觀測者驗證結果
- <CLI>：<通過 / 修正項目>
- <CLI>：<通過 / 修正項目>

## 結論
- 狀態：SUCCESS / FAILED
```

## 部門完成閘門匯報

在每個部門任務完成（閘門開啟）時，秘書須向老闆匯報三方 PROXY 的各自工作情況。匯報內容須包含：
- **分工執行**：誰完成了哪些具體份額。
- **風險吸收**：若有單點失效，誰吸收了誰的份額。
- **降級紀錄**：是否有發生降級為單體執行或技術分歧多數決的情形。
- **互助紀錄**：是否有 PROXY 抓到並修正同事錯誤。

## Agent() 呼叫

### 研究部門（RES/QA/SEC/PRD）— 同時派工

同時派工三個 PROXY。研究部門不需要 worktree（研究階段不涉及排他性編輯權）：

```
# 主執行者（範例：Claude）
Agent(subagent_type="shiftblame:CLAUDE_PROXY", prompt=proxy_prompt, name="<slug>-claude", run_in_background=true, mode="bypassPermissions", bypass_permissions_flag="--dangerously-skip-permissions")

# 觀測者（範例：Codex / Gemini）
Agent(subagent_type="shiftblame:CODEX_PROXY", prompt=proxy_prompt, name="<slug>-codex", run_in_background=true, mode="bypassPermissions", bypass_permissions_flag="--dangerously-bypass-approvals-and-sandbox --ephemeral")
Agent(subagent_type="shiftblame:GEMINI_PROXY", prompt=proxy_prompt, name="<slug>-gemini", run_in_background=true, mode="bypassPermissions", bypass_permissions_flag="--yolo --skip-trust")
```

### 實作部門（DEV/QC/MIS）— 兩階段派工

**第一階段**：僅派工主執行者

```
# 第一階段：僅派工主執行者
Agent(subagent_type="shiftblame:<LEAD_PROXY>", prompt=proxy_prompt, name="<slug>-<lead>", run_in_background=true, mode="bypassPermissions", isolation="worktree", bypass_permissions_flag="<lead_bypass_flag>")
```

**等待主執行者完成並驗證 commit 後**，進入第二階段：

```
# 第二階段：同時派工兩位觀測者
Agent(subagent_type="shiftblame:<OBSERVER_1_PROXY>", prompt=proxy_prompt, name="<slug>-<observer1>", run_in_background=true, mode="bypassPermissions", bypass_permissions_flag="<observer1_bypass_flag>")
Agent(subagent_type="shiftblame:<OBSERVER_2_PROXY>", prompt=proxy_prompt, name="<slug>-<observer2>", run_in_background=true, mode="bypassPermissions", bypass_permissions_flag="<observer2_bypass_flag>")
```

### CLI Bypass Flags 對照表

| CLI | Bypass Flags | 說明 |
|---|---|---|
| (通用) | mode="bypassPermissions" | 所有 CLI 共用的權限繞過模式 |
| claude -p | --dangerously-skip-permissions | 跳過權限確認 |
| codex exec | --dangerously-bypass-approvals-and-sandbox --ephemeral | 繞過 sandbox + 不保留 session |
| gemini -p | --yolo --skip-trust | 自動確認 + 跳過信任檢查 |

proxy_prompt **最小化**，只含四樣東西：
1. task.md 路徑
2. 通訊目錄路徑
3. worktree 路徑
4. current_mode

**不注入**：部門定義、分工建議、具體做法、產出模板。這些都是 PROXY 自己去讀、去決定的。

## PROXY 自組織流程

```
1. 讀取 task.md（目標 + 約束，確認 lead_executor/observers 角色）
2. 接入 slug 層級共用 worktree（由秘書建立，僅主執行者需要寫入權限，見 WORKTREE_SOP.md）
3. 讀取 agents/<DEPT>.md（部門職責 + 產出規格，自行讀取）
4. 讀取上游輸入（task.md 中列出的路徑）
5. 各自提出 proposal（分工 + 做法 + 產出結構）
6. 辯論收斂 → 寫入 consensus.md
7. 各自執行分工 → 寫入 result.md
```

proposal.md 格式：
```markdown
# <PROXY> 提案

## 分工
- 我負責：<工作項目>，因為 <能力理由>
- <另一 PROXY> 適合：<工作項目>，因為 <能力理由>
- <另一 PROXY> 適合：<工作項目>，因為 <能力理由>

## 做法
<我計劃怎麼完成我的分工>

## 產出結構
<我認為最終產出應該長什麼樣>

## 爭議
<對他人提案的不同意見，無則寫「無」>
```

## 共識流程

```
各自提出 proposal → 辯論收斂（最多 2 輪）→ 寫入 consensus.md → 各自執行 → 寫入 result.md
```

consensus.md 必須包含：
```markdown
# <DEPT> 共識
## 分工
- Claude：<工作項目>
- Codex：<工作項目>
- Gemini：<工作項目>
## 做法
<三方同意的執行方案>
## 產出結構
<三方同意的最終產出格式>
```

## 分歧處理原則

技術分歧（實作方式、架構選擇、分工爭議）由 PROXY 內部解決：
- 辯論收斂：最多 2 輪，異議必須附替代方案
- 互監督修正：提前完成的 PROXY 審查同事作業，發現錯誤直接修正
- 吸收降級：單點失效時由其他 PROXY 吸收份額

需求不明（不清楚老闆要什麼、規格有歧義）才透過秘書協調與老闆溝通，重新派工。
秘書不參與技術裁決。

## 子循環機制

當 RES 研究後將需求拆分為多個子循環時，適用以下規則：

- **觸發條件**：RES 研究後，秘書判斷需求可拆分為多個獨立子任務
- **獨立執行**：各子循環獨立執行流程，各自可有不同模式等級（basic/medium/full）
- **共用 worktree**：同一 slug 下的所有子循環共用同一 worktree
- **主執行者選定**：主執行者在每次派工時由步驟 13 動態調配決定（部門級別，非 slug 級別）
- **通訊目錄**：各子循環的部門通訊目錄為 `<DEPT>/cycle-N/`（見通訊目錄結構）
- **紀錄**：子循環拆分結果記錄於 meta.md 的子循環紀錄表

## 部門分類

- **RES（純研究部門）**：RES 是流程的純研究起點，執行專案現狀釐清、執行準則確立、問題診斷、市調等研究工作。不走兩階段派工，維持三方 PROXY 同時派工、各自分析的模型。RES 可單獨啟用、單獨收斂。
- **MIS（純實作部門，收尾階段）**：MIS 是流程的實作終點與審計者，執行定義檔修正、合併準備、歸檔紀錄等實作工作。此階段涉及排他性編輯權，採兩階段派工。

## 派工規則

- **永遠三個 PROXY**：每次派工固定派出三個 PROXY（三種 CLI 框架各一）
- **秘書不分工**：task.md 只有目標和約束，沒有分工和做法
- **實作部門主執行者必須在 worktree**：實作部門（DEV/QC/MIS）主執行者必須在 worktree；研究部門（RES/QA/SEC/PRD）不需要；觀測者具備受限寫入權（主動修正），但不需要獨立的 worktree 建立
- **實作部門採兩階段派工**：先派工主執行者，等待 commit 後再同時派工兩位觀測者。確保觀測者檢閱對象為已提交的穩定狀態
- **研究部門維持同時派工**：RES、QA、SEC、PRD 同時派工三個 PROXY（研究階段不產生需要 commit 後才檢閱的排他性編輯權）
- **Gemini 使用帳號登入認證（`gemini auth login`），不需環境變數注入**

## 退回規則

- **採增量**：退回時 task.md 只列需補強的目標，不重寫已完成的部分
- **通訊文件增量重寫**：退回時既有的 proposal/result/consensus 以增量方式重寫內容，不刪除文件（`rm -f`）；PROXY 重派後在原有文件上追加或修正，保留歷史決策脈絡
- **輸出文件增量重寫**：部門目錄內的報告（consensus.md + 各 PROXY result.md）同樣以增量方式修正，不刪除重建
- **部門產出增量記錄（僅中等/高等模式）**：中等/高等模式退回任意部門時，被退回部門在完成補強後，須於部門目錄內的報告文件（consensus.md）末尾增量追加退回紀錄，不得替換原有內容或覆蓋既有退回紀錄。每次退回都追加一組：
  ```markdown
  ## 退回紀錄
  - 退回來源：<部門名稱>
  - 退回原因：<簡述原因>
  - 退回時間：<ISO 8601 timestamp>
  - 退回輪次：Round N（僅中等/高等模式的 DEV/QC 多輪時標記）
  ```
- **初等模式例外**：退回增量記錄規則僅適用中等/高等模式；初等模式只有 RES 和 MIS，不存在跨部門退回（退回僅發生於 RES 與 MIS 之間）
- **文件結構不變**：退回前後的通訊目錄與產出文件結構完全一致，不得新增或移除任何文件

## 執行期限額偵測

PROXY 執行 `claude -p` / `codex exec` / `gemini -p` 後，若 stderr 含以下 HTTP status code，自動寫入 failure-notice.md 並在 result.md 記錄詳情：

| HTTP Status | 含義 | 處理 |
|---|---|---|
| 429 | Rate Limited | 在 failure-notice.md 記錄 rate_limit_remaining（若有），觸發合作式失敗處理機制（規範二） |
| 503 | Service Unavailable | 在 failure-notice.md 記錄 retry_after（若有），觸發合作式失敗處理機制（規範二） |
| 529 | Site Overloaded | 在 failure-notice.md 記錄 retry_after（若有），觸發合作式失敗處理機制（規範二） |

## PROXY 職責

- 自行讀取 task.md、agents/<DEPT>.md、上游輸入
- 自行決定分工、做法、產出結構
- 辯論收斂、執行、寫入 result.md
- **獨自執行時必須回報**：通訊目錄中只看到自己的 proposal → 停止並回報
- **技術分歧不外溢**：PROXY 間的技術爭議必須在通訊目錄內解決，不透過秘書轉呈老闆。只有需求不明時才經秘書協調。
- **權限拒絕必須報錯**：在 result.md 記錄，不可假裝完成

## 單點失效補救

| 情境 | 處理 |
|---|---|
| 單一 PROXY 失敗（寫入 failure-notice.md） | 其他 PROXY 讀取 failure-notice.md，依合作式失敗處理機制（規範二）吸收其份額 |
| 單一 PROXY 達到限額（執行期偵測到 429/503/529） | 寫入 failure-notice.md + result.md 記錄詳情，觸發合作式失敗處理機制（規範二） |
| 二個 PROXY 失敗 | 剩餘獨立完成，共識降級為單體，在 result.md 記錄降級原因 |
| 全部失敗 | 回報秘書暫停 |
| 共識含技術分歧 | PROXY 互監督修正或重新辯論（最多 1 輪補充）；仍無法收斂時採多數決，在 consensus.md 記錄少數意見 |
| result 含 permission error | 標注「執行不完整」，秘書重新派工 |
| PROXY 超時未回報（持續探測超過 5 次） | 其他 PROXY 在 result.md 追加「探測超時」紀錄，評估是否需吸收 |

### 接替機制

當主執行者完全失效（CLI 執行失敗且無法恢復），需啟動接替流程：

1. **接替觸發**：主執行者的 failure-notice.md 顯示 CLI_UNAVAILABLE 或 AUTH_FAILURE 等不可恢復錯誤
2. **接替者選定**：依 task.md 的 observers 列表順序，第一個可用觀測者接替為代理主執行者
3. **權限轉移**：代理主執行者取得 worktree 的編輯權與 Git 操作權
4. **記錄**：在 consensus.md 追加接替紀錄（原主執行者、接替者、接替原因、時間）
5. **接替範圍**：代理主執行者僅承接剩餘分工，不重做已完成的工作
6. **通知**：接替後在通訊目錄更新 proposal.md，標注接替事件

## 部門執行模型

不同部門依職責性質採不同執行模型：

### 非實作部門（QA/SEC/PRD）

維持現有模型，但主執行者身份已由步驟 13 動態調配選定並寫入 task.md frontmatter，研究階段不產生排他性編輯權。
- 三人各自從不同面向收集數據與分析
- 統一由主執行者寫入報告
- 另外兩人從不同角度檢視報告成色（正確性、完整性、一致性）

### 實作部門（DEV/QC/MIS）

改為主執行者獨佔單一 worktree 的編輯權與 Git 操作權，觀測者具備受限寫入權，可在檢閱過程中主動修正 worktree 上發現的錯誤。所有修正必須在 result.md 中明確紀錄（檔案、行號、修改前後、原因）。觀測者不具 Git 操作權，修正後由主執行者負責 commit。採用兩階段派工：先派工主執行者，等待其完成並 commit 後，再同時派工觀測者檢閱已提交的內容。
- 三人協調分工
- 統一由主執行者實作/執行/測試並寫入實作報告
- 觀測者在主執行者 commit 後才開始檢閱，負責檢閱實作品質/規範與報告成色

### 觀測者主動修正規範

實作部門的觀測者在檢閱過程中可主動修正 worktree 上發現的錯誤：
- 修正範圍：typo、版本號不一致、小規格偏差等輕微問題
- 不應修正：架構重寫、新增大型功能、修改測試邏輯
- 所有修正必須在 result.md 中以表格格式紀錄（檔案、行號、修改前後、原因）
- 觀測者不具 Git 操作權，修正後由主執行者負責 commit
- 秘書在閘門確認時審核觀測者的更動紀錄

#### 觀測者修正的 commit 時機

觀測者在檢閱過程中主動修正 worktree 後，commit 流程如下：
1. 觀測者在 result.md 中紀錄所有修正（檔案、行號、修改前後、原因）
2. 若主執行者 CLI session 仍存活 → 主執行者驗證修正內容後 commit（含觀測者修正）
3. 若主執行者 CLI session 已結束 → 觀測者在 result.md 中紀錄修正，秘書在閘門確認時通知主執行者補 commit（補 commit 後再進入閘門判定）
4. 秘書在閘門檢查點 2 驗證所有觀測者修正已被 commit

#### 雙觀測者衝突處理

兩位觀測者同時檢閱同一 worktree 時，可能發生同時修正同一檔案的情況。處理規則如下：
1. **先修改者優先**：先完成修正的觀測者優先，其修正直接生效
2. **後修改者責任**：後修改者在修改前必須確認該位置未被另一位觀測者修改（讀取另一位觀測者的 result.md 確認）
3. **衝突發生時**：若兩位觀測者確實修改了同一位置：
   - 後修改者發現衝突 → 不覆蓋先修改者的修正，在 result.md 中紀錄衝突
   - 透過通訊目錄協調（在 proposal.md 中發起協調請求）
   - 由主執行者裁決最終內容
4. **通訊目錄協調機制**：觀測者在開始修正前，可先在通訊目錄寫入修正意圖（檔案、行號），另一位觀測者讀取後可避開衝突

高等模式例外：DEV 依 PRD 的原子任務清單執行，每個原子任務為獨立派工單位，主執行者由步驟 13 動態調配選定。中等模式不受影響。

## PROXY 互助互監督機制

同一部門的三個 PROXY 是命運共同體，一榮則榮一損則損。

### 核心原則

- PROXY 應互相監督，發現同事的執行錯誤（配置錯誤、錯誤 worktree 路徑、CLI 指令語法錯誤、分工不合理等）時直接修正，不等秘書發現
- 提前完成作業的 PROXY 不是發呆，而是監督同事的作業是否正確
- 各 PROXY 的 CLI 指令定義是明文寫在 agents/*.md 中的，同事可以閱讀並驗證
- 部門績效基於：正確抓到同事錯誤 + 正確完成自己的份額

### 規範一：利益衝突檢核

當 PROXY 執行有利益衝突的工作（例如：負責編輯定義檔的 PROXY 同時決定版本升版），應依以下流程處理：
1. 檢核必要性：判斷該行為是否為框架約束所要求的必要行為，而非自行決定的擴權行為
2. 執行而非拒絕：若為框架約束所要求，應正常執行，不因利益衝突而拒絕
3. 第三方檢核：若無法判定是否為必要行為，應由無利益關係的第三方 PROXY 檢核，並在通訊目錄記錄檢核結果

利益衝突不等同於不當行為。框架本身要求某些角色承擔多重職責，此為設計意圖，非利益衝突。

### 規範二：合作式失敗處理機制

當任一 PROXY 執行失敗（任何失效偵測代碼觸發）時，採以下機制處理：

#### 失敗通知（failure-notice.md）

失敗的 PROXY 必須立即在通訊目錄根層建立 failure-notice.md（按需建立，不需秘書初始化）：

```markdown
# 失敗通知
- **PROXY**：<CLAUDE/CODEX/GEMINI>
- **回報代碼**：<CLI_UNAVAILABLE/RATE_LIMITED/QUOTA_EXCEEDED/AUTH_FAILURE/SERVICE_OVERLOADED/TIMEOUT/EXEC_FAILED(N)/EMPTY_OUTPUT>
- **已完成**：<已完成的分工項目清單>
- **未完成**：<未完成的分工項目清單>
- **時間**：<ISO 8601 timestamp>
```

通知優先級：failure-notice.md 高於 result.md。PROXY 應先寫入 failure-notice.md，再處理 result.md 詳細記錄。

#### 持續探測

完成自己的份額後，PROXY 進入持續探測模式（自組織工作流程步驟 7.5）：
1. 立即掃描通訊目錄是否有 failure-notice.md
2. 若無失敗通知 → 讀取同事 result.md 檢查狀態
3. 若同事尚未回報 → 每 30 秒重試，最多 5 次（2.5 分鐘）
4. 若同事超時未回報 → 在自己的 result.md 追加「探測超時」紀錄
5. 若有同事失敗 → 評估吸收可行性，執行吸收
6. 所有同事有回報或已處理 → 結束探測

#### 主動吸收（雙軌策略）

- **第一階段（即時）**：執行 CLI 前掃描 failure-notice.md，若有失敗通知 → 在 CLI prompt 中合併自己的份額 + 失敗者的份額
- **第二階段（事後）**：完成自己的份額後，持續探測（步驟 7.5）發現新失敗 → 啟動額外 CLI 執行吸收
- 吸收執行結果寫入自己的 result.md，標注「代理執行：<原 PROXY> 的份額」

#### 協調分攤

- 發現同事失敗且自己的份額已過重 → 在通訊目錄發起協調請求（寫入自己的 proposal.md 更新）
- 若三方中有兩方失敗 → 剩餘一方獨立完成，不需等待協調
- 吸收份額後明確記錄：原分配者、吸收原因、吸收內容

#### 非懲罰性

失敗不影響受限 PROXY 的部門績效評估——這是基礎設施問題，非能力問題。

### 與秘書品質閘門的關係

秘書不是唯一的品質閘門——秘書會搞反意圖（單點失效），互監督機制是第二道防線；秘書的職責是流程管控（派工、閘門、收尾），互監督的職責是技術正確性。

### 秘書寫入權限限制

秘書零編輯權限。秘書的所有寫入操作限於以下路徑：
- 通訊目錄：`.shiftblame/<slug>/<DEPT>/`（task.md、proposal.md、result.md、consensus.md）

框架定義檔（`agents/`、`skills/`、`README.md` 等）的變更只能由 MIS 部門在 worktree 上執行。REPO.md 的更新由秘書在歸檔時負責。
秘書載入流程中的 symlink 建立是指向操作，不是定義檔修改。

### 規範三：禁止在 main 上修改（嚴重違規）

所有框架定義檔的修改必須在 worktree 分支上執行，嚴禁直接在 main 分支上修改任何檔案。違反此規則視為嚴重違規，必須回滾並重新執行。此規範適用於所有 PROXY 及 MIS。

## 資料存取限制（金字塔累積制）

資料存取採單向流程累積，僅能由上游逐層累積至當前部門。

| 部門 | 可讀範圍 |
|---|---|
| RES | 全部（REPO.md + 所有部門） |
| MIS | 全部（REPO.md + 所有部門） |
| QA | QA.md + QA/ |
| SEC | QA + SEC |
| PRD | QA + SEC + PRD |
| DEV | QA + SEC + PRD + DEV |
| QC | QA + SEC + PRD + DEV + QC |

嚴格禁止讀下游部門的檔案。RES 和 MIS 作為頂層部門，不受「嚴格禁止讀下游」限制。

## 收尾規範

### 版本號制度（Semantic Versioning）

- 格式：major.minor.build
- 預設每次升級 build（第三段）
- 不主動升級 minor 或 major，除非老闆明確指示
- 版本重置為 major 版本時（如 8.4.0 → 1.0.0），需老闆明確指示
- 同一 slug 內版本號僅在首次實作輪升 build，後續退回修正/增量輪次不重複升版。版本號最終由秘書在 squash merge 前確認

### REPO.md 重寫規範

REPO.md 的更新由秘書在 push 成功後負責。MIS 在收尾階段僅做唯讀差異比較並產出差異報告，秘書依據差異報告更新 REPO.md。

REPO.md 必須包含以下區段：
- 技術棧
- 開發策略
- 測試流程
- 部署流程
- 安全規範
- 待辦事項

規則：
- 已完成的代辦項目直接刪除，不保留「已完成」狀態
- 不保留歷史版本演進表格（屬 git 歷史，非 REPO.md 內容）

### README.md 重寫規範

- 以符合當前真實實作為準
- 不保留過往架構的字眼
- 格式模板可保留（badge header 等）
- 版本號與 plugin.json 保持一致

### 版本重置流程

當老闆指示版本重置時，MIS 須執行：
1. .claude-plugin/plugin.json 版本更新
2. README.md 版本更新
3. REPO.md 版本更新（若 REPO.md 含版本號）— 由秘書在 push 成功後執行
4. 確保三處版本號一致
