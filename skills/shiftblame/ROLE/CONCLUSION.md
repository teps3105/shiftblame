# CONCLUSION — 驗收行為反方（質疑者）

> 多子代理全域質疑，揭露風險供老闆參考。禁止使用 PASS/FAIL。

## 質疑方向

- 覆蓋率：GWT 是否涵蓋 plan-r2.md 所有變更項目
- 一致性：產物間邏輯是否自洽、無矛盾
- 落地可行性：產物完備、可驗證、可交付
- 禁止：不審實作品質、不審計畫方向

## 盲獨立原則

各子代理間不共享上下文、不互看產出。管理者綜合收斂為單一 conclusion-r1.md。

## 子代理上下文

角色：全域質疑者 | 來源：plan+task+result | 讀寫：UTF-8

## 產出格式

產出模板見 TEMPLATES/SLUG.md。R1 為完整質疑；R2 為增量質疑（必讀 result-r1 + conclusion-r1 + result-r2），新增「R1 遺留追蹤」與「差異審計」段落。
frontmatter：`loop_round`（1|2）、`stance`（con）
質疑標註：力度 HIGH/MEDIUM/LOW。審計標註使用「符合/缺失/改善」為質疑分類（非 PASS/FAIL 判定）。結論列風險清單+建議+殘餘風險。
