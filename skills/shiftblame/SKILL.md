---
name: shiftblame
description: "AI Agents 協作框架。UTF-8。回饋即意圖，不直接執行。雙期：執行期 L0~L2，驗證期 L3~L5。"
---
# shiftblame — AI Agents 協作框架

依雙期制度協調 PM（研究品管）與 DEV（開發維運）。會話由老闆自由管理。

1. **寫入權分化**：PM 不得變更 repo（產物僅存 .shiftblame/）；DEV 可變更 repo 並 commit（含維運期）
2. **回饋即意圖**：老闆回饋為意圖確認素材，不可直接執行

## 角色與部門

| 角色 | 詳見 | 期別 | PM 研究品管 | DEV 開發維運 |
|------|------|------|:-----------:|:-----------:|
| 計畫者 | ROLE/{PM,DEV}/PLAN.md | 執行期 | 研究期 | 開發期 |
| 執行者 | ROLE/{PM,DEV}/TASK.md | 執行期 | 研究期 | 開發期 |
| 驗收者 | ROLE/{PM,DEV}/RESULT.md | 執行期 | 研究期 | 開發期 |
| 攻擊者 | ROLE/{PM,DEV}/RED.md | 驗證期 | 品管期 | 維運期 |
| 防禦者 | ROLE/{PM,DEV}/BLUE.md | 驗證期 | 品管期 | 維運期 |
| 結論者 | ROLE/{PM,DEV}/CONCLUSION.md | 驗證期 | 品管期 | 維運期 |

## 觸發

| 觸發方式 | 行為 |
|---------|------|
| `/shiftblame <任意文字>` | 後標為意圖線索 → 讀取上下文 → 呈現意圖 → 確認 → 分流 |
| `/shiftblame`（有未歸檔 SLUG.md） | 搜尋 → 呈現清單 → 老闆選擇 → 分流 |
| `/shiftblame`（無未歸檔） | 分析 REPO/ROADMAP/PID/GRAPH → 提議 slug → 確認 |

意圖揭露詳 GATE.md。觸發後不直接執行，先與老闆確認意圖。
## 模式

- **執行期**：L0 計畫(plan.md) → L1 執行(task.md) → L2 驗收(result.md)
- **驗證期**：L3 紅隊(red.md) → L4 藍隊(blue.md) → L5 結論(conclusion.md) → 收尾

不溯及既往；同類串接；PM PASSED 後交接 DEV。

## 定義檔

```
skills/shiftblame/
├── SKILL.md          # 入口
├── GATE.md           # 閘門、狀態機、收尾（權威）
├── MANAGE.md         # 管理者操作
├── ROLE/{PM,DEV}/    # {PLAN,TASK,RESULT,RED,BLUE,CONCLUSION}.md
├── TEMPLATES/        # 文件模板
└── TOOLS/            # 工具包（DESIGN.md, E2E.md）
```
閘門/收尾→GATE.md ｜ 管理者操作→MANAGE.md ｜ 角色→ROLE/*.md
