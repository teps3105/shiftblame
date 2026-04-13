---
name: blame-init
description: >-
  初始化推鍋環境。建立 ~/.shiftblame/ 資料夾結構、repo symlink、.gitignore 檢查、commit 並推送。
  Use this skill when: the repo has no .shiftblame/ directory, or when the user says "初始化", "init", "/blame-init".
---

# shiftblame:init — 資料夾結構管理

初始化目標 repo 的推鍋環境：建立 `~/.shiftblame/` 完整目錄結構、repo 內 symlink、檢查 `.gitignore`、commit 並推送。

## 步驟

### 1. 取得 repo 資訊
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
```

### 2. 建立 ~/.shiftblame/ 完整目錄結構

#### blame 目錄（跨 repo 共用）
```bash
# 支援與維運
mkdir -p ~/.shiftblame/blame/ADM/LEAD
mkdir -p ~/.shiftblame/blame/MIS/LEAD
mkdir -p ~/.shiftblame/blame/OPS/{LEAD,cloud,infra}
mkdir -p ~/.shiftblame/blame/AUTO/{LEAD,ci,cd}
# 開發執行
mkdir -p ~/.shiftblame/blame/PM/LEAD
mkdir -p ~/.shiftblame/blame/DEV/{LEAD,fe,be,db}
mkdir -p ~/.shiftblame/blame/QA/{LEAD,unit,integ,e2e}
# 規劃決策
mkdir -p ~/.shiftblame/blame/PRD/LEAD
mkdir -p ~/.shiftblame/blame/ARC/LEAD
mkdir -p ~/.shiftblame/blame/MKT/LEAD
mkdir -p ~/.shiftblame/blame/QC/{LEAD,edge,fuzz,user}
mkdir -p ~/.shiftblame/blame/SEC/{LEAD,audit,consistency,red,blue}
# 特殊
mkdir -p ~/.shiftblame/blame/SECRETARY
```

#### repo 文件目錄（per repo）
```bash
mkdir -p ~/.shiftblame/"$REPO_NAME"/{MIS,OPS,AUTO,ADM}
mkdir -p ~/.shiftblame/"$REPO_NAME"/{PM,DEV,QA}
mkdir -p ~/.shiftblame/"$REPO_NAME"/{PRD,ARC,MKT,QC,SEC}
```

### 3. 建立 repo 內 symlink
```bash
mkdir -p "$REPO_ROOT/.shiftblame"
ln -sfn ~/.shiftblame/"$REPO_NAME" "$REPO_ROOT/.shiftblame/$REPO_NAME"
ln -sfn ~/.shiftblame/blame "$REPO_ROOT/.shiftblame/blame"
```

### 4. 檢查 .gitignore

確認 `.gitignore` 存在且包含必要項目：

```bash
GITIGNORE="$REPO_ROOT/.gitignore"

# 建立 .gitignore（若不存在）
touch "$GITIGNORE"

# 檢查並補上缺少的項目
for ENTRY in '.shiftblame/' '.worktree/'; do
  grep -qxF "$ENTRY" "$GITIGNORE" || echo "$ENTRY" >> "$GITIGNORE"
done
```

**驗證**：讀取 `.gitignore` 確認以下項目存在（每行獨立一條，不含多餘空白）：
```
.shiftblame/
.worktree/
```

若格式不對（例如項目被黏在其他行後面），修正為每項獨立一行。

### 5. Commit 並推送

```bash
cd "$REPO_ROOT"

# 檢查是否有需要 commit 的變更
if ! git diff --quiet "$GITIGNORE" 2>/dev/null || ! git diff --cached --quiet "$GITIGNORE" 2>/dev/null; then
  git add "$GITIGNORE"
  git commit -m "chore: 初始化 shiftblame 環境，更新 .gitignore"
  git push
fi
```

若 `.gitignore` 沒有變更（已經正確），跳過 commit。

### 6. 回報結果

```
✅ shiftblame:init 完成

symlink：
  .shiftblame/<repo> → ~/.shiftblame/<repo>/
  .shiftblame/blame  → ~/.shiftblame/blame/

目錄結構：
  blame/{ADM,MIS,OPS,AUTO}/...
  blame/{PM,DEV,QA}/...
  blame/{PRD,ARC,MKT,QC,SEC}/...
  blame/SECRETARY/
  <repo>/{MIS,OPS,AUTO,ADM}/
  <repo>/{PM,DEV,QA}/
  <repo>/{PRD,ARC,MKT,QC,SEC}/

.gitignore：✓ 已包含 .shiftblame/ 和 .worktree/
commit：[已推送 / 無需變更]
```
