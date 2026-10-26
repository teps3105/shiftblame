# Shiftblame

供 AI 代理使用的通用工作流與 CLI，版本 **4.0.2**。從已授權目標出發，規劃可驗收片段，完成實作、驗證、審查與交接。只有主技能列的停止條件才停下提問，方法依任務風險選擇，結果以實際證據判定。

## 開始使用

從 [GitHub 市集](https://github.com/teps3105/shiftblame) 安裝插件，或安裝全域 CLI：

```sh
npm install -g github:teps3105/shiftblame
sb --help
```

主技能適用於理解需求、安排工作及驗證結果。Hooks 提供本機路徑防護與觀測；是否支援各事件由使用平台決定。

## 工作方法與工具

| 入口 | 用途 |
| --- | --- |
| [shiftblame](skills/shiftblame/SKILL.md) | 授權、需求釐清、規劃、實作、驗證與交付。 |
| [think](skills/think/SKILL.md) | 理解目標，查證事實並釐清必要缺口。 |
| [rewrite](skills/rewrite/SKILL.md) | 保存文件原稿，依讀者任務重整內容。 |
| [save](skills/save/SKILL.md) | 保存具名交接與 Git 定位事實。 |
| [load](skills/load/SKILL.md) | 載入最新或指定交接，成功後清空本 repo 全部交接快照。 |
| [dice](skills/dice/SKILL.md) | 在明確授權範圍內撤除失敗成果。 |

`sb state` 顯示工作區入口，`sb rewrite` 預設快照根 README、`docs/` 與框架本機文件。`sb commitmsg` 檢查非空單行訊息及暫存區邊界，產生可選提交章。`sb handoff` 提供具名保存、查詢及載入。

文件位置、編號、提交格式與版本管理策略遵循專案慣例。TDD、BDD、SDD 是可選方法；需求訪談、測試同批及提交印章不作通用強制條件。CLI 與 hook 的完整邊界見 [MECHANISMS](skills/shiftblame/references/MECHANISMS.md)。

## 本機文件與忽略規則

一般將 `AGENTS.md` 與 `ROADMAP.md` 放 repo 根。若上游已追蹤任一同名文件，或有多位 Git 作者，就改放 `.shiftblame/`。框架保留已追蹤的上游文件，以 Git local exclude 忽略本機工作資料。

使用 `sb workspace migrate` 搬移既有本機內容；`init` 才建立缺少的範本。`check` 唯讀核對，`clean` 顯式清理既有 `.gitignore` 污染。新忽略規則寫入 Git 實際使用的 `info/exclude`，不加入 `.gitignore`。完整判準、衝突處理與命令契約見 [MECHANISMS](skills/shiftblame/references/MECHANISMS.md)。

## 接入本機政策

個人稱謂、語言、模型與平台規則由使用者環境管理。需要額外檢查時，以 `SHIFTBLAME_POLICY` 指定本機政策模組的絕對路徑，或在使用者設定檔中明確安裝政策。未設定時使用通用行為；空的環境變數可停用已安裝政策。

政策模組可增加文件、提交及 hook 規則，不能放寬核心路徑防護。模組是可執行的本機設定，應由使用者選定。介面、設定位置及錯誤處理見 [MECHANISMS](skills/shiftblame/references/MECHANISMS.md)。

## 深入參照與驗證

除錯見 [DEBUG](skills/shiftblame/references/DEBUG.md)，審查見 [AUDIT](skills/shiftblame/references/AUDIT.md)，結構設計見 [STRUCTURE](skills/shiftblame/references/STRUCTURE.md)。交接契約見 [HANDOFF](skills/shiftblame/references/HANDOFF.md)，文件方法見 [DOCS](skills/shiftblame/assets/DOCS.md)，方法來源見 [SOURCES](skills/shiftblame/references/SOURCES.md)。

[INTERVIEW](skills/shiftblame/assets/INTERVIEW.md)、[AGENTS](skills/shiftblame/assets/AGENTS.md) 與 [ROADMAP](skills/shiftblame/assets/ROADMAP.md) 是可調整的範本。代理指引與路線文件採上述本機工作區布局。

```sh
npm test --prefix cli
```

測試使用臨時 repo 核對通用預設、外部政策入口、路徑防護及交接行為。[CI](.github/workflows/test.yml) 在 ubuntu、macOS 與 Windows 執行檢查。通過只支持已覆蓋的行為；方法效益仍須以代表任務量測。
