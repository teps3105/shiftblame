在目前 repo 根目錄建立 `.shiftblame` symlink 指向 `~/.shiftblame`。

步驟：
1. 取得 repo 根目錄：`REPO_ROOT=$(git rev-parse --show-toplevel)`
2. 確保 `~/.shiftblame` 目錄存在：`mkdir -p ~/.shiftblame/blame`
3. 確保 repo 對應的子目錄存在：
   ```bash
   REPO_NAME=$(basename "$REPO_ROOT")
   mkdir -p ~/.shiftblame/"$REPO_NAME"/docs ~/.shiftblame/"$REPO_NAME"/report
   ```
4. 如果 `$REPO_ROOT/.shiftblame` 已存在且是正確的 symlink → 回報「已連結」
5. 如果 `$REPO_ROOT/.shiftblame` 已存在但不是 symlink → 警告使用者並詢問是否覆蓋
6. 建立 symlink：`ln -sfn ~/.shiftblame "$REPO_ROOT/.shiftblame"`
7. 回報結果：`$REPO_ROOT/.shiftblame → ~/.shiftblame`
