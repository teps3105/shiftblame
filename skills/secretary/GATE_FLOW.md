# 部門完成閘門流程

每個部門完成後，秘書交叉比對三方 PROXY 產出，然後用 AskUserQuestion 回報老闆。

## 步驟

```
1. 部門完成 → 秘書交叉比對三方 PROXY 產出
2. AskUserQuestion 呈報結果 + 分歧項 → 等老闆判定
3. 工具回傳 → 覆述「您選了 [X]」→ 此 turn 立即結束
4. 老闆下一則訊息 → 判讀意圖
```

**關鍵**：步驟 3 後絕對不可在同一 turn 內派工下一部門。

## AskUserQuestion 格式

### 無分歧

```
AskUserQuestion({
  questions: [{
    question: "[部門] 完成。結果：<摘要>。三方 PROXY 比對：<N> 項收斂 / <M> 項分歧。",
    header: "部門回報",
    options: [
      { label: "繼續", description: "結果 OK，推進下一部門" },
      { label: "重做", description: "有問題，要求該部門重新執行" },
      { label: "暫停", description: "先暫停，有問題要討論" }
    ],
    multiSelect: false
  }]
})
```

### 有分歧

```
AskUserQuestion({
  questions: [{
    question: "[部門] 完成。三方 PROXY 比對發現 <M> 項分歧：\n\n<逐條列出>\n\n請裁定：",
    header: "分歧裁決",
    options: [
      { label: "採多數", description: "以多數 PROXY 結論為準" },
      { label: "採特定方", description: "指定某一 PROXY 的結論為準" },
      { label: "合併", description: "合併各方結論，下游都要考量" },
      { label: "暫停", description: "先暫停，需要討論" }
    ],
    multiSelect: false
  }]
})
```

## 判讀老闆回應

| 老闆語意 | 秘書動作 |
|---|---|
| 明確批准（好/go/繼續/ok） | 派工下一部門 |
| 分歧裁決 | 記錄裁決，注入下一部門 prompt |
| 要求修正 | 重新派出同一部門 |
| 追問或修改 | 回應討論，重新呈報 |
| 取消或暫停 | 停下 |

## 產碼部門回報後驗證

PRD/DEV/QC/MIS 回報後，執行 `cd <worktree> && git status && git branch --show-current` 確認改動在 worktree 內、分支正確。主 repo 絕不可切離 main。

## 主管回報格式

每個 PROXY 完成後必須回報：

```
## <部門> 主管回報
- **做了什麼**：<具體任務>
- **問題**：<遇到的問題，無則寫「無」>
- **解決方式**：<怎麼解決的，無問題則寫 N/A>（需協調標註「需秘書協調」）
- **結果**：<完成狀態，如 commit hash / 檔案變更摘要>
```

## 秘書彙報格式

交叉比對後向老闆彙報：

```
## 總彙報
### <部門> 主管
- **做了什麼** / **問題** / **解決方式** / **結果**
---
整體狀態：<全部完成 / 有待處理項>
待處理：<需老闆裁示的事項，無則寫「無」>
```
