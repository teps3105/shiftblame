# codex — 審計／獨立性工具

## 適用

反方獨立複審、成果驗收、code review、外部資訊查證、圖像識別粗篩。post-EXECUTOR code review 不得由同輪 G1/G2 planning 反方冒充；需新開 read-only 審查者或走本工具。

## 定位

獨立性升級鏈的外部擔任者；GATE 複審①②揭露升級鏈選項時 codex 為現有擔任者。framework 內 agent 對 codex 的外部需求一律走 `/codex:rescue`，禁側通道。降級鏈兩路徑：老闆主動不選外部→read-only 子代理獨立 code review；codex 不可用→read-only 獨立子代理＋老闆親驗。

## 使用

- 純文字審查 prompt 須明確：不得 computer use、不得操作瀏覽器與桌面、只讀本機檔＋文字產出。
- code review 須附 diff 或指示自跑 `git diff`，結論以 file:line／commit 證據支撐。
- GATE 觸發點②為 post-EXECUTOR 硬審核（必做，擔任者老闆選）；①③ 老闆-gated 預設關閉（①含升級鏈選項揭露）。
