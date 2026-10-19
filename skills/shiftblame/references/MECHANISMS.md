---
name: MECHANISMS
revision: 4.0.0
---
# 執行介面與界線

## 狀態

sb state 印出專案根、.shiftblame/ 工作區是否存在與交接查找方式。對話與授權事實由平台承載；意圖由完整對話理解，完成以實際結果驗證。舊版遺留的 .shiftblame/flow-state.json 與其他流程目錄不讀、不寫、也不擋任何操作。

## CLI

- sb state 顯示專案根與工作區狀態；不帶參數。
- sb commitmsg <訊息> 檢查「type: 一句話」單行格式、內容及 staged 系統檔，產生綁定 repo／訊息／時效的提交印章。type 小寫屬流程詞彙（feat/fix/docs/style/refactor/perf/test/chore/build/ci），冒號後恰一格空格，全訊息 ≤120 字元；內部文件檔名、任務代號、壓縮術語與流程詞彙擋下。staged 含 .shiftblame/ 內檔案即擋；staged 含 SOP.md／ROADMAP.md（任一位置）即位置違例擋下——權威位置是 .shiftblame/，不入庫。staged 動到參照型文件（根 README、docs/）時先過文件閘——文件集須過 sb rewrite 同一判準，未過不發章；hooks 對無章提交硬擋，文件閘因此覆蓋所有動文件的提交。
- sb rewrite 文件編輯的唯一入口：把文件集（根 README、docs/、.shiftblame/SOP.md 與 .shiftblame/ROADMAP.md 存在者）原稿快照至 .shiftblame/tmp/rewrite-backup/\<時間戳\>/，再檢查位置違例（根目錄或 docs/ 的 SOP.md／ROADMAP.md、根目錄 README 大小寫變體並存——SOP 與 ROADMAP 的權威位置是 .shiftblame/，README 形象文件全專案唯一）、docs/ 結構（非 md 檔不得入 docs/、除索引.md 外全編號（頂層 N-大節、節內 N.M-文件）、層級最多 N.M、編號連續、索引逐檔收錄）與可讀性信號——重點前置（H1 後須有一段當下摘要）、長度預算（超 300 可見行須 length-allow）、治理暗語（sb 命令、.shiftblame/ 路徑與舊流程詞彙不得入參照型文件，README 與 .shiftblame/SOP／ROADMAP 一併檢查；jargon-allow 豁免）、純散文段（連續 ≥5 句且零具體內容）、佔位符殘留（「（填…）」、TODO、待補視為未完成）。重寫後標題序列與上一份快照完全相同即擋（沿舊目錄抄錄）；小修直接編輯檔案不走 sb rewrite。機械檢查只證明結構形式，撰寫規範見 [DOCS](../assets/DOCS.md)；檢查核心與提交閘共用。
- sb handoff save <task> <草稿.md> 保存具名交接；list 查找、show <task> 核對快照與現況。資料留 tmp；完整性及差異的處理見 [HANDOFF](HANDOFF.md)。
- 已移除的舊命令與任何未知命令一律印出用法並以 exit 2 結束。

## Hooks

SessionStart 注入簡短的授權與驗收原則及訪談提示；UserPromptSubmit 重置本回合純觀測數據，訪談未完成時附提醒。PreToolUse 檢查產品訪談、repo 邊界、破壞性目標、提交印章與最低品質機制。回合結束依任務完成或實際阻塞判斷。平台自動壓縮不設前置介入：跨對話狀態由 save／load 承載。

失敗信號引導：PostToolUseFailure 以對話代號累計連續失敗，PostToolUse 的工具成功把計數歸零，換對話重新計數。達三次起每次失敗注入「[失敗引導]」——先判斷根因、檢查假設、換方法或回頭修正上游依據，不以相同操作反覆重試；達六次起改為「[失敗裁示]」，要求以 AskUserQuestion 取得使用者「換方向或照目前做法續行」的決定，且下一個改動類工具（寫入或 shell）回傳 ask 一次。計數只在專案已有 .shiftblame/ 時記錄。外掛清單目前只註冊 SessionStart、UserPromptSubmit 與 PreToolUse；平台設定另行註冊這兩個失敗事件時，失敗引導才會生效。

工具嘗試次數用於觀測，操作結果另以實際輸出核對。重試與非同步輪詢依進展決定；技能以當前平台的讀取能力使用。

### 產品訪談閘

- 適用範圍：帶對話代號（session_id）的事件。專案根是 cwd 向上第一個含 .git 或 .shiftblame 的目錄，都沒有時為 cwd；磁碟根與系統頂層目錄不作錨點（家目錄照常可作），sb 與 hook 用同一判定。專案根不是根目錄、家目錄或其上層、系統頂層目錄時，hook 自動建立 .shiftblame/、.shiftblame/tmp/ 與內容為 * 的 .shiftblame/.gitignore。非 Git 資料夾同樣建立，其下的子資料夾之後以它為專案根。
- 紀錄：.shiftblame/tmp/interview-<代號>.md，代號是對話代號 sha256 的前 12 碼，格式見 [INTERVIEW](../assets/INTERVIEW.md)。「## 第 N 輪」段落的觸發、提問、目標、範圍、驗收、使用者確認都有實際內容，該輪才算完成。
- 開場標記 interview-<代號>.json 記下開場時已完成的輪數（base）與上一輪完成後的提問工具呼叫數（asks）：startup 在沒有標記時建立；resume 與 clear 以目前完成輪數重設並歸零計數，須再完成新的一輪；compact 沿用。紀錄出現新的完成輪時，hook 在其後的事件推進基準並歸零計數，下一輪須新證據。標記由 hook 維護，寫入工具或 shell 重定向寫它一律拒絕。
- 寫入訪談紀錄（寫入工具、> 與 >>、tee、Set-Content、Add-Content、Out-File）須有提問證據：本輪自上一輪完成（或對話開始）後至少一次提問工具呼叫（名稱以 ask 開頭，如 AskUserQuestion），未提問即拒絕；有證據則直接放行。專案檔案寫入、git commit／push 與 sb 命令不因訪談未完成而受阻；唯讀查證、tmp 筆記與專案根以外的寫入照常。
- 不設閘：沒有對話代號的呼叫，以及 ZCode 子代理（代號以 sess_subagent_ 開頭）。Claude Code 與 Codex 的子代理和父代理共用對話代號，也共用同一份紀錄。
- 外部顧問問診：主對話以唯讀 CLI 呼叫另一平台的代理（如 `codex exec -s read-only`）時，在啟動該 CLI 的環境帶 `SHIFTBLAME_CONSULT=1`。hook 讀到這個值（只認 1）就不設訪談閘、不建開場標記，開場與每次輸入改注入「[顧問問診] 直接依提問作答」的提示；問診沒有使用者可答，訪談由發起問診的主對話負責。標示只在 CLI 啟動時進入 hook 的環境，對話中執行的命令改不到，一般對話的訪談規則不變。委派執行：主對話把限定範圍的實作交給另一平台的代理（如 `codex exec -s workspace-write`）時，改帶 `SHIFTBLAME_CONSULT=write`；同樣不設訪談閘、不建開場標記，提示改為「[委派執行] 依簡報允許的檔案與範圍作業」，不限唯讀，提交章等其他閘門照常。

### 使用者確認

hook 以 permissionDecision: ask 在權限提示中交使用者確認的情況：行為碼提交缺測試同批（最低品質機制），以及失敗裁示後的第一個改動類工具。Claude Code 與 ZCode 支援 ask；Codex 不支援，這些操作在 Codex 直接放行。訪談紀錄的寫入不逐一詢問使用者；「使用者確認」欄的真實性由提問證據（寫入前的提問工具呼叫）與代理自律承擔。

### Shell 命令

Bash 與 PowerShell 工具的命令先做 shell 語法解析：引號、跳脫、heredoc、管線、命令替換，以及 bash -c、cmd /c、pwsh -Command、-EncodedCommand、iex 等巢狀層，最多 4 層，超過或內容過多即拒絕。只核對實際執行的命令，字串、註解與參數中的相同字樣不會誤擋。

- 提交：字面 git commit 須有相符印章，訊息並以 sb commitmsg 的同一判準複驗格式——印章檔存於可寫的 tmp、可被手寫，格式不因印章來源豁免。放行時不刪章，只在印章記下當時的 HEAD；提交落地使 HEAD 前進後此章作廢，同一命令對同一 repo 只放行一次提交——被同命令另一錨定、其他 hook 或權限確認拒絕的呼叫不消耗印章，可直接重試。commit-tree 與 am 等繞過 -m 訊息閘的管線提交一律擋。git -C 須為絕對路徑。子命令、訊息或命令名稱由變數或命令替換組成時拒絕；git alias 定義與 GIT_DIR 類路徑重定向一併攔截。
- 最低品質機制（TDD→BDD→SDD 依意圖定檔）：staged 含行為碼（程式碼副檔名白名單、非測試路徑）而無測試同批，提交回傳 permissionDecision: ask，要求自證意圖檔位或補測試／規格後放行；有測試同批或純文件／設定變更不攔。SDD 的規格先行指設計層規格（介面契約、型別、資料結構）。
- 破壞性刪除：rm -r、Remove-Item -Recurse、rd /s、find -delete 或 -exec rm、xargs rm、robocopy /MIR、rsync --delete 的本機目標須為絕對路徑。xargs 刪除的來源須是同一管線中、搜尋根為絕對路徑的 find；rsync 的遠端目的地（host:、user@host:、rsync://）不在此限。
- 保護目錄：根目錄、家目錄、專案根、它們的上層，以及系統頂層目錄（POSIX 的第一層、Windows 系統磁碟的第一層；Windows 上無磁碟代號的單段路徑如 /usr 在 Git Bash 指 Git 安裝目錄，不依 cwd 所在磁碟展開，同樣算），即使以絕對路徑指定也不可整個刪除或清空（含 <目錄>/*）；find 沒有篩選條件時以搜尋根判斷。
- 丟棄變更：git clean -f、reset --hard、checkout -f、checkout -- <路徑>、checkout .、restore（只有 --staged 除外）、switch --discard-changes 或 -f、stash drop／clear、branch -D 須以 git -C <絕對路徑> 錨定 repo。
- 截斷重定向（>、>|、&>）須以絕對路徑為目標；丟棄輸出用 /dev/null 或 $null，追加用 >>。
- 寫入工具的目標使用共同路徑解析（含 Git Bash 的 /c/ 路徑、符號連結，以及 Windows 忽略的段尾點與空白）。帶 owner、repo、bucket 等遠端定位欄位或以 URI 為目標的工具寫的是遠端資源，不視為本機寫入；沒有本機寫入目標的工具（如待辦清單）不受影響。

### 紀錄與錯誤

hooks 在 .shiftblame/tmp/hook-records.json 記錄心跳、本回合與累計的工具呼叫數及失敗連續計數（failureNudge，含 session／count／at／askedAt），以排他鎖串行；舊版紀錄的多餘欄位讀取時剝除。工作區不存在時不寫，等鎖逾時就略過該次紀錄。防護本身出錯時放行工作，錯誤寫入 .shiftblame/tmp/hook-errors.jsonl。

### 未涵蓋

- cd 之後的相對路徑追蹤；直譯器內嵌程式與腳本檔內的提交（遞迴刪除 API 只提示）。
- 背景任務與長時間程序啟動後的持續寫入——防護只在啟動當下的呼叫核對。
- Start-Process、Out-File、Set-Content、tee、cp /dev/null、truncate 等非重定向寫入。
- merge、cherry-pick、revert、rebase 等其他產生提交的 git 子命令；git checkout <提交> <路徑> 這類以提交內容覆寫檔案的形式；定義於環境的既有 git alias。
- 產品訪談閘：提問計數以名稱以 ask 開頭的工具呼叫為準，其他名稱的提問機制不計入；紀錄寫入後到下一個事件前是基準未推進的窗口，同批連寫多輪可能共用同一份提問證據；經 shell 與 ZCode js 工具直接改寫紀錄的形態不在辨識範圍；家目錄、其上層與系統頂層目錄不自動建立工作區，因此不設閘。
- 失敗信號：失敗事件未註冊時不計數；平台不發 PostToolUseFailure 事件的失敗（逾時、代理自行判斷的失敗）不計入；ask 一次後的續行由代理依取得的裁示承擔。

這些由代理依授權自律，交付時如實揭露。

每次工具呼叫約 80 ms（Node 啟動約 50 ms），含提交的命令另需讀取 staged 清單。hooks 不設 matcher，工具呼叫計數才涵蓋所有工具。staged 邊界與印章檢查各自只證明其所涵蓋的事實。

## 維護與發布

文件與執行行為保持一致，測試驗證實際風險與正常操作。以代表任務的完成結果、誤擋、返工及失誤衡量治理效益。.github/workflows/test.yml 在 ubuntu、macOS 與 Windows 各執行一次 npm test --prefix cli。

開發 repo 與消費端分離；插件與全域 CLI 從已發布的 GitHub 來源更新為獨立快照。版本、發布與外部變更依使用者授權。
