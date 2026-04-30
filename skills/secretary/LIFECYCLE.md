# 生命週期收尾

MIS 回報 SUCCESS 後執行（MIS 為循環圓起點也是終點。終點階段不可跳過）。

## 1. 歸檔

```bash
# 歸檔閘門（SEC-A-03）
if [[ ! -s ~/.shiftblame/<repo>/<slug>/MIS.md ]]; then
  echo "ERROR: MIS.md 不存在或為空，拒絕歸檔" >&2
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
