---
name: blame-update
description: >-
  升級 ~/.shiftblame/ 目錄結構至最新版。偵測舊版鍋紀錄並遷移到新路徑，補齊缺少的目錄。
  Use this skill when: shiftblame 更新後需要升級目錄結構, or when the user says "升級", "update", "/blame-update".
  秘書在偵測到目錄結構與 agents 不一致時會自動調用。
---

# blame-update — 目錄結構升級

偵測 `~/.shiftblame/` 中的舊版目錄結構，將既有鍋紀錄遷移到新路徑，補齊缺少的目錄。**不丟失任何既有的 BLAME.md 內容。**

## 核心原則

- **不刪除任何檔案**：只搬移、不刪除
- **內容完整保留**：搬移時保留 BLAME.md 全部內容
- **同名合併**：若新舊路徑都有 BLAME.md，將舊內容附加到新檔案末尾
- **冪等執行**：跑多次結果相同，已搬移的不會重複搬

## 步驟

### 1. 掃描當前 agents 建立最新結構

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
```

動態掃描 `.claude/agents/L*.md` 取得最新的組織架構：

```bash
# 從 agent 檔名解析出 Ln/DEPT/role
for f in "$REPO_ROOT"/.claude/agents/L*.md; do
  basename "$f" .md  # e.g. L1_ADM_LEAD, L2_DEV_fe, L3_SEC_audit
done
```

解析規則：`L{n}_{DEPT}_{role}` → blame 路徑 `L{n}/{DEPT}/{role}/`

### 2. 建立所有最新目錄

根據掃描結果，mkdir -p 所有最新的 blame 和 repo 文件目錄。（同 blame-init 的邏輯，但基於動態掃描而非硬編碼。）

```bash
# blame 目錄
for f in "$REPO_ROOT"/.claude/agents/L*.md; do
  NAME=$(basename "$f" .md)
  LEVEL=$(echo "$NAME" | cut -d_ -f1)
  DEPT=$(echo "$NAME" | cut -d_ -f2)
  ROLE=$(echo "$NAME" | cut -d_ -f3)
  mkdir -p ~/.shiftblame/blame/"$LEVEL"/"$DEPT"/"$ROLE"
done
mkdir -p ~/.shiftblame/blame/secretary
mkdir -p ~/.shiftblame/blame/boss

# repo 文件目錄（從 LEAD agent 提取部門清單）
for f in "$REPO_ROOT"/.claude/agents/L*_LEAD.md; do
  NAME=$(basename "$f" .md)
  LEVEL=$(echo "$NAME" | cut -d_ -f1)
  DEPT=$(echo "$NAME" | cut -d_ -f2)
  mkdir -p ~/.shiftblame/"$REPO_NAME"/"$LEVEL"/"$DEPT"
done
mkdir -p ~/.shiftblame/"$REPO_NAME"/report
```

### 3. 偵測並遷移舊版鍋紀錄

掃描 `~/.shiftblame/blame/` 中不符合 `L{n}/` 結構的目錄，嘗試映射到新路徑。

#### 舊版映射表

| 舊路徑 | 新路徑 |
|--------|--------|
| `blame/product-planner/` | `blame/L3/PRD/LEAD/` |
| `blame/system-architect/` | `blame/L3/ARC/LEAD/` |
| `blame/project-manager/` | `blame/L2/PM/LEAD/` |
| `blame/quality-assurance/` | `blame/L2/QA/LEAD/` |
| `blame/quality-assurance/unit-test-engineer/` | `blame/L2/QA/unit/` |
| `blame/quality-assurance/integration-test-engineer/` | `blame/L2/QA/integ/` |
| `blame/quality-assurance/e2e-test-engineer/` | `blame/L2/QA/e2e/` |
| `blame/feature-developer/` | `blame/L2/DEV/LEAD/` |
| `blame/feature-developer/frontend-engineer/` | `blame/L2/DEV/fe/` |
| `blame/feature-developer/backend-engineer/` | `blame/L2/DEV/be/` |
| `blame/feature-developer/infra-engineer/` | `blame/L2/DEV/db/` (最接近的映射) |
| `blame/quality-control/` | `blame/L3/QC/LEAD/` |
| `blame/quality-control/edge-test-engineer/` | `blame/L3/QC/edge/` |
| `blame/quality-control/fuzz-test-engineer/` | `blame/L3/QC/fuzz/` |
| `blame/audit-reviewer/` | `blame/L3/SEC/audit/` |
| `blame/security-auditor/` | `blame/L3/SEC/LEAD/` |
| `blame/security-auditor/red-team/` | `blame/L3/SEC/red/` |
| `blame/security-auditor/blue-team/` | `blame/L3/SEC/blue/` |
| `blame/operations-engineer/` | `blame/L1/OPS/LEAD/` |
| `blame/cloud-engineer/` | `blame/L1/OPS/cloud/` |
| `blame/infra-engineer/` | `blame/L1/OPS/infra/` |
| `blame/mis-engineer/` | `blame/L1/MIS/LEAD/` |
| `blame/administrative-clerk/` | `blame/L1/ADM/LEAD/` |
| `blame/auto-lead/` | `blame/L1/AUTO/LEAD/` |
| `blame/auto-lead/ci-engineer/` | `blame/L1/AUTO/ci/` |
| `blame/auto-lead/cd-engineer/` | `blame/L1/AUTO/cd/` |
| `blame/ops-lead/` | `blame/L1/OPS/LEAD/` |
| `blame/ops-lead/cloud-engineer/` | `blame/L1/OPS/cloud/` |
| `blame/ops-lead/infra-engineer/` | `blame/L1/OPS/infra/` |

#### L4 → L3 映射（扁平化前的版本）

| 舊路徑 | 新路徑 |
|--------|--------|
| `blame/L4/PRD/LEAD/` | `blame/L3/PRD/LEAD/` |
| `blame/L4/ARC/LEAD/` | `blame/L3/ARC/LEAD/` |
| `blame/L4/QC/*/` | `blame/L3/QC/*/` |
| `blame/L4/SEC/*/` | `blame/L3/SEC/*/` |
| `blame/L4/PM/LEAD/` | `blame/L2/PM/LEAD/` |

#### 遷移邏輯

對每個舊路徑中的 BLAME.md：

```
if 舊 BLAME.md 存在 && 非空:
  if 新 BLAME.md 已存在 && 非空:
    # 合併：舊內容附加到新檔案末尾
    cat 舊/BLAME.md >> 新/BLAME.md
  else:
    # 搬移
    mv 舊/BLAME.md 新/BLAME.md
  fi
fi
```

### 4. 遷移舊版 repo 文件

掃描 `~/.shiftblame/<repo>/` 中的舊版目錄結構。

| 舊路徑 | 新路徑 |
|--------|--------|
| `<repo>/docs/prd/` | `<repo>/L3/PRD/` |
| `<repo>/docs/dag/` | `<repo>/L3/ARC/` |
| `<repo>/docs/spec/` | `<repo>/L2/PM/` |
| `<repo>/docs/basis/` | `<repo>/L2/QA/` |
| `<repo>/docs/devlog/` | `<repo>/L2/DEV/` |
| `<repo>/docs/e2e/` | `<repo>/L3/QC/` |
| `<repo>/docs/audit/` | `<repo>/L3/SEC/` |
| `<repo>/docs/ops/` | `<repo>/L1/OPS/` |
| `<repo>/docs/env/` | `<repo>/L1/MIS/` |
| `<repo>/docs/infra/` | `<repo>/L1/OPS/` |
| `<repo>/docs/auto/` | `<repo>/L1/AUTO/` |
| `<repo>/L4/PRD/` | `<repo>/L3/PRD/` |
| `<repo>/L4/ARC/` | `<repo>/L3/ARC/` |
| `<repo>/L4/QC/` | `<repo>/L3/QC/` |
| `<repo>/L4/SEC/` | `<repo>/L3/SEC/` |

對每個舊目錄中的 `<slug>.md`：
- 新目錄中沒有同名檔案 → mv
- 新目錄中已有同名檔案 → 跳過（新的優先）
- 搬完後若舊目錄為空 → rmdir

### 5. 清理空的舊目錄

```bash
# 清理空目錄（由深到淺）
find ~/.shiftblame/blame/ -type d -empty -delete 2>/dev/null
find ~/.shiftblame/"$REPO_NAME"/docs/ -type d -empty -delete 2>/dev/null
rmdir ~/.shiftblame/"$REPO_NAME"/docs 2>/dev/null
# 清理 L4（若扁平化後已空）
find ~/.shiftblame/blame/L4/ -type d -empty -delete 2>/dev/null
rmdir ~/.shiftblame/blame/L4 2>/dev/null
find ~/.shiftblame/"$REPO_NAME"/L4/ -type d -empty -delete 2>/dev/null
rmdir ~/.shiftblame/"$REPO_NAME"/L4 2>/dev/null
```

### 6. 驗證

掃描 agents 目錄，確認每個 agent 對應的 blame 目錄都存在：

```bash
MISSING=0
for f in "$REPO_ROOT"/.claude/agents/L*.md; do
  NAME=$(basename "$f" .md)
  LEVEL=$(echo "$NAME" | cut -d_ -f1)
  DEPT=$(echo "$NAME" | cut -d_ -f2)
  ROLE=$(echo "$NAME" | cut -d_ -f3)
  [ -d ~/.shiftblame/blame/"$LEVEL"/"$DEPT"/"$ROLE" ] || MISSING=$((MISSING+1))
done
```

### 7. 回報結果

```
✅ blame-update 完成

遷移摘要：
  鍋紀錄搬移：N 個 BLAME.md
  鍋紀錄合併：M 個（舊內容附加到新檔案）
  文件搬移：P 個 <slug>.md
  清理空目錄：Q 個
  跳過（已存在）：R 個

驗證：
  agents 數量：29
  blame 目錄完整：✓ / ✗（缺 X 個）

[若有無法映射的舊目錄]
⚠️ 以下舊目錄無法自動映射，請手動處理：
  - ~/.shiftblame/blame/<unknown>/
```
