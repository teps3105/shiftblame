# PROXY 自組織通訊協定

秘書是純邊界設定者：定義「要達成什麼」和「不能碰什麼」，不定义「怎麼做」。「怎麼做」由 PROXY 自行協商。

## 去識別化

CLI 彼此僅知使用三種不同 CLI 框架，不知底層模型。派工時不可指定具體 AI 模型或暗示 CLI 能力差異。

## 通訊目錄結構

```
~/.shiftblame/<repo>/<slug>/<DEPT>/
├── task.md              # 秘書寫入：目標 + 約束（見下方格式）
├── consensus.md         # PROXY 寫入：分工 + 做法共識 + 產出結構
├── failure-notice.md   # PROXY 寫入：失敗通知（按需建立，見規範二）
├── claude/{proposal,result}.md
├── codex/{proposal,result}.md
└── gemini/{proposal,result}.md
```

## task.md 格式（秘書寫入）

task.md 只包含兩樣東西：**目標**和**約束**。不包含任何做法指示。

```markdown
# <DEPT> 任務

## 目標
<老闆的需求摘要，轉化為該部門需要達成的具體目標>

## 上游輸入
- QA.md：<路徑>（如適用）
- SEC.md：<路徑>（如適用）
- ...（所有上游部門結論檔路徑）

## 約束
- worktree 路徑：<路徑>
- 技術棧：<從 REPO.md 提取>
- 需求釐清結果：<如有>
- 其他不可違反的限制

## 不可包含
- 分工指示（誰做什麼）
- 做法指示（怎麼做）
- 產出格式指示（產出長什麼樣）
```

**秘書禁止在 task.md 中寫「建議分工」或「做法步驟」。** 寫了 = 違規。

## 秘書派工步驟

1. 驗證 slug 名稱（SEC-A-01，見 DISPATCH_CHECKLIST.md）
2. 建立通訊目錄：`mkdir -p ~/.shiftblame/<repo>/<slug>/<DEPT>/{三個 PROXY 子目錄}`
3. 寫入 `task.md`（目標 + 約束，不含做法）
4. 派工三個 PROXY（prompt 只含 task.md 路徑 + 通訊目錄路徑 + worktree 路徑）

## 部門完成閘門匯報

在每個部門任務完成（閘門開啟）時，秘書須向老闆匯報三方 PROXY 的各自工作情況。匯報內容須包含：
- **分工執行**：誰完成了哪些具體份額。
- **風險吸收**：若有單點失效，誰吸收了誰的份額。
- **降級紀錄**：是否有發生降級為單體執行或技術分歧多數決的情形。
- **互助紀錄**：是否有 PROXY 抓到並修正同事錯誤。

## Agent() 呼叫

永遠派三個 PROXY：

```
Agent(subagent_type="shiftblame:CLAUDE_PROXY", prompt=proxy_prompt, name="<slug>-claude", run_in_background=true, isolation="worktree")
Agent(subagent_type="shiftblame:CODEX_PROXY", prompt=proxy_prompt, name="<slug>-codex", run_in_background=true, isolation="worktree")
Agent(subagent_type="shiftblame:GEMINI_PROXY", prompt=proxy_prompt, name="<slug>-gemini", run_in_background=true, isolation="worktree")
```

proxy_prompt **最小化**，只含三樣東西：
1. task.md 路徑
2. 通訊目錄路徑
3. worktree 路徑

**不注入**：部門定義、分工建議、具體做法、產出模板。這些都是 PROXY 自己去讀、去決定的。

## PROXY 自組織流程

```
1. 讀取 task.md（目標 + 約束）
2. 讀取 agents/<DEPT>.md（部門職責 + 產出規格，自行讀取）
3. 讀取上游輸入（task.md 中列出的路徑）
4. 各自提出 proposal（分工 + 做法 + 產出結構）
5. 辯論收斂 → 寫入 consensus.md
6. 各自執行分工 → 寫入 result.md
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

## 派工規則

- **永遠三個 PROXY**：每次派工固定派出三個 PROXY（三種 CLI 框架各一）
- **秘書不分工**：task.md 只有目標和約束，沒有分工和做法
- **所有部門必須在 worktree**
- **Gemini 使用帳號登入認證（`gemini auth login`），不需環境變數注入**

## 退回規則

- **採增量**：退回時 task.md 只列需補強的目標，不重寫已完成的部分
- **通訊文件增量重寫**：退回時既有的 proposal/result/consensus 以增量方式重寫內容，不刪除文件（`rm -f`）；PROXY 重派後在原有文件上追加或修正，保留歷史決策脈絡
- **輸出文件增量重寫**：部門產出（如 QA.md、SEC.md 等）同樣以增量方式修正，不刪除重建
- **部門產出增量記錄（僅開發模式）**：開發模式退回任意部門時，被退回部門在完成補強後，須於該部門產出文件（如 QA.md、SEC.md、DEV.md）末尾增量追加退回紀錄，不得替換原有內容或覆蓋既有退回紀錄。每次退回都追加一組：
  ```markdown
  ## 退回紀錄
  - 退回來源：<部門名稱>
  - 退回原因：<簡述原因>
  - 退回時間：<ISO 8601 timestamp>
  ```
- **維護模式例外**：退回增量記錄規則僅適用開發模式；維護模式只有 MIS，不存在跨部門退回
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

## 部門執行模型

不同部門依職責性質採不同執行模型：

### 非實作部門（QA/SEC/PRD）

職責不變更 worktree（權限也不可變更 worktree）。採單向流程執行模式：
- 三人各自從不同面向收集數據與分析
- 統一由一人寫入報告
- 另外兩人從不同角度檢視報告成色（正確性、完整性、一致性）

### 實作部門（DEV/QC/OPS）

三人協調執行。採單向流程執行模式：
- 三人協調分工
- 統一由一人實作/執行/測試並寫入實作報告
- 其餘兩人同時檢視實作品質/規範與報告成色

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

### 規範二：合作式失敗處理機制（原職務代理人機制）

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

秘書不是唯一的品質閘門——秘書會搞反意圖（單點失效），互監督機制是第二道防線。秘書的職責是流程管控（派工、閘門、收尾），互監督的職責是技術正確性。

### 秘書寫入權限限制

秘書零編輯權限。秘書的所有寫入操作限於以下路徑：
- 通訊目錄：`~/.shiftblame/<repo>/<slug>/<DEPT>/`（task.md、proposal.md、result.md、consensus.md）

框架定義檔（`agents/`、`skills/`、`README.md`、`REPO.md` 等）的變更只能由 MIS 部門在 worktree 上執行。
秘書載入流程中的 symlink 建立是指向操作，不是定義檔修改。

### 規範三：禁止在 main 上修改（嚴重違規）

所有框架定義檔的修改必須在 worktree 分支上執行，嚴禁直接在 main 分支上修改任何檔案。違反此規則視為嚴重違規，必須回滾並重新執行。此規範適用於所有 PROXY 及 MIS。

## 資料存取限制（金字塔累積制）

資料存取採單向流程累積，僅能由上游逐層累積至當前部門。

| 部門 | 可讀範圍 |
|---|---|
| MIS | 全部（REPO.md + 所有部門） |
| QA | QA.md + QA/ |
| SEC | QA + SEC |
| PRD | QA + SEC + PRD |
| DEV | QA + SEC + PRD + DEV |
| QC | QA + SEC + PRD + DEV + QC |
| OPS | QA + SEC + PRD + DEV + QC + OPS |

嚴格禁止讀下游部門的檔案。
