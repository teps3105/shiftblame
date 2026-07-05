# ai-vision-mcp — 圖像識別工具

## 適用

UI 截圖比對、圖像內容理解、物件偵測、回歸粗篩、影片內容分析。

## 能力

`analyze_image`、`analyze_video`、`compare_images`、`detect_objects_in_image`。

## 使用

只能作「有無回歸」粗篩，不得單獨據以 PASS；粗篩與老闆直覺衝突時預設相信老闆。不可用或精度不足時降級 codex rescue 或老闆肉眼。
