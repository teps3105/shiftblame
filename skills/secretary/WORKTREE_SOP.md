# Worktree SOP v2.0.0

shiftblame 自定義 worktree（`.shiftblame/<slug>/worktree/`），非 Claude 內建 worktree。Worktree 位於 slug 層級目錄內。

## 建立

**注意**：worktree 與通訊目錄的建立權歸屬秘書（所有部門不負責建立 worktree 或通訊目錄）。清理由秘書執行（收尾流程）。僅主執行者（lead_executor）擁有 worktree 的寫入權，觀測者（observers）不需要建立獨立 worktree。

### 路徑規範
建立在 `.shiftblame/<slug>/worktree/`。

### 隔離規範
1. **單一共用**：所有部門共用同一個位於 slug 層級的 worktree。
2. **主執行者獨佔**：在實作階段，僅主執行者有權在 worktree 上進行編輯與 Git 操作。
3. **禁止內建**：明確禁止使用 Claude Code 內建的 `.claude/worktrees/` 管理方式。

### 建立指令
```bash
mkdir -p .shiftblame/"$SLUG"
git worktree add .shiftblame/"$SLUG"/worktree -b feat/"$SLUG"
```

確認 `.gitignore` 含 `.shiftblame/`（獨立一行）。

## 清理

worktree 清理由秘書執行（見 SKILL.md 收尾流程）。單一共用 worktree 的清理指令：

```bash
git worktree remove .shiftblame/<slug>/worktree
```

若整個 slug 目錄已無其他用途，可一併移除。

## 結束時詢問老闆

秘書在 MIS 收尾流程中詢問老闆 worktree 處置意願。實際清理操作由秘書執行。

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
