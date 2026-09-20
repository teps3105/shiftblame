// 獨立提供的合成資料；分類標的為 excerpt，鄰文只提供語境。
export const cases = [
 ['f01','檢查未通過，仍有兩個必要欄位缺漏。','已完成資料格式檢查。','請補上寄件地址與聯絡電話後重試。','keep'],
 ['f02','Validation passed.','All required fields were checked.','Uploading failed: the destination rejected the write.','routine'],
 ['f03','先前顯示的成功已撤回：輸出檔的校驗碼不符。','匯出程序先前回報完成。','目前結果不可交付，需重新產生。','keep'],
 ['f04','The previous success message was incorrect; no changes were committed.','The transaction reached its final validation step.','A constraint violation caused a rollback.','keep'],
 ['f05','僅在唯讀預覽模式下：','下列說明區分預覽與實際執行。','「完成」表示檢查結束，不表示已寫入任何變更。','keep'],
 ['f06','For accounts without export permission:','The following restriction applies only to the group named below.','The download action is unavailable.','keep'],
 ['f07','候選識別碼：8a41c275-620e-4bd9-a68f-46b1297c2f03','已找到兩個同名的封面素材，以下是第二個候選。','尺寸為 1600 × 2400；後續選取必須使用識別碼。','keep'],
 ['f08','Selected candidate: 72e9ca40-8a5e-46e3-9df8-01bff337fa61','Candidate evaluation is complete.','Use this identifier when retrieving the selected result.','keep'],
 ['f09','狀態已由「等待」變為「暫停」，不會自行繼續。','背景工作仍保留在佇列中。','需要人工解除暫停才能恢復。','keep'],
 ['f10','The retry succeeded, and the previously missing attachment is now present.','The first attempt failed because the attachment was unavailable.','The final package is ready for review.','keep'],
 ['f11','處理進度：40%','這一階段只輸出進度，不包含檢查結果。','處理進度：41%','routine'],
 ['f12','Processing item 12 of 80...','Progress updates do not identify individual items or report their results.','Processing item 13 of 80...','routine'],
 ['f13','作業完成。','完整結果：十二筆資料均已儲存；沒有警告或失敗。','以上為本次全部結果。','routine'],
 ['f14','Thank you for using this utility.','All task results have already been printed above.',"For general documentation, see the application's Help menu.",'routine'],
 ['f15','這不是已修復的通知；原本的權限問題仍然存在。','有人將「重試已送出」誤讀為「重試成功」。','目前尚未取得可寫入權限。','keep'],
 ['f16','If verification fails, do not publish the package.','The package has been generated, but verification has not run yet.','Run the verification step before deciding whether to publish.','keep'],
 ['f17','結果：△','此輸出使用另一個系統的自訂符號。','符號對照表未提供；無法知道它表示進度、成功、警告或失敗。','insufficient'],
 ['f18','ZX-17','The source system emitted the following unlabeled value.','No schema or legend is available; it might be a progress token, an object identifier, or a status code.','insufficient'],
 ['f19','尚待處理：取得資料擁有者的同意後才能繼續。','技術檢查已完成，但不代表所有前置條件都已滿足。','目前工作保持暫停。','keep'],
 ['f20','Initialization successful.','This line is a generic startup acknowledgment; it contains no task result.','Task results will be reported separately.','routine']
];
