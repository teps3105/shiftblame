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
                └──BossConfirm PASS──→ APPROVED
L2 產出:   APPROVED → EXECUTED（result.md，子代理）──BossConfirm FAIL──→ DECLARED
                └──BossConfirm PASS──→ L3
L3 紅隊:   L2 通過 → red.md（子代理）→ RED ──BossConfirm FAIL──→ DECLARED
                └──BossConfirm PASS──→ L4
L4 藍隊:   L3 通過 → blue.md（子代理）→ BLUE ──BossConfirm FAIL──→ DECLARED
                └──BossConfirm PASS──→ L5
L5 結論:   L4 通過 → conclusion.md（管理者）→ CHECKED ──BossConfirm FAIL──→ DECLARED
                                                        └──BossConfirm PASS──→ PASSED

全閘門 BossConfirm：DEV/FEATURE/PM 每個閘門均需老闆確認；AUTO 模式全閘門自動通過。L2~L5 FAIL 一律退回 DECLARED 重新宣告，不分模式。
```

| 狀態 | 意義 | 必要檔案 |
|------|------|----------|
| DECLARED | 宣告已寫入，等待老闆確認 | task.md（含「## 宣告」） |
| APPROVED | 老闆同意宣告 | task.md |
| EXECUTED | result.md 已產出（子代理） | task.md + result.md |
| RED | red.md 已產出（子代理），待 BossConfirm | + red.md |
| BLUE | blue.md 已產出（子代理），待 BossConfirm | + blue.md |
| CHECKED | 五檔齊全，待老闆確認 | + conclusion.md |
| PASSED | 老闆確認通過 | — |

## 宣告-確認-執行閘門

每一輪任務開始前，管理者必須向老闆確認宣告內容：

1. 管理者在 task.md「## 宣告」寫入本輪計畫
2. 管理者向老闆 BossConfirm（繁體中文，L1 階段指標）
3. 老闆同意 → PENDING→APPROVED；不同意 → 調整重新確認

**計畫不可更動**：不得更動已 PASSED 的前輪計畫範圍。需更動→回溯或進路線圖。宣告更新後狀態回到 DECLARED，必須重新 BossConfirm。

## BossConfirm

`BossConfirm` 為老闆確認機制：必須等待老闆明確回覆通過、退回或調整；不得自行假設通過。

面向老闆全部使用繁體中文，預設老闆不懂技術。階段指標規則：必須使用「現在是 L*階段（名稱）」，不得以檔名為指標。選項文字使用中文（「同意」「不同意」「調整」），不得使用英文狀態機值。

`BossPreview`：DEV 期間即時觀看機制，不是正式閘門，不取代 BossConfirm。

## 審查序列

嚴格序列執行，紅藍不得並行：

1. 子代理寫入 result.md（EXECUTED）→ 管理者 BossConfirm（L2 閘門）
2. L2 通過 → 子代理寫入 red.md → 管理者驗證
3. red.md 有效 → 管理者 BossConfirm（L3 閘門）
4. L3 通過 → 子代理寫入 blue.md → 管理者驗證
5. blue.md 有效 → 管理者 BossConfirm（L4 閘門）
6. L4 通過 → 管理者寫入 conclusion.md
7. 五檔齊全 → CHECKED → 管理者 BossConfirm（L5 閘門）→ PASSED

L2~L5 BossConfirm FAIL 一律退回 DECLARED 重新宣告，不分模式。

## 派工檢查

派工前確認 `SLUG.md` 與 `task.md` 存在。缺任一 → BLOCK。task.md frontmatter：`slug, role, round, status, created_at, trigger, review: local, upstream`。正文含 `# <ROLE>/<NNN>` 與 `## 宣告`。上游結論由管理者提供。PRD/SOP 非強制參照。

## Worktree 閘門

僅 AUTO 模式使用 worktree（`.worktrees/<slug>`）。FEATURE 在主工作目錄開分支。PM/DEV 不使用功能分支。

- **FEATURE**：`git checkout -b feat/<slug>`
- **AUTO**：`git worktree add .worktrees/<slug> -b feat/<slug>`
- 收尾（FEATURE）：merge → push → branch delete
- 收尾（AUTO）：merge → push → worktree remove → branch delete

## 退回規則

- L1~L5 BossConfirm FAIL 一律退回 DECLARED 重新宣告，不分模式。AUTO 模式全閘門自動通過。DEV 退回前先 commit。定義問題→退回 PM。回溯→撤回該角色所有變更回到 001。

## 歸檔

所有角色 PASSED → FEATURE/AUTO：merge --no-ff → push → branch delete（AUTO 額外 worktree remove）；PM/DEV：push → 歸檔 `mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/` → 更新 REPO.md + ROADMAP.md。

## 每角色階段對話隔離

所有模式下，每個對話只能執行一個角色階段（PM 或 DEV）。該角色階段 PASSED 後，管理者必須停止處理並提醒老闆開新對話。PM 與 DEV 不得在同一對話內執行。

階段內部流程不受影響：單一角色階段的 L1~L5 閘門、紅藍攻防、FAIL 重跑均在同一對話內完成。僅在該角色階段最終 PASSED 時才觸發對話邊界。

SLUG.md 管線狀態紀錄格式：`<ROLE>/<NNN> <STATUS>`（例：PM/001 PASSED）。新對話啟動時，管理者讀取最後一筆紀錄判定下一角色：PM PASSED → DEV；DEV PASSED → PM 或收尾。

## 開新對話

FEATURE/AUTO：每角色階段 PASSED 後**強制**開新對話。PM/DEV：slug 收尾後建議開新對話。恢復：SLUG.md → ROADMAP.md → REPO.md。

## 上下文監控

管理者持續監控上下文用量。過高時強制觸發壓縮。compact hook 自動重新載入技能。
