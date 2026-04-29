# 派工前 Checklist

每次派工前逐條完成，不可跳過。

## 1. 讀取專案資訊

```
Read ~/.shiftblame/<repo>/REPO.md
```

提取並填入派工 prompt：
- 技術棧（語言、框架、測試工具）
- 測試指令（unit / integration 路徑與指令）
- 建置指令（build / compile）
- 部署方式（Docker / k8s / 其他）
- 已知約束（安全守則、狀態機、API 端點）

**不讀 REPO.md 就派工 = 違規。** 派工 prompt 必須反映 REPO.md 的實際情況，不可用通用模板。

## 2. Slug 名稱驗證（SEC-A-01）

```bash
[[ -z "$slug" ]] && fail    # 空字串
[[ "$slug" == *--* ]] && fail  # 雙連字號
[[ "$slug" =~ ^[a-z][a-z0-9-]{0,62}[a-z0-9]$ ]] || [[ "$slug" =~ ^[a-z0-9]$ ]] || fail
```

驗證失敗 → 不建任何目錄，回報老闆。

## 3. 填寫派工單

```
=== 派工單 ===
SLUG:          (必填)
DEPT:          (必填)
WORKTREE_PATH: /home/derek/.worktree/<repo>/<slug>/   (必填)
BRANCH:        feat/<slug>                              (必填)
UPSTREAM:      /home/derek/.shiftblame/<repo>/<slug>/<上游部門>.md
OUTPUT:        /home/derek/.shiftblame/<repo>/<slug>/<DEPT>.md
DISCUSSION:    /home/derek/.shiftblame/<repo>/<slug>/<DEPT>/
REPO_TECH:     (從 REPO.md 提取的技術棧)
TEST_CMD:      (從 REPO.md 提取的測試指令)
BUILD_CMD:     (從 REPO.md 提取的建置指令)
```

## 4. 派工 prompt 必含

- **git commit 單命令警告**（prompt 開頭）：commit 必須用 `cd <worktree> && git add <files> && git commit -m "..."` 單一 Bash 命令，禁止拆開（Bash 每次 reset cwd）
- **絕對路徑**：所有路徑用 `/home/derek/...`，不用 `~` 或相對路徑
- **pwd 確認**：要求 agent 動手前執行 `pwd && git branch --show-current`
- **部門常識**：`Read ~/.shiftblame/common/<DEPT>.md` 的內容注入 prompt
- **上游裁決**：如有老闆裁決結論，注入 prompt

## 5. 部門特殊檢查

| 部門 | 派工前必做 |
|---|---|
| QA | user journey 預審：主業務 view 是什麼？user 從哪個 view 點哪個按鈕觸發？寫不出 = 不派工 |
| QC | 檢查 QC agent type 工具清單是否含任務所需工具（Web SPA 需要 chrome-devtools-mcp）。不足 = 不硬派 |
| 所有部門 | 確認 `.gitignore` 含 `.worktree/`，worktree 已建立 |

## 6. QC 定位提醒

派工 QC 時 prompt 必須明確：QC 是破壞者（主動挖掘 BUG、邊緣案例、業務邏輯斷裂），不是規格驗收員。QC 必須親自啟動應用操作，對照 QA 品保條件做穩健性攻擊。不重複跑 DEV 已通過的自動化測試。

## 7. 殭屍掃描注意

殭屍判準（無載入路徑）對「測試檔」失效（測試檔是 pytest 入口）。重構砍掉 N 個 endpoint 必對應 grep `tests/**/test_<module>*.py` 整批處置。任何補列「殘留 N 個」前必跑同性質 pattern 全掃。
