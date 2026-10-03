---
name: MECHANISMS
revision: 2.9.3
---
# 執行介面與界線

## 狀態

sb state 區分未接入、直接實行、活動 slug、已結束及損壞狀態。操作權限以使用者授權為準。損壞時先保留原資料並修復，診斷及 tmp 可用；正式提交與流程推進保持封閉。

flow-state 記錄節點、需求契約、審查邊及有限觀測欄位；對話與授權事實由平台承載。意圖由完整對話理解，完成以實際結果驗證。

flow-state 只由 sb 寫入。寫入狀態的命令（init、next、end、closeout、sopreview、adversarial）先取得 .shiftblame/flow-state.json.lock 排他鎖，再以同目錄暫存檔改名整檔寫入，讀取端不會讀到半寫檔。鎖被占用時等待（預設 30 秒，SB_LOCK_WAIT_MS 可調），逾時即停下並指出鎖檔；持有程序已結束或持有超過 2 分鐘的殘鎖自動清除。hooks 的紀錄另存 tmp，不改寫 flow-state。

research、quality 與 verify 段的 sb state 另印先行研究的比對基準：時點 1 為目前 G1 定義區 hash，時點 2 為 G2 定義區 hash，時點 3 為受驗提交（工作分支末端）。審查與判定期間的筆記記下此值，判定後核對。

## CLI

- sb init <slug> [type] 建立使用者已授權的工作骨架與分支，並記下基底提交供收尾合併。
  - 空資料夾（只忽略 .shiftblame 與 .DS_Store、Thumbs.db、desktop.ini）自動建 Git 庫，起始提交只含 .gitignore；中途失敗時移除本次建立的 .git 與 .gitignore，不留骨架。
  - 有 repo 但尚無提交時，補一個空樹起始提交於目前分支；索引與工作樹不動，既有暫存保留。
  - 已有內容的非 Git 資料夾不代為提交：先 git init 並提交既有內容，或以 --no-git 不用 Git（不建分支與基底，收尾只歸檔）。--no-git 在 Git 工作區內為用法錯誤。
  - 缺少 Git 提交身分時停下並說明設定方式；在空的子資料夾執行而專案根向上錨定時停下，避免在上層專案建立流程。
  - HEAD 無法解析的損壞 repo 只建骨架，不建分支、不動索引，修復後以 sb state 查證。
- sb next <node> 沿流程切換責任段。符合契約的回查與技術修復可自主執行；使用者指出驗收未通過時，依差異回責任段修復，實質需求或授權變更先經訪談回 requirement。
- research → plan 封存 G1 定義區、quality → build 封存 G2 定義區；## 回指記錄 是證據分隔。已核准、相同且仍適用的契約可重用。契約變更需對應時點審查與使用者授權。
- sb adversarial <報告> --point 1|2|3 記錄對應審查並綁定審查對象：時點 1（research→plan）記 G1 定義區 hash，時點 2（quality→build）記 G2 定義區 hash（G 檔不存在或回指標題不是恰好一次時拒絕記錄），時點 3（verify 出口）記受驗提交（收尾已留痕時取其工作提交；非 Git 工作區不記）。時點邊以 --adversarial 與 --boss-ok 承接真實審查與使用者判定，CLI 核對條目新鮮度與審查對象：審查後修改 G1／G2 定義區或再提交，須重新審查；只更新回指區不受影響。舊版條目沒有審查對象，只核對新鮮度；2.8.x 的時點 2（verify 出口）條目載入時遷移為時點 3。
- sb commitmsg <訊息> 檢查「type: 一句話」單行格式、狀態及 staged 系統檔，產生綁定 repo／訊息／時效的提交印章。type 小寫屬流程詞彙（feat/fix/docs/style/refactor/perf/test/chore/build/ci），冒號後恰一格空格，全訊息 ≤120 字元。staged 動到參照型文件（README、docs/、SOP、ROADMAP）時先過文件閘——文件集須過 sb rewrite 同一判準，未過不發章；hooks 對無章提交硬擋，文件閘因此覆蓋所有動文件的提交（main 與 slug 模式皆然）。
- sb sopreview <範圍與結論> 選用記錄已進行的治理文件審查範圍與結論；審查依治理變更需要執行。
- sb end --adversarial --boss-ok 在 verify 及使用者終審後歸檔並整合：收尾文件閘（本 slug 期間動過參照型文件時，文件集須先過 sb rewrite 判準；無 git 基準則跳過）、歸檔、合併、寫下收尾留痕，最後刪除本機工作分支。刪分支失敗時狀態停在 verify 並保留留痕，排除原因後重跑即完成，不會重併。基底有歧義以 --base 明示；外部協作 repo 的發布與整合依其授權。
- sb closeout --base <分支> 核對收尾整合事實。
- sb rewrite 文件編輯的唯一入口：把文件集（README、docs/、SOP、ROADMAP 存在者）原稿快照至 .shiftblame/tmp/rewrite-backup/\<時間戳\>/，再檢查 docs/ 結構（非 md 檔不得入 docs/、除索引.md 外全編號（頂層 N-大節、節內 N.M-文件）、層級最多 N.M、編號連續、索引逐檔收錄）與可讀性信號——重點前置（H1 後須有一段當下摘要）、長度預算（超 300 可見行須 length-allow）、治理暗語（時點、G 檔搭配詞、sb 命令、.shiftblame/ 路徑不得入 docs/；jargon-allow 豁免）、純散文段（連續 ≥5 句且零具體內容）、佔位符殘留（「（填…）」、TODO、待補視為未完成）。重寫後標題序列與上一份快照完全相同即擋（沿舊目錄抄錄）；小修直接編輯檔案不走 sb rewrite。機械檢查只證明結構形式，撰寫規範見 [DOCS](../assets/DOCS.md)；檢查核心由提交閘與收尾閘共用。
- sb handoff save <task> <草稿.md> 保存 main／直接作業的具名交接；list 查找、show <task> 核對快照與現況。資料留 tmp，不改流程狀態；模式、完整性及差異的處理見 [HANDOFF](HANDOFF.md)。

## Hooks

SessionStart 注入簡短的授權與驗收原則及訪談提示；UserPromptSubmit 重置本回合純觀測數據並提示當前狀態，requirement 與 verify 段附先行研究的範圍，訪談未完成時附提醒；節點由明確的 CLI 操作更新。PreToolUse 檢查可辨識操作的狀態健康、產品訪談、repo 邊界、破壞性目標及提交印章。回合結束依任務完成或實際阻塞判斷。

工具嘗試次數用於觀測，操作結果另以實際輸出核對。重試與非同步輪詢依進展決定；技能以當前平台的讀取能力使用。

### 產品訪談閘

- 適用範圍：帶對話代號（session_id）的事件。專案根是 cwd 向上第一個含 .git 或 .shiftblame 的目錄，都沒有時為 cwd。專案根不是根目錄、家目錄或其上層、系統頂層目錄時，hook 自動建立 .shiftblame/、.shiftblame/tmp/ 與內容為 * 的 .shiftblame/.gitignore，不寫 flow-state。非 Git 資料夾同樣建立，其下的子資料夾之後以它為專案根。
- 紀錄：.shiftblame/tmp/interview-<代號>.md，代號是對話代號 sha256 的前 12 碼，格式見 [INTERVIEW](../assets/INTERVIEW.md)。「## 第 N 輪」段落的觸發、提問、目標、範圍、驗收、使用者確認都有實際內容，該輪才算完成。
- 開場標記 interview-<代號>.json 記下開場時已完成的輪數（base）與上一輪完成後的提問工具呼叫數（asks）：startup 在沒有標記時建立；resume 與 clear 以目前完成輪數重設並歸零計數，須再完成新的一輪；compact 沿用。紀錄出現新的完成輪時，hook 在其後的事件推進基準並歸零計數，下一輪須新證據。標記由 hook 維護，寫入工具或 shell 重定向寫它一律拒絕。
- 寫入訪談紀錄（寫入工具、> 與 >>、tee、Set-Content、Add-Content、Out-File）須有提問證據：本輪自上一輪完成（或對話開始）後至少一次提問工具呼叫（名稱以 ask 開頭，如 AskUserQuestion），未提問即拒絕；有證據則直接放行。專案檔案寫入、git commit／push 與 sb 流程命令不因訪談未完成而受阻；唯讀查證、tmp 筆記與專案根以外的寫入照常。
- 不設閘：沒有對話代號的呼叫，以及 ZCode 子代理（代號以 sess_subagent_ 開頭）。Claude Code 與 Codex 的子代理和父代理共用對話代號，也共用同一份紀錄。

### 使用者確認

帶 --boss-ok 的 sb next 與 sb end 由 hook 回傳 permissionDecision: ask，在權限提示中交使用者確認。Claude Code 與 ZCode 支援 ask；Codex 不支援，這些操作在 Codex 直接放行。訪談紀錄的寫入不再逐一詢問使用者；「使用者確認」欄的真實性由提問證據（寫入前的提問工具呼叫）與代理自律承擔。

### Shell 命令

Bash 與 PowerShell 工具的命令先做 shell 語法解析：引號、跳脫、heredoc、管線、命令替換，以及 bash -c、cmd /c、pwsh -Command、-EncodedCommand、iex 等巢狀層，最多 4 層，超過或內容過多即拒絕。只核對實際執行的命令，字串、註解與參數中的相同字樣不會誤擋。

- 提交：字面 git commit 須有相符印章，訊息並以 sb commitmsg 的同一判準複驗格式——印章檔存於可寫的 tmp、可被手寫，格式不因印章來源豁免；commit-tree 與 am 等繞過 -m 訊息閘的管線提交一律擋。git -C 須為絕對路徑。子命令、訊息或命令名稱由變數或命令替換組成時拒絕；git alias 定義與 GIT_DIR 類路徑重定向一併攔截。
- 破壞性刪除：rm -r、Remove-Item -Recurse、rd /s、find -delete 或 -exec rm、xargs rm、robocopy /MIR、rsync --delete 的本機目標須為絕對路徑。xargs 刪除的來源須是同一管線中、搜尋根為絕對路徑的 find；rsync 的遠端目的地（host:、user@host:、rsync://）不在此限。
- 保護目錄：根目錄、家目錄、專案根、它們的上層，以及系統頂層目錄（POSIX 的第一層、Windows 系統磁碟的第一層），即使以絕對路徑指定也不可整個刪除或清空（含 <目錄>/*）；find 沒有篩選條件時以搜尋根判斷。
- 丟棄變更：git clean -f、reset --hard、checkout -f、checkout -- <路徑>、checkout .、restore（只有 --staged 除外）、switch --discard-changes 或 -f、stash drop／clear、branch -D 須以 git -C <絕對路徑> 錨定 repo。
- 截斷重定向（>、>|、&>）須以絕對路徑為目標；丟棄輸出用 /dev/null 或 $null，追加用 >>。
- 寫入工具的目標使用共同路徑解析（含 Git Bash 的 /c/ 路徑、符號連結，以及 Windows 忽略的段尾點與空白）；verify 段擋下受驗來源的修改，被忽略且未追蹤的輸出與 .shiftblame/ 不受限。帶 owner、repo、bucket 等遠端定位欄位或以 URI 為目標的工具寫的是遠端資源，不視為本機寫入。狀態損壞時只放行 flow-state 與 tmp 的修復寫入；沒有本機寫入目標的工具（如待辦清單）不受影響。

### 紀錄與錯誤

hooks 在 .shiftblame/tmp/hook-records.json 記錄心跳、本回合與累計的工具呼叫數，以排他鎖串行；sb end 以累計值減去開 slug 時的基準，得到本 slug 的呼叫數。工作區不存在時不寫，等鎖逾時就略過該次紀錄。防護本身出錯時放行工作，錯誤寫入 .shiftblame/tmp/hook-errors.jsonl。

### 未涵蓋

- cd 之後的相對路徑追蹤；直譯器內嵌程式與腳本檔內的提交（遞迴刪除 API 只提示）。
- 背景任務與長時間程序啟動後的持續寫入——防護只在啟動當下的呼叫核對。
- Start-Process、Out-File、Set-Content、tee、cp /dev/null、truncate 等非重定向寫入；verify 段經 shell 的寫入。
- merge、cherry-pick、revert、rebase 等其他產生提交的 git 子命令（收尾合併的固定訊息 merge <slug> 由 sb end／closeout 自驗）；git checkout <提交> <路徑> 這類以提交內容覆寫檔案的形式；定義於環境的既有 git alias。
- 產品訪談閘：提問計數以名稱以 ask 開頭的工具呼叫為準，其他名稱的提問機制不計入；紀錄寫入後到下一個事件前是基準未推進的窗口，同批連寫多輪可能共用同一份提問證據；經 shell 與 ZCode js 工具直接改寫紀錄的形態不在辨識範圍；家目錄、其上層與系統頂層目錄不自動建立工作區，因此不設閘。

這些由代理依授權自律，交付時如實揭露。

每次工具呼叫約 80 ms（Node 啟動約 50 ms），含提交的命令另需讀取 staged 清單。hooks 不設 matcher，工具呼叫計數才涵蓋所有工具。G1 封存、staged 邊界及工作樹檢查各自只證明其所涵蓋的事實。

## 維護與發布

文件與執行行為保持一致，測試驗證實際風險與正常操作。以代表任務的完成結果、誤擋、返工及失誤衡量治理效益。.github/workflows/test.yml 在 ubuntu、macOS 與 Windows 各執行一次 npm test --prefix cli。

開發 repo 與消費端分離；插件與全域 CLI 從已發布的 GitHub 來源更新為獨立快照。版本、發布與外部變更依使用者授權。
