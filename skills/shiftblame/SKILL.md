---
name: shiftblame
description: "AI Agents 協作框架。Use when: '開始','start','開工','動工','go','begin'; or multi-agent workflow."
---
# shiftblame — AI Agents 協作框架
三名員工在同一工作目錄協作。管理者與執行者由目前主開發環境擔任。支援兩種工作區模式：**direct**（主 repo 直接開發，預設）或 **worktree**（獨立工作樹）。紅隊與藍隊固定使用本環境子代理，不使用外部品牌工具或跨環境審查。

## 角色
| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 目前環境 | task.md |
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
| 0 | PM | 產品管理 |
| 1 | QA | 品保 |
| 2 | DEV | 開發 |
| 3 | QC | 品管 |

詳見 `DEPT/*.md`。

部門產物皆寫入該部門任務目錄的 `result.md`，每部門固定三段：PM 為 BRD + MRD + PRD，QA 為 SEC + SOP + SRS，DEV 為 TPD + TDD + TIR，QC 為 ATP + ATR + ACR。這些縮寫不是額外檔名，不得建立同名 `.md` 檔作為替代產物。

功能開發管線以本輪使用者明確想實現的功能為中心：先開 PM，在 `result.md` 產出 BRD、MRD、PRD，完成市場調查、通用方法、設計模式、CVE 或版本差異等建立標準前的研究；QA 再依 PM 結果產出 SEC、SOP、SRS，並承擔原 PM 的產品規格、任務拆解與實作規劃職責。不得把 `.shiftblame/ROADMAP.md` 內的既有規劃當成本輪必做內容，除非使用者本輪明確要求。

進入 DEV 前，管理者必須先用中文詢問老闆想先完成 QA 結果中的哪個可見功能，並把本回合要實際開發的功能寫成非技術描述。DEV 必須先在 `result.md` 建立 TPD、TDD、TIR 的前置內容，再依此開發；DEV 期間允許老闆多次提出「想看目前變化」或「下一步想調整什麼」。管理者提供可操作 URL、畫面、截圖或驗證結果，這類即時預覽不取代正式閘門。

## 定義檔 / gitignore
`MANAGER.md` `STAFF.md` `DEPT/{PM,QA,DEV,QC}.md`

`.shiftblame/` 為本地工作目錄，須列入 `.gitignore` 不納入版本控制。開發中的工作筆記、臨時待辦、BossPreview 回饋、退回原因與本輪決策一律維護在 `.shiftblame/<slug>/SLUG.md`；不得寫入 `.shiftblame/ROADMAP.md`。ROADMAP 只在每輪收尾時，依 `SLUG.md` 與實際完成結果整理成穩定產品路線、完成摘要與後續候選；不得作為邊開發邊寫的工作日誌，也不得改寫成本輪「按照規劃應該要實現」的功能來源。

全域入口檔的 managed block 由管理者依 `GATE.md` 全域入口安裝段落寫入或更新。不得依賴工具專屬設定檔觸發流程。

## 閘門狀態機

管理者依 `GATE.md` 定義的狀態機執行閘門檢查：G0 初始化 → G1 派工 → G2 審查 → G3 歸檔。每次狀態轉移前驗證必要檔案，不通過則中止並報告缺件。詳見 `GATE.md`。

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
    ├── worktree/          # git worktree（worktree 模式專用；direct 模式無此目錄）
    └── <DEPT>/<NNN>/
        ├── task.md       # 任務定義
        ├── result.md     # 執行結果，依部門承載三段式文件章節
        ├── red.md        # 紅隊驗證
        └── blue.md       # 藍隊驗證
```

```
skills/shiftblame/
├── SKILL.md
├── GATE.md               # 狀態機閘門定義
├── MANAGER.md
├── STAFF.md
└── DEPT/
```
