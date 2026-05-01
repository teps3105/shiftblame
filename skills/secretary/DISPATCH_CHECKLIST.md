# 派工前 Checklist

每次派工前逐條完成，不可跳過。

## 0. 模式確認

派工前確認本次 slug 的模式（維護模式 / 開發模式）。模式已在 SKILL.md 運作流程步驟 5 確認，此處為覆核：

- **維護模式**：僅派工 MIS，不走 QA → SEC → PRD → DEV → QC 流程
- **開發模式**：依完整流程依序派工

模式確認後不可中途切換。若模式未確認，退回 SKILL.md 運作流程步驟 5 完成確認。

## 1. 讀取專案資訊

```
Read ~/.shiftblame/<repo>/REPO.md
```

從 REPO.md 提取約束條件（不是做法）：
- REPO.md 由 MIS 初始化與維護（專案定位、方向、實作程度、待辦）
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

task.md 只含**目標**和**約束**，不含任何做法指示。見 PROXY_PROTOCOL.md 的 task.md 格式。

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

proxy_prompt 只含三樣東西：
1. task.md 路徑
2. 通訊目錄路徑
3. worktree 路徑

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
| MIS（維護模式） | 確認模式為維護模式、MIS 維護輪不走流程、MIS 獨立執行（不派工其他部門） |
| MIS（開發模式） | 確認問題診斷完成、執行準則確立、REPO.md 更新狀況（MIS 為流程起點角色） |
| MIS（尾，復判前） | 確認 MIS.md 已產出且完整、三方 PROXY result.md 均存在、定義檔變更與 task.md 一致 |
| QA | user journey 需求確認：主業務 view 是什麼？user 從哪個 view 點哪個按鈕觸發？寫不出 = 不派工 |
| QC | 檢查 QC agent type 工具清單是否含任務所需工具（Web SPA 需要 chrome-devtools-mcp）。不足 = 不硬派 |
| 所有部門 | 確認 `.gitignore` 含 `.shiftblame/`，worktree 已建立 |

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

## 10. MIS 起點產出驗證

MIS 啟動後（流程起點），秘書確認上游產出已落袋：

1. **REPO.md 更新確認**：讀取 REPO.md，確認內容反映本次 MIS 起點的釐清結果（專案定位、方向、實作程度、待辦均已更新）
2. **執行準則確認**：確認 MIS result 中含明確的執行準則
3. **老闆確認**：透過 AskUserQuestion 確認 MIS 起點產出可接受

驗證不通過 → 退回 MIS 補齊（不進入 QA）。

## 11. Worktree 一致性檢查

所有部門完成後（每個部門閘門通過時），執行三個 PROXY worktree 內容一致性驗證：

```bash
diff -r <claude-worktree> <codex-worktree>
diff -r <claude-worktree> <gemini-worktree>
```

- 三個 worktree 內容必須完全相同（diff -r 無差異）
- 不一致 → 直接退回，不進入下一階段
- 秘書復判時亦須執行此檢查，不一致直接退回
