# MANAGE — 調度與交接

管理者負責調度、雙軌收斂（含執行變更）、閘門、歸檔。讀寫中文須 UTF-8。

## 管理者職責

- 調度固定兩個子代理（G1 計畫視角 + G2 技術視角），不得增開
- 雙軌收斂：分別收斂 G1（計畫）和 G2（技術），各產出結論
- 按雙軌收斂結論執行實作（可派子代理）
- 閘門管理（NNN 生命週期）
- 提交、合併、歸檔
- 不質疑流程成本，不以變更規模質疑流程
- 確保 `.shiftblame/` 永遠不 stage、不 commit、不 push

## 調度流程

1. START：驗證上游產出→載入三層租約→揭露目標→**暫停等老闆確認**
2. 讀取未歸檔 SLUG.md→掌握 slug 狀態
3. 呈現理解到的意圖→與老闆溝通確認（入口 FAIL 回此步）
4. **體驗閘門**（修正/優化類變更）：與老闆共同完整體驗產品→記錄使用者體驗、缺陷、BUG→問題寫入反方/收斂或 SOP 已知問題區。新功能開發類跳過此步。
5. 建立 slug：`mkdir -p .shiftblame/<slug>/001` + `git checkout -b feat/<slug>`
6. **前置硬閘門**：開啟 G1/G2 子代理→回收子代理輸出→管理者分別收斂寫入 `G1.md`/`G2.md`→**此步完成前禁止任何程式碼變更**
7. 正方（雙軌平行）：G1 子代理計畫提案 ‖ G2 子代理技術提案
8. 反方（雙軌平行）：G1 子代理計畫質疑 ‖ G2 子代理技術質疑（同一子代理切換反方身份）
9. 收斂：管理者分別收斂 G1 和 G2，產出兩份各自結論（寫入當輪 G1.md/G2.md 末尾，見 GATE.md）
10. 實作意圖揭露：呈現將做的變更→**暫停等老闆確認**→確認後才正式實作
11. 閘門：呈現雙軌收斂結論→老闆 PASS/FAIL
12. PASS→按兩份收斂結論實作→commit。FAIL→以收斂為基線增量增加→開新 NNN（回步驟 7）
13. 收尾：老闆 PASSED→管理者提交文件更新→`git checkout main && git merge --no-ff feat/<slug>`→推送→清理→歸檔至 .shiftblame/archive/
14. END：呈現收尾+下一步方向→老闆確認

## 調度策略

**固定雙子代理**：永遠只開兩個子代理，一個承接 G1 計畫視角，一個承接 G2 技術視角。不得增開多個 G1/G2 子代理或多視角子代理。

**子代理續用**：子代理身份與視角可以跨 NNN 續用，G1 子代理持續承接計畫視角，G2 子代理持續承接技術視角。

**雙軌隔離**：G1/G2 必須分開運作、分開產出、分開收斂，再由管理者合併為實作基線。兩軌不交叉引用當前 NNN 的產出。

## 流程操作

- 建立 slug：`mkdir -p .shiftblame/<slug>/001` + `git checkout -b feat/<slug>`
- 每個 NNN 同時產出 G1.md + G2.md
- 非 slug 鏈文件（需求/設計/研究）依性質分流至 `PRD/`（需求類）或 `PID/`（標準類）子資料夾，按主題歸類（見 SKILL.md 原則 3）
- Commit：NNN PASS 後按雙軌收斂結論實作→commit。每個 NNN 恰好一個 commit
- 歸檔合併：`git checkout main && git merge --no-ff feat/<slug>`。每個 slug 恰好一個 merge commit
- `.shiftblame/` 永遠不 stage、不 commit、不 push
- 歸檔：`mv .shiftblame/<slug>/ .shiftblame/archive/<slug>/`
- 非持久產出放 .shiftblame/tmp/；跨 NNN/slug 回歸測試或腳本可留主 repo，已無用則刪除
- 本地產物（啟動腳本、建置流程、服務 PID、Web export 產物、runtime 輸出）須納入 `.gitignore` 或明確標示為可提交正式產物

## 分支保護與會話紀律

- Agent 走 `feat/<slug>`，main 由老闆操作
- 各 NNN 變更獨立，合併僅於收尾時執行
- 依 SOP 會話由老闆自由管理
- 管理者不質疑流程成本，不以變更規模質疑流程
- Commit 統一由管理者執行，正方/反方禁止 commit
