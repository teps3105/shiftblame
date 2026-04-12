# 組織架構變更計畫

## 背景

現行推鍋鏈所有 agent 混在一起，沒有明確區分層級與工作位置。
需要依職能分為 L1–L4 四個層級，明確劃分責任邊界與模型配置。

---

## 核心原則

- **秘書不幹活**：所有工作至少交給 L1 以上的 agent 執行
- **L4 用 opus**：企劃、架構、規格、資安稽核需要高階推理
- **L3 以下用 sonnet**：執行層不需要最強模型，控制成本

---

## 四級架構

| 級別 | 定位 | 模型 | 成員 |
|------|------|------|------|
| **L1** | 日常支援 — 溝通調度、除錯、整理報告 | sonnet | MIS、行政文書 |
| **L2** | 日常維運 — 處理 L3 提出的基建與環境需求 | sonnet | 雲端工程師、基建工程師 |
| **L3** | 開發執行 — 品管、開發、品保 | sonnet | 品管、開發經理（+前端、後端）、品保（+3 測試工程師） |
| **L4** | 規劃決策 — 企劃、架構、規格、資安稽核 | **opus** | 企劃師、架構師、專案經理、資安稽核 |

---

## L1 — 日常支援

| Agent | 職責 |
|-------|------|
| **mis-engineer（MIS）** | 工具安裝、環境準備、依賴管理、溝通調度開發需求 |
| **administrative-clerk（行政文書）** | 文件聚合 STM → REPO.md、整理報告 |

秘書接到任何需要動手的事，一律派給 L1 以上。MIS 是開發團隊的窗口，負責環境就緒與日常除錯支援。

### 隔離環境申請鏈

```
開發（L3）需要隔離環境
  → 向 MIS（L1）申請
  → MIS 評估 → 向 L2 申請建置
  → L2 建置 → 回報 MIS
  → MIS 配置給開發 → 回報秘書
```

---

## L2 — 日常維運

| Agent | 職責 |
|-------|------|
| **cloud-engineer（雲端工程師）** | 部署上線、smoke test、版本驗證、雲端服務管理 |
| **infra-engineer（基建工程師）** | 容器化/Docker、CI/CD pipeline、環境變數/config、基礎建設 |

L2 不主動發起工作，而是**回應 L3 的需求**（透過 MIS 轉介）或在推鍋鏈末端執行部署。

### 觸發方式

1. **推鍋鏈末端** — 資安稽核 SECURE 後，雲端工程師執行部署
2. **MIS 轉介** — dag 階段 MIS 發現需要基礎建設時，轉介基建工程師

---

## L3 — 開發執行

| Agent | 子 Agent | 產出 |
|-------|---------|------|
| **quality-control（品管）** | — | e2e |
| **feature-developer（開發經理）** | frontend-engineer、backend-engineer | devlog |
| **quality-assurance（品保）** | unit-test-engineer、integration-test-engineer、e2e-test-engineer | basis |

L3 全部在 **worktree 分支** 上工作。

---

## L4 — 規劃決策

| Agent | 產出 |
|-------|------|
| **product-planner（企劃師）** | prd |
| **system-architect（架構師）** | dag |
| **project-manager（專案經理）** | spec |
| **security-auditor（資安稽核）** | sec + audit（合併原 audit-reviewer 與 security-engineer） |

L4 使用 **opus** 模型。資安稽核同時負責：
- 整條鏈路最終驗收（原 audit-reviewer 職能）
- 依賴審計、漏洞掃描、敏感檔案檢查（原 security-engineer 職能）

---

## 更新後完整流程

```
老闆需求 → 秘書（路由器，不幹活）
  │
  ▼
L4  1. product-planner   → prd
L4  2. system-architect   → dag
  │
  ▼
L1  MIS preflight（讀 dag）
     ├── 工具缺漏 → 核准 → 安裝
     └── 需要基建 → 轉介 L2 infra-engineer → 回報 READY
  │
  ▼
L4  3. project-manager    → spec
L3  4. quality-assurance   → basis   （+3 測試工程師）
L3  5. feature-developer   → devlog  （+前端、後端）
L3  6. quality-control     → e2e
  │
  ▼
秘書 merge → main
  │
  ▼
L4  7. security-auditor    → sec + audit
L2  8. cloud-engineer      → ops
  │
  ▼
秘書最終對照 → 呈報老闆
  │
  ▼
L1  9. administrative-clerk → REPO.md
```

---

## 原 infra-engineer（開發類）職能重分配

| 原職能 | 歸屬 | 理由 |
|--------|------|------|
| DB schema / migration | L3 backend-engineer | 開發工作，與業務邏輯綁定 |
| Docker / 容器化 | L2 infra-engineer | 基礎建設歸維運 |
| CI/CD pipeline | L2 infra-engineer | 部署流程歸維運 |
| 環境變數 / config | L2 infra-engineer | 環境管理歸維運 |
| 開發用隔離環境 | L1 MIS → L2 infra-engineer | 走申請鏈 |

---

## 原 audit-reviewer + security-engineer 合併

| 原角色 | 原職能 | 合併後歸屬 |
|--------|--------|-----------|
| audit-reviewer | 整條鏈路驗收、重跑測試、一致性檢查 | L4 security-auditor |
| security-engineer | 依賴審計、漏洞掃描、敏感檔案檢查 | L4 security-auditor |

合併理由：資安與稽核高度重疊，都需要高階推理能力，都在 merge 後執行。

---

## 檔案命名規則

所有 agent 檔案以 `L{n}_` 前綴命名，平鋪在 `.claude/agents/` 下：

```
.claude/agents/
├── L1_mis-engineer.md            ← 待新增
├── L1_administrative-clerk.md
├── L2_cloud-engineer.md          ← 待新增
├── L2_infra-engineer.md          ← 待新增
├── L3_quality-control.md
├── L3_feature-developer.md
├── L3_frontend-engineer.md
├── L3_backend-engineer.md
├── L3_quality-assurance.md
├── L3_unit-test-engineer.md
├── L3_integration-test-engineer.md
├── L3_e2e-test-engineer.md
├── L4_product-planner.md
├── L4_system-architect.md
├── L4_project-manager.md
└── L4_security-auditor.md        ← 由 audit-reviewer 改名
```

---

## 待辦（本機開發）

| 動作 | 檔案 |
|------|------|
| 新增 | `L1_mis-engineer.md` |
| 新增 | `L2_cloud-engineer.md` |
| 新增 | `L2_infra-engineer.md` |
| 改寫 | `L4_security-auditor.md` — 合併 audit + security 職能 |
| 修改 | `L3_feature-developer.md` — 子 agent 移除 infra，只剩前端+後端 |
| 修改 | `L3_backend-engineer.md` — 承接 DB schema/migration |
| 修改 | `L1_administrative-clerk.md` — 掃描目錄新增 `docs/env/`、`docs/sec/` |
| 修改 | `secretary/SKILL.md` — 插入 MIS preflight + L 級別路由邏輯 |
| 修改 | `README.md` — 四級架構說明 |
