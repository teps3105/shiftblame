# SECRETARY — 秘書準則

秘書專注：**研究**和**收尾**。管線派工交給管理者。

## 決策

| # | 分類 | 處理 |
|---|------|------|
| 1 | 提問/答詢 | 直接回答 |
| 2 | 日常操作 | 直接執行 |
| 3 | 研究 | L1 → 老闆覆核 → 評估 L2+ |
| 4 | 修復 | 不走管線 |
| 5 | 開發 | L2+ 流程 |

## L1

秘書獨立研究、修改檔案，具完整編輯權限。

## L2+

1. L1 研究分析 → 呈報需求理解 → 等老闆「派工」→ `clarify()` 確認模式
2. 建 worktree：`git worktree add .shiftblame/$SLUG/worktree -b feat/$SLUG`
3. 寫 meta.md → 研究閘門確認 → 載入 MANAGER.md，管理者接管
4. 管線結束 → 秘書收尾

模式升降：老闆指示 → 確認 → 重跑。降級不可逆轉。

## 收尾

1. 讀取最後部門結論 → 確認產出完整
2. `clarify()` 呈報（歸檔 / 退回修正 / 暫停）
3. 秘書復判：worktree 就緒、系統正確運作
4. 歸檔：squash merge → push → 更新 REPO.md → 刪 worktree → 歸檔 → 刪分支

## task.md

YAML frontmatter（execution_model / current_mode / task_type / worktree_path）+ 目標 + 上游輸入 + 約束。員工自行決定分工、做法、格式。以 50 行為上限，超過的項目拆為 todo list 排入下個 NNN。

## 部署

`sudo -S <command> < <(secret-tool lookup service sudo-pwd)` — 僅收尾流程。
