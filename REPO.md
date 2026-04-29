# REPO.md -- shiftblame 專案現狀

> 秘書讀本。反映 2026-04-30 的真實狀態。

## 專案簡介

shiftblame（推鍋）是一套 AI agents 開發框架，核心機制是讓三個 AI CLI（Claude / Codex / Gemini）作為 **PROXY agent** 在同一個 worktree 上共議分工、自主執行、互相辯論。以 Claude Code plugin 形式發布，透過 `/secretary` skill 啟動六部門循環圓（QA -> SEC -> PRD -> DEV -> QC -> MIS）。

關鍵設計：PROXY 是外殼代理 -- 不直接操作，而是各自啟動外部 CLI 進程（`claude -p` / `codex exec` / `gemini -p`），確保三 CLI 上下文獨立、對等、不被 Claude Code 污染。

## 技術棧

- **Plugin 系統**：Claude Code plugin（`.claude-plugin/plugin.json`），透過 Marketplace 安裝
- **Skill**：`/secretary` -- 秘書調度入口（`skills/secretary/SKILL.md`）
- **9 個 Agent 定義**：
  - 6 部門主管：QA / SEC / PRD / DEV / QC / MIS（`agents/*.md`）
  - 3 個 PROXY：CLAUDE_PROXY / CODEX_PROXY / GEMINI_PROXY（`agents/*_PROXY.md`）
- **PROXY 通訊**：`~/.shiftblame/<repo>/<slug>/<DEPT>/` 永久討論目錄（proposal -> debate -> consensus -> execute -> result）
- **資料存放**：`~/.shiftblame/<repo>/` slug 階層 + `~/.shiftblame/<repo>/archive/` 歸檔 + `~/.shiftblame/common/` 跨 repo 常識
- **Worktree**：`~/.worktree/<repo>/<slug>/`，秘書負責建立與清理
- **模型策略**：各 CLI 用自家 default，不從外部指定

## 檔案結構

```
shiftblame/
├── .claude-plugin/
│   ├── plugin.json          # v5.1.1
│   └── marketplace.json
├── agents/
│   ├── QA.md                # 品保主管
│   ├── SEC.md               # 資安主管
│   ├── PRD.md               # 企劃主管
│   ├── DEV.md               # 開發主管
│   ├── QC.md                # 品管主管
│   ├── MIS.md               # MIS 主管（含歸檔、常識提煉、專案文件維護職責）
│   ├── CLAUDE_PROXY.md      # Claude CLI 外殼代理
│   ├── CODEX_PROXY.md       # Codex CLI 外殼代理
│   └── GEMINI_PROXY.md      # Gemini CLI 外殼代理
├── skills/
│   └── secretary/
│       ├── SKILL.md         # 秘書 skill（含派工規則、閘門機制、slug 驗證）
│       ├── DISPATCH_CHECKLIST.md
│       ├── GATE_FLOW.md
│       ├── PROXY_PROTOCOL.md
│       ├── WORKTREE_SOP.md
│       └── LIFECYCLE.md     # 歸檔 + worktree 清理
├── LICENSE                  # MIT
└── README.md
```

## 資料存儲架構（v5.1.1 slug 階層）

```
~/.shiftblame/
├── common/                      # 跨 repo 部門常識
│   ├── DEV.md
│   ├── QA.md
│   ├── QC.md
│   ├── SEC.md
│   ├── MIS.md
│   ├── PRD.md
│   └── SECRETARY.md
└── <repo>/
    ├── REPO.md                  # 專案知識（永遠在這，不隨歸檔移動）
    ├── archive/                 # 歸檔目錄（MIS 完成後 mv 進來）
    │   └── <slug>/              # 已歸檔的完整 slug 快照
    └── <slug>/                  # 當前迭代的 slug 目錄
        ├── <DEPT>.md            # 部門結論檔（QA/SEC/PRD/DEV/QC/MIS）
        └── <DEPT>/              # 永久討論目錄（PROXY 產出）
            ├── task.md
            ├── dept.md
            ├── consensus.md
            ├── claude/{proposal,result}.md
            ├── codex/{proposal,result}.md
            └── gemini/{proposal,result}.md
```

關鍵設計決策：
- 每輪迭代獨立一個 slug 目錄，互不覆蓋
- PROXY 討論產出永久保留（不再於生命週期結尾刪除）
- 歸檔使用 `mv` 原子操作（SEC-A-02）
- 歸檔前檢查 MIS.md 存在且非空（SEC-A-03 閘門）
- slug 名稱驗證：三層檢查 -- 空字串 guard、雙連字號 guard、正規表示式（SEC-A-01）

## 當前狀態

### 版本：5.1.1

最新架構變更：退回規則改為增量重寫（通訊文件與部門產出不再刪除重建），PROXY 互監督機制、秘書寫入權限限制。

### 架構演進歷史

| 版本 | 變更 |
|---|---|
| v3.5 | Codex 派工修正、閘門機制導入 |
| v3.6 | 閘門從派工前改為部門完成後回報 |
| v3.7 | CODEX 代理 agent 取代 codex-cross skill；Codex bwrap fallback |
| v3.8 | 三巨頭能力路由整合 Gemini；PROXY 自組織架構 |
| v4.0 | 框架全面重寫 -- 三 PROXY 共議產出 |
| v4.1 | slug 階層結構 + 永久討論目錄 + 歸檔機制 |
| v5.0 | 常識提煉職能從秘書轉移至 MIS；秘書移除預審機制；MIS 升級為專案文件維護負責人 |
| v5.0.1 | 定義文件清理：統一用詞、更新檔案結構描述 |
| v5.1.0 | PROXY 互監督機制、秘書寫入權限限制、README 全面重寫、定義文件清理 |
| v5.1.1 | 退回規則改為增量重寫（通訊文件與部門產出不再刪除重建） |

### 已知待辦

1. **部門常識為空**：`~/.shiftblame/common/` 的各部門 `.md` 尚未建立內容，等第一輪實戰後由 MIS 提煉
2. **Codex / Gemini CLI 可用性未確認**：PROXY 設計了失效偵測機制（`CLI_UNAVAILABLE` 等），但三 CLI 同時可用的環境尚未驗證
3. **PROXY 自組織完整流程未實戰驗證**：三方 PROXY 在 slug 階層共議的完整流程還沒跑過一輪
4. **SRE 部門設計（效益分析師）**：新增獨立背景部門，巡檢所有 repo 的 archive + 部門常識，分析三巨頭（Claude/Codex/Gemini）在各部門的效益、token 消耗、rate limit、產出品質。產出寫入 `~/.shiftblame/<repo>/sre/report.md`，秘書載入時讀取作為派工參考。不主動觸發循環圓，由秘書請示老闆後才決定是否啟動處理。**前置依賴**：PROXY result.md 需加入結構化 token 回報機制（input/output token、執行時間、結論摘要），目前 PROXY 產出為自由文本無此數據
5. **SRE Web Dashboard（WebSocket 即時監控）**：Web 介面透過 WebSocket 即時顯示三巨頭在各 repo、各部門的工作狀態（當前任務、token 消耗、進度、共識狀態）。資料來源為 PROXY 寫入的結構化 result.md，後端 watch `~/.shiftblame/` 目錄變更並推送。**與待辦 4 同一前置依賴**（需結構化 token 回報）

### 無外部依賴

框架本身是純 Markdown 定義檔（agents + skill），不需要任何 runtime 依賴。實際執行時需要三個 CLI 工具分別安裝且可用。
