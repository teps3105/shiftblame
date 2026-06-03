---
title: EXECUTE/TEMPLATE
---

# TEMPLATE — 臨時檔案、工作區與 Prompt 模板

## 臨時檔案規範

所有流程中產生的臨時檔案（暫存、中間產物、除錯輸出、截圖、錄影、下載等）一律存放在 `.shiftblame/tmp/`。不得在專案根目錄建立臨時檔案。不自動清理，由老闆自行決定何時清理。派工 prompt 必須明確寫入此規則。

## 工作區規範

功能分支在第一次進入產品開發時建立。MANUAL 模式在主工作目錄執行 `git checkout -b feat/<slug>`；AUTO 模式執行 `git worktree add .worktrees/<slug> -b feat/<slug>`。僅適用 MANUAL/AUTO 模式；PLAN/OPERATE 模式不使用功能分支。

- 功能分支生命週期：產品開發開始時建立 → PM/DEV 皆 PASSED 後 merge --no-ff 到主分支 → push → branch delete（AUTO 額外 worktree remove）
- MANUAL 模式所有程式碼變更在主工作目錄的功能分支上；AUTO 在 `.worktrees/<slug>` 中
- `.shiftblame/` 位於主工作目錄中，不在 worktree 內

## Prompt 模板通用格式

所有模板都必須包含「`.shiftblame/` 與 `skills/shiftblame/` 的 Markdown 檔案讀取與寫入規則：Claude 環境優先使用 Read Tool / Write/Edit Tool；Codex 桌面環境使用 `Get-Content -Encoding UTF8`（讀取）與 `apply_patch` 系列或 `Out-File -Encoding UTF8`（寫入）。若內建工具無法使用，再以 shell 指令處理」。

## 面向老闆互動規則

所有面向老闆的內容都必須預設老闆不懂技術：用繁體中文、作品效果、可操作步驟與驗證結果描述，不得用技術術語包裝。技術細節可放在「內部備註」或「實作紀錄」，不可取代功能描述。

面向老闆的互動必須使用繁體中文。選項文字不得使用英文狀態機值（如 AGREE、DECLARED 等）。參考選項文字：「同意」「不同意」「調整」。狀態機值全部大寫（YAML frontmatter、狀態描述）。

## 上下文監控

管理者在全流程中持續監控上下文用量。上下文過高時直接強制觸發環境的壓縮上下文機制（非建議老闆執行），避免工作到一半因上下文爆炸而中斷。壓縮後 SessionStart hook 會自動重新載入 shiftblame 技能。
