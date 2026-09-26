# Shiftblame

版本 **2.8.1**。供 AI agent 使用的開發工作方法與 CLI：承接使用者授權，保留需求契約，以獨立審查與真實行為證據交付。

## 使用方式

小型、可回復且範圍明確的工作可在目前已授權分支直接完成。需要跨里程碑管理的工作使用 slug，以 `intent → requirement → research → plan → test → build → verify` 記錄責任，透過 `sb next` 切段。技術問題可以回到相鄰責任階段修正，契約變更才重新核准。

slug 有兩個使用者決策時點：G1 需求完成後，以及 verify 驗收完成後。兩者都是獨立審查、修正必修項，再由使用者決定。旗標記錄使用者已明確給予的授權。審查與判定期間，代理可非同步先行研究（唯讀查證、tmp 筆記、隔離原型），不推進、不改受審來源、不提交，判定後只重查受影響部分。

- [主技能](skills/shiftblame/SKILL.md)：授權、分工、驗證及文件原則。
- [理解意圖](skills/think/SKILL.md)、[整理文件](skills/rewrite/SKILL.md)、[保存](skills/save/SKILL.md)、[恢復](skills/resume/SKILL.md)、[丟棄](skills/dice/SKILL.md)。
- [CLI 與 hooks](skills/shiftblame/references/MECHANISMS.md)：狀態、契約與攔截邊界。
- [SLUG 與 G1–G3 模板](skills/shiftblame/assets/SLUG.md)、[SOP](skills/shiftblame/assets/SOP.md)、[ROADMAP](skills/shiftblame/assets/ROADMAP.md)。

階段內依實際問題取用方法：難定位錯誤先建立[原症狀重現](skills/shiftblame/references/DEBUG.md)，功能按[完整行為片段與依賴](skills/shiftblame/references/PLAN.md)推進，[測試](skills/shiftblame/references/TEST.md)使用可觀察介面與獨立預期值，[審查](skills/shiftblame/references/AUDIT.md)分開核對需求與工程品質。技術選擇可透過[決策依賴與原型](skills/shiftblame/references/RESEARCH.md)取證，再以[介面負擔及變更集中度](skills/shiftblame/references/STRUCTURE.md)比較方案。

[治理詞彙](skills/shiftblame/references/GLOSSARY.md)提供概念定義；[文件方法](skills/shiftblame/assets/DOCS.md)說明按需讀取入口、領域詞彙與長期決策理由。這些方法依情境使用，技術工作沿用既有授權。[方法來源](skills/shiftblame/references/SOURCES.md)列出借鑑依據。

## main 模式交接

在目前已授權分支直接工作，不需要建立 slug；main 模式也適用於名為 trunk 等其他分支。保存時先寫好 Markdown 交接，記錄目標與授權來源、已完成／未完成、使用者既有變更、證據及下一步，再執行：

```sh
sb handoff save release-280 .shiftblame/tmp/release-280-notes.md
sb handoff list
sb handoff show release-280
```

每個具名工作保存於 `.shiftblame/tmp/main/<task>/handoff.json`；快照包含交接文字、repo、分支、HEAD 及索引／工作樹指紋，允許未提交變更。重存同名工作採原子更新，其他工作互不覆蓋；恢復時明確選工作並核對差異。命令不切分支、不還原產品檔案、不更改 flow-state；快照用於定位，授權與驗收仍回到原始來源。

`sb init --main` 是已結束 slug 的收束操作，不是開始直接工作的必要步驟。活動 slug 仍使用 SLUG 交接回指。完整保存／恢復與例外處理見 [main 交接機制](skills/shiftblame/references/HANDOFF.md)、[save](skills/save/SKILL.md)、[resume](skills/resume/SKILL.md)。

## 安裝與更新

插件從 [GitHub 市集](https://github.com/teps3105/shiftblame) 安裝或更新，全域 CLI 使用：

```sh
npm install -g github:teps3105/shiftblame
```

開發工作目錄僅供開發和測試；消費端使用已發布的獨立快照。發布後，既有平台須更新插件，並依平台要求重新信任變更過的 hooks；執行中的對話可能仍保留舊指令。

插件包含六個技能及 command hooks。SessionStart 注入精簡規則；UserPromptSubmit 更新觀測和階段提示；PreToolUse 解析 Bash 與 PowerShell 命令（含巢狀 shell），檢查狀態、破壞性目標、截斷重定向及提交邊界，字串與參數中的相同字樣不誤擋。回合結束依任務完成或實際阻塞判斷。

## CLI

```sh
sb state
sb init example feat
sb next requirement --boss-ok
sb adversarial .shiftblame/tmp/review-1.md --point 1
sb next research --adversarial --boss-ok
sb next plan
sb next test
sb next build
sb commitmsg "fix: correct the requested behavior"
# 使用同一訊息提交相關實作、測試及文件
sb next verify
# 真驗收、獨立檢閱及使用者終審完成後：
sb adversarial .shiftblame/tmp/review-2.md --point 2
sb end --adversarial --boss-ok
```

先將對應的實際審查報告保存於上述 tmp 路徑；旗標只在審查及使用者授權已成立時使用。更多命令與參數見 `sb --help`；`sb sopreview "<範圍與結論>"` 可選用記錄治理文件審查。

新專案可在空資料夾直接 `sb init <slug>`：自動建立 Git 儲存庫及只含 `.gitignore` 的起始提交，再切到工作分支。已有 repo 但尚無提交時補一個空樹起始提交，不動既有暫存。已有內容的非 Git 資料夾須先 `git init` 並提交，或以 `sb init <slug> --no-git` 不用 Git（收尾只歸檔）。

## 保護與限制

G1 的定義區在需求批准後以 hash 封存；回指記錄保存驗收證據。時點審查仍檢查新鮮度，提交仍檢查 repo、訊息印章及 staged `.shiftblame/`。verify 期間保持被驗來源穩定，修正來源先回 build；hook 覆蓋範圍限於平台提供且可辨識的操作事件，未涵蓋項目列於 [MECHANISMS](skills/shiftblame/references/MECHANISMS.md)。

任務語義、文件品質與工具重試由代理依目標及證據判斷。未知事實依需要查證，測試依變更風險安排，視覺與互動結果可以使用實際操作證據。未驗證的結果明確標示。

## 開發驗證

```sh
npm test --prefix cli
node cli/bin/sb.mjs state
```

測試在臨時 repo 驗證狀態遷移、契約核准、驗收、提交、hook 事件與 shell 命令解析、空專案初始化，以及具名交接保存、完整性與 Git 差異辨識。測試成功支持已覆蓋的行為；模型效能須以代表任務另外量測。授權與語義品質仍需由人及代理依實際上下文判斷。
