---
name: blame-update
description: >-
  升級 ~/.shiftblame/ 組織架構。讀懂每條舊鍋紀錄的內容，按現行責任歸屬重新分配到正確的部門。
  Use this skill when: shiftblame 更新後組織架構變更, or when the user says "升級", "update", "/blame-update".
  秘書在偵測到目錄結構與 agents 不一致時會自動調用。
---

# blame-update — 責任重分配

組織架構變更後，讀懂每條舊鍋紀錄的**實際內容**，按**現行責任歸屬**重新分配到正確的部門。不是搬檔案，是重新判鍋。

## 核心原則

- **讀內容判責任**：不看舊路徑名稱，看鍋紀錄裡「犯了什麼錯」的實際內容
- **不丟失任何鍋**：每條紀錄都必須歸到某個現行部門
- **無法判斷的鍋**：放入待審區，由秘書呈報老闆手動分配
- **冪等執行**：已分配過的不重複分配

## 步驟

### 1. 掃描現行組織架構

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
```

動態掃描 `.claude/agents/L*.md`，讀每個 agent 的 frontmatter（name、description），建立**現行部門職責清單**：

```
L1/ADM/LEAD → 文件聚合、STM 管理
L1/MIS/LEAD → 工具安裝、環境準備
L1/OPS/LEAD → 維運調度
L1/OPS/cloud → 部署上線
L1/OPS/infra → 容器化、CI/CD pipeline、環境配置
L1/AUTO/LEAD → 自動化調度
L1/AUTO/ci → CI pipeline、分支合併
L1/AUTO/cd → CD pipeline、rollback
L2/PM/LEAD → 規格、驗收條件
L2/DEV/LEAD → 開發調度
L2/DEV/fe → 前端 UI
L2/DEV/be → 後端 API、商業邏輯
L2/DEV/db → DB schema、migration、query
L2/QA/LEAD → 測試調度
L2/QA/unit → 單元測試
L2/QA/integ → 整合測試
L2/QA/e2e → E2E 測試設計
L3/PRD/LEAD → 需求定義、PRD
L3/ARC/LEAD → 架構設計、技術選型
L3/MKT/LEAD → 市場調研、工具比較
L3/QC/LEAD → 品管調度
L3/QC/edge → 邊緣測試
L3/QC/fuzz → 模糊測試
L3/QC/user → 用戶可用性測試
L3/SEC/LEAD → 資安調度
L3/SEC/audit → 鏈路稽核、重跑測試
L3/SEC/consistency → 一致性檢查
L3/SEC/red → 滲透測試
L3/SEC/blue → 防禦掃描
```

### 2. 建立所有最新目錄

```bash
for f in "$REPO_ROOT"/.claude/agents/L*.md; do
  NAME=$(basename "$f" .md)
  LEVEL=$(echo "$NAME" | cut -d_ -f1)
  DEPT=$(echo "$NAME" | cut -d_ -f2)
  ROLE=$(echo "$NAME" | cut -d_ -f3)
  mkdir -p ~/.shiftblame/blame/"$LEVEL"/"$DEPT"/"$ROLE"
done
mkdir -p ~/.shiftblame/blame/secretary
mkdir -p ~/.shiftblame/blame/boss
mkdir -p ~/.shiftblame/blame/_pending  # 待審區

# repo 文件目錄
for f in "$REPO_ROOT"/.claude/agents/L*_LEAD.md; do
  NAME=$(basename "$f" .md)
  LEVEL=$(echo "$NAME" | cut -d_ -f1)
  DEPT=$(echo "$NAME" | cut -d_ -f2)
  mkdir -p ~/.shiftblame/"$REPO_NAME"/"$LEVEL"/"$DEPT"
done
mkdir -p ~/.shiftblame/"$REPO_NAME"/report
```

### 3. 找出所有孤兒鍋紀錄

掃描 `~/.shiftblame/blame/` 中**不屬於現行架構**的 BLAME.md：

```bash
find ~/.shiftblame/blame/ -name 'BLAME.md' -size +0c | while read f; do
  # 判斷此路徑是否屬於現行架構
  # 不屬於 → 標記為孤兒，需要重分配
done
```

孤兒來源：
- 舊角色名目錄（`blame/product-planner/`）
- 已廢棄的層級（`blame/L4/`）
- 已合併或拆分的角色

### 4. 逐條讀懂、判斷歸屬

對每個孤兒 BLAME.md，**讀取每個 `##` 條目**：

```markdown
## some-feature · 2026-04-10
**犯了什麼錯**：DB migration 少了 rollback script
**怎麼被抓的**：audit 重跑測試時發現
**本質原因**：...
```

根據「犯了什麼錯」和「本質原因」的**內容**判斷現行責任歸屬：

#### 責任判定規則

| 鍋的內容涉及 | 歸屬部門 |
|-------------|---------|
| PRD / 需求定義 / 老闆原話遺漏 | L3/PRD/LEAD |
| 架構設計 / 技術選型 / 模組拆分 | L3/ARC/LEAD |
| 市場調研 / 工具比較 | L3/MKT/LEAD |
| 規格 / 驗收條件 / 任務依賴 | L2/PM/LEAD |
| 前端 UI / 頁面 / 樣式 | L2/DEV/fe |
| 後端 API / 商業邏輯 / 序列化 | L2/DEV/be |
| DB schema / migration / query / ORM | L2/DEV/db |
| 開發任務拆分 / 工程師協調 | L2/DEV/LEAD |
| 單元測試 | L2/QA/unit |
| 整合測試 | L2/QA/integ |
| E2E 測試設計 | L2/QA/e2e |
| 測試任務拆分 / 涵蓋度 | L2/QA/LEAD |
| E2E 執行 / 品管驗收 | L3/QC/LEAD |
| 邊緣案例 / 邊界條件 | L3/QC/edge |
| 模糊測試 / 隨機輸入 | L3/QC/fuzz |
| 用戶可用性 / 新手體驗 | L3/QC/user |
| 鏈路稽核 / 重跑測試 / 涵蓋度驗收 | L3/SEC/audit |
| 跨檔案一致性 / 路徑 / 命名 | L3/SEC/consistency |
| 滲透測試 / 攻擊 / 漏洞利用 | L3/SEC/red |
| 依賴審計 / 敏感檔案 / OWASP 防禦 | L3/SEC/blue |
| 資安調度 / 紅藍對照研判 | L3/SEC/LEAD |
| 環境準備 / 工具安裝 | L1/MIS/LEAD |
| 部署上線 / smoke test | L1/OPS/cloud |
| 容器化 / 環境配置 | L1/OPS/infra |
| 維運調度 | L1/OPS/LEAD |
| CI pipeline / 分支合併 | L1/AUTO/ci |
| CD pipeline / rollback | L1/AUTO/cd |
| 自動化調度 | L1/AUTO/LEAD |
| 文件聚合 / REPO.md | L1/ADM/LEAD |
| 無法判斷 | `_pending/` 待審區 |

### 5. 執行重分配

對每條鍋紀錄：

```
讀取條目內容
  → 判斷責任歸屬（按上表）
  → 目標 BLAME.md 已存在？
      是 → 將條目插入目標檔案（新條目在前）
      否 → 建立新檔案，寫入條目
  → 在條目末尾加註遷移紀錄：
      `> 📦 由 <舊路徑> 遷移，原因：<判斷依據>`
```

**一條鍋可能涉及多個部門**：選擇「犯了什麼錯」最直接對應的部門。若真的橫跨兩個部門，複製到兩邊並加註。

### 6. 遷移 repo 文件

舊版 `docs/` 下的文件搬到對應的 `Ln/DEPT/` 目錄：

| 舊路徑 | 新路徑 |
|--------|--------|
| `docs/prd/` | `L3/PRD/` |
| `docs/dag/` | `L3/ARC/` |
| `docs/spec/` | `L2/PM/` |
| `docs/basis/` | `L2/QA/` |
| `docs/devlog/` | `L2/DEV/` |
| `docs/e2e/` | `L3/QC/` |
| `docs/audit/` | `L3/SEC/` |
| `docs/ops/` | `L1/OPS/` |
| `docs/env/` | `L1/MIS/` |
| `docs/auto/` | `L1/AUTO/` |

文件內容不需要判斷，按目錄對應直接搬。同名檔案新的優先，舊的跳過。

### 7. 清理

```bash
# 清理已清空的舊目錄
find ~/.shiftblame/blame/ -type d -empty -delete 2>/dev/null
find ~/.shiftblame/"$REPO_NAME"/ -type d -empty -delete 2>/dev/null
```

**不刪除 `_pending/` 待審區**——即使為空也保留，作為標記。

### 8. 回報結果

```
✅ blame-update 完成

責任重分配：
  讀取孤兒鍋紀錄：N 條
  成功分配：M 條
  待審（無法自動判斷）：P 條 → ~/.shiftblame/blame/_pending/BLAME.md

遷移明細：
  [舊] blame/feature-developer/infra-engineer → [新] L2/DEV/db（3 條）+ L1/OPS/infra（2 條）
  [舊] blame/audit-reviewer → [新] L3/SEC/audit（5 條）
  ...

文件搬移：Q 個 <slug>.md
清理空目錄：R 個

驗證：
  agents 數量：29
  blame 目錄完整：✓

[若有待審]
⚠️ 以下鍋紀錄無法自動判斷歸屬，請老闆手動分配：
  ~/.shiftblame/blame/_pending/BLAME.md
  - "xxx · 2026-04-08"：<摘要>
```
