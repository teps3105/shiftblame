# Worktree SOP

shiftblame 自定義 worktree（`/home/derek/.worktree/<repo>/<slug>/`），非 Claude 內建 worktree。

## 建立

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")

git worktree add /home/derek/.worktree/<repo>/<slug> -b feat/<slug>

mkdir -p "$REPO_ROOT/.worktree"
ln -sfn /home/derek/.worktree/<repo>/<slug> "$REPO_ROOT/.worktree/<slug>"
```

確認 `.gitignore` 含 `.worktree/`（獨立一行）。

## 清理

刪除 worktree 時確認兩件事都完成：
1. `rm -rf /home/derek/.worktree/<repo>/<slug>`
2. `rm <repo_root>/.worktree/<slug>`

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
