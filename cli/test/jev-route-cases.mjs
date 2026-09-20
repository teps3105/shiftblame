// 人工受控案例；不是實際專案分布或通用校準證據。標籤在呼叫 Jev 前固定。
const inventory = [
  ['TodoRead', 'Read the current to-do list.'],
  ['CronList', 'List scheduled and recurring jobs.'],
  ['OffPeakList', 'List jobs waiting for off-peak execution.'],
  ['ListSavedWorkflows', 'List saved reusable workflow definitions, not execution history.'],
  ['ListModels', 'List AI inference models available to the agent.']
].map(([name, description]) => ({ name, description, input: {} }));
const run = (id, description) => ({ name: 'GetWorkflowRun', input: { run_id: id }, description });
const rows = [
  ['c01','zh-Hant','先確認我還有哪些待辦，暫時不要查看定時工作。','尚未取得待辦清單。',inventory,0],
  ['c02','en','Show jobs configured to repeat every week, rather than tasks waiting for discounted execution.','No scheduling inventory retrieved.',inventory,1],
  ['c03','zh-Hant','如果剛才送的是離峰執行，就查看那個佇列；若是每週定時工作，才查看排程。','收據：已加入離峰執行佇列，未建立週期排程。',inventory,2],
  ['c04','en','Find the reusable procedures I saved, so I can choose one to run later.','Need definitions, not started executions.',inventory,3],
  ['c05','zh-Hant','列出這個代理目前可以選用的推論模型，先不要推薦其中任何一個。','尚未查詢模型目錄。',inventory,4],
  ['c06','en','Read execution details of the customer-account export, not the product-catalog export.','Both executions are running.',[run('run-product-42','Export product catalog'),run('run-customer-41','Export customer accounts')],1],
  ['c07','zh-Hant','查清楚發票附件檢查那次執行為何停止，不是查發票資料匯入。','兩次執行皆因provider停止。',[run('run-invoice-attach','檢查發票附件是否齊全'),run('run-invoice-import','將發票資料匯入帳簿')],0],
  ['c08','en','If the saved procedure exists, inspect its most recent execution; otherwise list saved procedures.','Customer address audit exists; run-address-9 is its most recent execution.',[inventory[3],run('run-address-9','Customer address audit, most recent execution')],1],
  ['c09','zh-Hant','把這封郵件寄給供應商。','郵件內容與收件地址已確認；候選只有查詢，沒有寄信能力。',inventory,'insufficient'],
  ['c10','en','Inspect the run I mentioned earlier.','Earlier reference unavailable. Neither of these two running executions is identified as the target.',[run('run-stock-a','Audit stock quantities'),run('run-stock-b','Audit stock prices')],'insufficient'],
  ['c11','zh-Hant','根據已取得的結果，用一句話告訴我目前还剩多少待辦，不要重新查詢。','剛取得完整清單：三項未完成、兩項已完成，無分頁或缺漏。',inventory,'generate'],
  ['c12','en','Write a brief completion note using the verified execution result.','Full result: 120 rows exported; file verified; no further facts needed.',[run('run-csv-12','Fetch quarterly-sales export execution again'),inventory[3]],'generate'],
  ['h01','en','Do not inspect an execution. Show reusable automation recipes available for a future run.','A completed archive execution exists.',[run('run-backup-6','Archive project files, completed execution'),inventory[3]],1],
  ['h02','zh-Hant','確認每天清晨自動跑的那些工作，不是等待便宜時段才執行的單次工作。','尚未取得定時工作清單。',inventory,1],
  ['h03','en','If the report waits for off-peak capacity, inspect that queue; if recurring, inspect schedules.','Receipt identifies a one-time off-peak job; explicitly no recurring schedule.',inventory,2],
  ['h04','zh-Hant','安排下一步之前，先讀我手動記下的待處理事項；已儲存的自動化程序先不用。','尚未取得待辦內容。',inventory,0],
  ['h05','en','Before choosing the reasoning engine for this agent, retrieve the engines available to it.','AI inference model catalog not known.',inventory,4],
  ['h06','zh-Hant','查看教材插圖授權查核的執行內容，別選教材錯字查核。','兩次執行都在running。',[run('run-material-spelling','教材文字錯字查核'),run('run-material-license','教材插圖授權查核')],1],
  ['h07','en','Inspect why the accessibility audit stopped, rather than the page-speed audit.','Both stopped with generic provider reason.',[run('run-web-speed','Measure page loading performance'),run('run-web-a11y','Check keyboard navigation and screen-reader labels')],1],
  ['h08','zh-Hant','若只知道封面縮圖程序已存在，就查看它最近一次執行；若存在與否不明，才列出已存程序。','已確認程序存在。run-cover-73是最近一次執行，尚未讀詳細結果。',[run('run-cover-73','製作書籍封面縮圖，最近一次執行'),inventory[3]],0],
  ['h09','en','Cancel the recurring inventory report now.','Target identified and authorized, but no candidate can modify or cancel it.',inventory,'insufficient'],
  ['h10','zh-Hant','查看昨天我決定採用的那次翻譯執行詳情。','兩次皆在昨天完成，沒有採用決定紀錄，無法識別目標。',[run('run-translate-a','手冊翻譯候選甲'),run('run-translate-b','手冊翻譯候選乙')],'insufficient'],
  ['h11','en','Explain in one sentence whether any off-peak jobs wait, using the complete result already obtained.','Just queried: empty list, no pagination/errors/omissions. Do not query again.',inventory,'generate'],
  ['h12','zh-Hant','把已驗證的備份結果寫成簡短交付說明。','十二份文件皆已備份，數量、目的地、可讀性均已驗證，證據齊全。',[run('run-backup-verified','重新取得設計文件備份執行詳情'),inventory[0]],'generate']
];
export const cases = rows.map(([id, language, goal, observations, candidates, expected]) => ({
  id, language, split: 'development', state: { goal, observations },
  candidates, expected,
  tools: [...new Set(candidates.map(candidate => candidate.name))].map(name => ({ name }))
}));
