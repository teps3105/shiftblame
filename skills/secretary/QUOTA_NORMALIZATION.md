# QUOTA_NORMALIZATION.md

## Provider Normalization Layer 輸出格式

所有 Provider 的額度資料應統一轉換為以下欄位：

| 欄位 | 說明 |
|---|---|
| `used_percent` | 已使用額度百分比 |
| `remaining_percent` | 剩餘額度百分比 |
| `source_direction` | 原始資料方向（`remaining_direct` 或 `used_direct`） |
| `status` | 狀態（充裕 / 吃緊 / 危急） |
| `window` | 額度窗口（如 5hr / 7day / monthly） |
| `raw` | 原始 JSON 資料 |

## 狀態閾值判定

| 狀態 | 判定標準 |
|---|---|
| 充裕 (Adequate) | `remaining_percent >= 50%` |
| 吃緊 (Tight) | `30% <= remaining_percent < 50%` |
| 危急 (Critical) | `remaining_percent < 30%` |

## 各 Provider 換算公式對照表

| Provider | 計算公式 | 說明 |
|---|---|---|
| Anthropic | `剩餘% = (remain / total) * 100` | 原始提供 `remain` 與 `total`，直接計算剩餘百分比 |
| Z.ai | `剩餘% = 100 - tokens_percentage` | 原始提供 `tokens_percentage` (已用%) |
| Codex | `剩餘% = 100 - utilization` | 原始提供 `utilization` (已用率) |
| Gemini | `剩餘% = remaining` | 直接取 `remaining`，標記為 `remaining_direct` |
| MiniMax | `剩餘% = (remain / total) * 100` | 原始提供三值分離 |

---
*Version: v1.2.0*
