# shiftblame — Claude Entry

本 repo 使用同一套 `skills/shiftblame/` 流程定義。當目前環境是 Claude CLI 時，Claude 是執行者，負責寫入 `result.md`。

角色映射：

| 角色 | CLI | 產出 |
|------|-----|------|
| 執行者 | claude | result.md |
| 紅隊 | codex | red.md |
| 藍隊 | gemini | blue.md |

遵循 `skills/shiftblame/SKILL.md`、`MANAGER.md`、`STAFF.md` 與 `DEPT/*.md`。`.shiftblame/` 工作結構不得因 CLI 環境改變。

Claude hooks 設定位於 `.claude/settings.json`，並呼叫共用的 `~/.claude/skills/shiftblame/scripts/*.sh`。

所有產出使用繁體中文。
