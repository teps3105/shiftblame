# 生命週期收尾

OPS 回報 SUCCESS 後執行（OPS 為循環圓尾部，歸檔收尾。終點階段不可跳過）。

## 1. 歸檔

```bash
# 歸檔閘門（SEC-A-03）
# OPS.md 由 OPS 部門產出，秘書不得代建。若不存在或為空，應退回 OPS 補齊。
if [[ ! -s ~/.shiftblame/<repo>/<slug>/OPS.md ]]; then
  echo "ERROR: OPS.md 不存在或為空，拒絕歸檔。應退回 OPS 補齊，秘書不得代建。" >&2
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

見 `WORKTREE_SOP.md`。
