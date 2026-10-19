# Shiftblame

供 AI 代理使用的開發工作方法與 CLI，版本 **4.0.0**。代理先與使用者對齊目標、範圍與驗收，再直接規劃、實作與驗證；品質底線依變更意圖定檔（行為修補先寫重現測試、新行為先定場景、介面變更先定規格），完成以真實行為證據驗收，而不是代理自述。

## 適用對象與效果

在支援 hooks 的 AI 代理平台（Claude Code、Codex、ZCode）上做開發，並希望工作有明確授權、結果可驗證的使用者。安裝後無須設定，每個對話自動啟動：

- 產品訪談：對話開始先向使用者提問並寫下目標、範圍與驗收。
- 工作防護：破壞性刪除與丟棄變更須以絕對路徑錨定，提交訊息須自含白話、文件須過結構與可讀性檢查。
- 品質底線：提交含程式碼而沒有測試同批時，先自證檔位或補測試。
- 失敗引導：工具連續失敗時提示換方法，再升級為向使用者取得決定。

## 安裝

插件從 [GitHub 市集](https://github.com/teps3105/shiftblame) 安裝或更新；全域 CLI 另行安裝：

```sh
npm install -g github:teps3105/shiftblame
```

開發工作目錄僅供開發和測試；消費端使用已發布的獨立快照。發布後，既有平台須更新插件，並依平台要求重新信任變更過的 hooks。

## 技能與參照

| 技能 | 用途 |
| --- | --- |
| [shiftblame](skills/shiftblame/SKILL.md) | 主技能：授權、產品訪談、工作方式、分工、驗證與文件原則。 |
| [think](skills/think/SKILL.md) | 理解使用者目標與授權，釐清影響結果的差異。 |
| [rewrite](skills/rewrite/SKILL.md) | 參照型文件的唯一編輯入口，整檔重寫維護。 |
| [save](skills/save/SKILL.md) | 保存具名交接，跨回合接續。 |
| [load](skills/load/SKILL.md) | 恢復具名工作並核對差異。 |
| [dice](skills/dice/SKILL.md) | 按已授權範圍丟棄失敗成果。 |

深入方法按問題取用：除錯見 [DEBUG](skills/shiftblame/references/DEBUG.md)，審查見 [AUDIT](skills/shiftblame/references/AUDIT.md)，結構比較見 [STRUCTURE](skills/shiftblame/references/STRUCTURE.md)，交接見 [HANDOFF](skills/shiftblame/references/HANDOFF.md)。[MECHANISMS](skills/shiftblame/references/MECHANISMS.md) 是 CLI 與 hooks 行為及攔截邊界的權威描述；[DOCS](skills/shiftblame/assets/DOCS.md) 是文件撰寫規範；[SOURCES](skills/shiftblame/references/SOURCES.md) 列方法來源。[SOP](skills/shiftblame/assets/SOP.md) 與 [ROADMAP](skills/shiftblame/assets/ROADMAP.md) 是專案規範與路線範本，權威位置與用法見 [DOCS](skills/shiftblame/assets/DOCS.md) 的文件分型。

## 測試

```sh
npm test --prefix cli
```

測試在臨時 repo 驗證提交與 hook 攔截、產品訪談、失敗引導、文件檢查與具名交接等行為；[.github/workflows/test.yml](.github/workflows/test.yml) 在 ubuntu、macOS 與 Windows 執行同一套。測試成功支持已覆蓋的行為；模型效能須以代表任務另外量測。
