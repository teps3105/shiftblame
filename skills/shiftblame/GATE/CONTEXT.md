---
title: GATE/CONTEXT
---

# 上下文監控與壓縮

管理者在全流程中持續監控上下文用量。

## 監控時機

- 狀態轉移前（特別是準備呼叫子代理前）
- 大量文件讀寫後（result.md、red.md、blue.md 產出後）
- BossConfirm 前
- 跨角色推進前
- 任何可能大幅增加上下文的操作前

## 壓縮觸發

上下文用量過高時，管理者直接強制觸發環境的壓縮上下文機制（非建議老闆執行），避免工作到一半因上下文爆炸而中斷。

## compact hook

壓縮後 SessionStart hook 會自動重新載入 shiftblame 技能。compact hook 用於壓縮後恢復技能，非閘門觸發。
