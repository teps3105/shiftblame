---
name: shiftblame
description: "AI Agents 協作框架。Use when: 功能創建(開始/start/開工/動工/go/begin)→建立新slug啟動PM, 恢復(恢復/restore/resume)→讀取未歸檔SLUG.md恢復工作狀態, 推進(推進/advance)→執行閘門推進流程, 補強(補強/reinforce)→同部門原地修復, 打回(打回/reject)→退回上游部門, 回溯(回溯/rollback)→撤回該部門所有變更回到該部門001, 收尾(收尾/finalize)→QC通過後執行收尾流程, 歸檔(歸檔/archive)→搬移slug至archive, 退回(退回)→依情境原地修復或打回, 載入(PM/QA/DEV/QC/專案計畫/品質保證/產品開發/驗收上線/管理者/執行者/紅隊/藍隊/BossConfirm/BossPreview/閘門/攻防/task.md/result.md/red.md/blue.md/SLUG.md/EXECUTED/RED/BLUE/CONCLUSION/CHECKED/PASSED)→載入技能."
---
# shiftblame — AI Agents 協作框架
使用功能分支模式：管理者在第一次進入產品開發時建立 `feat/<slug>` 分支，專案計畫和品質保證不使用功能分支。紅隊與藍隊固定使用本環境子代理，不使用外部品牌工具或跨環境審查。

## 角色
| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 目前環境 | 協調、派工、管線、閘門、收尾（不寫入部門正式產物） |
| 執行者 | 目前環境 | result.md、conclusion.md |
| 紅隊 | 本環境子代理 | red.md |
| 藍隊 | 本環境子代理 | blue.md |

固定呼叫映射：

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| 主開發環境 | 目前環境 | 本環境子代理 | 本環境子代理 |

詳見 `MANAGER.md` `STAFF.md`。紅藍隊固定使用本環境子代理，不得改用外部品牌工具。

## 溝通原則

全流程預設老闆不懂技術，只是一個想用 AI 實現作品的人。對老闆說明時必須使用繁體中文與作品語言，說清楚「現在會看到什麼、可以操作什麼、這回合要完成哪個功能、如何確認它有用」。技術名詞、架構名詞、測試名詞只能作為內部工作細節，不得包裝成給老闆確認的主要內容。

## 部門
| # | 部門 | 類型 |
|:-:|:----:|:----:|
| 0 | PM | 專案計畫 |
| 1 | QA | 品質保證 |
| 2 | DEV | 產品開發 |
| 3 | QC | 驗收上線 |

詳見 `DEPT/` 各部門子目錄。

## 定義檔 / gitignore
`MANAGER.md` `STAFF.md` `DEPT/{PM,QA,DEV,QC}/`（每部門 L1-L5）

`.shiftblame/` 為本地工作目錄，須列入 `.gitignore` 不納入版本控制。開發中的工作筆記、臨時待辦、BossPreview 回饋、退回原因與本輪決策一律維護在 `.shiftblame/<slug>/SLUG.md`；不得寫入 `.shiftblame/ROADMAP.md`。REPO.md 記錄「完成了什麼」（已完成功能詳情、技術棧、架構演進），本地私密。ROADMAP.md 記錄「未來預計要做什麼」（後續計畫、已知問題、待改進項目），本地私密。兩份文件語意不可交叉，只在歸檔後更新。

全域入口檔的 managed block 由管理者依 `GATE.md` 全域入口安裝段落寫入或更新。不得依賴工具專屬設定檔觸發流程。

## 閘門狀態機

管理者依 `GATE.md` 定義的狀態機執行閘門檢查：G0 初始化 → G1 派工 → 宣告-確認-執行閘門（TASK → DECLARED → APPROVED）→ G2 審查（EXECUTED → RED → BLUE → CONCLUSION → CHECKED → PASSED）→ G3 歸檔。每次狀態轉移前驗證必要檔案，不通過則中止並報告缺件。詳見 `GATE.md`。

每一輪任務開始前，管理者必須向老闆確認宣告內容（宣告-確認-執行閘門），老闆同意後才能開始執行。全部門、每一輪都適用。FAIL 時原地修復同一 NNN（不建立新 NNN，修改 result.md/red.md/blue.md/conclusion.md 不刪除，task.md 回到 APPROVED，宣告段落不變，重新走完整攻防流程）。BossConfirm FAIL 時老闆可選擇新切片（新 NNN 從階段 1 開始）或原地修復（同 NNN 修改 result.md/red.md/blue.md/conclusion.md 從階段 2 重做）。PASS 後管理者判斷分支：推進下一部門或同部門新執行切片（新 NNN），並輸出 compact 提醒。一個 NNN 可以多次提交。

## 格式檢查

載入技能時，管理者必須依操作標準 17 檢查 REPO.md 和 ROADMAP.md 是否符合標準格式（模板定義於系統規格 31 和系統規格 32）。若不符合，管理者必須先整理為標準格式再繼續。不得在非標準格式的文件上執行其他操作。

## 權限 / ignore 規則

`.shiftblame/` 通常會被 `.gitignore` 排除，因此部分檔案工具（例如 `read_file`、內建檔案讀取器）會拒絕讀取其中內容。所有管理者與員工在讀寫 `.shiftblame/` 與 `skills/shiftblame/` 的 Markdown 檔案時必須使用 shell 指令，且讀取 Markdown 一律明確指定 UTF-8：

- 讀取（Linux/macOS/Git Bash）：`cat`、`sed -n`
- 讀取（Windows PowerShell）：`Get-Content -Encoding UTF8`
- 檢查/列檔：`test -f`、`find`、`Test-Path`、`Get-ChildItem`
- 寫入：shell heredoc、目前環境檔案寫入、或目前環境允許的 patch/write 工具
- 禁止：要求員工用 `read_file` 讀 `.shiftblame/` 內檔案
- 禁止：在 Windows PowerShell 以未指定 `-Encoding UTF8` 的 `Get-Content`、`type`、`cat` 讀取含中文的 Markdown 檔案

派工 prompt 必須明確寫入：「`.shiftblame/` 與 `skills/shiftblame/` 的 Markdown 檔案只能用 shell 讀取，不要使用 read_file 或內建檔案讀取工具；Windows PowerShell 必須使用 `Get-Content -Encoding UTF8`，Linux/macOS/Git Bash 可用 `cat` 或 `sed -n`」。

確認 `.shiftblame/REPO.md` 與 `.shiftblame/ROADMAP.md` 存在，不存在 → 依 `GATE.md` 初始化或報告「尚未初始化」。關鍵字觸發流程。

## 文件結構

```
.shiftblame/
├── REPO.md               # 專案現狀（本地私密）
├── ROADMAP.md            # 穩定產品路線圖（本地私密，僅收尾整理）
├── archive/              # 歷史紀錄（已完成任務）
└── <slug>/
    ├── SLUG.md            # 本輪開發筆記（開發中唯一工作日誌）
    └── <DEPT>/
        └── <NNN>/
```

```
skills/shiftblame/
├── SKILL.md
├── GATE.md               # 狀態機閘門定義
├── MANAGER.md
├── STAFF.md
└── DEPT/
    ├── PM/
    ├── QA/
    ├── DEV/
    └── QC/
```
