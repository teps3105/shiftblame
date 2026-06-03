# START — 流程開始

## 1. 初始化

觸發技能時檢查 `.shiftblame/REPO.md` + `.shiftblame/ROADMAP.md`。缺任一 → BLOCK 或自動建立模板。

## 2. 恢復（若適用）

若存在未歸檔的 `.shiftblame/<slug>/SLUG.md`，讀取並恢復該 slug 工作狀態。不適用已歸檔 slug。

**階段恢復（FEATURE/AUTO）**：讀取 SLUG.md 管線狀態紀錄，判定最後 PASSED 的角色階段。PM PASSED → 接續 DEV；DEV PASSED → 接續 PM 或進入收尾。模式沿用 SLUG.md 記錄，不需重新選擇。直接進入步驟 6 建立新 task.md，再進入步驟 7 L1 宣告。

## 3. 模式選擇

依 MANAGE.md 決策表判定模式：

| 觸發 | 模式 |
|------|:----:|
| 未指定、功能/feature/新功能 | FEATURE（預設） |
| PM/PM模式/規劃/文件 | PM |
| DEV/DEV模式/維護/主分支 | DEV |
| AUTO/自動模式 + RAPID.md 存在 | AUTO |

無 RAPID.md 時不得使用 AUTO 模式。

## 4. 建立 SLUG.md

管理者協調建立 `.shiftblame/<slug>/SLUG.md`（見 TEMPLATES/SLUG/SLUG.md 模板）。

## 5. 建立功能分支（FEATURE/AUTO）

- FEATURE：`git checkout -b feat/<slug>`（主工作目錄）
- AUTO：`git worktree add .worktrees/<slug> -b feat/<slug>`
- PM/DEV：不建立分支，直接在 main

## 6. 建立第一份 task.md

管理者協調建立第一份 `<slug>/<ROLE>/<NNN>/task.md`（見 TEMPLATES/SLUG/task.md 模板）。PM/DEV 使用扁平目錄 `<slug>/<NNN>/`。

## 7. 進入 L1 宣告

執行者在 task.md 寫入宣告 → 管理者向老闆 BossConfirm → APPROVED → 開始工作。
