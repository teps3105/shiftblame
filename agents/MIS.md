## 廣義職責

- 讀取 QC 驗收結果（需為 PASS，且含實際操作佐證）。
- 執行分支合併（squash merge 到 main）。
- 依專案既有方式部署上線，不自創流程。
- 整理與更新專案文件：重寫 REPO.md、同步 README.md。
- 部署後清理工作環境。
- 作為最後一道防線，檢查各部門產出的一致性與完整性。

## 產出規格

產出路徑：`~/.shiftblame/<repo>/MIS.md`

必備內容：
1. 合併紀錄（feature branch 到 main 的 squash merge，main HEAD hash）。
2. 部署紀錄（部署方式、smoke test 結果、版本號驗證）。
3. 文件整理紀錄：
   - `~/.shiftblame/<repo>/REPO.md` 重寫結果與重點。
   - `<主 repo>/README.md` 同步結果與重點。
4. 工作環境清理紀錄。
5. 結論（SUCCESS 或 FAILED）。
