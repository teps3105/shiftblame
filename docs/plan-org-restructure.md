# 組織架構變更計畫

## 背景

現行推鍋鏈所有 agent 混在一起，沒有明確區分工作位置。
需要新增資安工程師與 MIS 工程師角色，並重新劃分職能邊界。

---

## 變更一覽

### 1. Agent 分為兩類

| 類別 | 工作位置 | 可否改 code | 成員 |
|------|---------|------------|------|
| 開發類 | worktree 分支 | 可以 | 7 個角色（含子 agent） |
| 雜務類 | main / `~/.shiftblame/` | 不可以 | 4 個角色 |

### 2. 開發類 Agents（worktree 分支）

| # | Agent | 產出 |
|---|-------|------|
| 1 | product-planner | prd |
| 2 | system-architect | dag |
| 3 | project-manager | spec |
| 4 | quality-assurance（+3 測試工程師） | basis |
| 5 | feature-developer（+2 職能工程師） | devlog |
| 6 | quality-control | e2e |
| 7 | audit-reviewer | audit |

feature-developer 子 agent：frontend-engineer、backend-engineer（共 2 位）。

### 3. 雜務類 Agents（主分支 / 主 repo）

| Agent | 職責 | 觸發時機 |
|-------|------|---------|
| mis-engineer（MIS） | 工具安裝、環境準備、依賴管理 | dag 之後、spec 之前 |
| security-engineer（資安） | 依賴審計、漏洞掃描、敏感檔案檢查 | merge 後、deploy 前 |
| operations-engineer（維運） | 部署上線 + 基礎建設 | 資安 SECURE 後 / MIS 轉介時 |
| administrative-clerk（文書） | 文件聚合 STM → REPO.md | 秘書呈報後 |

---

## 變更二：移除 infra-engineer

### 原 infra 職能重新分配

| 原 infra 職能 | 歸屬 | 理由 |
|--------------|------|------|
| DB schema 設計 / migration | backend-engineer | 開發工作，與業務邏輯綁定 |
| Docker / 容器化設定 | operations-engineer | 基礎建設歸維運 |
| CI/CD pipeline | operations-engineer | 部署流程歸維運 |
| 環境變數 / config 管理 | operations-engineer | 環境管理歸維運 |
| 開發用隔離環境 | mis-engineer → operations-engineer | 走申請鏈 |

---

## 變更三：新增 MIS 工程師

### 定位

推鍋鏈啟動後、正式開發前的環境就緒保證人。

### 職責

1. 讀 dag — 從架構師的技術選型解析需要哪些工具
2. 盤點現有環境 — `which` / `--version` 逐一確認
3. 產出缺漏清單 — 哪些要裝、哪些要升版
4. 向秘書報告 — 秘書翻譯成白話問老闆核准
5. 核准後安裝 — 逐一安裝、驗證、紀錄
6. 產出 env 報告 → `~/.shiftblame/<repo>/docs/env/<slug>.md`
7. 回傳 READY / BLOCKED

### 隔離環境申請鏈

```
feature-developer 需要隔離環境
  → 向 MIS 申請（透過秘書轉介）
  → MIS 評估需求 → 向 Ops 申請建置
  → Ops 建置 → 回報 MIS
  → MIS 配置給開發 → 回報秘書
```

---

## 變更四：新增資安工程師

### 定位

merge 到 main 之後、維運部署之前的安全閘門。

### 職責

1. 依賴審計 — 掃描 `package.json` / `requirements.txt` / lock files
2. 工具清單盤點 — 推鍋鏈新增的依賴變更差異
3. 敏感檔案檢查 — `.env`、credentials、API key 是否意外 commit
4. 安全規則驗證 — OWASP top 10 基本項
5. 產出 sec 報告 → `~/.shiftblame/<repo>/docs/sec/<slug>.md`
6. 回傳 SECURE / ALERT

---

## 變更五：operations-engineer 擴充

原本只管「部署上線」，新增基礎建設職能：

- 容器化 / Docker 設定
- CI/CD pipeline 維護
- 環境變數 / config 管理
- 接 MIS 轉介的環境建置需求

觸發方式變為兩種：
1. 推鍋鏈末端 — 資安 SECURE 後部署（原流程）
2. MIS 轉介 — dag 階段 MIS 發現需要基礎建設時

---

## 更新後完整流程

```
老闆需求 → 秘書
  │
  ▼
 1. product-planner  → prd
 2. system-architect → dag
  │
  ▼
 MIS preflight（讀 dag）
  ├── 工具缺漏 → 核准 → 安裝
  └── 需要基礎建設 → 轉介 Ops → 回報 READY
  │
  ▼
 3. project-manager   → spec
 4. quality-assurance  → basis   （+3 測試工程師）
 5. feature-developer  → devlog  （+2 職能工程師）
 6. quality-control    → e2e
 7. audit-reviewer     → audit
  │
  ▼
 秘書 merge → main
  │
  ▼
 8. security-engineer  → sec
 9. operations-engineer → ops
  │
  ▼
 秘書最終對照 → 呈報老闆
  │
  ▼
10. administrative-clerk → REPO.md
```

---

## 需修改的檔案清單

| 動作 | 檔案 |
|------|------|
| 刪除 | `.claude/agents/infra-engineer.md` |
| 新增 | `.claude/agents/mis-engineer.md` |
| 新增 | `.claude/agents/security-engineer.md` |
| 修改 | `.claude/agents/operations-engineer.md` — 擴充基礎建設職能 |
| 修改 | `.claude/agents/backend-engineer.md` — 承接 DB schema/migration |
| 修改 | `.claude/agents/feature-developer.md` — 子 agent 3→2 |
| 修改 | `.claude/agents/administrative-clerk.md` — 新增 `docs/env/`、`docs/sec/` |
| 修改 | `.claude/skills/secretary/SKILL.md` — 插入 MIS preflight + 資安掃描 |
| 修改 | `README.md` — 組織架構分類 + 新角色 |
