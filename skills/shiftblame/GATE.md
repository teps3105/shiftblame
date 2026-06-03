# GATE — 閘門檢查與狀態機

## 初始化

觸發技能時檢查 `.shiftblame/REPO.md` 與 `.shiftblame/ROADMAP.md` 是否存在。

| 情境 | 動作 |
|------|------|
| 皆存在 | 通過 |
| 缺 REPO.md 或 ROADMAP.md | BLOCK：手動補齊 |
| 無 `.shiftblame/` | 自動建立 + 模板 |

## 狀態機

```
L1 宣告:   DECLARED ──BossConfirm FAIL──→ DECLARED
                └──agree──→ APPROVED
L2 產出:   APPROVED → EXECUTED（result.md）──BossConfirm──→ L3
                └──修改──→ DECLARED（更新宣告 + BossConfirm）
L3 紅隊:   L2 通過 → red.md → RED
L4 藍隊:   RED → blue.md → BLUE ──FAIL──→ EXECUTED（原地修復）
L5 結論:   BLUE → conclusion.md → CHECKED ──BossConfirm FAIL──→ DECLARED
                                                └──PASSED──→ 收尾
```

| 狀態 | 意義 | 必要檔案 |
|------|------|----------|
| DECLARED | 宣告已寫入，等待老闆確認 | task.md（含「## 宣告」） |
| APPROVED | 老闆同意宣告 | task.md |
| EXECUTED | result.md 已產出 | task.md + result.md |
| RED | red.md 已產出 | + red.md |
| BLUE | blue.md 已產出 | + blue.md |
| CHECKED | 五檔齊全，待老闆確認 | + conclusion.md |
| PASSED | 老闆確認通過 | — |

## 宣告-確認-執行閘門

每一輪任務開始前，管理者必須向老闆確認宣告內容：

1. 執行者在 task.md「## 宣告」寫入本輪計畫
2. 管理者向老闆 BossConfirm（繁體中文，L1 階段指標）
3. 老闆同意 → PENDING→APPROVED；不同意 → 調整重新確認

**計畫不可更動**：不得更動已 PASSED 的前輪計畫範圍。需更動→回溯或進路線圖。宣告更新後狀態回到 DECLARED，必須重新 BossConfirm。

## BossConfirm

`BossConfirm` 為老闆確認機制：必須等待老闆明確回覆通過、退回或調整；不得自行假設通過。

面向老闆全部使用繁體中文，預設老闆不懂技術。階段指標規則：必須使用「現在是 L*階段（名稱）」，不得以檔名為指標。選項文字使用中文（「同意」「不同意」「調整」），不得使用英文狀態機值。

`BossPreview`：DEV 期間即時觀看機制，不是正式閘門，不取代 BossConfirm。

## 審查序列

嚴格序列執行，紅藍不得並行：

1. 執行者寫入 result.md（EXECUTED）→ BossConfirm
2. L2 通過 → 呼叫紅隊寫入 red.md → 管理者驗證
3. red.md 有效 → 呼叫藍隊寫入 blue.md → 管理者驗證
4. 藍隊 FAIL → 退回 L2 原地修復（增量攻防，不刪除既有紀錄）
5. 藍隊 PASS → 管理者寫入 conclusion.md
6. 五檔齊全 → CHECKED → BossConfirm → PASSED

## 派工檢查

派工前確認 `SLUG.md` 與 `task.md` 存在。缺任一 → BLOCK。task.md frontmatter：`slug, role, round, status, created_at, trigger, review: local, upstream`。正文含 `# <ROLE>/<NNN>` 與 `## 宣告`。上游結論由管理者提供。PRD/SOP 非強制參照。

## Worktree 閘門

僅 AUTO 模式使用 worktree（`.worktrees/<slug>`）。MANUAL 在主工作目錄開分支。PLAN/OPERATE 不使用功能分支。

- **MANUAL**：`git checkout -b feat/<slug>`
- **AUTO**：`git worktree add .worktrees/<slug> -b feat/<slug>`
- 收尾（MANUAL）：merge → push → branch delete
- 收尾（AUTO）：merge → push → worktree remove → branch delete

## 退回規則

- L1 FAIL → 重新宣告。L2 FAIL → 返回 DECLARED 更新宣告。L4 藍隊 FAIL → 原地修復（增量攻防）。L5 FAIL → 退回 L1。DEV 退回前先 commit。定義問題→退回 PM；實作問題→原地修復。回溯→撤回該角色所有變更回到 001。

## 歸檔

所有角色 PASSED → merge --no-ff → push → branch delete（AUTO 額外 worktree remove）→ `mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/` → 更新 REPO.md + ROADMAP.md。

## 開新對話

每個 slug 收尾後建議開新對話。恢復：ROADMAP.md → REPO.md → 前一歸檔 SLUG.md。

## 上下文監控

管理者持續監控上下文用量。過高時強制觸發壓縮。compact hook 自動重新載入技能。
