---
name: update-readme
description: >-
  掃描專案現狀（agents、skills、hooks、config、目錄結構），同步更新 README.md。
  適用於任何專案。Use this skill when: the user says "update readme", "更新 readme", "/update-readme".
---

# update-readme — 同步 README

掃描專案當前狀態，將 README.md 同步為最新。通用於任何 Claude Code 專案。

## 掃描來源

按專案實際擁有的內容動態掃描，有什麼掃什麼：

### 通用掃描
- **README.md**：讀取現有內容作為比對基準
- **專案結構**：`ls`、`find` 了解目錄佈局
- **package.json**：名稱、版本、描述、scripts、dependencies（若有）
- **git 狀態**：最近 commits、分支資訊

### Claude Code 配置掃描（若有）
- `.claude/agents/*.md`：agent 定義檔 → 統計數量、模型分配、角色列表
- `.claude/skills/*/SKILL.md`：skill 定義 → 列出名稱、觸發詞、用途
- `.claude/hooks/*`：hook 腳本 → 列出事件類型、行為
- `.claude/settings.json`：hooks 設定、權限、模型、MCP servers
- `~/.claude/settings.json`：全域設定（若有專案相關項目）

### 框架特定掃描（若有）
- **shiftblame**：`~/.shiftblame/blame/` 鍋紀錄、REPO.md、部門目錄
- **其他框架**：按專案特徵自動識別

## 同步邏輯

對 README.md 中的每個資訊段落：

1. **提取聲明**：README 中寫的數字、列表、描述
2. **驗證事實**：從掃描結果取得實際值
3. **比對差異**：聲明 vs 事實
4. **精確替換**：只更新有變動的部分

## 執行步驟

### 1. 收集資料
```bash
# 專案基本資訊
cat package.json 2>/dev/null || echo "No package.json"
git log --oneline -5 2>/dev/null

# Claude Code 配置
find .claude/agents/ -name '*.md' 2>/dev/null | sort
find .claude/skills/ -name 'SKILL.md' 2>/dev/null | sort
find .claude/hooks/ -type f 2>/dev/null | sort
cat .claude/settings.json 2>/dev/null

# 全域設定中的 hooks
jq '.hooks' ~/.claude/settings.json 2>/dev/null
```

### 2. 讀取現有 README

讀取 `README.md` 全文，識別各段落結構。

### 3. 比對並列出差異

逐一比對 README 中的聲明與掃描事實：
- Badge 數字是否正確
- Agent/Skill/Hook 列表是否完整
- 檔案結構是否反映現狀
- 使用說明是否涵蓋所有功能

### 4. 精確更新

用 Edit 工具只替換有變動的段落，保留整體結構和風格。

### 5. 回報結果
```
✅ update-readme 完成

已更新：
- Badge：X → Y
- <段落>：新增/移除/修正 Z 項
無變動：<段落列表>
```

## 注意事項
- 只修改 `README.md`，不動其他檔案
- 保留 README 的整體結構、風格、語氣
- 數字必須從檔案系統即時計算，不硬編碼
- 如果 README 不存在，詢問使用者是否要建立
- 描述語言跟隨專案現有語言
