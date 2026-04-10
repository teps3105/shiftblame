在目前 repo 根目錄建立 `.shiftblame/` 子目錄，內含兩個 symlink：
- `.shiftblame/<repo>` → `~/.shiftblame/<repo>/`（本 repo 的 docs + report）
- `.shiftblame/blame` → `~/.shiftblame/blame/`（跨 repo 共用的鍋紀錄）

步驟：
1. 取得 repo 資訊：
   ```bash
   REPO_ROOT=$(git rev-parse --show-toplevel)
   REPO_NAME=$(basename "$REPO_ROOT")
   ```
2. 確保遠端目錄存在：
   ```bash
   mkdir -p ~/.shiftblame/"$REPO_NAME"/docs ~/.shiftblame/"$REPO_NAME"/report ~/.shiftblame/blame
   ```
3. 建立本地 `.shiftblame/` 子目錄：
   ```bash
   mkdir -p "$REPO_ROOT/.shiftblame"
   ```
4. 建立兩個 symlink：
   ```bash
   ln -sfn ~/.shiftblame/"$REPO_NAME" "$REPO_ROOT/.shiftblame/$REPO_NAME"
   ln -sfn ~/.shiftblame/blame "$REPO_ROOT/.shiftblame/blame"
   ```
5. 確保 `.gitignore` 包含 `.shiftblame/`：
   ```bash
   grep -qxF '.shiftblame/' "$REPO_ROOT/.gitignore" 2>/dev/null || echo '.shiftblame/' >> "$REPO_ROOT/.gitignore"
   ```
6. 回報結果：
   ```
   .shiftblame/<repo> → ~/.shiftblame/<repo>/
   .shiftblame/blame  → ~/.shiftblame/blame/
   ```
