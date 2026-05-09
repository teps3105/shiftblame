# shiftblame — Gemini Entry

本 repo 使用同一套 `skills/shiftblame/` 流程定義。當目前環境是 Gemini CLI 時，Gemini 是執行者，負責寫入 `result.md`。

角色映射：

| 角色 | CLI | 產出 |
|------|-----|------|
| 執行者 | gemini | result.md |
| 紅隊 | claude | red.md |
| 藍隊 | codex | blue.md |

遵循 `skills/shiftblame/SKILL.md`、`MANAGER.md`、`STAFF.md` 與 `DEPT/*.md`。`.shiftblame/` 工作結構不得因 CLI 環境改變。

所有產出使用繁體中文。
