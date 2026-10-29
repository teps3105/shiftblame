---
name: MECHANISMS
revision: 4.0.2
---
# 執行介面與界線

本文件描述 CLI、通用 hook 與外部政策入口。需求、授權與完成判定由 [主技能](../SKILL.md) 承載；本機政策只在使用者明確設定後載入。

## CLI 與工作區

專案根由執行目錄向上尋找 `.git` 或既有 `.shiftblame`；找不到時使用目前目錄。磁碟根與系統頂層目錄不作錨點。工作暫存位於 `<repo>/.shiftblame/tmp/`，避免入庫。

| 命令 | 通用行為 |
| --- | --- |
| `sb state` | 顯示專案根、工作區與交接入口。 |
| `sb rewrite` | 快照根目錄 README、`docs/` 及框架選定位置的 AGENTS／ROADMAP 至 `.shiftblame/tmp/rewrite-backup/<時間戳>/`。不強制文件編號、位置、文風或標題變化。 |
| `sb commitmsg "<訊息>"` | 檢查非空單行訊息，拒絕 staged 工作區內部檔案，產生 `.shiftblame/tmp/commit-stamp.json`。提交章是否必要由外部政策決定。 |
| `sb handoff save <task> <草稿.md>` | 保存具名交接及可核對的 Git 事實。 |
| `sb handoff list`、`show <task>` | 唯讀查找或核對交接。 |
| `sb handoff load` | 依當前 Git 重新整理並讀取交接，保留舊快照。 |

CLI 退出碼為 0 通過、1 條件不符、2 用法錯誤。交接的選取、完整性、清理及資料邊界見 [HANDOFF](HANDOFF.md)。命令與參數摘要可記於 `.shiftblame/tmp/sb-usage.jsonl`；觀測失敗不改變命令結果。

## 本機工作區布局

`AGENTS.md` 記錄代理操作指引，`ROADMAP.md` 記錄方向與待辦，暫存放 `.shiftblame/tmp/`。這是 Shiftblame 框架布局；個人文件編號與文風由外部政策管理。

一般將兩份文件放 repo 根。只要 Git 歷史或遠端參照已追蹤任一同名文件，或專案有多位 Git 作者，就改放 `.shiftblame/AGENTS.md` 與 `.shiftblame/ROADMAP.md`。既有 tracked 文件視為上游來源，保留原位與內容；不以本機範本覆寫。

框架透過 `git rev-parse --git-path info/exclude` 找到正確本機忽略檔，支援 linked worktree。加入 `/.shiftblame/`、`/AGENTS.md`、`/ROADMAP.md`，不以新增 `.gitignore` 規則管理本機文件。

| 命令 | 作用 |
| --- | --- |
| `sb workspace migrate` | 判定布局，搬移現有未追蹤文件並更新 local exclude；不建立空文件、不修改根 `.gitignore`。 |
| `sb workspace init` | 先遷移，再從範本建立缺少的兩份文件。 |
| `sb workspace check` | 唯讀核對布局、忽略規則與待遷移內容。 |
| `sb workspace clean` | 先遷移，再精準清除根 `.gitignore` 的本機文件專用規則；保留一般規則及保護 tracked 上游文件的規則。 |

舊本機 `SOP.md` 遷為 `AGENTS.md`。內容衝突時回報並保留原檔，不自動覆寫或合併。工作區命令需要 Git；一般暫存建立只準備儲存位置，不隱式搬移文件。非 Git 目錄不建立 `.git/info`。

## 外部政策

`SHIFTBLAME_POLICY` 指向本機 JavaScript 模組的絕對路徑。未提供環境變數時，載入使用者明確安裝的 `~/.agents/local/shiftblame-policy.json`：

```json
{"module": "/absolute/path/to/policy.mjs"}
```

Windows 使用 JSON 可表示的絕對路徑。環境變數優先；設為空字串可停用設定檔中的政策。兩者皆未設定時使用通用預設。政策是可執行的本機設定，不從專案內容自動搜尋或下載。

模組匯出 `apiVersion = 1`，並可提供下列介面：

| 匯出 | 契約 |
| --- | --- |
| `commitMessageIssue(message)` | 合格回傳 `null`，不合格回傳原因字串。 |
| `createCli({ROOT, SB_DIR, TMP, die, fin, inspectWorkspace})` | 回傳可選的 `rewrite()` 與 `checkStaged(staged)`，擴充文件及 staged 檢查。 |
| `createHook(api)` | 回傳 `(event, input, ctx) => ({deny?, ask?, context?})`。 |
| `requireCommitStamp` | 啟用提交章要求；未啟用時通用 hook 不要求章。 |

`inspectWorkspace(cwd)` 回傳 repo 根、協作判定、兩份本機文件位置及 exclude 路徑，供政策沿用框架布局。

`createHook` 的 `api` 由通用 hook 提供，包含路徑解析、shell 掃描、狀態鎖及工作區觀測工具。實際名稱以 `hooks/guard-runtime.mjs` 的呼叫點為準。`ctx` 包含目前目錄、專案根與事件來源。平台如何呈現 `ask` 依平台能力處理。

通用防護先判斷，政策結果再合併。核心拒絕結果優先，政策不能將它放寬。載入或執行政策失敗時拒絕操作。`shiftblame-guard.mjs` 啟動入口捕捉模組載入及初始化錯誤，以退出碼 2 阻擋，避免錯誤設定變成靜默停用。

訪談、失敗次數裁示、文件編排、提交格式、測試同批與固定收尾屬外部政策責任。通用層不指定稱謂、自然語言、模型、提問工具或平台顧問路由。

## 通用 hooks

插件註冊 SessionStart、UserPromptSubmit、PreToolUse、PostToolUse 與 PostToolUseFailure。SessionStart 提供簡短工作原則；其他事件按需要維護觀測，PreToolUse 執行路徑及命令防護。支援的事件依實際平台判定。

Shell 解析處理引號、跳脫、heredoc、管線、命令替換及巢狀 shell。最多展開 4 層；內容過多而無法確認破壞性操作時拒絕。字串與註解中的命令名稱不當作執行證據。

- 遞迴刪除及同步刪除的本機目標須為絕對路徑。
- 根目錄、家目錄、專案根、其上層及系統頂層目錄不可整個刪除或清空。
- 丟棄 Git 變更須以 `git -C <絕對路徑>` 錨定 repo。
- 截斷重定向須使用絕對目標；丟棄輸出可用 `/dev/null` 或 `$null`。
- 提交檢查保護 `.shiftblame/` 內部資料。Git 路徑重定向及無法判明目標的命令會被拒絕。

外部政策可在此基礎上增加提交及其他檢查。未啟用政策時，合法提交不必先跑 `sb commitmsg`。

## 觀測與限制

Hooks 在既有工作區的 `.shiftblame/tmp/hook-records.json` 記錄心跳與工具次數，使用排他鎖串行。等鎖逾時可略過該次觀測，錯誤記於 `hook-errors.jsonl`。計數只代表嘗試，成功與完成仍須核對實際結果。

防護只核對可辨識的工具輸入與命令。背景程序啟動後的持續寫入、直譯器內嵌程式與腳本內部行為未必能完整解析。不能以 hook 放行推定操作安全或需求滿足；代理仍須遵守授權並核對真實目標。

## 維護

CLI、技能與政策文件須對應實際行為。測試涵蓋通用預設、政策入口、防護及交接契約。版本與正式發布依使用者授權；開發成果不等同已發布版本。
