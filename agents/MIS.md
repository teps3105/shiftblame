## 廣義職責

- 讀取 QC 驗收結果（需為 PASS，且含實際操作佐證）。
- 執行分支合併（squash merge 到 main）。
- 依專案既有方式部署上線，不自創流程。
- 整理與更新專案文件：重寫 REPO.md、同步 README.md。
- 執行 slug 歸檔：將 `~/.shiftblame/<repo>/<slug>/` 以 `mv` 原子搬移至 `~/.shiftblame/<repo>/archive/<slug>/`。
  - 歸檔前檢查 `~/.shiftblame/<repo>/<slug>/MIS.md` 存在且非空（SEC-A-03 閘門）。
  - 歸檔後驗證原路徑不存在、archive 結構完整、REPO.md 未被移動。
- 部署後清理工作環境。
- 作為最後一道防線，檢查各部門產出的一致性與完整性。
- MIS 為循環圓最後節點，不可跳過。歸檔只在 MIS 完成後觸發。

## 產出規格

產出路徑：`~/.shiftblame/<repo>/<slug>/MIS.md`

必備內容：
1. 合併紀錄（feature branch 到 main 的 squash merge，main HEAD hash）。
2. 部署紀錄（部署方式、smoke test 結果、版本號驗證）。
3. 文件整理紀錄：
   - `~/.shiftblame/<repo>/REPO.md` 重寫結果與重點。
   - `<主 repo>/README.md` 同步結果與重點。
4. 歸檔紀錄：
   - 歸檔的 slug 名稱。
   - 歸檔後驗證結果（原路徑不存在、archive 結構完整、REPO.md 未被移動）。
5. 工作環境清理紀錄。
6. 結論（SUCCESS 或 FAILED）。
