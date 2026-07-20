---
name: shiftblame
revision: 3.0
---
# shiftblame — 回饋驅動的 agent 協作框架

> All you need is feedback.

```
老闆說 → G1(Why/What) ‖ G2(How/Done) → 收斂 → G3(Plan) → 執行 → 證據 → 老闆 PASS
         正方主session＋反方子代理            管理者    執行者           ↑
         ←────────────── 未 PASS 回老闆 ─────────────────────────────────┘
```

## 1. 詞彙（RFC 2119）

MUST（必須）｜SHOULD（應）｜MAY（得）｜MUST NOT（必須不，走替代路由）｜SHOULD NOT（應不，建議替代路由）。

## 2. 角色

- **老闆**：需求／優先序／風險／PASS-FAIL。
- **管理者**：G1+G2 收斂、G3 規劃、派發、初審、收尾。不實作。
- **執行者**：逐項 `<task>` 實作至 `<complete>`，自驗通過即 commit。
- **正方**：主 session 身份切換。**反方**：子代理獨立上下文。

## 3. 三軌

| 軌 | 職責 | 產出 |
|----|------|------|
| G1 | Why/What | `<task>` |
| G2 | How/Done | `<complete>` |
| G3 | Plan/Verify（非正反收斂） | `<plan>` |

## 4. 原則

1. **回饋即意圖**：老闆每次說話即意圖，管理者揭露後執行。有矛盾/模糊隨附「意圖釐清區塊」（Type/Issue/Context/Decision Needed 四欄）。
2. **證據優先**：不確定、新版本、外部 API、法規/安全/效能/成本、無先例、與老闆直覺衝突——MUST 查證。
3. **實作/審查互斥**：管理者改碼 MUST 走第三方驗證。
4. **寫當下事實**：禁日誌式（流水帳）、禁教訓式（推翻/經N輪/TRANSFERRED/TD由X解決/反面教訓）。過去事實以 git 歷史為權威。目標只寫 SOP；文件交叉引用不重複。

## 5. 觸發

- `/shiftblame <text>`：揭露意圖 → 老闆確認 → 建 slug → 流程路由 → 再次確認 → 實作。
- `/shiftblame`：列未歸檔 slug。

## 6. 提交與文件

- 訊息 `<type>: <繁中描述>`，描述 ≤20 codepoint（`sed 's/^[^:]*: //' | python -c "import sys;print(len(sys.stdin.readline().rstrip()))"`）。`.shiftblame/` MUST 經 `.gitignore` 排除。開框架走 `feat/<slug>`，管理者收尾 merge；不開 MAY 直接 main。
- 文件：`SKILL`(主)｜`GATE`(閘門)｜`ROLE/`(角色)｜`TEMPLATES/`(範本+slug鏡射)。
