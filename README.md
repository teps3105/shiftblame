# Shiftblame

供 AI 代理使用的開發工作方法與 CLI，版本 **3.0.4**。把使用者的授權變成可核對的交付：需求先對齊成契約，開發過程由獨立審查把關，完成以真實行為證據驗收，而不是代理自述。

## 給誰

在支援 hooks 的 AI 代理平台（Claude Code、Codex、ZCode）上做開發，並希望工作有明確授權、過程可審查、結果可驗證的使用者。安裝後無須設定：每個對話的產品訪談與工作防護自動啟動。

## 安裝與更新

插件從 [GitHub 市集](https://github.com/teps3105/shiftblame) 安裝或更新；全域 CLI 另行安裝：

```sh
npm install -g github:teps3105/shiftblame
```

開發工作目錄僅供開發和測試；消費端使用已發布的獨立快照。發布後，既有平台須更新插件，並依平台要求重新信任變更過的 hooks。

## 六個技能

| 技能 | 用途 |
| --- | --- |
| [shiftblame](skills/shiftblame/SKILL.md) | 主技能：授權、產品訪談、分工、驗證與文件原則。 |
| [think](skills/think/SKILL.md) | 理解使用者目標與授權，釐清影響結果的差異。 |
| [rewrite](skills/rewrite/SKILL.md) | 參照型文件的唯一編輯入口，整檔重寫維護。 |
| [save](skills/save/SKILL.md) | 保存具名交接，跨回合接續。 |
| [load](skills/load/SKILL.md) | 恢復具名工作並核對差異。 |
| [dice](skills/dice/SKILL.md) | 按已授權範圍丟棄失敗成果。 |

深入方法按問題取用：需求與研究、計畫與品質、整合與驗收的方法分別見 [G1](skills/shiftblame/references/G1.md)、[G2](skills/shiftblame/references/G2.md)、[G3](skills/shiftblame/references/G3.md)；除錯見 [DEBUG](skills/shiftblame/references/DEBUG.md)，審查見 [AUDIT](skills/shiftblame/references/AUDIT.md)，結構比較見 [STRUCTURE](skills/shiftblame/references/STRUCTURE.md)。[MECHANISMS](skills/shiftblame/references/MECHANISMS.md) 是 CLI 與 hooks 行為及攔截邊界的權威描述；[GLOSSARY](skills/shiftblame/references/GLOSSARY.md) 定義治理詞彙；[DOCS](skills/shiftblame/assets/DOCS.md) 是文件撰寫規範（六型文件的位置與規範、治理語彙不得入參照型文件）；[SOURCES](skills/shiftblame/references/SOURCES.md) 列方法來源。[SLUG](skills/shiftblame/assets/SLUG.md) 是流程範本，[SOP](skills/shiftblame/assets/SOP.md) 與 [ROADMAP](skills/shiftblame/assets/ROADMAP.md) 是專案規範與路線範本——權威位置與用法見 [DOCS](skills/shiftblame/assets/DOCS.md) 的文件分型。

## 開發驗證

```sh
npm test --prefix cli
```

測試在臨時 repo 驗證狀態遷移、契約核准、驗收、提交與 hook 攔截、文件檢查與具名交接等行為；[.github/workflows/test.yml](.github/workflows/test.yml) 在 ubuntu、macOS 與 Windows 執行同一套。測試成功支持已覆蓋的行為；模型效能須以代表任務另外量測。
