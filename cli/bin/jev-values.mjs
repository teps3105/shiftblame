// 從原始狀態收集可複製值；不辨識工具名稱、不推斷領域關係或生成參數。
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function sourceValues(state) {
  const found = new Map();
  const add = (value, source) => {
    if (value === null || typeof value === 'object' || ['string','boolean','number'].includes(typeof value)) {
      if (typeof value === 'number' && !Number.isFinite(value)) return;
      const key = JSON.stringify(value);
      if (!found.has(key)) found.set(key, { value, source });
    }
  };
  const visit = (value, source, parseText = true) => {
    add(value,source);
    if (Array.isArray(value)) return value.forEach((item,index) => visit(item, `${source}[${index}]`, parseText));
    if (plain(value)) return Object.entries(value).forEach(([key,item]) => visit(item, `${source}.${key}`, parseText));
    if (typeof value !== 'string' || !parseText) return;
    try { const parsed = JSON.parse(value); if (plain(parsed) || Array.isArray(parsed)) { visit(parsed, `${source}:json`, false); return; } } catch {}
    // 引號內原值可来自文字、JSON 或 XML；只處理格式，不把欄位名稱當成操作規則。
    for (const match of value.matchAll(/"([^"\r\n]*)"|'([^'\r\n]*)'|`([^`\r\n]*)`/g)) {
      const raw = match[1] ?? match[2] ?? match[3];
      if (raw.includes('\\') || /&(?!(?:amp|lt|gt|quot|apos);)/.test(raw)) continue;
      add(raw, `${source}:${match.index}`);
    }
  };
  visit(state,'state');
  return [...found.values()];
}

// 未實作的約束交回宿主，不以部分 schema 驗證宣稱整體符合。
export function matchesSchema(value,schema) {
  if (!plain(schema)) return false;
  const known = ['type','description','title','default','enum','const','properties','required','additionalProperties','items','minItems','maxItems','minLength','maxLength','minimum','maximum'];
  if (Object.keys(schema).some(key => !known.includes(key))) return false;
  if (Object.hasOwn(schema,'const') && JSON.stringify(value)!==JSON.stringify(schema.const)) return false;
  if (schema.enum && !schema.enum.some(item=>JSON.stringify(value)===JSON.stringify(item))) return false;
  const kind = value===null?'null':Array.isArray(value)?'array':typeof value;
  const types = Array.isArray(schema.type)?schema.type:[schema.type];
  if (!types.some(type=>type===kind || type==='integer' && Number.isInteger(value))) return false;
  if (kind==='object') {
    const properties=schema.properties??{};
    if ((schema.required??[]).some(key=>!Object.hasOwn(value,key))) return false;
    return Object.entries(value).every(([key,item])=>Object.hasOwn(properties,key)?matchesSchema(item,properties[key]):schema.additionalProperties===true);
  }
  if (kind==='array') return value.length>=(schema.minItems??0) && value.length<=(schema.maxItems??Infinity) && value.every(item=>matchesSchema(item,schema.items));
  if (kind==='string') { const length=Array.from(value).length; return length>=(schema.minLength??0) && length<=(schema.maxLength??Infinity); }
  if (kind==='number') return Number.isFinite(value) && value>=(schema.minimum??-Infinity) && value<=(schema.maximum??Infinity);
  return true;
}
