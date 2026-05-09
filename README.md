<div align="center">

# shiftblame

### 推鍋

_「這不是我的鍋。」_

**AI Agents 協作開發框架 — 流程協議與定義檔**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![AI Agent Skill](https://img.shields.io/badge/AI%20Agent-skill-8a2be2.svg)]()

</div>

---

## 簡介

`shiftblame` 是一套 AI agents 流程定義框架，以純 Markdown 定義檔構建跨模型協作流程。管理者與執行者同樣由目前所在 CLI 擔任，另外兩個 CLI 預設擔任紅隊/藍隊；外部 CLI 限額或 429 時依降級策略補位。

---

## 角色

| 員工 | 身份 | 產出 |
|------|------|------|
| 管理者 | 目前 CLI（claude/codex/gemini） | 協調、派工、管線、閘門、收尾 |
| 執行者 | 目前 CLI（claude/codex/gemini） | result.md |
| 紅隊 | 非目前 CLI 之一 | red.md |
| 藍隊 | 非目前 CLI 之一 | blue.md |

| 目前環境 | 執行者 | 紅隊 | 藍隊 |
|----------|--------|------|------|
| Claude CLI | claude | codex | gemini |
| Codex CLI | codex | claude | gemini |
| Gemini CLI | gemini | claude | codex |

外部 CLI 若遇到 `429`、rate limit、quota exceeded、billing limit、暫時不可用或重派後仍無輸出，先由另一個外部 CLI 補上缺少的紅/藍產出；若只剩目前 CLI 可用，管理者改開兩個本環境子代理分別產出 `red.md`、`blue.md`。

```
L1: 執行 → 收尾
L2: 執行 → PRD → QA → DEV → QC → 產品現況確認 → 收尾
```

## 工作區模式

建立任務時選擇工作區模式：

| 模式 | 說明 |
|------|------|
| `worktree` | 建立獨立 git worktree，產物寫入 `<slug>/worktree/`（預設） |
| `direct` | 直接在主 repo 切分支開發，不額外建工作樹 |

兩種模式皆會建立功能分支，差異僅在是否有獨立工作目錄。

## 部門

| # | 部門 | 類型 |
|:-:|:----:|:----:|
| 0 | PRD | 產品 |
| 1 | QA | 品保 |
| 2 | DEV | 開發 |
| 3 | QC | 品管 |

詳見 `DEPT/*.md`。

## 閘門

| 閘門 | 條件 |
|:----:|------|
| PRD→QA | 執行者/紅隊/藍隊 result/red/blue → `AskUserQuestion` 老闆確認，QA 退回 → 上游新 NNN |
| QA→DEV | 執行者/紅隊/藍隊 result/red/blue → `AskUserQuestion` 老闆確認，DEV 退回 → 上游新 NNN |
| DEV→QC | 執行者/紅隊/藍隊 result/red/blue → `AskUserQuestion` 老闆確認，QC 退回 → 上游新 NNN |
| QC→收尾 | 實際啟動產品，提供 URL/指令/截圖或操作證據 → `AskUserQuestion` 老闆確認現況，未通過 → 退回 DEV 或 QC 新 NNN；通過 → 收尾後自動歸檔 slug |

## 收尾檢查

收尾前必須確認下列項目，不符合則退回 DEV 或 QC 新 NNN：

- 無殭屍程序、背景 dev server、測試服務或未關閉的 watcher。
- 無開發殘留檔案進入主分支，例如 scratch、demo、prototype、debug output、臨時設定。
- 無測試文件或測試產物進入主分支，除非它們是正式測試資產。
- 無多餘 build artifact、coverage report、log、cache、截圖、錄影、下載檔。
- `.shiftblame/`、worktree 專用產物、本地私密設定不納入版本控制。
- README.md 與 REPO.md 已反映最終現況。
- QC→收尾確認通過後，slug 通訊文件夾直接搬移至 `.shiftblame/archive/`，不再詢問是否歸檔。

---

## 檔案結構

```
skills/shiftblame/
├── SKILL.md          # 框架入口
├── GATE.md           # 狀態機閘門定義
├── MANAGER.md        # 管理者定義（≤50 行）
├── STAFF.md          # 員工呼叫規格
└── DEPT/
    ├── PRD.md        # 產品部門
    ├── QA.md         # 品保部門
    ├── DEV.md        # 開發部門
    └── QC.md         # 品管部門
```

## 文件結構

```
.shiftblame/
├── REPO.md               # 專案現狀（本地私密）
└── <slug>/<DEPT>/<NNN>/
    ├── task.md
    ├── result.md        # 執行者
    ├── red.md          # 紅隊
    └── blue.md         # 藍隊
```

---

## 安裝

三方 CLI 統一使用 skills symlink 安裝：將本 repo 的 `skills/shiftblame` 連結到各 CLI 的 skills 目錄。

```bash
# Claude CLI
mkdir -p ~/.claude/skills
ln -s ~/shiftblame/skills/shiftblame ~/.claude/skills/shiftblame

# Codex CLI
mkdir -p ~/.codex/skills
ln -s ~/shiftblame/skills/shiftblame ~/.codex/skills/shiftblame

# Gemini CLI
mkdir -p ~/.gemini/skills
ln -s ~/shiftblame/skills/shiftblame ~/.gemini/skills/shiftblame
```

安裝後，管理者依 `GATE.md` 全域入口安裝段落在各 CLI 全域入口檔寫入 managed block。重啟對應 CLI 讓新技能被載入。

## 自訂

本專案不接受外部貢獻。如需微調，請 fork 後調整。

## 授權

[MIT](./LICENSE)
