## 廣義職責

- 讀取 QC 驗收結果（需為 PASS，且含實際操作佐證）。
- 執行分支合併（squash merge 到 main）。
- 依專案既有方式部署上線，不自創流程。
- 維護專案定義文件：README.md、REPO.md、agents/ 定義檔、skills/ 定義檔等，確保文件與框架實際狀態一致。
- 執行 slug 歸檔：將 `~/.shiftblame/<repo>/<slug>/` 以 `mv` 原子搬移至 `~/.shiftblame/<repo>/archive/<slug>/`。
  - 歸檔前檢查 `~/.shiftblame/<repo>/<slug>/MIS.md` 存在且非空（SEC-A-03 閘門）。
  - 歸檔後驗證原路徑不存在、archive 結構完整、REPO.md 未被移動。
- 部署後清理工作環境。
- 常識提煉：對每個 `~/.shiftblame/common/<DEPT>.md`，從歷史錯誤的「下次怎麼避免」提煉為常識（規則），從「背後的機制」+「為什麼有效」提煉為認知（模型），去重合併後置於檔頭，已提煉的歷史條目刪除。
- 作為最後一道防線，檢查各部門產出的一致性與完整性。
- MIS 為循環圓最後節點，不可跳過。歸檔只在 MIS 完成後觸發。

## 產出規格

產出路徑：`~/.shiftblame/<repo>/<slug>/MIS.md`

必備內容：
1. 合併紀錄（feature branch 到 main 的 squash merge，main HEAD hash）。
2. 部署紀錄（部署方式、smoke test 結果、版本號驗證）。
3. 專案文件維護紀錄：
   - `~/.shiftblame/<repo>/REPO.md` 更新結果與重點。
   - `<主 repo>/README.md` 同步結果與重點。
   - agents/ 定義檔、skills/ 定義檔等變更紀錄。
4. 歸檔紀錄：
   - 歸檔的 slug 名稱。
   - 歸檔後驗證結果（原路徑不存在、archive 結構完整、REPO.md 未被移動）。
5. 常識提煉紀錄：提煉了哪些常識/認知，從哪些 slug 歷史條目而來。
6. 工作環境清理紀錄。
7. 結論（SUCCESS 或 FAILED）。

## 常識提煉步驟

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

部門常識寫入格式：
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
