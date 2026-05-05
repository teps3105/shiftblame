# 派工前 Checklist v2.0.0

> 所有路徑基於專案根目錄解析，執行時由 task.md 提供絕對路徑。

每次派工前逐條完成，不可跳過。

## 0. 模式確認

派工前確認本次 slug 的模式（L1/L2/L3/L4/L5）。模式已在 SKILL.md 運作流程步驟 6 確認，此處為覆核：

- **L1（日常維護）**：秘書直接執行，不派工部門
- **L2（基本）**：RES → MIS 收尾，不走 SEC → QA → PRD → DEV → QC → EXP 流程
- **L3（標準）**：RES → PRD → DEV（可多輪）→ MIS(尾)
- **L4（完整）**：RES → QA → PRD → DEV（可多輪）→ QC → MIS(尾)
- **L5（高等）**：RES → SEC → QA → PRD → DEV（可多輪）→ QC → EXP → MIS(尾)

模式可升級也可降級（縮小範圍），降級不可逆轉。若模式未確認，退回 SKILL.md 運作流程步驟 6 完成確認。

若本次 slug 含子循環（RES 研究結果拆分），確認以下事項：
- 各子循環的模式等級已在 meta.md 子循環紀錄表中明確標記
- 各子循環通訊目錄（`<DEPT>/cycle-N/`）已建立
- 子循環執行順序與依賴關係已在 meta.md 中記錄

## 1. 讀取專案資訊

```
Read .shiftblame/REPO.md
```

從 `.shiftblame/REPO.md` 提取約束條件（不是做法）：
- `.shiftblame/REPO.md` 由 RES 初始化（專案定位、方向、實作程度、待辦），由秘書在歸檔時更新
- 技術棧（語言、框架、測試工具）
- 測試指令（unit / integration 路徑與指令）
- 建置指令（build / compile）
- 部署方式（Docker / k8s / 其他）
- 已知約束（安全守則、狀態機、API 端點）

**`.shiftblame/REPO.md` 不存在 = RES 尚未啟動。** 須先派工 RES 進行專案現狀釐清，完成後 `.shiftblame/REPO.md` 才會建立。

**不讀 `.shiftblame/REPO.md` 就派工 = 違規。**

## 2. Slug 名稱驗證（SEC-A-01）

```bash
[[ -z "$slug" ]] && fail    # 空字串
[[ "$slug" == *--* ]] && fail  # 雙連字號
[[ "$slug" =~ ^[a-z][a-z0-9-]{0,62}[a-z0-9]$ ]] || [[ "$slug" =~ ^[a-z0-9]$ ]] || fail
```

驗證失敗 → 不建任何目錄，回報老闆。

## 3. 寫入 task.md

task.md 只含**目標**和**約束**，不含任何做法指示。必須包含 YAML frontmatter 元數據區段。YAML 格式依 execution_model 動態決定：

**研究部門（RES/SEC/QA/PRD）格式：**
```yaml
---
execution_model: equal_consensus
current_mode: <L2 / L3 / L4 / L5>
task_type: research
worktree_path: none
---
```

**執行部門（DEV/QC/EXP/MIS）格式：**
```yaml
---
execution_model: 主執行者
current_mode: <L2 / L3 / L4 / L5>
task_type: implementation
worktree_path: <.shiftblame/<slug>/worktree/>
---
```

主執行者採公平序列輪替（Claude → Codex → Gemini → Claude...），並寫入 YAML frontmatter。

```
=== task.md 必含 ===
- 目標：<老闆需求轉化的具體目標>
- 上游輸入：所有上游部門結論檔路徑
- 約束：worktree 路徑 + `.shiftblame/REPO.md` 約束 + 需求釐清結果

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
| RES | 確認 execution_model 為 equal_consensus、RES 獨立研究（不走兩階段派工） |
| QC | 確認 execution_model: lead_executor、QC/EXP 無 worktree 編輯權（僅執行測試） |
| EXP | 確認 execution_model: lead_executor、QC/EXP 無 worktree 編輯權（僅執行測試） |
| MIS（L2 模式） | 確認模式為 L2 模式、確認主執行者已寫入 task.md frontmatter、MIS 執行收尾 |
| MIS（L3/L4/L5 模式） | 確認主執行者已寫入、單一 worktree 已建立 |
| MIS（尾，復判前） | 確認 MIS 部門報告（consensus.md）已產出且完整、三方 PROXY result.md 均存在、定義檔變更與 task.md 一致 |
| QA | user journey 需求確認：主業務 view 是什麼？user 從哪個 view 點哪個按鈕觸發？寫不出 = 不派工 |
| QC（L4/L5） | 檢查 QC agent type 工具清單是否含任務所需工具（Web SPA 需要 chrome-devtools-mcp）。不足 = 不硬派 |
| 所有部門 | 確認 `.gitignore` 含 `.shiftblame/` |
| 執行部門 | 確認主執行者 worktree 已建立且位於 slug 層級、確認採兩階段派工（先主執行者，等待 commit 後再派工觀測者） |
| 研究部門（RES/SEC/QA/PRD） | 確認 execution_model: equal_consensus（從 task.md frontmatter 讀取）、確認採同時派工（三個 PROXY 同時派工）、確認無需等待 commit（研究階段無排他性編輯權） |

## 6. QC/EXP 定位提醒

派工 QC 或 EXP 時 task.md 的目標中必須明確：
- QC 是破壞者（主動挖掘 BUG、邊緣案例、業務邏輯斷裂），不是規格驗收員
- EXP 是用戶視角驗證者，專注「用戶從哪個 view 點哪個按鈕觸發什麼行為」

## 7. 殭屍掃描注意

殭屍判準（無載入路徑）對「測試檔」失效（測試檔是 pytest 入口）。重構砍掉 N 個 endpoint 必對應 grep `tests/**/test_<module>*.py` 整批處置。任何補列「殘留 N 個」前必跑同性質 pattern 全掃。

## 8. 禁止在 main 上修改

所有框架定義檔的修改必須在 worktree 分支上執行，嚴禁直接在 main 分支上修改任何檔案。違反此規則視為嚴重違規，必須回滾並重新執行。此規範適用於所有 PROXY 及 MIS。

## 9. Worktree 洩漏偵測

派工明記錄 main 分支 git status 快照：
```bash
git -C <MAIN_REPO> status --porcelain > /tmp/main-status-before.txt
```
PROXY 完成後比對：
```bash
git -C <MAIN_REPO> status --porcelain > /tmp/main-status-after.txt
diff /tmp/main-status-before.txt /tmp/main-status-after.txt
```
若 main 出現新增的未提交變更 → 標記為 worktree 洩漏違規，退回 MIS 處理。

## 10. 兩階段派工確認（執行部門）

派工執行部門（DEV/QC/EXP/MIS）時，確認派工方式為兩階段（QC/EXP 無 worktree 編輯權，僅執行測試）：

- **第一階段**：僅派工主執行者（`run_in_background=true`），不派工觀測者
- **等待完成**：主執行者完成後，驗證結果
- **第二階段**：確認完成後，同時派工兩位觀測者（`run_in_background=true`）

研究部門（RES/SEC/QA/PRD）不走兩階段，維持同時派工三個 PROXY。

## 11. RES 起點產出驗證

RES 啟動後（流程起點），秘書確認上游產出已落袋：

1. **`.shiftblame/REPO.md` 讀取確認**：讀取 `.shiftblame/REPO.md` 作為專案現狀參考。
2. **執行準則確認**：確認 RES result 中含明確的執行準則
3. **老闆確認**：透過 AskUserQuestion 確認 RES 起點產出可接受

驗證不通過 → 退回 RES 補齊（不進入下一部門）。

## 12. 額度提醒（提醒老闆確認）

提醒老闆透過 onwatch 確認各 CLI 額度是否適合進行作業。秘書透過 AskUserQuestion 提醒老闆。此為秘書→老闆通訊層，不寫入 PROXY 可讀取的通訊檔案。

## 13. 主執行者選定

主執行者採公平序列輪替：Claude → Codex → Gemini → Claude...。老闆可透過 AskUserQuestion 指定主執行者。主執行者寫入 task.md frontmatter 的 lead_executor，observers 為其餘兩個 CLI。
