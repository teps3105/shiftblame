# shiftblame — AI Agents 協作框架

_「這不是我的鍋。」_

雙期制度：PM 研究品管與 DEV 開發維運交替迭代。PM 不得變更 repo；DEV 可變更 repo。

## 六階段

| 階段 | 名稱 | 產出 | 期別 |
|------|------|------|------|
| L0 | 計畫 | plan.md | 執行期 |
| L1 | 執行 | task.md | 執行期 |
| L2 | 驗收 | result.md | 執行期 |
| L3 | 紅隊 | red.md | 驗證期 |
| L4 | 藍隊 | blue.md | 驗證期 |
| L5 | 結論 | conclusion.md | 驗證期 |

## PM 與 DEV

| 部門 | 執行期 | 驗證期 |
|------|--------|--------|
| PM 研究品管 | 需求釐清、品質定義、測試標準 | 品質偏移校正、標準修訂 |
| DEV 開發維運 | 技術規劃、設計、執行、驗收 | 使用者視角驗證、端到端驗收 |

PM PASSED → 交接 DEV。DEV PASSED → 歸檔更新四文件（REPO 現狀 / ROADMAP 規劃 / SOP 全局標準 / GRAPH 圖譜）。

## 定義檔

```
skills/shiftblame/
├── SKILL.md          # 入口
├── GATE.md           # 閘門、狀態機、收尾
├── MANAGE.md         # 管理者操作
├── ROLE/{PM,DEV}/    # {PLAN,TASK,RESULT,RED,BLUE,CONCLUSION}.md
├── TEMPLATES/        # 模板
└── TOOLS/            # 工具包
```

## 安裝

`ln -s ~/shiftblame/skills/shiftblame ~/.claude/skills/shiftblame`
Windows：`cmd /c mklink /J "%USERPROFILE%\.claude\skills\shiftblame" "D:\shiftblame\skills\shiftblame"`

MIT License. 不接受外部貢獻。
