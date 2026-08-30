---
name: sb-commit
description: 提交規範的封裝執行——任何 commit MUST 經 sb-commit 流程（範圍盤點＋訊息機械驗證）後由秘書執行 git 提交。
---
# sb-commit — 提交規範封裝

> **sb-think 分發目標**：任何 commit 前 MUST 走本技能流程——提交不是隨手 `git commit`，是「精準範圍＋合格訊息＋正確分支」三檢後的動作。權威規範見 SKILL §7；本技能是它的執行封裝。

## 流程（每次 commit）

1. **範圍盤點**：`git status` 確認將提交的檔案清單——**精準 `git add`**，MUST NOT `git add -A` 一把梭（功能＝commit 單位，不得夾帶範圍外檔案；不屬於本 ms 的功能開新 ms，不堆積）。
2. **分支確認**：slug 開發 MUST 在 `<type>/<slug>` 分支上提交；**直接在 main 上工作是例外**（不開 slug 的框架演化、緊急修復、輕量調整）——不在例外清單卻在 main 上時，先切分支。
3. **訊息機械驗證**：`sb commitmsg "<訊息>"`（SKILL §1.8）MUST PASS——格式 `<type>: <繁中描述>`，type：feat／fix／docs／style／refactor／perf／test／chore／build／ci；單行 10-30 字（超過 60 字擋）；MUST NOT 含追蹤編號（#123、PROJ-456、ms／slug 代號）——追蹤靠分支名與 merge 訊息，slug 名稱只在 merge 訊息呈現。
4. **提交**：驗證 PASS 才 `git commit`；FAIL 時改寫訊息重驗，MUST NOT 逕自 `git commit -m` 繞過驗證。
5. **對位**：走重流程的功能，commit 存檔即建立「待驗對象」——驗收階段對該存檔跑 CI，收斂前 `sb next converge` 閘門核對 working tree 乾淨（SKILL §1.8）。

## 邊界

- sb-commit 只管提交動作本身的規範；**commit＝存檔**——實作完成即存檔建立不可變待驗對象，先於驗收與判決；判決不通過走返工、修復後疊加新存檔，而非禁止提交。
- 不取代 §7 分支政策與 merge 規範（合回主分支時 slug 名稱寫在 merge 訊息）。
- 框架演化直接在 main 提交同樣走本流程（範圍盤點＋commitmsg 驗證不豁免）。

## 印章硬擋（hooks 機械強制）

`sb commitmsg` 通過時自動寫入 `<repo>/.shiftblame/tmp/commit-stamp.json`（訊息＋時間＋cwd，10 分鐘有效）；ZCode 的 `PreToolUse` hook 偵測 `git commit` 時驗印章——無印章、逾期或訊息不符即 exit 2 阻擋，`-F` 檔案訊息無法驗證即擋。commit 訊息 MUST 以 `-m` 傳遞且與印章完全一致；多指令行（如 `sb commitmsg "…" && git commit -m "…"`）同訊息可過。
