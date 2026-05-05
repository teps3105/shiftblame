# PROXY 自組織通訊協定 v2.0.0

> 所有路徑基於專案根目錄解析，執行時由 task.md 提供絕對路徑。

秘書是純邊界設定者：定義「要達成什麼」和「不能碰什麼」，不定義「怎麼做」。「怎麼做」由 subagent 自行協商。

> **術語說明**：本文件中的「PROXY」為框架術語，實際由 Hermes `delegate_task` 派工的三個 subagent 實作。三個 subagent 以 Subagent-A、Subagent-B、Subagent-C 標識，對應通訊目錄中的 `proxy-a`、`proxy-b`、`proxy-c`。

## 去識別化

subagent 彼此僅知透過 Hermes delegate_task 派工，不知底層模型。派工時不可指定具體 AI 模型或暗示 subagent 能力差異。

### 模型配置

`delegate_task` 沒有直接的 per-task `model` 參數。跨模型 subagent 派工透過以下方式實現：

- **`terminal()` 呼叫非互動 CLI（標準路徑）**：subagent 透過 `terminal()` 呼叫各 CLI 的非互動模式（`claude -p`、`codex exec`、`gemini -p`）進行實際工作。此方式三方 CLI 均支援，為目前的主要派工路徑
- **`acp_command` + `acp_args`（Gemini 專用）**：僅 Gemini CLI 原生支援 `--acp` 旗標，可作為 Gemini subagent 的 ACP 子程序模式。Claude CLI 和 Codex CLI 均不支援 `--acp`，不可使用此路徑
- **`delegation.model`（全域設定）**：Hermes config.yaml 的 `delegation.model` 為全域設定，所有 subagent 共用同一模型。此方式無法為三個 subagent 分別指定不同模型
- CLI 名稱由 Hermes config.yaml 管理，秘書動態讀取確認，不硬編碼供應商名稱
- 模型調整由老闆決定後手動執行

### 去識別化範圍

- task.md、consensus.md、result.md：不包含模型名稱
- subagent 可讀取的通訊檔案：不包含模型名稱
- 模型使用資訊僅存在於「秘書→老闆」通訊層（`clarify()` 對話），不寫入任何 subagent 可讀取的通訊檔案

### 秘書權限

- 秘書在派工前提醒老闆確認 API 額度是否適合進行作業
- 秘書不執行任何設定檔的編輯
- 模型調整由老闆決定後手動執行

## 通訊目錄結構

```
.shiftblame/<slug>/
├── meta.md              # 秘書寫入：記錄每輪派工的主執行者、當前模式等狀態
├── worktree/            # 執行部門主執行者使用的單一共用 worktree
└── <DEPT>/
    ├── task.md              # 秘書寫入：目標 + 約束（含 YAML frontmatter）
    ├── consensus.md         # subagent 寫入：分工 + 做法共識 + 產出結構
    ├── failure-notice.md   # subagent 寫入：失敗通知
    ├── proxy-a/{proposal,result}.md
    ├── proxy-b/{proposal,result}.md
    └── proxy-c/{proposal,result}.md
```

### 共識匯聚機制（部門類型差異）

| 部門類型 | execution_model | 共識機制 | consensus.md 寫入職責 |
|---|---|---|---|
| 研究部門（RES/SEC/QA/PRD） | equal_consensus | 三個 subagent 同時派工，各自產出分析，consensus.md 由 leader 彙整寫入 | leader 負責彙整 |
| 執行部門（DEV/QC/EXP/MIS） | lead_executor | 主執行者完成後 commit，觀測者檢閱，consensus.md 由 leader 產出 | leader 負責產出 |

**研究部門（equal_consensus）共識流程：**
1. 三個 subagent 同時派工
2. 各自提出 proposal
3. 辯論收斂（最多 2 輪）
4. leader 負責彙整寫入 consensus.md
5. 各自執行分工，寫入 result.md

**執行部門（lead_executor）共識流程：**
1. 主執行者派工（第一階段）
2. 主執行者完成後 commit
3. 觀測者派工檢閱（第二階段）
4. consensus.md 由 leader 產出（驗證摘要）

**QC/EXP 特殊約束：** QC/EXP 屬執行部門但無 worktree 編輯權（僅執行測試），主執行者和觀測者均僅執行測試，不直接修改 worktree。

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
| RES | Subagent-A | Subagent-B, Subagent-C | L5 | 1 | 2026-01-01T00:00:00Z |
| QA | Subagent-B | Subagent-A, Subagent-C | L5 | 1 | 2026-01-01T01:00:00Z |

## 當前狀態
- current_mode: L5
- 上次派工部門：QA
- 下次主執行者由公平序列輪替決定

## 模式變更紀錄
- 2026-01-01T02:00:00Z：降級 L4（原因：範圍縮小，不可逆轉）

## 子循環紀錄
| 子循環 | 模式 | 部門 | 狀態 | 時間 |
|--------|------|------|------|------|
| cycle-1 | L2 | RES | 完成 | 2026-01-01T00:00:00Z |
| cycle-2 | L3 | RES → DEV → QC → MIS | 進行中 | 2026-01-01T01:00:00Z |
```

> **註**：子循環紀錄表僅在需求拆分為多個子循環時才存在。無子循環時省略此區段。

## 動態增量紀錄

| 增量輪次 | 新增需求 | 模式 | 派工部門 | 狀態 | 時間 |
|----------|---------|------|---------|------|------|
| 1 | <需求描述> | L3 | RES | 完成 | 2026-01-01T00:00:00Z |

> **註**：動態增量紀錄表僅在使用「繼續補強」功能時才存在。無動態增量時省略此區段。

## task.md 格式（秘書寫入）

task.md 只包含兩樣東西：**目標**和**約束**。必須包含 YAML frontmatter 元數據區段。

```markdown
---
# execution_model 取代 lead_executor/observers
execution_model: <equal_consensus / lead_executor>
# equal_consensus: 研究部門(RES/SEC/QA/PRD)
# lead_executor: 執行部門(DEV/QC/EXP/MIS)（QC/EXP 無 worktree 編輯權，僅執行測試）
current_mode: <L2 / L3 / L4 / L5>
task_type: <research / implementation>  # research: 研究部門(RES/SEC/QA/PRD)；implementation: 執行部門(DEV/QC/EXP/MIS)
worktree_path: <.shiftblame/<slug>/worktree/>  # 研究部門 (RES/SEC/QA/PRD) 明確設為 none
---

# <DEPT> 任務

## 目標
<老闆的需求摘要，轉化為該部門需要達成的具體目標>

## 上游輸入
- QA 部門報告：<路徑>（如適用）
- SEC 部門報告：<路徑>（如適用）
- ...（所有上游部門結論檔路徑）

## 約束
- worktree 路徑：<路徑>（研究部門為 none，無 worktree）
- 技術棧：<從 .shiftblame/REPO.md 提取>
- 需求釐清結果：<如有>
- 其他不可違反的限制
```

## 禁止含
- 分工指示（誰做什麼）← subagent 自行決定
- 做法步驟（怎麼做）← subagent 自行決定
- 產出格式指示（長什麼樣）← subagent 自行決定
- 部門定義內容 ← subagent 自行讀取 agents/<DEPT>.md
```

**秘書禁止在 task.md 中寫「建議分工」或「做法步驟」。** 寫了 = 違規。

## 秘書派工步驟

1. 驗證 slug 名稱（SEC-A-01，見 DISPATCH_CHECKLIST.md）
2. 建立通訊目錄：`mkdir -p .shiftblame/<slug>/<DEPT>/{proxy-a,proxy-b,proxy-c}` 並初始化或更新 `meta.md`
3. 主執行者採公平序列輪替（見 DISPATCH_CHECKLIST.md 步驟 13），並寫入 `task.md`（目標 + 約束，包含 YAML frontmatter）
4. 依部門類型選擇派工方式：
   - **研究部門（RES/SEC/QA/PRD）**：同時派工三個 subagent（context 只含 task.md 路徑 + 通訊目錄路徑 + current_mode，物理性移除 worktree 路徑）
   - **執行部門（DEV/QC/EXP/MIS）**：兩階段派工（見下方，QC/EXP 無 worktree 編輯權，僅執行測試）

### 執行部門兩階段派工步驟

1. **第一階段**：僅派工主執行者（lead_executor）
2. **等待完成**：輪詢主執行者的 result.md，確認其完成回報
3. **驗證 commit**：確認 worktree 中有主執行者產出的 commit（`git -C <worktree> log --oneline -1`）（QC/EXP 不需此步驟）
4. **第二階段**：確認完成後，同時派工兩位觀測者（observers）
5. 等待觀測者完成驗證
6. leader 基於三份 result.md 產出 consensus.md（驗證摘要）

觀測者在主執行者完成後才開始檢閱，確保檢閱對象為已完成的穩定狀態。

### 執行部門共識產出

執行部門（DEV/QC/EXP/MIS）採兩階段派工，觀測者獨立驗證而非辯論收斂。consensus.md 產出方式：

- **研究部門**：consensus.md 由 leader 負責彙整（部門產出）
- **執行部門**：consensus.md 由 leader 產出（驗證摘要）

此為事實彙整（基於 result.md 的客觀摘要），非部門分析產出，不違反「秘書不得代建 MIS 部門報告」原則。MIS 部門報告的實質內容在各 subagent 的 result.md 中。

執行部門 consensus.md 格式：
```markdown
# <DEPT> 驗證摘要

## 主執行者
- Subagent-A：<已完成的工作摘要>

## 觀測者驗證結果
- Subagent-B：<通過 / 修正項目>
- Subagent-C：<通過 / 修正項目>

## 結論
- 狀態：SUCCESS / FAILED
```

## 部門完成閘門匯報

在每個部門任務完成（閘門開啟）時，秘書須向老闆匯報三個 subagent 的各自工作情況。匯報內容須包含：
- **分工執行**：誰完成了哪些具體份額。
- **風險吸收**：若有單點失效，誰吸收了誰的份額。
- **降級紀錄**：是否有發生降級為單體執行或技術分歧多數決的情形。
- **互助紀錄**：是否有 subagent 抓到並修正同事錯誤。

## delegate_task 呼叫範例

### 關於跨模型派工

`delegate_task` 沒有直接的 per-task `model` 參數。跨模型 subagent 派工透過以下方式實現：

- **`terminal()` 呼叫非互動 CLI（標準路徑）**：subagent 透過 `terminal()` 呼叫各 CLI 的非互動模式（`claude -p`、`codex exec`、`gemini -p`）進行實際工作。此方式三方 CLI 均支援，為目前的主要派工路徑
- **`acp_command` + `acp_args`（Gemini 專用）**：僅 Gemini CLI 原生支援 `--acp` 旗標。Claude CLI（截至 2.1.126）和 Codex CLI（截至 0.128.0）均不支援 `--acp`，不可使用 `acp_command` 路徑
- `acp_command` 和 `acp_args` 均支援**任務級別覆寫**（tasks[i]），但目前僅 Gemini 可實際使用

**ACP 支援現狀（2026-05-05 驗證）**：

| CLI | 版本 | `--acp` 支援 | 非互動模式 | 結論 |
|---|---|---|---|---|
| Claude | 2.1.126 | 不支援 | `claude -p` | 僅 `terminal()` 路徑 |
| Codex | 0.128.0 | 不支援 | `codex exec` | 僅 `terminal()` 路徑 |
| Gemini | 0.40.1 | 支援 | `gemini -p` | `acp_command` 或 `terminal()` 均可 |

### 研究部門（RES/SEC/QA/PRD）— 同時派工

同時派工三個 subagent。研究部門不需要 worktree（研究階段不涉及排他性編輯權）：

```
delegate_task(tasks=[
  {
    goal: "執行 <DEPT> 任務（Subagent-A）",
    context: "task.md 路徑: .shiftblame/<slug>/<DEPT>/task.md\n通訊目錄路徑: .shiftblame/<slug>/<DEPT>/\\ncurrent_mode: <L2/L3/L4/L5>",
    toolsets: ["terminal", "file"]
  },
  {
    goal: "執行 <DEPT> 任務（Subagent-B）",
    context: "task.md 路徑: .shiftblame/<slug>/<DEPT>/task.md\n通訊目錄路徑: .shiftblame/<slug>/<DEPT>/\\ncurrent_mode: <L2/L3/L4/L5>",
    toolsets: ["terminal", "file"]
  },
  {
    goal: "執行 <DEPT> 任務（Subagent-C）",
    context: "task.md 路徑: .shiftblame/<slug>/<DEPT>/task.md\n通訊目錄路徑: .shiftblame/<slug>/<DEPT>/\\ncurrent_mode: <L2/L3/L4/L5>",
    toolsets: ["terminal", "file"]
  }
])
```

> **subagent 如何使用不同 CLI**：subagent 透過 `terminal()` 呼叫其分配的非互動 CLI 進行實際工作。秘書在 context 中提供 CLI 分配資訊（Subagent-A/B/C 各自對應哪個 CLI），但 CLI 名稱不寫入 subagent 可讀取的通訊檔案（去識別化）。

### 執行部門（DEV/QC/EXP/MIS）— 兩階段派工

**第一階段**：僅派工主執行者

```
delegate_task(
  goal: "執行 <DEPT> 主執行者任務",
  context: "task.md 路徑: .shiftblame/<slug>/<DEPT>/task.md\n通訊目錄路徑: .shiftblame/<slug>/<DEPT>/\\nworktree 路徑: .shiftblame/<slug>/worktree/\\ncurrent_mode: <L2/L3/L4/L5>",
  toolsets: ["terminal", "file"]
)
```

**等待主執行者完成並驗證 commit 後**，進入第二階段：

```
delegate_task(tasks=[
  {
    goal: "執行 <DEPT> 觀測者檢閱（Subagent-B）",
    context: "task.md 路徑: .shiftblame/<slug>/<DEPT>/task.md\n通訊目錄路徑: .shiftblame/<slug>/<DEPT>/\\nworktree 路徑: .shiftblame/<slug>/worktree/\\ncurrent_mode: <L2/L3/L4/L5>",
    toolsets: ["terminal", "file"]
  },
  {
    goal: "執行 <DEPT> 觀測者檢閱（Subagent-C）",
    context: "task.md 路徑: .shiftblame/<slug>/<DEPT>/task.md\n通訊目錄路徑: .shiftblame/<slug>/<DEPT>/\\nworktree 路徑: .shiftblame/<slug>/worktree/\\ncurrent_mode: <L2/L3/L4/L5>",
    toolsets: ["terminal", "file"]
  }
])
```

### EXP 部門派工

EXP 屬執行部門，採主執行者機制，與其他執行部門共用兩階段派工流程。但 EXP 主執行者和觀測者均無 worktree 編輯權（僅執行測試）。

### context 參數說明

`delegate_task` 的 `context` 參數**最小化**，研究部門含 3 項，執行部門含 4 項：
1. task.md 路徑
2. 通訊目錄路徑
3. worktree 路徑（僅執行部門提供，研究部門物理性移除）
4. current_mode

**不注入**：部門定義、分工建議、具體做法、產出模板。這些都是 subagent 自己去讀、去決定的。

## subagent 自組織流程

```
1. 讀取 task.md（目標 + 約束）— 使用 read_file()
2. 角色判斷：根據 execution_model 區分處理方式（equal_consensus 為研究部門、主執行者為執行部門），在讀取 task.md 後立即判斷
3. 接入 slug 層級共用 worktree（由秘書建立，見 WORKTREE_SOP.md）
4. 讀取 agents/<DEPT>.md（部門職責 + 產出規格，自行讀取）— 使用 read_file()
5. 讀取上游輸入（task.md 中列出的路徑）— 使用 read_file()
6. 辯論收斂 → 寫入 consensus.md（直接論點比較，三方異議直接在共識階段表達）— 使用 write_file()
7. 各自執行分工 → 寫入 {proxy-x}/result.md — 使用 write_file()
```

subagent 可用的工具：
- `read_file()`：讀取檔案
- `write_file()`：寫入檔案
- `terminal()`：執行 shell 指令（如 git 操作、測試執行等）
- `clarify(question="...", choices=[...])`：向老闆提問（僅主代理可用，subagent 需透過秘書中繼）

## 共識流程

```
辯論收斂（直接論點比較）→ 寫入 consensus.md → 各自執行 → 寫入 {proxy-x}/result.md
```

consensus.md 必須包含：
```markdown
# <DEPT> 共識
## 分工
- Subagent-A：<工作項目>
- Subagent-B：<工作項目>
- Subagent-C：<工作項目>
## 做法
<三方同意的執行方案>
## 產出結構
<三方同意的最終產出格式>
```

## 分歧處理原則

技術分歧（實作方式、架構選擇、分工爭議）由 subagent 內部解決：
- 辯論收斂：最多 2 輪，異議必須附替代方案
- 互監督修正：提前完成的 subagent 審查同事作業，發現錯誤直接修正
- 吸收降級：單點失效時由其他 subagent 吸收份額

需求不明（不清楚老闆要什麼、規格有歧義）才透過秘書協調與老闆溝通，重新派工。
秘書不參與技術裁決。

## 子循環機制

當 RES 研究後將需求拆分為多個子循環時，適用以下規則：

- **觸發條件**：RES 研究後，秘書判斷需求可拆分為多個獨立子任務
- **獨立執行**：各子循環獨立執行流程，各自可有不同模式等級（L2/L3/L4/L5）
- **共用 worktree**：同一 slug 下的所有子循環共用同一 worktree
- **主執行者選定**：主執行者在每次派工時由公平序列輪替決定（部門級別，非 slug 級別）
- **通訊目錄**：各子循環的部門通訊目錄為 `<DEPT>/cycle-N/`（見通訊目錄結構）
- **紀錄**：子循環拆分結果記錄於 meta.md 的子循環紀錄表

## 部門分類

- **RES（純研究部門）**：RES 是流程的純研究起點，執行專案現狀釐清、執行準則確立、問題診斷、市調等研究工作。不走兩階段派工，維持三個 subagent 同時派工、各自分析的模型。RES 可單獨啟用、單獨收斂。
- **EXP（執行部門，用戶體驗驗證）**：EXP 是用戶視角驗證部門，採主執行者機制，但主執行者和觀測者均無 worktree 編輯權（僅執行測試）。EXP 與 SEC 為鏡像對應部門（用戶體驗驗證 ↔ 資安研究）。
- **MIS（純執行部門，收尾階段）**：MIS 是流程的實作終點與審計者，執行定義檔修正、合併準備、歸檔紀錄等實作工作。此階段涉及排他性編輯權，採兩階段派工。

## 派工規則

- **永遠三個 subagent**：每次派工固定派出三個 subagent（Subagent-A、Subagent-B、Subagent-C）
- **秘書不分工**：task.md 只有目標和約束，沒有分工和做法
- **執行部門主執行者必須在 worktree**：執行部門（DEV/QC/EXP/MIS）主執行者必須在 worktree；研究部門（RES/SEC/QA/PRD）不需要；觀測者具備受限寫入權（主動修正），但不需要獨立的 worktree 建立。QC/EXP 無 worktree 編輯權（僅執行測試）
- **執行部門採兩階段派工**：先派工主執行者，等待 commit 後再同時派工兩位觀測者。確保觀測者檢閱對象為已提交的穩定狀態
- **研究部門維持同時派工**：RES、SEC、QA、PRD 同時派工三個 subagent（研究階段不產生需要 commit 後才檢閱的排他性編輯權）

## 退回規則

- **採增量**：退回時 task.md 只列需補強的目標，不重寫已完成的部分
- **通訊文件增量重寫**：退回時既有的 proposal/result/consensus 以增量方式重寫內容，不刪除文件（`rm -f`）；subagent 重派後在原有文件上追加或修正，保留歷史決策脈絡
- **輸出文件增量重寫**：部門目錄內的報告（consensus.md + 各 subagent result.md）同樣以增量方式修正，不刪除重建
- **部門產出增量記錄（僅 L3/L4/L5 模式）**：L3/L4/L5 模式退回任意部門時，被退回部門在完成補強後，須於部門目錄內的報告文件（consensus.md）末尾增量追加退回紀錄，不得替換原有內容或覆蓋既有退回紀錄。每次退回都追加一組：
  ```markdown
  ## 退回紀錄
  - 退回來源：<部門名稱>
  - 退回原因：<簡述原因>
  - 退回時間：<ISO 8601 timestamp>
  - 退回輪次：Round N（僅 L3/L4/L5 模式的 DEV/QC 多輪時標記）
  ```
- **L2 模式例外**：退回增量記錄規則僅適用 L3/L4/L5 模式；L2 模式只有 RES 和 MIS，不存在跨部門退回（退回僅發生於 RES 與 MIS 之間）
- **文件結構不變**：退回前後的通訊目錄與產出檔案結構完全一致，不得新增或移除任何檔案

## 執行期限額偵測

subagent 執行 delegate_task 後，若偵測到以下 HTTP status code，自動寫入 failure-notice.md 並在 result.md 記錄詳情：

| HTTP Status | 含義 | 處理 |
|---|---|---|
| 429 | Rate Limited | 在 failure-notice.md 記錄 rate_limit_remaining（若有），觸發合作式失敗處理機制（規範二） |
| 503 | Service Unavailable | 在 failure-notice.md 記錄 retry_after（若有），觸發合作式失敗處理機制（規範二） |
| 529 | Site Overloaded | 在 failure-notice.md 記錄 retry_after（若有），觸發合作式失敗處理機制（規範二） |

## subagent 職責

- 自行讀取 task.md、agents/<DEPT>.md、上游輸入
- 自行決定分工、做法、產出結構
- 辯論收斂、執行、寫入 result.md
- **獨自執行時必須回報**：通訊目錄中只看到自己的 proposal → 停止並回報
- **技術分歧不外溢**：subagent 間的技術爭議必須在通訊目錄內解決，不透過秘書轉呈老闆。只有需求不明時才經秘書協調。
- **權限拒絕必須報錯**：在 result.md 記錄，不可假裝完成
- **EXP 部門**：無 worktree 編輯權（僅執行測試），發現問題僅記錄於報告，不直接修改

## 單點失效補救

| 情境 | 處理 |
|---|---|
| 單一 subagent 失敗（寫入 failure-notice.md） | 其他 subagent 讀取 failure-notice.md，依合作式失敗處理機制（規範二）吸收其份額 |
| 單一 subagent 達到限額（執行期偵測到 429/503/529） | 寫入 failure-notice.md + result.md 記錄詳情，觸發合作式失敗處理機制（規範二） |
| 二個 subagent 失敗 | 剩餘獨立完成，共識降級為單體，在 result.md 記錄降級原因 |
| 全部失敗 | 回報秘書暫停 |
| 共識含技術分歧 | subagent 互監督修正或重新辯論（最多 1 輪補充）；仍無法收斂時採多數決，在 consensus.md 記錄少數意見 |
| result 含 permission error | 標注「執行不完整」，秘書重新派工 |
| subagent 超時未回報（持續探測超過 5 次） | 其他 subagent 在 result.md 追加「探測超時」紀錄，評估是否需吸收 |

### 接替機制

當主執行者完全失效（執行失敗且無法恢復），需啟動接替流程：

1. **接替觸發**：主執行者的 failure-notice.md 顯示 CLI_UNAVAILABLE 或 AUTH_FAILURE 等不可恢復錯誤
2. **接替者選定**：依 task.md 的 observers 列表順序，第一個可用觀測者接替為代理主執行者
3. **權限轉移**：代理主執行者取得 worktree 的編輯權與 Git 操作權
4. **記錄**：在 consensus.md 追加接替紀錄（原主執行者、接替者、接替原因、時間）
5. **接替範圍**：代理主執行者僅承接剩餘分工，不重做已完成的工作
6. **通知**：接替後在通訊目錄標注接替事件

### 研究部門接替邏輯（equal_consensus）

研究部門（RES/SEC/QA/PRD）採 equal_consensus 模型，失敗時接替邏輯如下：
- 無固定主執行者，三個 subagent 平等
- 失敗時由其他兩方依可用性吸收份額
- 接替者僅承接剩餘分工，不重做已完成的工作
- 在 consensus.md 追加接替紀錄

## 部門執行模型

不同部門依職責性質採不同執行模型：

### 研究部門（RES/SEC/QA/PRD）

採 equal_consensus 模型，維持三人各自分析的現有模型：
- 三人各自從不同面向收集數據與分析
- leader 負責彙整寫入報告
- 另外兩人從不同角度檢視報告成色（正確性、完整性、一致性）

### 執行部門（DEV/QC/EXP/MIS）

採 lead_executor 模型，主執行者獨佔單一 worktree 的編輯權與 Git 操作權：
- 三人協調分工
- 主執行者負責實作/執行/測試並寫入實作報告
- 觀測者具備受限寫入權，可在檢閱過程中主動修正 worktree 上發現的錯誤
- 採用兩階段派工：先派工主執行者，等待其完成並 commit 後，再同時派工觀測者檢閱已提交的內容
- **QC/EXP 特殊約束**：QC/EXP 無 worktree 編輯權（僅執行測試），主執行者和觀測者均僅執行測試，不直接修改 worktree

### 觀測者主動修正規範

此規範適用於 DEV 和 MIS 部門的觀測者。QC/EXP 部門因無 worktree 編輯權，觀測者不具備修正權，發現問題僅記錄於報告。

執行部門的觀測者在檢閱過程中可主動修正 worktree 上發現的錯誤：
- 修正範圍：typo、版本號不一致、小規格偏差等輕微問題
- 不應修正：架構重寫、新增大型功能、修改測試邏輯
- 所有修正必須在 result.md 中以表格格式紀錄（檔案、行號、修改前後、原因）
- 觀測者不具 Git 操作權，修正後由主執行者負責 commit
- 秘書在閘門確認時審核觀測者的更動紀錄

#### 觀測者修正的 commit 時機

觀測者在檢閱過程中主動修正 worktree 後，commit 流程如下：
1. 觀測者在 result.md 中紀錄所有修正（檔案、行號、修改前後、原因）
2. 若主執行者仍在執行中 → 主執行者驗證修正內容後 commit（含觀測者修正）
3. 若主執行者已結束 → 觀測者在 result.md 中紀錄修正，秘書在閘門確認時通知主執行者補 commit（補 commit 後再進入閘門判定）
4. 秘書在閘門檢查點 2 驗證所有觀測者修正已被 commit

#### 雙觀測者衝突處理

兩位觀測者同時檢閱同一 worktree 時，可能發生同時修正同一檔案的情況。處理規則如下：
1. **先修改者優先**：先完成修正的觀測者優先，其修正直接生效
2. **後修改者責任**：後修改者在修改前必須確認該位置未被另一位觀測者修改（讀取另一位觀測者的 result.md 確認）
3. **衝突發生時**：若兩位觀測者確實修改了同一位置：
   - 後修改者發現衝突 → 不覆蓋先修改者的修正，在 result.md 中紀錄衝突
   - 透過通訊目錄協調（發起協調請求）
   - 由主執行者裁決最終內容
4. **通訊目錄協調機制**：觀測者在開始修正前，可先在通訊目錄寫入修正意圖（檔案、行號），另一位觀測者讀取後可避開衝突

## subagent 互助互監督機制

同一部門的三個 subagent 是命運共同體，一榮則榮一損則損。

### 核心原則

- subagent 應互相監督，發現同事的執行錯誤（配置錯誤、錯誤 worktree 路徑、指令語法錯誤、分工不合理等）時直接修正，不等秘書發現
- 提前完成作業的 subagent 不是發呆，而是監督同事的作業是否正確
- 各 subagent 的工具與指令定義是明文寫在 agents/*.md 中的，同事可以閱讀並驗證
- 部門績效基於：正確抓到同事錯誤 + 正確完成自己的份額

### 規範一：利益衝突檢核

當 subagent 執行有利益衝突的工作（例如：負責編輯定義檔的 subagent 同時決定版本升版），應依以下流程處理：
1. 檢核必要性：判斷該行為是否為框架約束所要求的必要行為，而非自行決定的擴權行為
2. 執行而非拒絕：若為框架約束所要求，應正常執行，不因利益衝突而拒絕
3. 第三方檢核：若無法判定是否為必要行為，應由無利益關係的第三方 subagent 檢核，並在通訊目錄記錄檢核結果

利益衝突不等同於不當行為。框架本身要求某些角色承擔多重職責，此為設計意圖，非利益衝突。

### 規範二：合作式失敗處理機制

當任一 subagent 執行失敗（任何失效偵測代碼觸發）時，採以下機制處理：

#### 失敗通知（failure-notice.md）

失敗的 subagent 必須立即在通訊目錄根層建立 failure-notice.md（按需建立，不需秘書初始化）：

```markdown
# 失敗通知
- **Subagent**：<PROXY-A/PROXY-B/PROXY-C>
- **回報代碼**：<CLI_UNAVAILABLE/RATE_LIMITED/QUOTA_EXCEEDED/AUTH_FAILURE/SERVICE_OVERLOADED/TIMEOUT/EXEC_FAILED(N)/EMPTY_OUTPUT>
- **已完成**：<已完成的分工項目清單>
- **未完成**：<未完成的分工項目清單>
- **時間**：<ISO 8601 timestamp>
```

通知優先級：failure-notice.md 高於 result.md。subagent 應先寫入 failure-notice.md，再處理 result.md 詳細記錄。

#### 持續探測

完成自己的份額後，subagent 進入持續探測模式（自組織工作流程步驟 7.5）：
1. 立即掃描通訊目錄是否有 failure-notice.md
2. 若無失敗通知 → 讀取同事 result.md 檢查狀態
3. 若同事尚未回報 → 每 30 秒重試，最多 5 次（2.5 分鐘）
4. 若同事超時未回報 → 在自己的 result.md 追加「探測超時」紀錄
5. 若有同事失敗 → 評估吸收可行性，執行吸收
6. 所有同事有回報或已處理 → 結束探測

#### 主動吸收（雙軌策略）

- **第一階段（即時）**：執行前掃描 failure-notice.md，若有失敗通知 → 合併自己的份額 + 失敗者的份額
- **第二階段（事後）**：完成自己的份額後，持續探測（步驟 7.5）發現新失敗 → 啟動額外執行吸收
- 吸收執行結果寫入自己的 result.md，標注「代理執行：<原 subagent> 的份額」

#### 協調分攤

- 發現同事失敗且自己的份額已過重 → 在通訊目錄發起協調請求
- 若三方中有兩方失敗 → 剩餘一方獨立完成，不需等待協調
- 吸收份額後明確記錄：原分配者、吸收原因、吸收內容

#### 非懲罰性

失敗不影響受限 subagent 的部門績效評估——這是基礎設施問題，非能力問題。

### 與秘書品質閘門的關係

秘書不是唯一的品質閘門——秘書會搞反意圖（單點失效），互監督機制是第二道防線；秘書的職責是流程管控（派工、閘門、收尾），互監督的職責是技術正確性。

### 秘書寫入權限限制

秘書零編輯權限。秘書的所有寫入操作限於以下路徑：
- 通訊目錄：`.shiftblame/<slug>/<DEPT>/`（task.md、result.md、consensus.md、failure-notice.md）

框架定義檔（`agents/`、`skills/`、`README.md` 等）的變更只能由 MIS 部門在 worktree 上執行。.shiftblame/REPO.md 的更新由秘書在歸檔時負責。
秘書載入流程中的 symlink 建立是指向操作，不是定義檔修改。

### 規範三：禁止在 main 上修改（嚴重違規）

所有框架定義檔的修改必須在 worktree 分支上執行，嚴禁直接在 main 分支上修改任何檔案。違反此規則視為嚴重違規，必須回滾並重新執行。此規範適用於所有 subagent 及 MIS。

## 資料存取限制

各部門僅能讀取自身及上游部門的產出，嚴格禁止讀取下游部門的檔案。

## 收尾規範

### 版本號制度（Semantic Versioning）

- 格式：major.minor.build
- 預設每次升級 build（第三段）
- 不主動升級 minor 或 major，除非老闆明確指示
- 版本重置為 major 版本時（如 2.0.0 → 1.0.0），需老闆明確指示
- 同一 slug 內版本號僅在首次實作輪升 build，後續退回修正/增量輪次不重複升版。版本號最終由秘書在 squash merge 前確認

### .shiftblame/REPO.md 重寫規範

.shiftblame/REPO.md 的更新由秘書在 push 成功後負責。MIS 在收尾階段僅做唯讀差異比較並產出差異報告，秘書依據差異報告更新 .shiftblame/REPO.md。

.shiftblame/REPO.md 必須包含以下區段：
- 技術棧
- 開發策略
- 測試流程
- 部署流程
- 安全規範
- 待辦事項

規則：
- 已完成的代辦項目直接刪除，不保留「已完成」狀態
- 不保留歷史版本演進表格（屬 git 歷史，非 .shiftblame/REPO.md 內容）

### README.md 重寫規範

- 以符合當前真實實作為準
- 不保留過往架構的字眼
- 格式模板可保留（badge header 等）
- 版本號與 plugin 設定檔保持一致

### 版本重置流程

當老闆指示版本重置時，MIS 須執行：
1. plugin 設定檔版本更新
2. README.md 版本更新
3. .shiftblame/REPO.md 版本更新（若 .shiftblame/REPO.md 含版本號）— 由秘書在 push 成功後執行
4. 確保三處版本號一致
