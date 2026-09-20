// 策略選定後取得的合成保留集，未用於選擇界線。
export const cases=[
 ['v01','正在準備下一批掃描……','這是文件掃描器的等待動畫文字，不代表任何頁面已完成或失敗。','正在準備下一批掃描……','routine'],
 ['v02','Operation successful.','The complete result immediately above confirms that all six audio tracks were normalized, with no warnings or remaining work.','End of report.','routine'],
 ['v03','感謝使用字型檢查程式。','檢查結果已完整列出，這裡開始是每次執行都相同的結尾文字。','祝您使用愉快。','routine'],
 ['v04','Analyzing frame 250 of 900...','These messages report only progress through the animation frames, without findings or frame-specific results.','Analyzing frame 251 of 900...','routine'],
 ['v05','先前無法讀取的第二頁現已恢復，全文索引已包含該頁。','第一輪索引因第二頁損壞而不完整。','本行是第二輪唯一記錄修復結果的資訊。','keep'],
 ['v06','The synchronization did not remove the duplicate appointments.','The calendar synchronization request was accepted.','Two copies of each affected appointment remain.','keep'],
 ['v07','以下數值只適用於未加裝隔熱層的配置：','報告分別列出兩種牆面配置的測量結果。','熱傳導係數為 1.8 W/(m²·K)。','keep'],
 ['v08','Source recording ID: 43d728c1-6fa9-4b2e-a815-09cc6472d830','Two recordings have the same visible title. The following identifier links this transcript to the recording actually transcribed.','The transcript begins with the chair opening the meeting.','keep'],
 ['v09','警告：調色盤轉換後，透明像素已變成不透明黑色。','色彩轉換程序已正常結束。','輸出影像尚未修正。','keep'],
 ['v10','Only if the replacement certificate matches the registered hostname may the connection be restored.','A replacement certificate has been received, but its hostname has not been checked.','Keep the connection disabled until this check is complete.','keep'],
 ['v11','讀值：橙色／三','儀器以自訂顏色和數字組合回報資訊，這份輸出沒有欄位名稱。','未提供對照規格，無法分辨這是循環進度、樣本編號或異常等級。','insufficient'],
 ['v12','M::04::Q','The archive reader emitted this isolated token without a field name.','No format specification is available to distinguish a heartbeat token from a record key or a failure code.','insufficient']
];
