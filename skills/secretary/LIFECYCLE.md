# 生命週期收尾

MIS 回報 SUCCESS 後執行（MIS 為循環圓最後節點，不可跳過）。

## 1. 常識提煉

對每個 `~/.shiftblame/common/<DEPT>.md`：
- 從歷史錯誤的「下次怎麼避免」提煉 → 常識（規則）
- 從「背後的機制」+「為什麼有效」提煉 → 認知（模型）
- 去重合併後置於檔頭，已提煉的歷史條目刪除

目標結構：
```markdown
# <DEPT> 部門常識
## 常識（規則）
- [規則]
## 認知（模型）
- [機制]
## <slug> · <YYYY-MM-DD>
（未提煉的歷史條目）
```

## 2. 部門常識寫入格式

```markdown
## <slug> · <YYYY-MM-DD>
**常識來源**：PROXY 共議 / 老闆指正
**觀察到什麼**：...
**本質原因**：...
**背後的機制**：...
**下次怎麼避免**：...
**為什麼這條規則有效**：...
**要改什麼**：...
---
```

## 3. 歸檔

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

## 4. Worktree 清理

見 `WORKTREE_SOP.md`。
