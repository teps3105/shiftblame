---
title: GATE/STATE
---

# 狀態機

五階段 FAIL 狀態機：

```
L1 宣告:   DECLARED ──BossConfirm FAIL──→ DECLARED（重新宣告）
                └──agree──→ APPROVED

L2 產出:   APPROVED ──→ EXECUTED（result.md）──BossConfirm──→（繼續 L3）
                └──老闆要求修改──→ DECLARED（重新宣告，BossConfirm 後再 APPROVED → EXECUTED → BossConfirm）

L3 紅隊:   L2 BossConfirm 通過後 ──→ 紅隊寫入 red.md ──→ 管理者驗證 ──→ RED

L4 藍隊:   RED ──→ 藍隊寫入 blue.md ──→ 管理者驗證 ──→ BLUE
                └──FAIL──→ EXECUTED（退回 L2 原地修復 result.md）
                              └──BossConfirm 通過──→ L3 紅隊 → L4 藍隊 → L5 結論
                              └──BossConfirm FAIL──→ EXECUTED（繼續修改，見 L4 FAIL 修復閘門）

L5 結論:   BLUE ──PASS──→ CONCLUSION（管理者寫入 conclusion.md）──→ CHECKED ──BossConfirm FAIL──→ DECLARED（退回 L1 重新宣告）
                                                                └──BossConfirm PASSED──→ PASSED
```

## 狀態定義

| 狀態 | 意義 | 必要檔案 |
|------|------|----------|
| UNINIT | 尚未初始化 | 無 |
| READY | 可開始任務 | `.shiftblame/REPO.md` + `.shiftblame/ROADMAP.md` |
| TASK | 任務已建立 | `<slug>/SLUG.md` + `<slug>/<ROLE>/<NNN>/task.md` |
| DECLARED | 執行者已寫入宣告，等待老闆確認 | `task.md`（含非空「## 宣告」段落） |
| APPROVED | 老闆已同意宣告，可開始執行 | `task.md` |
| EXECUTED | result.md 已產出 | `task.md` + `result.md` |
| RED | red.md 已產出 | `task.md` + `result.md` + `red.md` |
| BLUE | blue.md 已產出 | `task.md` + `result.md` + `red.md` + `blue.md` |
| CONCLUSION | conclusion.md 已產出 | `task.md` + `result.md` + `red.md` + `blue.md` + `conclusion.md` |
| CHECKED | 閘門檢查完成（五檔齊全），待老闆確認 | — |
| PASSED | 老闆確認通過 | — |
| ARCHIVED | 已歸檔 | （已搬移至 `archive/`） |

## 合併歸檔狀態機

所有角色皆 PASSED 後：

```
MERGED ──PUSH──→ PUSHED ──ARCHIVE──→ ARCHIVED ──UPDATE──→ UPDATED
```
