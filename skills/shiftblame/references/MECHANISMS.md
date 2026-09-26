---
name: MECHANISMS
revision: 2.8.1
---
# 執行介面與界線

## 狀態

sb state 區分未接入、直接實行、活動 slug、已結束及損壞狀態。操作權限以使用者授權為準。損壞時先保留原資料並修復，診斷及 tmp 可用；正式提交與流程推進保持封閉。

flow-state 記錄節點、需求契約、審查邊及有限觀測欄位；對話與授權事實由平台承載。意圖由完整對話理解，完成以實際結果驗證。

requirement 與 verify 段的 sb state 另印先行研究的比對基準：時點 1 為目前 G1 定義區 hash，時點 2 為受驗 HEAD。審查與判定期間的筆記記下此值，判定後核對。

## CLI

- sb init <slug> [type] 建立使用者已授權的工作骨架與分支，並記下基底提交供收尾合併。
  - 空資料夾（只忽略 .shiftblame 與 .DS_Store、Thumbs.db、desktop.ini）自動建 Git 庫，起始提交只含 .gitignore；中途失敗時移除本次建立的 .git 與 .gitignore，不留骨架。
  - 有 repo 但尚無提交時，補一個空樹起始提交於目前分支；索引與工作樹不動，既有暫存保留。
  - 已有內容的非 Git 資料夾不代為提交：先 git init 並提交既有內容，或以 --no-git 不用 Git（不建分支與基底，收尾只歸檔）。--no-git 在 Git 工作區內為用法錯誤。
  - 缺少 Git 提交身分時停下並說明設定方式；在空的子資料夾執行而專案根向上錨定時停下，避免在上層專案建立流程。
  - HEAD 無法解析的損壞 repo 只建骨架，不建分支、不動索引，修復後以 sb state 查證。
- sb next <node> 沿流程切換責任段。符合契約的回查與技術修復可自主執行；使用者指出驗收未通過時，依差異回責任段修復，實質需求或授權變更才回 intent。
- requirement → research 封存 G1 定義區；## 回指記錄 是證據分隔。已核准、相同且仍適用的契約可重用。契約變更需本次時點 1 審查與使用者授權。
- sb adversarial <報告> --point 1|2 記錄對應審查。時點邊以 --adversarial 與 --boss-ok 承接真實審查與使用者判定，CLI 核對條目新鮮度。
- sb commitmsg <訊息> 檢查非空單行訊息、狀態及 staged 系統檔，產生綁定 repo／訊息／時效的提交印章。repo 自身格式依其政策執行。
- sb sopreview <範圍與結論> 選用記錄已進行的治理文件審查範圍與結論；審查依治理變更需要執行。
- sb end --adversarial --boss-ok 在 verify 及使用者終審後歸檔並整合。基底有歧義以 --base 明示；外部協作 repo 的發布與整合依其授權。
- sb closeout --base <分支> 核對收尾整合事實。sb vault 僅在使用者要求管理 Obsidian 顯示時使用。
- sb handoff save <task> <草稿.md> 保存 main／直接作業的具名交接；list 查找、show <task> 核對快照與現況。資料留 tmp，不改流程狀態；模式、完整性及差異的處理見 [HANDOFF](HANDOFF.md)。

## Hooks

SessionStart 注入簡短的授權與驗收原則；UserPromptSubmit 重置本回合純觀測數據並提示當前狀態，requirement 與 verify 段附先行研究的範圍；節點由明確的 CLI 操作更新。PreToolUse 檢查可辨識操作的狀態健康、repo 邊界、破壞性目標及提交印章。回合結束依任務完成或實際阻塞判斷。

工具嘗試次數用於觀測，操作結果另以實際輸出核對。重試與非同步輪詢依進展決定；技能以當前平台的讀取能力使用。

Bash 與 PowerShell 工具的命令先做 shell 語法解析：引號、跳脫、heredoc、管線、命令替換，以及 bash -c、cmd /c、pwsh -Command、-EncodedCommand、iex 等巢狀層，最多 4 層，超過或內容過多即拒絕。只核對實際執行的命令，字串、註解與參數中的相同字樣不會誤擋。

- 提交：字面 git commit 須有相符印章；git -C 須為絕對路徑。子命令、訊息或命令名稱由變數或命令替換組成時拒絕；git alias 定義與 GIT_DIR 類路徑重定向一併攔截。
- 破壞性刪除：rm -r、Remove-Item -Recurse、rd /s、find -delete 或 -exec rm、xargs rm、robocopy /MIR、git clean -f、git reset --hard 的目標須為絕對路徑且不是根目錄。xargs 刪除的來源須是同一管線中、搜尋根為絕對路徑的 find。
- 截斷重定向（>、>|、&>）須以絕對路徑為目標；丟棄輸出用 /dev/null 或 $null，追加用 >>。
- 寫入工具的目標使用共同路徑解析（含 Git Bash 的 /c/ 路徑、符號連結，以及 Windows 忽略的段尾點與空白）；verify 段擋下受驗來源的修改，被忽略且未追蹤的輸出與 .shiftblame/ 不受限。狀態損壞時只放行 flow-state 與 tmp 的修復寫入。

未涵蓋項目：cd 之後的相對路徑追蹤；直譯器內嵌程式與腳本檔內的提交（遞迴刪除 API 只提示）；Start-Process、Out-File、Set-Content、tee 等非重定向寫入；merge、cherry-pick、revert、rebase、am 等其他產生提交的 git 子命令；verify 段經 shell 的寫入。這些由代理依授權自律，交付時如實揭露。

每次工具呼叫約 80 ms（Node 啟動約 50 ms），含提交的命令另需讀取 staged 清單。hooks 不設 matcher，工具呼叫計數才涵蓋所有工具。G1 封存、staged 邊界及工作樹檢查各自只證明其所涵蓋的事實。

## 維護與發布

文件與執行行為保持一致，測試驗證實際風險與正常操作。以代表任務的完成結果、誤擋、返工及失誤衡量治理效益。

開發 repo 與消費端分離；插件與全域 CLI 從已發布的 GitHub 來源更新為獨立快照。版本、發布與外部變更依使用者授權。
