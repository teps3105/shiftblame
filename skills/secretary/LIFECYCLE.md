# 生命週期收尾

MIS 回報 SUCCESS 後執行（MIS 為單向流程終點，收尾包含歸檔。終點階段不可跳過）。

## 雙模式歸檔邏輯

### 維護模式
- MIS 完成 → 秘書復判 → 復判通過 → 歸檔
- 歸檔前提：秘書確認 MIS 確實收尾且系統正確運作
- 歸檔閘門（SEC-A-03）：確認 MIS.md 存在且非空
- 執行歸檔 → Worktree 清理 → 合併推送

### 開發模式
- OPS 完成 → MIS 收尾 → 秘書復判 → 復判通過 → 歸檔
- 歸檔前提：秘書確認 MIS 確實收尾且系統正確運作
- 歸檔閘門（SEC-A-03）：確認 MIS.md 存在且非空
- 執行歸檔 → Worktree 清理 → 合併推送

## 0. 秘書復判

在 MIS 完成收尾後、執行歸檔（SEC-A-02）前，秘書必須進行復判：
- **查驗收尾**：確認 MIS 是否已依 `WORKTREE_SOP.md` 完成清理與合併準備。
- **功能複核**：確認本次變更後的系統是否仍正確運作（如：核心功能測試、定義檔完整性）。
- **復判通過**：秘書確認無誤後，方可發動歸檔流程。若復判不通過，應退回 MIS 修正。

## 1. 歸檔

歸檔操作由 MIS 在收尾階段執行（非秘書）。秘書在 MIS 回報收尾完成後確認歸檔結果。

```bash
# 歸檔閘門（SEC-A-03）
# MIS.md 由 MIS 部門產出，秘書不得代建。若不存在或為空，應退回 MIS 補齊。
if [[ ! -s ~/.shiftblame/<repo>/<slug>/MIS.md ]]; then
  echo "ERROR: MIS.md 不存在或為空，拒絕歸檔。應退回 MIS 補齊，秘書不得代建。" >&2
  exit 1
fi

# 原子歸檔（SEC-A-02）
mkdir -p ~/.shiftblame/<repo>/archive
mv ~/.shiftblame/<repo>/<slug> ~/.shiftblame/<repo>/archive/<slug>

# 驗證
test ! -e ~/.shiftblame/<repo>/<slug>/ || echo "WARN: 原 slug 路徑仍存在"
test -f ~/.shiftblame/<repo>/REPO.md || echo "WARN: REPO.md 不在原位"
! find ~/.shiftblame/<repo>/archive/<slug> -name "REPO.md" | grep -q . || echo "WARN: archive 含 REPO.md"
```

## 2. Worktree 清理

見 `WORKTREE_SOP.md`。Worktree 清理由 MIS 在收尾階段執行。
