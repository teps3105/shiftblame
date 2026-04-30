# Worktree SOP

shiftblame 自定義 worktree（`~/.shiftblame/<repo>/<slug>/worktree/`），非 Claude 內建 worktree。Worktree 位於通訊目錄內，無需額外 symlink。

## 建立

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")

mkdir -p ~/.shiftblame/"$REPO_NAME"/"$SLUG"
git worktree add ~/.shiftblame/"$REPO_NAME"/"$SLUG"/worktree -b feat/"$SLUG"
```

確認 `.gitignore` 含 `.shiftblame/`（獨立一行）。

## 清理

刪除 worktree 時：
1. `git worktree remove ~/.shiftblame/<repo>/<slug>/worktree`
2. 若整個 slug 目錄已無其他用途，可一併移除

## 結束時詢問老闆

```
AskUserQuestion({
  questions: [{
    question: "本輪工作完成。Worktree `<slug>` 要怎麼處理？",
    header: "Worktree",
    options: [
      { label: "刪除", description: "清理 worktree，回到主 repo" },
      { label: "保留迭代", description: "保留 worktree，繼續迭代" },
      { label: "保留待命", description: "保留但不動" }
    ],
    multiSelect: false
  }]
})
```
