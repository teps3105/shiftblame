---
name: GATE
parent: SBM-SKILL
revision: 3.1
---
# GATE — 閘門與 `<nnn>` 生命週期

## 1. 閘門

- **回饋即意圖**：見 SBM-SKILL §4.1。老闆每次說話即觸發揭露。
- **證據閘門**：正方/反方/收斂 MUST 標依據、查證、未知、反證、替代。未查證 MUST NOT 推進或 PASS。
- **先提案再質疑**：G1/G2 各自正→反→收斂。
- **迭代收斂**：以最後收斂為基線增量。
- **Slug 前置硬閘門**：實作前 MUST 建 slug + 完成反方子代理回收 + 寫入 G1/G2 收斂。

## 2. 狀態序

- **Slug**：`IN_PROGRESS → PASSED`。PASS 唯老闆拍板。
- **`<nnn>`**：見 §3。`<nnn>` 無 gate/PASS/FAIL，推進 MUST 由老闆指示。

## 3. `<nnn>` 階段

| 階段 | 動作 |
|------|------|
| START | 載三層租約（SOP｜SLUG §6｜SKILL+GATE+ROLE/+TEMPLATES/）→ 揭露目標 → **暫停等老闆** |
| 正方 | 主 session G1 提計畫 ‖ G2 提技術（身份切換） |
| 反方 | 子代理 G1 質疑 ‖ G2 質疑（獨立上下文） |
| 收斂 | 管理者分別收斂 G1/G2 → 揭露實作意圖 → **暫停等老闆** → 合併基線 → G3 |
| G3 | 管理者產 `<plan>`（策略+序列+驗收+明確化 `<complete>`）→ 派發執行者 |
| 執行 | 執行者逐項 `<task>` 自驗通過即 commit → 達 `<complete>` → 觸發點② |

## 4. G3 複雜度判定（派發策略）

任一成立 → 序列派發多執行者（一個完成才開下一個，非並行）；否則單一執行者。

| 維度 | 門檻 |
|------|------|
| `<task>` 序列長度 | ≥ 4 |
| 跨檔數 | ≥ 4 |
| 強序列依賴對 | ≥ 2 |

一致性的跨檔 `<task>` MUST 保持同一執行者。

## 5. Minor/Major 變更

- **Minor**（當前 `<nnn>`）：順序/驗證/細節調整，commit `change(<slug>): <摘>`。
- **Major**（新 `<nnn>`）：目標/完成標準/架構改變，重新正反收斂 + 新 `<plan>`。

## 6. 複審觸發點

- **①③**（G1/G2 收斂後、slug 全域）：老闆-gated，預設關閉。
- **②**（`<nnn>` 序列執行完）：硬審核 MUST 做；管理者揭露升級鏈選項 → 老闆選擔任者 → 獨立審 e2e 證據/未驗項。未跑 e2e MUST 標「未驗」。

## 7. 收尾（老闆拍板 PASS 後）

1. 管理者品質確認
2. 老闆 PASSED
3. **文件保鮮重寫**（對齊 SBM-SKILL §4.4 寫當下事實、§4.5 可查核引用）：
   - `docs/`+`SOP.md`+`ROADMAP.md` 移至 `.shiftblame/tmp/`
   - 從當下 codebase 逐檔重寫回原位置
   - 每個 `<檔案路徑>:<行號>` 引用重新查核；失效引用 MUST 修正或刪除
   - 測試資產盤點依專案 SOP 準則執行
4. `git checkout main && git merge --no-ff feat/<slug>` → 推送 → 清理
5. 歸檔 `.shiftblame/<slug>/` 至 `archive/`
