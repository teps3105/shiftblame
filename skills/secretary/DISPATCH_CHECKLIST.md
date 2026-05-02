# 派工前 Checklist

每次派工前逐條完成，不可跳過。

## 0. 模式確認

派工前確認本次 slug 的模式（初等 / 中等 / 高等）。模式已在 SKILL.md 運作流程步驟 6 確認，此處為覆核：

- **初等（basic）**：僅派工 MIS，不走 QA → SEC → PRD → DEV → QC 流程
- **中等（medium）**：MIS → DEV（可多輪）→ QC → MIS(尾)
- **高等（full）**：依完整流程依序派工

模式可升級也可降級（縮小範圍），降級不可逆轉。若模式未確認，退回 SKILL.md 運作流程步驟 6 完成確認。

若本次 slug 含子循環（MIS 研究結果拆分），確認以下事項：
- 各子循環的模式等級已在 meta.md 子循環紀錄表中明確標記
- 各子循環通訊目錄（`<DEPT>/cycle-N/`）已建立
- 子循環執行順序與依賴關係已在 meta.md 中記錄

## 1. 讀取專案資訊

```
Read REPO.md
```

從 REPO.md 提取約束條件（不是做法）：
- REPO.md 由 MIS 初始化（專案定位、方向、實作程度、待辦），由秘書在歸檔時更新
- 技術棧（語言、框架、測試工具）
- 測試指令（unit / integration 路徑與指令）
- 建置指令（build / compile）
- 部署方式（Docker / k8s / 其他）
- 已知約束（安全守則、狀態機、API 端點）

**REPO.md 不存在 = MIS 尚未啟動。** 須先派工 MIS 進行專案現狀釐清，完成後 REPO.md 才會建立。

**不讀 REPO.md 就派工 = 違規。**

## 2. Slug 名稱驗證（SEC-A-01）

```bash
[[ -z "$slug" ]] && fail    # 空字串
[[ "$slug" == *--* ]] && fail  # 雙連字號
[[ "$slug" =~ ^[a-z][a-z0-9-]{0,62}[a-z0-9]$ ]] || [[ "$slug" =~ ^[a-z0-9]$ ]] || fail
```

驗證失敗 → 不建任何目錄，回報老闆。

## 3. 寫入 task.md

task.md 只含**目標**和**約束**，不含任何做法指示。必須包含 YAML frontmatter 元數據區段。主執行者由秘書按固定順序輪換選定（Claude → Codex → Gemini → Claude...），每個 slug 的首次派工固定從 Claude 開始。老闆可透過 AskUserQuestion 覆蓋指名（見 SKILL.md 老闆指名機制），並寫入 YAML frontmatter。

```yaml
---
lead_executor: <由秘書按輪換順序遞進選定的 PROXY 名稱（每個 slug 首次從 Claude 開始（老闆可透過 AskUserQuestion 覆蓋指名））>
observers: [<其他兩個 PROXY 名稱>]
current_mode: <basic / medium / full>
worktree_path: <~/.shiftblame/shiftblame/<slug>/worktree/>
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
| MIS（初等模式） | 確認模式為初等模式、確認主執行者已由輪換制選定（固定從 Claude 開始）並寫入 task.md frontmatter、MIS 獨立執行 |
| MIS（中等/高等模式） | 確認主執行者已依輪換制選定（固定從 Claude 開始，按順序輪換）、單一 worktree 已建立、問題診斷完成 |
| MIS（尾，復判前） | 確認 MIS 部門報告（consensus.md）已產出且完整、三方 PROXY result.md 均存在、定義檔變更與 task.md 一致 |
| QA | user journey 需求確認：主業務 view 是什麼？user 從哪個 view 點哪個按鈕觸發？寫不出 = 不派工 |
| QC | 檢查 QC agent type 工具清單是否含任務所需工具（Web SPA 需要 chrome-devtools-mcp）。不足 = 不硬派 |
| 所有部門 | 確認 `.gitignore` 含 `.shiftblame/` |
| 實作部門 | 確認主執行者 worktree 已建立且位於 slug 層級、確認採兩階段派工（先主執行者，等待 commit 後再派工觀測者） |
| 研究部門（MIS 啟動/QA/SEC/PRD） | 確認採同時派工（三個 PROXY 同時派工，不走兩階段） |

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

研究部門（MIS 啟動階段/QA/SEC/PRD）不走兩階段，維持同時派工三個 PROXY。

## 11. MIS 起點產出驗證

MIS 啟動後（流程起點），秘書確認上游產出已落袋：

1. **REPO.md 讀取確認**：讀取 REPO.md 作為專案現狀參考。
2. **執行準則確認**：確認 MIS result 中含明確的執行準則
3. **老闆確認**：透過 AskUserQuestion 確認 MIS 起點產出可接受

驗證不通過 → 退回 MIS 補齊（不進入 QA）。
