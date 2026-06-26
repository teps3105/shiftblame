# 研究／搜尋工具

本文件整理 shiftblame 可用的研究與外部資訊搜尋工具，供 G1 外部研究規劃視角與外部查證使用。後續新增工具時直接追加列表項目即可。

## 工具列表

### SEARXNG-mcp

- **適用場景**：外部資訊研究、官方文件查證、版本號／bundle size／業界做法查證
- **定位**：研究／搜尋能力軸的外部首選工具（見 SKILL §17.0 能力降級鏈研究軸）；非唯一權威，單一來源不據以 PASS
- **能力**：
  - `searxng_web_search`：多引擎彙整 web 搜尋（可指定引擎／類別／時間／語言／結果數）
  - `web_url_read`：抓取指定 URL 轉 markdown（可分頁／取章節／列標題）
  - `searxng_instance_info`：查 SearXNG 實例可用引擎／類別
  - `searxng_search_suggestions`：查詢自動補全，用於精煉模糊查詢
- **在 shiftblame 中的使用方式**：
  - G1 外部研究：需求翻譯階段查外部生態、業界先例、競品做法
  - 外部查證：管理者依 SKILL §17.3 外部資訊查證升級規則；先用內建 web 嘗試，本地硬約束（429／查不到／精度不足）時升級 codex rescue 派查證任務
- **降級替代**：不可用時降級內建 web 搜尋（WebSearch／WebFetch）；內建亦硬約束時升級 `/codex:rescue` 派查證任務（見 SKILL §17.0 能力降級鏈研究軸）

### （後續工具追加處）
