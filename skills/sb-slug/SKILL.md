---
name: sb-slug
description: 開新 slug；無後標依脈絡提議待授權，有後標視為顯式授權建立。
---
# sb-slug — 開新 slug

當使用者要求「開新 slug」「新功能」「新長程目標」時執行本 prompt。用於與既有功能幾乎無關的新功能需求（SKILL §6 關係原則），建立新 `<slug>` 並從三權制衡開始。是否帶後續文字決定授權狀態。

先 `load skill: shiftblame`，讀取 SKILL §9 脈絡（SOP/ROADMAP/archive/當前 slug），再依下列分派：

## 無後續文字 → 提議，待老闆授權

問題揭露不等於修改授權（SKILL §2、§9）。提議後**等待老闆拍板**，MUST NOT 在授權前預建檔案。

從 `ROADMAP.md` 未完成項與專案脈絡選出適合的 `<slug>` 名稱，附脈絡依據提議開新 `<slug>`。

## 有後續文字 → 視為需求，顯式授權

後續文字即老闆命題，視為顯式授權。執行：

1. **記錄 slug 命題**：在 SLUG §1 忠實引用老闆命題，§2 記錄授權。
2. **切分支**：依 §7 分支政策切 `<type>/<slug>` 分支（從乾淨 main 開出）。
3. **建立 slug 骨架**（**定義單檔、結構分檔**，權威結構見 SKILL §8）：
   - 建立 `.shiftblame/<slug>/` 目錄。
   - 複製 `assets/SLUG.md` 範本 → `.shiftblame/<slug>/SLUG.md`（SLUG 主體 §1-§7；§3 初始節點 `三權制衡（G1↔G2↔G3）`）。
   - 建立 `.shiftblame/<slug>/<nnn>/` 子目錄（初始 nnn 如 `001`）。
   - 從 `assets/SLUG.md`「三權範本」段複製 G1→`<nnn>/G1.md`、G2→`<nnn>/G2.md`、G3→`<nnn>/G3.md`。
   - **不另建檔案、不建子目錄、不寫入非授權位置**；除 SLUG.md、`<nnn>/{G1,G2,G3}.md` 與 `tmp/` 外，MUST NOT 建立或寫入其他文件。
4. **進入三權制衡**：派發顧問側三角（AUDITOR→G1、RESEARCHER→G2、PLANNER→G3）產出三份文件。

## 邊界

- 本指令只開新 `<slug>`；同一 `<slug>` 內推進 nnn 用 `sb-next`，不在本指令開 nnn。
- 「與既有功能幾乎無關」是判定基準（§6）；若其實是同一大需求的新子需求，應走 `sb-next` 而非本指令。
- 無後續文字時，提議須附脈絡依據；**提議不等於授權**。
- 無後續文字時 MUST NOT 自行建立 slug。
