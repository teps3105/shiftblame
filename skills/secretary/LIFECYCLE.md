# 生命週期收尾

MIS 回報 SUCCESS 後執行（MIS 為單向流程終點，收尾包含歸檔。終點階段不可跳過）。

## 三級歸檔邏輯

### 初等（basic）
- MIS(獨立執行) → 秘書復判 → 歸檔
- 適用於框架定義檔維護、文件更新等小規模工作

### 中等（medium）
- MIS(起) → DEV（可多輪）→ QC → MIS(尾) → 秘書復判 → 歸檔
- 功能開發、bug 修復等中等規模工作

### 高等（full）
- MIS(起) → QA → SEC → PRD → DEV（可多輪）→ QC → MIS(尾) → 秘書復判 → 歸檔
- 大型功能、架構重構等大規模工作

## 0. 秘書復判

在 MIS 完成收尾後、執行歸檔（SEC-A-02）前，秘書必須進行復判：
- **查驗收尾**：確認 MIS 是否已依 `WORKTREE_SOP.md` 完成清理與合併準備。
- **功能複核**：確認本次變更後的系統是否仍正確運作（如：核心功能測試、定義檔完整性）。
- **復判通過**：秘書確認無誤後，方可發動歸檔流程。若復判不通過，應退回 MIS 修正。

## 1. 歸檔

歸檔操作由秘書執行。秘書在復判通過後確認歸檔結果。

```bash
# 歸檔閘門（SEC-A-03）
# MIS 部門報告（consensus.md + 各 PROXY result.md）由 MIS 部門產出，秘書不得代建。若 consensus.md 不存在或為空，應退回 MIS 補齊。
if [[ ! -s ~/.shiftblame/<repo>/<slug>/MIS/consensus.md ]]; then
  echo "ERROR: MIS/consensus.md 不存在或為空，拒絕歸檔。應退回 MIS 補齊，秘書不得代建。" >&2
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

見 `WORKTREE_SOP.md`。Worktree 清理由秘書執行。
