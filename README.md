# Shiftblame

供 AI agent 使用的開發工作方法與 CLI，版本 **2.9.10**：承接使用者授權，保留需求契約，以獨立審查與真實行為證據交付。

## 安裝與更新

插件從 [GitHub 市集](https://github.com/teps3105/shiftblame) 安裝或更新，全域 CLI 使用：

```sh
npm install -g github:teps3105/shiftblame
```

開發工作目錄僅供開發和測試；消費端使用已發布的獨立快照。發布後，既有平台須更新插件，並依平台要求重新信任變更過的 hooks；執行中的對話可能仍保留舊指令。

插件包含六個技能及 command hooks。SessionStart 注入精簡規則與訪談提示，壓縮續接時另注入工作帳本路徑與末 30 行；UserPromptSubmit 更新觀測與階段提示，上下文用量過窗口 80% 時注入一次帳本提醒；PreToolUse 解析 Bash 與 PowerShell 命令（含巢狀 shell），檢查狀態、repo 邊界、破壞性目標（含丟棄未提交變更的 git 操作與保護目錄）、截斷重定向及提交邊界，字串與參數中的相同字樣不誤擋；寫入訪談紀錄時核對提問證據——每一輪自上一輪完成後須有至少一次 AskUserQuestion，未提問即拒絕。帶 `--boss-ok` 的 `sb next`／`sb end` 由 hook 在權限提示中交使用者確認；Codex 不支援權限詢問，這些操作在 Codex 直接放行。回合結束依任務完成或實際阻塞判斷。

## 使用方式

工作由驅動方式分路：使用者提出具體需求時使用 slug，以 `requirement → research → plan → quality → build → verify` 記錄責任，透過 `sb next` 切段，需求契約與三時點把關；使用者給出目標或意圖時走 main 模式，代理訪談意圖後自行規劃、設計與迭代，可自行開工作樹、派子代理執行片段，整併時保持基底分支歷史線性。瑣碎、可回復的修正沿已授權分支直接完成。意圖確認由產品訪談承載，任何新意圖先訪談對齊，再回 requirement 重入。技術問題可以回到相鄰責任階段修正，契約變更才重新核准。

G1 寫需求與研究、G2 寫計畫與品質、G3 寫實作與驗收。文件結構是三區循環模型：每區兩個責任段對應一份 G 檔，區間以時點關卡銜接；回指為三角循環，通過後由後區指向前區，不是線性鏈：

```
G1（需求＋研究）◀────── G2（計畫＋品質）
   │                       ▲
   ▼                       │
G3（實作＋驗收）───────────┘
```

G2 回指 G1（時點 1 後）、G3 回指 G2（時點 2 後）、G1 回指 G3（時點 3 後閉環）。slug 有三個使用者決策時點：時點 1 在 research→plan（審 G1），時點 2 在 quality→build（審 G2），時點 3 在 verify 驗收完成後（審驗收結果）。三者都是獨立審查、修正必修項，再由使用者決定。旗標記錄使用者已明確給予的授權。審查與判定期間，代理可非同步先行研究（唯讀查證、tmp 筆記、隔離原型），不推進、不改受審來源、不提交，判定後只重查受影響部分。

- [主技能](skills/shiftblame/SKILL.md)：授權、分工、驗證及文件原則。
- [理解意圖](skills/think/SKILL.md)、[整理文件](skills/rewrite/SKILL.md)、[保存](skills/save/SKILL.md)、[恢復](skills/load/SKILL.md)、[丟棄](skills/dice/SKILL.md)。
- [CLI 與 hooks](skills/shiftblame/references/MECHANISMS.md)：狀態、契約與攔截邊界。
- [SLUG 與 G1–G3 模板](skills/shiftblame/assets/SLUG.md)、[SOP](skills/shiftblame/assets/SOP.md)、[ROADMAP](skills/shiftblame/assets/ROADMAP.md)。

階段內依實際問題取用方法：需求翻譯與技術取證依 [G1](skills/shiftblame/references/G1.md)，計畫與品質依 [G2](skills/shiftblame/references/G2.md) 按完整行為片段推進、以可觀察介面與獨立預期值驗證，整合與核對依 [G3](skills/shiftblame/references/G3.md)；難定位錯誤先建立[原症狀重現](skills/shiftblame/references/DEBUG.md)，[審查](skills/shiftblame/references/AUDIT.md)分開核對需求與工程品質，再以[介面負擔及變更集中度](skills/shiftblame/references/STRUCTURE.md)比較方案。

[治理詞彙](skills/shiftblame/references/GLOSSARY.md)提供概念定義；[文件方法](skills/shiftblame/assets/DOCS.md)說明撰寫規範——同構合併、當下自洽、單一描述、人可讀與 docs/ 編號結構——及領域詞彙與長期決策理由。這些方法依情境使用，技術工作沿用既有授權。[方法來源](skills/shiftblame/references/SOURCES.md)列出借鑑依據。

## 產品訪談

每個對話開始都先做一輪產品訪談，不論輸入是新需求、續行或恢復舊對話：先以 AskUserQuestion 向使用者實際提問並取得回答，對齊目標、範圍、限制與授權及驗收後，寫入 `.shiftblame/tmp/interview-<代號>.md`，格式見 [INTERVIEW](skills/shiftblame/assets/INTERVIEW.md)。輸入已經明確時，一輪可以只問最少的確認問題，但不得跳過提問；壓縮續接沿用原紀錄。開發中目標或範圍改變、證據推翻需求假設、slug 定 G1 前與交付前確認，在同一紀錄追加一輪；每一輪寫入前都要先提問。

訪談不封鎖其他工作：hook 只在寫入紀錄本身時把關——每一輪自上一輪完成（或對話開始）後須有至少一次 AskUserQuestion 呼叫，未提問即拒絕，有提問證據則直接放行。對話第一次在專案中觸發 hook 時，自動建立 `.shiftblame/`、`.shiftblame/tmp/` 與忽略全部內容的 `.shiftblame/.gitignore`，不需先執行 `sb init`；家目錄、其上層與系統頂層目錄不建立。適用範圍與未涵蓋項見 [MECHANISMS](skills/shiftblame/references/MECHANISMS.md)。

## 跨回合與壓縮

自動壓縮會丟掉沒寫進檔案的過程內容。工作帳本補這個缺口：上下文用量過窗口 80%（hook 會注入提醒）起，事件發生當下一條一行追加——[否決] 方案與原因、[修正] 使用者原話、[證據] 驗證結果與證據位置、[未決] 待解事項。壓縮續接時 hook 注入帳本路徑與末 30 行，代理據此重讀正式來源接續。活動 slug 寫 `.shiftblame/tmp/<slug>/ledger.md`，`sb next` 切段時列出未決事項提醒收帳；main 寫 `.shiftblame/tmp/main/<task>/ledger.md`。用量估計與注入的機制細節見 [MECHANISMS](skills/shiftblame/references/MECHANISMS.md)。

main 模式在目前已授權分支直接工作，不需要建立 slug；main 模式也適用於名為 trunk 等其他分支。需要跨回合或交接時，先寫好 Markdown 交接草稿，記錄目標與授權來源、已完成／未完成、否決方案與原因、使用者原話修正、證據及下一步，再執行：

```sh
sb handoff save release-280 .shiftblame/tmp/release-280-notes.md
sb handoff list
sb handoff show release-280
```

每個具名工作保存於 `.shiftblame/tmp/main/<task>/handoff.json`；快照包含交接文字、repo、分支、HEAD 及索引／工作樹指紋，允許未提交變更。重存同名工作採原子更新，其他工作互不覆蓋；恢復時明確選工作並核對差異。命令不切分支、不還原產品檔案、不更改 flow-state；快照用於定位，授權與驗收仍回到原始來源。`sb init --main` 是已結束 slug 的收束操作，不是開始直接工作的必要步驟。活動 slug 仍使用 SLUG 交接回指。完整保存／恢復與例外處理見 [main 交接機制](skills/shiftblame/references/HANDOFF.md)、[save](skills/save/SKILL.md)、[load](skills/load/SKILL.md)。

## CLI

```sh
sb state
sb init example feat
sb next research
sb next plan
sb adversarial .shiftblame/tmp/review-1.md --point 1
sb next quality --adversarial --boss-ok
sb adversarial .shiftblame/tmp/review-2.md --point 2
sb next build --adversarial --boss-ok
sb commitmsg "fix: correct the requested behavior"
# 使用同一訊息提交相關實作、測試及文件
sb next verify
# 真驗收、獨立檢閱及使用者終審完成後：
sb adversarial .shiftblame/tmp/review-3.md --point 3
# slug 還有里程碑：開下一里程碑，slug 與工作分支保留
sb next requirement --new-ms --adversarial --boss-ok
# 整個 slug 完成：歸檔、合併回基底、刪除本機工作分支
sb end --adversarial --boss-ok
```

先將對應的實際審查報告保存於上述 tmp 路徑；旗標只在審查及使用者授權已成立時使用。`sb end` 結束整個 slug：SLUG 里程碑清單中目前 ms 之後還有未完成里程碑時會擋下，改用 `--new-ms` 開下一里程碑。更多命令與參數見 `sb --help`；`sb sopreview "<範圍與結論>"` 可選用記錄治理文件審查。參照型文件（README、docs/、SOP、ROADMAP）的編輯統一入口是 `sb rewrite`：快照文件集後檢查結構與可讀性信號（重點前置、長度預算、治理暗語、純散文段、佔位符），提交動到這些檔案時提交閘執行同一判準。

新專案可在空資料夾直接 `sb init <slug>`：自動建立 Git 儲存庫及只含 `.gitignore` 的起始提交，再切到工作分支。已有 repo 但尚無提交時補一個空樹起始提交，不動既有暫存。已有內容的非 Git 資料夾須先 `git init` 並提交，或以 `sb init <slug> --no-git` 不用 Git（收尾只歸檔）。

## 保護與限制

G1 的定義區在時點 1 核准後以 hash 封存，G2 於時點 2 封存；回指記錄保存執行證據與三角回指。時點審查檢查新鮮度與審查對象（時點 1 的 G1 定義區 hash、時點 2 的 G2 定義區 hash、時點 3 的受驗提交），審查後再改須重審；提交仍檢查 repo、訊息印章及 staged `.shiftblame/`。flow-state 以排他鎖與原子寫入更新，hooks 的觀測另存 tmp，並行的命令不會互相覆蓋。verify 期間保持被驗來源穩定，修正來源先回 build；hook 覆蓋範圍限於平台提供且可辨識的操作事件，未涵蓋項目列於 [MECHANISMS](skills/shiftblame/references/MECHANISMS.md)。

任務語義、文件品質與工具重試由代理依目標及證據判斷。未知事實依需要查證，測試依變更風險安排，視覺與互動結果可以使用實際操作證據。未驗證的結果明確標示。

## 開發驗證

```sh
npm test --prefix cli
node cli/bin/sb.mjs state
```

測試在臨時 repo 驗證狀態遷移、契約核准、驗收、提交、hook 事件與 shell 命令解析、帳本提醒與壓縮續接注入、空專案初始化、產品訪談閘、並行寫入、審查對象綁定、文件編輯入口（sb rewrite）的結構與可讀性判準及提交／收尾文件閘，以及具名交接保存、完整性與 Git 差異辨識。[.github/workflows/test.yml](.github/workflows/test.yml) 在 ubuntu、macOS 與 Windows 執行同一套測試。測試成功支持已覆蓋的行為；模型效能須以代表任務另外量測。授權與語義品質仍需由人及代理依實際上下文判斷。
