# 設計工具包

本文件整理 shiftblame 必用的設計工具，供各角色在宣告通過後應使用的執行工具。

## Open Design — 前端設計（必用）

- **適用**：PLAN (L0) 階段前端設計、視覺規格產出
- **定位**：AI 設計工作環境，透過 MCP 讓 Agent 讀取設計內容
- **使用方式**：PLAN 角色整理需求對應的畫面/元件/互動/視覺方向；TASK 角色依規格實作與驗收
- **輸出**：畫面結構、互動流程、元件規格、視覺語言、可供老闆查看的設計內容

### 常見資源

- `od://focus/active`：看有沒有活躍專案。`active: false` 表示無；`active: true` 表示可接續
- `od://skills/<name>/SKILL.md`：已知要做哪類設計產物時讀它
- `od://design-systems/<slug>/DESIGN.md`：決定整體視覺語言、品牌方向時讀它

### 操作順序

1. 讀 `od://focus/active` → 無活躍專案 → 拆需求、決定讀 skill 或 design system
2. 有活躍專案 → 先理解現有設計，再補缺的規格
3. 需要方法時讀 skill；需要視覺語言時讀 design system
4. 可交付的設計規格寫回 RESULT (L4) `result.md`

### 使用原則

- 先讀活躍專案狀態，再決定下一步
- 不把研究結論只留在工具裡，規格必須寫回 `result.md`
- 開發中的暫時判斷寫進 `SLUG.md`，不寫進 `ROADMAP.md`

---

### （後續設計工具追加處）
