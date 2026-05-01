# 閘門流程

## MIS 啟動閘門（流程起點）

MIS 啟動後（流程起點），秘書確認 MIS 已完成專案現狀釐清、執行準則確立、REPO.md 初始化/更新。

### 確認步驟

1. 讀取 `~/.shiftblame/<repo>/REPO.md`，確認內容完整：
   - 專案定位
   - 方向
   - 實作程度
   - 待辦
2. 若 REPO.md 不存在或內容不完整 → 退回 MIS 補齊
2.1 上游產出驗證（DISPATCH_CHECKLIST 10）：
   - 讀取 REPO.md，確認內容反映本次 MIS 起點的釐清結果（專案定位、方向、實作程度、待辦均已更新）
   - 確認執行準則已落袋：MIS result.md 中含明確的執行準則
2.2 驗證不通過 → 退回 MIS 補齊（不進入 QA）
2.3 透過 AskUserQuestion 確認 MIS 起點產出可接受（見下方格式）
3. AskUserQuestion 呈報 MIS 啟動結果：

```
AskUserQuestion({
  questions: [{
    question: "MIS 啟動完成。專案現狀已釐清，REPO.md 已初始化/更新。",
    header: "MIS 啟動",
    options: [
      { label: "確認派工 QA", description: "專案現狀與準則 OK，啟動單向流程" },
      { label: "退回 MIS", description: "有問題，要求 MIS 補齊" },
      { label: "暫停", description: "先暫停，有問題要討論" }
    ],
    multiSelect: false
  }]
})
```

## 維護模式閘門

維護模式下，MIS 完成後的閘門簡化為直接進入收尾：

1. 秘書讀取 MIS 產出（consensus.md + 各 PROXY result.md）
2. 確認 MIS.md 已產出
3. AskUserQuestion 呈報 MIS 完成結果：

```
AskUserQuestion({
  questions: [{
    question: "MIS 維護完成。是否確認進入秘書復判？\n\n三方工作情況：\n- Claude：<完成項目>\n- Codex：<完成項目>\n- Gemini：<完成項目>",
    header: "維護模式",
    options: [
      { label: "確認復判", description: "確認進入秘書復判" },
      { label: "退回 MIS", description: "有問題，要求 MIS 補齊" },
      { label: "暫停", description: "先暫停，有問題要討論" }
    ],
    multiSelect: false
  }]
})
```

4. 「確認復判」→ 秘書執行復判確認有確實收尾與正確運作 → 復判通過 → 進入維護模式收尾流程
5. 「退回 MIS」→ 結束 turn，等老闆說明修正內容
6. 「暫停」→ 結束 turn，等老闆討論

維護模式不經過部門完成閘門流程（無 QA/SEC/PRD/DEV/QC/OPS 閘門），也不會發生退回其他部門的情況。

## 秘書復判閘門

MIS(尾)完成後，秘書須執行復判確認有確實收尾與正確運作，復判通過後才進入歸檔流程。

### 維護模式復判

1. 秘書讀取 MIS 產出（consensus.md + 各 PROXY result.md）
2. 復判確認項目：
   - MIS.md 產出完整性（含歸檔紀錄、合併紀錄、變更摘要、semver 評估、結論）
   - 定義檔變更與 task.md 要求一致
   - 三方 PROXY 均有完成回報（或已有降級/吸收記錄）
3. AskUserQuestion 呈報復判結果：

```
AskUserQuestion({
  questions: [{
    question: "秘書復判完成。MIS 維護工作已確認收尾與正確運作。\n\n三方工作情況：\n- Claude：<完成項目>\n- Codex：<完成項目>\n- Gemini：<完成項目>",
    header: "秘書復判",
    options: [
      { label: "確認歸檔", description: "復判通過，執行歸檔" },
      { label: "退回 MIS", description: "有問題，要求 MIS 補齊" },
      { label: "暫停", description: "先暫停，有問題要討論" }
    ],
    multiSelect: false
  }]
})
```

4. 「確認歸檔」→ 進入收尾流程（SKILL.md 收尾流程區段）
5. 「退回 MIS」→ 結束 turn，等老闆說明修正內容
6. 「暫停」→ 結束 turn，等老闆討論

### 開發模式復判

1. 秘書讀取 MIS 產出（consensus.md + 各 PROXY result.md）
2. 復判確認項目：
   - MIS.md 產出完整性
   - 合併紀錄（commit SHA、squash merge 記錄）
   - 定義檔變更與 task.md 要求一致
   - worktree 狀態乾淨（無未提交變更）
   - 三方 PROXY 均有完成回報（或已有降級/吸收記錄）
3. AskUserQuestion 呈報復判結果：

```
AskUserQuestion({
  questions: [{
    question: "秘書復判完成。MIS 收尾工作已確認收尾與正確運作。\n\n三方工作情況：\n- Claude：<完成項目>\n- Codex：<完成項目>\n- Gemini：<完成項目>",
    header: "秘書復判",
    options: [
      { label: "確認歸檔", description: "復判通過，執行歸檔" },
      { label: "退回 MIS", description: "有問題，要求 MIS 補齊" },
      { label: "暫停", description: "先暫停，有問題要討論" }
    ],
    multiSelect: false
  }]
})
```

4. 「確認歸檔」→ 進入收尾流程
5. 「退回 MIS」→ 結束 turn
6. 「暫停」→ 結束 turn

## 部門完成閘門流程

每個部門完成後，秘書讀取 PROXY 共識產出，驗證品質門檻，用 AskUserQuestion 回報老闆。

### 步驟

```
1. 部門完成 → 秘書讀取 consensus.md + 各 PROXY result.md
1.5. 讀取三方 PROXY result.md，整理三方工作情況
1.5.1. 讀取通訊目錄的 failure-notice.md（若有），確認是否有未被吸收的失敗通知
2. 執行部門驗證 SOP（見下方）
3. AskUserQuestion 呈報共識結果 → 等老闆判定
4. 工具回傳 → 依老闆選擇分支：
   - 「繼續」→ 同一 turn 內直接推進（派下一部門或進入收尾流程）
   - 「重做」→ 覆述選擇 → 結束 turn，等老闆下一則訊息說明修正內容
   - 「暫停」→ 覆述選擇 → 結束 turn，等老闆下一則訊息討論
```

**關鍵**：只有「重做」和「暫停」才結束 turn。「繼續」必須在同一 turn 內完成推進。

### 退回增量記錄

秘書退回某部門時，須執行以下增量記錄（僅開發模式，維護模式無退回）：

1. **task.md 退回指示**：秘書在退回部門時，須在 task.md 明確記錄退回來源部門與退回原因（增量追加，不替換原有目標與約束）。
2. **部門產出檔增量追加**：被退回部門完成補強後，須在其產出文件末尾追加退回紀錄（每次退回追加一組，不覆蓋既有紀錄）：
   ```markdown
   ## 退回紀錄
   - 退回來源：<部門名稱>
   - 退回原因：<簡述原因>
   - 退回時間：<ISO 8601 timestamp>
   ```

## AskUserQuestion 格式

### 共識收斂

```
AskUserQuestion({
  questions: [{
    question: "[部門] 完成。共識結果：<摘要>。\n\n三方工作情況：\n- Claude：<完成項目/吸收份額/降級狀態>\n- Codex：<完成項目/吸收份額/降級狀態>\n- Gemini：<完成項目/吸收份額/降級狀態>",
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
1. 無過濋 pytest：`cd ~/.shiftblame/<repo>/<slug>/worktree && pytest <all relevant paths> -v 2>&1 | tail -20`，比對共識報告數字
2. 業務 sanity check（read-only）：跑專案的 quality_check CLI、manifest schema 驗證、grep PRD 閾值關鍵字 vs 實作確認未暗改

派工 DEV 時 prompt 禁含 `tests/e2e/`（DEV 不跑 e2e，測試指令只含 unit + integration）。

不一致或驗證失敗 → 退 DEV。秘書沒跑 = 違規。

### PRD 報告後：測試數量驗證

PRD 共識到達後，秘書必驗證前端+後端測試數量（依 REPO.md 的專案結構調整路徑），任一為 0 → 退 PRD 補寫。

### 所有部門回報後：worktree 確認

PRD/DEV/QC/MIS 共識到達後，執行 `cd <worktree> && git status && git branch --show-current` 確認改動在 worktree 內、分支正確。主 repo 絕不可切離 main。
