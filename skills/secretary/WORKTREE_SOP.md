# Worktree SOP

shiftblame 自定義 worktree（`~/.shiftblame/<repo>/<slug>/<DEPT>/<proxy>/worktree/`），非 Claude 內建 worktree。Worktree 位於通訊目錄內，無需額外 symlink。

## 建立

**注意**：worktree 的建立與清理由 MIS 執行，非秘書。秘書僅負責在收尾流程中詢問老闆 worktree 處置意願。三個 PROXY 在同一部門執行時各自建立各自的 worktree（Claude/Codex/Gemini 各一個）。

### PROXY 隔離規範
1. **獨立隔離**：三個 PROXY（Claude / Codex / Gemini）在同一部門執行時，必須各自建立獨立的 worktree 以確保執行上下文完全隔離。
2. **禁止內建**：明確禁止使用 Claude Code 內建的 `.claude/worktrees/` 管理方式。
3. **路徑規範**：建立在 `~/.shiftblame/<repo>/<slug>/<DEPT>/<proxy>/worktree/`。

### 維護模式
維護模式（MIS 獨立執行）也需建立 worktree。所有框架定義檔修改必須在 worktree 上執行，維護模式也不例外。

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")

# 以 Gemini 為例
mkdir -p ~/.shiftblame/"$REPO_NAME"/"$SLUG"/"$DEPT"/gemini
git worktree add ~/.shiftblame/"$REPO_NAME"/"$SLUG"/"$DEPT"/gemini/worktree -b feat/"$SLUG"
```

確認 `.gitignore` 含 `.shiftblame/`（獨立一行）。

## 清理

worktree 清理由 MIS 執行（非秘書）。見 agents/MIS.md「日常作業」職責。三個 PROXY 的獨立 worktree 均需清理。

刪除 worktree 時：
1. `git worktree remove ~/.shiftblame/<repo>/<slug>/<DEPT>/<proxy>/worktree`（三個 PROXY 均需執行）
2. 若整個 slug 目錄已無其他用途，可一併移除

## 結束時詢問老闆

秘書在 MIS 收尾流程中詢問老闆 worktree 處置意願。實際清理操作由 MIS 執行。

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
