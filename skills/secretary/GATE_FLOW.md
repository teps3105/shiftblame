# 閘門流程

## MIS 啟動閘門

MIS 啟動後（循環圓外前置診斷），秘書確認 MIS 已完成專案現狀釐清、執行準則確立、REPO.md 初始化/更新。

### 確認步驟

1. 讀取 `~/.shiftblame/<repo>/REPO.md`，確認內容完整：
   - 專案定位
   - 方向
   - 實作程度
   - 待辦
2. 若 REPO.md 不存在或內容不完整 → 退回 MIS 補齊
2.1 上游產出驗證（DISPATCH_CHECKLIST 10.1）：
   - 讀取 REPO.md，確認內容反映本次 MIS 起點的釐清結果（專案定位、方向、實作程度、待辦均已更新）
   - 確認執行準則已落袋：MIS result.md 中含明確的執行準則
   - mtime 附帶驗證（非阻塞性）：`stat -c %Y ~/.shiftblame/<repo>/REPO.md` > `stat -c %Y ~/.shiftblame/<repo>/<slug>/MIS/task.md`。不通過 → 在報告中標注警告，不阻止派工
2.2 驗證不通過 → 退回 MIS 補齊（不進入 QA）
2.3 透過 AskUserQuestion 確認 MIS 起點產出可接受（見下方格式）
3. AskUserQuestion 呈報 MIS 啟動結果：

```
AskUserQuestion({
  questions: [{
    question: "MIS 啟動完成。專案現狀已釐清，REPO.md 已初始化/更新。",
    header: "MIS 啟動",
    options: [
      { label: "確認派工 QA", description: "專案現狀與準則 OK，開始循環圓" },
      { label: "退回 MIS", description: "有問題，要求 MIS 補齊" },
      { label: "暫停", description: "先暫停，有問題要討論" }
    ],
    multiSelect: false
  }]
})
```

### 恢復場景的 MIS 啟動閘門

當載入恢復命中 MIS_ALL_RESULT 時，秘書須在進入 QA 前完成以下閘門：

1. 讀取三方 MIS result.md（`~/.shiftblame/<repo>/<slug>/MIS/claude/result.md`、`codex/result.md`、`gemini/result.md`）
2. 確認 REPO.md 反映 MIS 釐清結果（上游產出驗證步驟 2.1）
3. 確認執行準則文件存在（MIS result 中含明確的執行準則）
4. 產出恢復報告（含 14 種狀態碼的詳細資訊，見恢復報告格式）
5. AskUserQuestion 確認後進入 QA

驗證不通過 → 退回 MIS 補齊（重新派工 MIS，保留既有 result）。

#### 恢復場景的 AskUserQuestion 格式

```
AskUserQuestion({
  questions: [{
    question: "偵測到未完成 slug：<slug>。狀態：IN_PROGRESS/MIS_ALL_RESULT。最高完成部門：MIS（起點）。當前卡點：等待整合進入 QA。\n\n上游產出驗證：REPO.md [已更新/未更新]，執行準則 [已落袋/缺失]，mtime [通過/不通過-警告]。",
    header: "載入恢復",
    options: [
      { label: "繼續恢復", description: "確認產出可接受，派工 QA 繼續循環圓" },
      { label: "退回 MIS", description: "上游產出驗證不通過，退回 MIS 補齊" },
      { label: "暫停", description: "先討論再決定" }
    ],
    multiSelect: false
  }]
})
```

## 部門完成閘門流程

每個部門完成後，秘書讀取 PROXY 共識產出，驗證品質門檻，用 AskUserQuestion 回報老闆。

### 步驟

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

### 載入恢復

載入階段偵測到未完成 slug 時使用。

```
AskUserQuestion({
  questions: [{
    question: "偵測到未完成 slug：<slug>。狀態：<第一層>/<第二層狀態碼>。最高完成部門：<部門>。當前卡點：<卡點描述>。",
    header: "載入恢復",
    options: [
      { label: "繼續恢復", description: "從斷點部門重新派工" },
      { label: "歸檔", description: "歸檔到 archive（需 OPS.md 存在）" },
      { label: "清理", description: "刪除 slug 目錄" },
      { label: "暫停", description: "先討論再決定" }
    ],
    multiSelect: false
  }]
})
```

各狀態碼的 question 呈現差異：

| 第二層狀態碼 | 「狀態」欄位 | 「最高完成部門」欄位 | 「當前卡點」欄位 |
|---|---|---|---|
| READY_ARCHIVE | READY_ARCHIVE | 全部完成 | 無 |
| QC_DONE | IN_PROGRESS/QC_DONE | QC | OPS 終點未執行 |
| DEV_DONE | IN_PROGRESS/DEV_DONE | DEV | QC 未執行 |
| PRD_DONE | IN_PROGRESS/PRD_DONE | PRD | DEV 未執行 |
| SEC_DONE | IN_PROGRESS/SEC_DONE | SEC | PRD 未執行 |
| QA_DONE | IN_PROGRESS/QA_DONE | QA | SEC 未執行 |
| ABORTED_MID | IN_PROGRESS/ABORTED_MID | <部門>（共識階段） | 執行階段中斷 |
| MIS_ALL_RESULT | IN_PROGRESS/MIS_ALL_RESULT | MIS（起點） | 等待整合進入 QA |
| MIS_PARTIAL_RESULT | IN_PROGRESS/MIS_PARTIAL_RESULT | MIS（起點） | 部分 PROXY 未完成 |
| MIS_CONSENSUS_NO_RESULT | IN_PROGRESS/MIS_CONSENSUS_NO_RESULT | MIS（起點） | PROXY 未執行 |
| MIS_DEBATING | IN_PROGRESS/MIS_DEBATING | MIS（起點） | 辯論未收斂 |
| MIS_DISPATCHED | IN_PROGRESS/MIS_DISPATCHED | MIS（起點） | PROXY 未啟動 |
| ABORTED_SETUP | IN_PROGRESS/ABORTED_SETUP | <部門>（已派工） | PROXY 未啟動 |
| MIS_NOT_STARTED | IN_PROGRESS/MIS_NOT_STARTED | 無 | MIS 未派工 |

## 判讀老闆回應

| AskUserQuestion 回傳 | 秘書動作 |
|---|---|
| label: 「繼續」 | 同一 turn 內派工下一部門或進入收尾流程 |
| label: 「重做」 | 結束 turn，等老闆下一則訊息說明修正內容 |
| label: 「暫停」 | 結束 turn，等老闆下一則訊息討論 |

> **註**：上表為閘門工具回傳後的結構化分支。老闆在「重做」或「暫停」之後的後續訊息仍需語意判讀——例如追問細節、修改需求、或取消——此時適用一般意圖理解，不構成新的閘門流程。

### 載入恢復的判讀

| AskUserQuestion 回傳 | 秘書動作 |
|---|---|
| label: 「繼續恢復」 | 依狀態碼恢復策略派工，完成後進入載入步驟 8 |
| label: 「歸檔」 | Read LIFECYCLE.md → 歸檔到 archive（僅 READY_ARCHIVE 可選） |
| label: 「清理」 | 刪除 slug 目錄，回報老闆確認 |
| label: 「暫停」 | 結束 turn，等老闆下一則訊息討論 |

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
