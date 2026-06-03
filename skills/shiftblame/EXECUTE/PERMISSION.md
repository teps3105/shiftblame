---
title: EXECUTE/PERMISSION
---

# PERMISSION — .shiftblame/ 讀寫權限規則

派工時，prompt 必須包含以下硬性指示：

```text
重要產出規則（環境自適應）：
- .shiftblame/ 已被 .gitignore 排除。
- 讀取 .shiftblame/ 與 skills/shiftblame/ 內 Markdown 檔案時：
  Claude 環境優先使用 Read Tool（內建檔案讀取工具）；
  Codex 桌面環境使用 Get-Content -Encoding UTF8（PowerShell）或 cat（Linux/macOS/Git Bash）。
  若內建工具無法使用再以 shell 指令處理。
- 寫入 .shiftblame/ 與 skills/shiftblame/ 內 Markdown 檔案時：
  Claude 環境優先使用 Write/Edit Tool（內建檔案寫入/編輯工具）；
  Codex 桌面環境使用 apply_patch 系列工具，或 Out-File -Encoding UTF8（PowerShell）。
  若內建工具無法使用再以 shell heredoc 處理。
- 檢查檔案存在與列檔可使用 test -f、find、Test-Path、Get-ChildItem。
- 禁止在 Windows PowerShell 以未指定 -Encoding UTF8 的 Get-Content/type/cat 讀取含中文 Markdown。
```

- 開發中筆記、臨時待辦、BossPreview 回饋、退回原因與本輪決策只可記錄在 `.shiftblame/<slug>/SLUG.md`，不得寫入 ROADMAP.md。
- 輸出必須直接寫入指定的目標檔案，報告必須包含完整的 YAML frontmatter 與繁體中文內容。
- 臨時檔案（暫存、中間產物、除錯輸出、截圖等）一律存放在 `.shiftblame/tmp/`，不得放在專案根目錄。

若員工回報 `.shiftblame/` 檔案被 ignore/permission 拒絕，管理者不得等待其自行修復；立即中止該員工程序，改用上述硬性指示重派，或由管理者代讀內容後以 prompt 摘要提供。
