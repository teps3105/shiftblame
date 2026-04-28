# 專案文件一致性掃描報告

**掃描日期**：2026-04-29
**掃描範圍**：agents/*.md（9 檔）、skills/secretary/SKILL.md、README.md、.claude-plugin/*.json（2 檔）

---

## 發現的問題清單

| # | 檔案 | 行號 | 問題描述 |
|---|------|------|----------|
| 1 | README.md | 100 | `指派 model` — 已廢棄的 model 指派描述，與 Model 策略章節（各 CLI 用自家 default）矛盾 |
| 2 | README.md | 179 | `選 model` — 已廢棄的 model 選擇描述，同上矛盾 |

---

## 已執行的修正清單

| # | 檔案 | 行號 | 修正前 | 修正後 |
|---|------|------|--------|--------|
| 1 | README.md | 100 | `└─ 明確：評估認知複雜度 → 指派 model` | `└─ 明確：啟動循環圓（各 CLI 用自家 default 模型）` |
| 2 | README.md | 179 | `老闆 → /secretary → 秘書（路由 + 選 model）` | `老闆 → /secretary → 秘書（路由 + 派工）` |

---

## 確認無誤的項目

### A. 過時引用（掃描通過）

- **blame/ 路徑**：目標檔案中無殘留。所有 `shiftblame` 命名皆為專案名稱或資料目錄路徑（`~/.shiftblame/`），非過時引用。
- **BLAME.md**：目標檔案中無殘留。
- **鍋紀錄 / 犯錯紀錄**：目標檔案中無殘留。
- **--model / -m 參數**：目標檔案中無殘留。三個 PROXY agent（CLAUDE_PROXY / CODEX_PROXY / GEMINI_PROXY）的指令組裝區塊皆已標註「不指定 model，用自家 default」，與 README.md Model 策略章節一致。

### B. 路徑引用一致性（通過）

- **common/<DEPT>.md**：README.md、SKILL.md 中統一使用 `~/.shiftblame/common/<DEPT>.md` 格式。
- **~/.shiftblame/<repo>/<DEPT>.md**：所有 9 個 agents/*.md 統一使用此格式，SKILL.md 中亦一致。
- **REPO.md**：agents/MIS.md、SKILL.md 中統一為 `~/.shiftblame/<repo>/REPO.md`。

### C. 檔案結構描述與實際檔案比對（通過）

README.md 描述的 Plugin 結構：
```
shiftblame/
├── .claude-plugin/
│   ├── plugin.json         ✓ 存在
│   └── marketplace.json    ✓ 存在
├── agents/
│   ├── QA.md               ✓ 存在
│   ├── SEC.md              ✓ 存在
│   ├── PRD.md              ✓ 存在
│   ├── DEV.md              ✓ 存在
│   ├── QC.md               ✓ 存在
│   ├── MIS.md              ✓ 存在
│   ├── CLAUDE_PROXY.md     ✓ 存在
│   ├── CODEX_PROXY.md      ✓ 存在
│   └── GEMINI_PROXY.md     ✓ 存在
├── skills/secretary/
│   └── SKILL.md            ✓ 存在
├── LICENSE                 ✓ 存在
└── README.md               ✓ 存在
```

全部吻合，無缺漏或多餘。

---

## 總結

掃描 12 個目標檔案，發現 2 處過時引用（皆為 README.md 中已廢棄的 model 指派描述），已全數修正。其餘所有檢查項目通過：無殘留過時路徑、無過時用語、路徑格式統一、檔案結構與實際一致。
