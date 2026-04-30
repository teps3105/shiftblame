# 部門完成閘門流程

每個部門完成後，秘書讀取 PROXY 共識產出，驗證品質門檻，用 AskUserQuestion 回報老闆。

## 步驟

```
1. 部門完成 → 秘書讀取 consensus.md + 各 PROXY result.md
2. 執行部門驗證 SOP（見下方）
3. AskUserQuestion 呈報共識結果 → 等老闆判定
4. 工具回傳 → 依老闆選擇分支：
   - 「繼續」→ 同一 turn 內直接推進（派下一部門或進入收尾流程）
   - 「重做」→ 覆述選擇 → 結束 turn，等老闆下一則訊息說明修正內容
   - 「暫停」→ 覆述選擇 → 結束 turn，等老闆下一則訊息討論
```

**關鍵**：只有「重做」和「暫停」才結束 turn。「繼續」必須在同一 turn 內完成推進。

## AskUserQuestion 格式

### 共識收斂

```
AskUserQuestion({
  questions: [{
    question: "[部門] 完成。共識結果：<摘要>。",
    header: "部門回報",
    options: [
      { label: "繼續", description: "共識 OK，推進下一部門" },
      { label: "重做", description: "有問題，要求重新執行" },
      { label: "暫停", description: "先暫停，有問題要討論" }
    ],
    multiSelect: false
  }]
})
```

### 共識含技術分歧（PROXY 內部已處理）

當 consensus.md 含技術分歧的多數決記錄時，秘書不需特別處理——技術分歧已由 PROXY 內部解決。秘書僅需確認 consensus.md 存在且含分工與做法。

## 判讀老闆回應

| AskUserQuestion 回傳 | 秘書動作 |
|---|---|
| label: 「繼續」 | 同一 turn 內派工下一部門或進入收尾流程 |
| label: 「重做」 | 結束 turn，等老闆下一則訊息說明修正內容 |
| label: 「暫停」 | 結束 turn，等老闆下一則訊息討論 |

> **註**：上表為閘門工具回傳後的結構化分支。老闆在「重做」或「暫停」之後的後續訊息仍需語意判讀——例如追問細節、修改需求、或取消——此時適用一般意圖理解，不構成新的閘門流程。

## 部門驗證 SOP

### QC 報告後：弱斷言掃描

QC 共識到達後，秘書必執行：
1. 弱斷言關鍵字掃描（`pixel diff` / `ratio` / `source="game"` fallback / 紅隊全擋但無正路徑 video/state）
2. OBS-/觀察 條目逐條判讀
3. 確認至少一條業務行為斷言用 video/state 級

任一不通 → 退 QC，不問老闆。

### DEV 報告後：無過濋 pytest + 業務 sanity check

DEV 共識到達後，秘書必執行：
1. 無過濋 pytest：`cd /home/derek/.worktree/<repo>/<slug> && pytest <all relevant paths> -v 2>&1 | tail -20`，比對共識報告數字
2. 業務 sanity check（read-only）：跑專案的 quality_check CLI、manifest schema 驗證、grep PRD 閾值關鍵字 vs 實作確認未暗改

派工 DEV 時 prompt 禁含 `tests/e2e/`（DEV 不跑 e2e，測試指令只含 unit + integration）。

不一致或驗證失敗 → 退 DEV + 主動詢問老闆是否記錄常識。秘書沒跑 = 違規。

### PRD 報告後：測試數量驗證

PRD 共識到達後，秘書必驗證前端+後端測試數量（依 REPO.md 的專案結構調整路徑），任一為 0 → 退 PRD 補寫。

### 所有部門回報後：worktree 確認

PRD/DEV/QC/MIS 共識到達後，執行 `cd <worktree> && git status && git branch --show-current` 確認改動在 worktree 內、分支正確。主 repo 絕不可切離 main。
