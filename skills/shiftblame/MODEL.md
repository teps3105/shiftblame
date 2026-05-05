---
name: model
description: >-
  模型配置定義。定義子代理別名與實際模型供應商/名稱的映射關係。
  框架內部僅引用別名，模型可隨時替換。
version: "1.0.0"
proxy_slots: 3
---

# MODEL.md — 模型配置

## 別名映射表

| 別名 | 供應商 | 模型名稱 | 備註 |
|------|--------|---------|------|
| proxy-a | google-gemini-cli | gemini-2.5-pro | 主執行者候選 |
| proxy-b | openai-codex | gpt-5.5 | 主執行者候選 |
| proxy-c | minimax | MiniMax-M2.7 | 主執行者候選 |

## 備用模型列表

每個 proxy 的備用模型（限額替換時使用，見 PROXY.md 限額替換機制）：

| 別名 | 備用供應商 | 備用模型名稱 | 備註 |
|------|-----------|-------------|------|
| proxy-a | openai-codex | gpt-5.5 | 若 Gemini 限額時替換 |
| proxy-b | google-gemini-cli | gemini-2.5-pro | 若 OpenAI 限額時替換 |
| proxy-c | google-gemini-cli | gemini-2.5-pro | 若 MiniMax 限額時替換 |

## 供應商配置

### google-gemini-cli
- provider_id: google-gemini-cli
- 呼叫方式: `hermes chat -q "<prompt>" --provider google-gemini-cli --model <MODEL>`
- 額度查詢: 透過 onwatch 確認

### openai-codex
- provider_id: openai-codex
- 呼叫方式: `hermes chat -q "<prompt>" --provider openai-codex --model <MODEL>`
- 額度查詢: 透過 onwatch 確認

### minimax
- provider_id: minimax
- 呼叫方式: `hermes chat -q "<prompt>" --provider minimax --model <MODEL>`
- 額度查詢: 透過 onwatch 確認

## 替換規則

### 更換模型

1. 確認新模型在 Hermes 中可用（`hermes chat -q "test" --provider <X> --model <Y>`）
2. 更新上方「別名映射表」中對應別名的供應商與模型名稱
3. 框架所有流程自動適用新模型，無需修改其他檔案

### 新增子代理

1. 在「別名映射表」新增一行（如 `proxy-d`）
2. 更新 YAML frontmatter 的 `proxy_slots` 數量
3. 秘書在通訊目錄建立時對應新增 `proxy-d/` 子目錄
4. SKILL.md 的 delegate_task 範例需擴充

### 移除子代理

1. 在「別名映射表」移除對應行
2. 更新 YAML frontmatter 的 `proxy_slots` 數量
3. 若 proxy_slots 低於 3，需評估對 equal_consensus 機制的影響

## 約束

- 框架內部（SKILL.md、DEPT/*.md、task.md、consensus.md、result.md）嚴禁直接引用模型名稱或供應商名稱
- 僅 PROXY.md 與 MODEL.md 可包含模型配置資訊
- 秘書在 delegate_task 時查 MODEL.md 取得參數，但不在通訊檔案中記錄模型資訊
- 老闆可透過 clarify() 與秘書討論模型配置，但討論內容不寫入 subagent 可讀取的通訊檔案

## 公平序列輪替

主執行者依 proxy 別名順序輪替：Proxy-A → Proxy-B → Proxy-C → Proxy-A...

不同部門可以有不同的主執行者。meta.md 記錄每輪派工的主執行者。
