---
name: shiftblame
description: "AI Agents 協作開發框架 — 流程協議與定義檔。適用於有多名 AI 員工（claude/codex/gemini）需分工合作的開發專案。Use this skill when: user says '開始', 'start', '開工', 'let's go', '來吧', '動工', 'go', 'begin'; or when a multi-agent development workflow is needed; or when coordinating claude, codex, and gemini agents for software development tasks."
---

# shiftblame — AI Agents 協作開發框架

## 框架定位

`shiftblame` 是一套 AI agents 流程定義框架，以純 Markdown 定義檔構建跨模型的協作流程。三名員工（claude / codex / gemini）透過 `terminal()` 直接呼叫，各自使用獨立模型，在同一個 worktree 上透過固定角色分工機制協作。

## 核心角色

| 員工 | 身份 | 職責 |
|------|------|------|
| claude | 主執行者（固定） | 獨佔 worktree 編輯權與 Git 操作權，執行實際開發 |
| codex | 監督者（固定） | 面向：邏輯正確性 + 測試覆蓋度 |
| gemini | 監督者（固定） | 面向：功能完整性 + 規格一致性 |

## 四等級流程

```
L1: 秘書研究 → 秘書收尾
L2: 秘書研究 → PRD → DEV → QC → 秘書收尾
L3: 秘書研究 → QA → PRD → DEV → QC → 秘書收尾
L4: 秘書研究 → SEC → QA → PRD → DEV → QC → 秘書收尾
```

## 部門分類

| 類型 | 部門 | 機制 |
|:---:|:---:|---|
| 研究部門 | SEC / QA / PRD | 三方各自分析寫 proposal.md，管理者彙整 conclusion.md |
| 開發部門 | DEV | claude 固定為主執行者獨佔 worktree，codex 與 gemini 固定為監督者 |
| 三方驗證 | QC | 三方 CLI 獨立驗證穩健性/邊緣案例/紅藍隊，管理者彙整 conclusion.md |

## 框架定義檔

| 檔案 | 內容 |
|------|------|
| `SECRETARY.md` | 秘書準則 |
| `MANAGER.md` | 管理者定義 |
| `STAFF.md` | 員工呼叫規格 |
| `DEPT/SEC.md` | 資安部門定義 |
| `DEPT/QA.md` | 品保部門定義 |
| `DEPT/PRD.md` | 產品部門定義 |
| `DEPT/DEV.md` | 開發部門定義 |
| `DEPT/QC.md` | 品管部門定義 |

## 使用方式

### 初始化專案

1. 確認專案根目錄存在 `.shiftblame/REPO.md`（框架現況定義）
2. 若不存在，向老闆報告「專案尚未初始化」

### 啟動開發流程

使用者說「開始」/「start」/「開工」等關鍵字時，載入此 skill 並啟動對應模式的流程。

### CLI 員工呼叫方式

```bash
# claude — Claude Code
claude -p "<prompt>" --dangerously-skip-permissions --output-format text

# codex — Codex (需要 pty: true)
codex exec --dangerously-bypass-approvals-and-sandbox "prompt"

# gemini — Gemini CLI
GEMINI_CLI_TRUST_WORKSPACE=true gemini --approval-mode yolo -o text -p "prompt"
```

## 通訊目錄結構

```
.shiftblame/<slug>/
├── meta.md              # 秘書建立，管理者維護
├── worktree/            # 單一共用 worktree
└── <DEPT>/<NNN>/
    ├── task.md              # 001 管理者寫入；002+ 管理者每次重新發布
    ├── conclusion.md        # 管理者寫入
    └── {claude,codex,gemini}/
        ├── proposal.md      # CLI 寫入（001）
        ├── result.md        # 主執行者寫入（002+）
        └── review.md        # 監督者寫入（002+）
```

## 開發部門循環機制

| 循環 | 內容 |
|------|------|
| 001 | 三方 proposal → 管理者寫 conclusion（純規劃） |
| 002 | 主執行者 result + 監督者 review → 管理者 conclusion |
| 003+ | 修正循環：依 review 反饋修正 → result + review → conclusion |

## 閘門機制

- **DEV→QC 閘門**：管理者 E2E 實際驗證 + 老闆覆核
- **QC 退回 DEV**：需再次 E2E + 老闆覆核
- **部門閘門**：監督者 review.md 均通過 → 部門完成

## 主要規則

1. **主執行者獨佔 worktree**：僅 claude 有權在 worktree 編輯
2. **監督者不修改 worktree**：只寫 review.md 檢視驗證
3. **task.md 只含目標和約束**：不寫分工、做法、產出格式
4. **限額偵測**：HTTP 429/503/529 時在 result.md 記錄詳情
5. **單一共用 worktree**：所有部門共用同一 slug 層級 worktree
