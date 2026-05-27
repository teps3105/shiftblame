---
name: shiftblame
description: "AI Agents 協作框架。Use when: any shiftblame keyword detected (開始/start/開工/動工/go/begin, PM/QA/DEV/QC, 專案計畫/品質保證/產品開發/驗收上線, 管理者/執行者/紅隊/藍隊, BossConfirm/BossPreview/PublishConfirm, 閘門/攻防/退回/歸檔, task.md/result.md/red.md/blue.md/SLUG.md, EXECUTED/RED/BLUE/RESULT/CHECKED/PASSED)."
---
# shiftblame — AI Agents 協作框架
使用功能分支模式：管理者在第一次進入產品開發時建立 `feat/<slug>` 分支，專案計畫和品質保證不使用功能分支。紅隊與藍隊固定使用本環境子代理，不使用外部品牌工具或跨環境審查。

## 角色
| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 目前環境 | 協調、派工、管線、閘門、收尾（不寫入部門正式產物） |
| 執行者 | 目前環境 | result.md |
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
`MANAGER.md` `STAFF.md` `DEPT/{PM,QA,DEV,QC}/`

`.shiftblame/` 為本地工作目錄，須列入 `.gitignore` 不納入版本控制。開發中的工作筆記、臨時待辦、BossPreview 回饋、退回原因與本輪決策一律維護在 `.shiftblame/<slug>/SLUG.md`；不得寫入 `.shiftblame/ROADMAP.md`。REPO.md 記錄「完成了什麼」（已完成功能詳情、技術棧、架構演進），本地私密。ROADMAP.md 記錄「未來預計要做什麼」（後續計畫、已知問題、待改進項目），本地私密。兩份文件語意不可交叉，只在歸檔後更新。

全域入口檔的 managed block 由管理者依 `GATE.md` 全域入口安裝段落寫入或更新。不得依賴工具專屬設定檔觸發流程。

## 閘門狀態機

管理者依 `GATE.md` 定義的狀態機執行閘門檢查：G0 初始化 → G1 派工 → G2 審查（EXECUTED → RED → BLUE → RESULT → CHECKED → PASSED）→ G3 歸檔。每次狀態轉移前驗證必要檔案，不通過則中止並報告缺件。詳見 `GATE.md`。

同一 slug、同一部門最多只能到 `005`；補強、打回與回溯都計入同一個五輪上限，不得建立 `006`。若到 `005` 仍未收斂，必須先聚合該部門：重寫 `DEPT/001/task.md`，刪除所有舊的攻防產物與中間文件。研究部門（PM/QA）001 經紅藍攻防通過後可作為下游輸入；執行部門（DEV/QC）至少完成 002 並通過 Result Check 與 BossConfirm 後才能推進。聚合後不受最低門檻限制。`DEV/001` 不得修改程式碼、正式文件、設定、部署或 git 狀態；`QC/001` 不得直接開始測試或驗收。

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
