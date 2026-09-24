# Shiftblame

版本 **2.7.3**。供 AI agent 使用的開發工作方法與 CLI：承接使用者授權，保留需求契約，以獨立審查與真實行為證據交付。

## 使用方式

小型、可回復且範圍明確的工作可在目前已授權分支直接完成。需要跨里程碑管理的工作使用 slug，以 `intent → requirement → research → plan → test → build → verify` 記錄責任，透過 `sb next` 切段。技術問題可以回到相鄰責任階段修正，契約變更才重新核准。

slug 有兩個使用者決策時點：G1 需求完成後，以及 verify 驗收完成後。兩者都是獨立審查、修正必修項，再由使用者決定。旗標記錄使用者已明確給予的授權。

- [主技能](skills/shiftblame/SKILL.md)：授權、分工、驗證及文件原則。
- [理解意圖](skills/think/SKILL.md)、[整理文件](skills/rewrite/SKILL.md)、[保存](skills/save/SKILL.md)、[恢復](skills/resume/SKILL.md)、[丟棄](skills/dice/SKILL.md)。
- [CLI 與 hooks](skills/shiftblame/references/MECHANISMS.md)：狀態、契約與攔截邊界。
- [SLUG 與 G1–G3 模板](skills/shiftblame/assets/SLUG.md)、[SOP](skills/shiftblame/assets/SOP.md)、[ROADMAP](skills/shiftblame/assets/ROADMAP.md)。

## 安裝與更新

插件從 [GitHub 市集](https://github.com/teps3105/shiftblame) 安裝或更新，全域 CLI 使用：

```sh
npm install -g github:teps3105/shiftblame
```

開發工作目錄僅供開發和測試；消費端使用已發布的獨立快照。發布後，既有平台須更新插件，並依平台要求重新信任變更過的 hooks；執行中的對話可能仍保留舊指令。

插件包含六個技能及 command hooks。SessionStart 注入精簡規則；UserPromptSubmit 更新觀測和階段提示；PreToolUse 檢查可辨識的狀態、路徑及提交邊界。回合結束依任務完成或實際阻塞判斷。

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

## 保護與限制

G1 的定義區在需求批准後以 hash 封存；回指記錄保存驗收證據。時點審查仍檢查新鮮度，提交仍檢查 repo、訊息印章及 staged `.shiftblame/`。verify 期間保持被驗來源穩定，修正來源先回 build；hook 覆蓋範圍限於平台提供且可辨識的操作事件。

任務語義、文件品質與工具重試由代理依目標及證據判斷。未知事實依需要查證，測試依變更風險安排，視覺與互動結果可以使用實際操作證據。未驗證的結果明確標示。

## 開發驗證

```sh
npm test --prefix cli
node cli/bin/sb.mjs state
```

測試在臨時 repo 驗證狀態遷移、契約核准、驗收、提交與 hook 事件。測試成功支持已覆蓋的行為；模型效能須以代表任務另外量測。授權與語義品質仍需由人及代理依實際上下文判斷。
