---
name: save
description: 保存 slug 或 main 直接作業的具名交接，核對工作落點及必要來源，供跨回合接續。
---
# 保存工作落點

依 [主技能](../shiftblame/SKILL.md) 與 `sb state` 確認 repo、模式、分支、工作樹及最近 commit。交接聚焦下一次要做的事：已授權目標與邊界的來源、已完成／未完成、使用者既有變更、有效及未驗證據、阻塞、下一步操作與預期觀察。已有正式文件、決策及 diff 使用回指；必要技能按讀取順序列出，敏感資料只記取得方式。

## main／直接實作

沒有活動 slug，或 ended 已完結而留在基底分支作業時，依 [HANDOFF](../shiftblame/references/HANDOFF.md) 選擇具名 task。先在 tmp 寫交接草稿並核對，再執行 `sb handoff save <task> <草稿.md>`。成功後以 `sb handoff show <task>` 讀回，確認內容及目前差異。

快照在 `.shiftblame/tmp/main/<task>/handoff.json`，包含交接文字與可核對的 Git 定位事實。名稱是工作識別，不建立 slug；CLI 不改分支、索引或 flow-state。多個工作分開命名，既有工作更新同名快照。main 模式不建立 SLUG 或 `last_save`；缺 Git 或 CLI 無法查證時保留草稿並揭露未建立正式快照。

## 活動 slug

先寫入 `.shiftblame/tmp/<slug>/handoff.pending.md`，讀回並核對實況，再以同目錄原子替換更新 `handoff.md`。失敗時保留舊交接及標記。正式檔讀回成功後，更新 SLUG §4 狀態與 §8 回指，最後設定 `last_save`。

保存範圍限於交接與其回指，維持既有階段、G1 契約及產品檔案。交接記錄不是授權或產品備份；恢復由 [resume](../resume/SKILL.md) 核對正式來源與實際狀態。保存完成不表示工作已交付，也不自行終止仍可推進的任務。
