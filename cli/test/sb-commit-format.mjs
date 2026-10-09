import assert from 'node:assert/strict';
import { commitMessageIssue } from '../bin/commit-format.mjs';

// 提交訊息內容判準的單元測試：紅案例取自歷史違例訊息，綠案例含版本號開頭。
// 整合行為（sb commitmsg 發章、hook 印章複驗）由 sb-init／sb-hooks 覆蓋；此處鎖單一判準本身。

// 綠：自含白話，含版本號開頭——版本號不算違例。
for (const ok of [
  'fix: 收尾提交走機械格式閘',
  'feat: 3.0.4——提交訊息內容檢查上線',
  'chore: 升版 3.0.4——兩處套件版本標記同步',
  'fix: 路徑前綴在符號連結暫存目錄的分歧',
]) {
  assert.equal(commitMessageIssue(ok), null, ok);
}

// 紅：四類內容違例——每一類由對應清單項擋下，訊息帶類別與命中的詞。
const red = [
  ['fix: .shiftblame/tmp 記錄清理', '內部工作目錄路徑', '.shiftblame'],
  ['feat: interview-3ab78db3861e 訪談自動化', '訪談代號檔', 'interview-3ab78db3861e'],
  ['docs: SOP 條文更新', '流程內部文件名', 'SOP'],
  ['docs: SKILL.md 提交段落修訂', '流程文件檔名', 'SKILL.md'],
  ['fix: G1 契約核准流程修正', '契約時點代號', 'G1'],
  ['feat: 收尾支援 --boss-ok 放行', '流程旗標', '--boss-ok'],
  ['fix: 修正 demo-a1b2c3d4e5 狀態遷移', '帶雜湊的任務代號', 'demo-a1b2c3d4e5'],
  ['feat: slug 里程碑閘強化', 'slug 代號稱呼', 'slug'],
  ['feat: sb 收尾命令加里程碑閘', '流程工具簡稱', 'sb'],
  ['feat: 時點 3 移到驗收完成後', '流程時點詞', '時點'],
  ['fix: 過期印章判準修正', '提交章流程詞', '印章'],
  ['feat: 續接注入末段狀態卡', '續接卡簡稱', '狀態卡'],
  ['chore: 帳本殘留標記清理', '已退役帳本稱呼', '帳本'],
  // 歷史違例實錄：壓縮術語（箭頭鏈）
  ['feat: 3.0.3——測試入口紅→綠機械核對與最低開發機制', '箭頭鏈壓縮', '→'],
  ['feat: 升版 2.9.11——時點 3 定位改為驗收完成後', '流程時點詞', '時點'],
];
for (const [bad, label, hit] of red) {
  if (!label) { assert.equal(commitMessageIssue(bad), null, bad); continue; }
  const issue = commitMessageIssue(bad);
  assert.ok(issue, bad);
  assert.match(issue, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  if (hit) assert.ok(issue.includes(`「${hit}」`), `${bad} → ${issue}`);
}

// 紅：格式違例照舊——內容檢查不取代格式檢查。
assert.match(commitMessageIssue(''), /非空單行/);
assert.match(commitMessageIssue('missing type prefix'), /「type: 一句話」/);
assert.match(commitMessageIssue(`feat: ${'長'.repeat(120)}`), /超過一句話/);
