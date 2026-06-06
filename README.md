# shiftblame — AI Agents 協作框架

_「這不是我的鍋。」_

交錯式六階段管線：計畫→審計→翻譯→審計→實作→審計。PM 不得變更 repo；DEV 可變更 repo。

## 六階段

| 階段 | 名稱 | 產出 | 說明 |
|------|------|------|------|
| L0 | 計畫 | plan.md | 建立 5W1H 邏輯 |
| L1 | 審計計畫 | red.md | 計畫有沒有偏差 |
| L2 | 翻譯 | task.md | 翻譯為 GWT 語言 |
| L3 | 審計翻譯 | blue.md | 翻譯有沒有正確 |
| L4 | 實作 | result.md | 依 GWT 執行實作 |
| L5 | 審計實作 | conclusion.md | 實作有沒有到位 |

每個階段通過審計才能往下走。

## PM 與 DEV

| 部門 | 職責 |
|------|------|
| PM（研究需求） | 業務 5W1H → 審計 → 業務 GWT → 審計 → 規格實作 → 審計 |
| DEV（開發維運） | 技術 5W1H → 審計 → 技術 GWT → 審計 → 程式碼實作 → 審計 |

PM PASSED → 交接 DEV。DEV PASSED → 歸檔更新四文件（REPO 現狀 / ROADMAP 規劃 / SOP 全局標準 / GRAPH 圖譜）。

## 定義檔

```
skills/shiftblame/
├── SKILL.md          # 入口
├── GATE.md           # 閘門、狀態機、收尾
├── MANAGE.md         # 管理者操作
├── ROLE/{PM,DEV}/    # {PLAN,RED,TASK,BLUE,RESULT,CONCLUSION}.md
├── TEMPLATES/        # 模板
└── TOOLS/            # 工具包
```

## 安裝

`ln -s ~/shiftblame/skills/shiftblame ~/.claude/skills/shiftblame`
Windows：`cmd /c mklink /J "%USERPROFILE%\.claude\skills\shiftblame" "D:\shiftblame\skills\shiftblame"`

MIT License. 不接受外部貢獻。
