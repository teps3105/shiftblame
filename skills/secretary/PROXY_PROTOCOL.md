# PROXY 自組織通訊協定

秘書是純邊界設定者：定義「要達成什麼」和「不能碰什麼」，不定义「怎麼做」。「怎麼做」由 PROXY 自行協商。

## 通訊目錄結構

```
~/.shiftblame/<repo>/<slug>/<DEPT>/
├── task.md              # 秘書寫入：目標 + 約束（見下方格式）
├── consensus.md         # PROXY 寫入：分工 + 做法共識 + 產出結構
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
- 老闆裁決：<如有>
- 其他不可違反的限制

## 不可包含
- 分工指示（誰做什麼）
- 做法指示（怎麼做）
- 產出格式指示（產出長什麼樣）
```

**秘書禁止在 task.md 中寫「建議分工」或「做法步驟」。** 寫了 = 違規。

## 秘書派工步驟

1. 驗證 slug 名稱（SEC-A-01，見 DISPATCH_CHECKLIST.md）
2. 建立通訊目錄：`mkdir -p ~/.shiftblame/<repo>/<slug>/<DEPT>/{claude,codex,gemini}`
3. 寫入 `task.md`（目標 + 約束，不含做法）
4. 同步派三方 PROXY（同一則訊息，prompt 只含 task.md 路徑 + 通訊目錄路徑 + worktree 路徑）

## Agent() 呼叫

```
Agent(subagent_type="shiftblame:CLAUDE_PROXY", prompt=proxy_prompt, name="<slug>-claude", run_in_background=true)
Agent(subagent_type="shiftblame:CODEX_PROXY", prompt=proxy_prompt, name="<slug>-codex", run_in_background=true)
Agent(subagent_type="shiftblame:GEMINI_PROXY", prompt=proxy_prompt, name="<slug>-gemini", run_in_background=true)
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

- **預設三個全派**
- **秘書不分工**：task.md 只有目標和約束，沒有分工和做法
- **補派至少 2 個**
- **所有部門必須在 worktree**
- **Gemini 使用帳號登入認證（`gemini auth login`），不需環境變數注入**

## 退回規則

- **採增量**：退回時 task.md 只列需補強的目標，不重寫已完成的部分
- **重用通訊目錄**：清空既有 proposal/result/consensus（`rm -f`）

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
| 單一 PROXY 失敗 | 其他自行吸收 |
| 二個 PROXY 失敗 | 剩餘獨立完成，共識降級為單體 |
| 全部失敗 | 回報秘書暫停 |
| 共識含技術分歧 | PROXY 互監督修正或重新辯論（最多 1 輪補充）；仍無法收斂時採多數決，在 consensus.md 記錄少數意見 |
| result 含 permission error | 標注「執行不完整」，秘書重新派工 |

## PROXY 互助互監督機制

同一部門的三個 PROXY 是命運共同體，一榮則榮一損則損。

### 核心原則

- PROXY 應互相監督，發現同事的執行錯誤（配置錯誤、錯誤 worktree 路徑、CLI 指令語法錯誤、分工不合理等）時直接修正，不等秘書發現
- 提前完成作業的 PROXY 不是發呆，而是監督同事的作業是否正確
- 各 PROXY 的 CLI 指令定義是明文寫在 agents/*.md 中的，同事可以閱讀並驗證
- 部門績效基於：正確抓到同事錯誤 + 正確完成自己的份額

### 與秘書品質閘門的關係

秘書不是唯一的品質閘門——秘書會搞反意圖（單點失效），互監督機制是第二道防線。秘書的職責是流程管控（派工、閘門、收尾），互監督的職責是技術正確性。

### 秘書寫入權限限制

秘書的所有寫入操作限於以下路徑：
- 通訊目錄：`~/.shiftblame/<repo>/<slug>/<DEPT>/`
- 部門常識：`~/.shiftblame/common/`

框架定義檔（`agents/`、`skills/`、`README.md`、`REPO.md` 等）的變更只能由 MIS 部門在 worktree 上執行。秘書載入流程中的 symlink 建立是指向操作，不是定義檔修改。

## 資料存取限制（金字塔累積制）

| 部門 | 可讀範圍 |
|---|---|
| QA | QA.md + QA/ |
| SEC | QA + SEC |
| PRD | QA + SEC + PRD |
| DEV | QA + SEC + PRD + DEV |
| QC | QA + SEC + PRD + DEV + QC |
| MIS | 全部（REPO.md + 所有部門） |

嚴格禁止讀下游部門的檔案。
