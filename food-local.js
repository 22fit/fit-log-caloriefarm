// USDA FoodData Central SR Legacy, per 100 g edible portion.
// Verified against the public FDC API: 173424 (hard-boiled egg),
// 173944 (raw banana), 168878 (cooked white long-grain rice).
// Household sizes below are explicit app assumptions, not measurements.
window.fitlogLocalNutrition=function(draft){
 if(!draft||draft.notes?.trim()||!draft.items?.length)return null;
 const items=[],assumptions=[];
 for(const i of draft.items){
  if(i.notes?.trim())return null;
  const p=String(i.portion||'').trim().replace(/\s/g,'').replace(/^半/,'0.5').replace(/^¼/,'0.25').replace(/^¾/,'0.75');
  const m=p.match(/^(\d+(?:\.\d+)?)(g|克|個|隻|條|碗|ml|毫升|l|公升)$/i);
  if(!m||!(+m[1]>0))return null;
  const count=+m[1],unit=m[2].toLowerCase();let grams,values,source;
  if(i.name==='水'&&['即飲／沖調','不確定'].includes(i.cookingMethod)&&['不確定','無油'].includes(i.oil)&&['ml','毫升','l','公升'].includes(unit)){
   grams=0;values=[0,0,0,0];source='清水';
  }else if(i.name==='雞蛋'&&['水煮'].includes(i.cookingMethod)&&['不確定','無油'].includes(i.oil)){
   grams=['g','克'].includes(unit)?count:unit==='隻'?count*50:null;values=[155,12.58,1.12,10.61];source='USDA FDC 173424';assumptions.push('水煮全蛋每隻按50g可食部分，無額外油醬。');
  }else if(i.name==='香蕉'&&i.cookingMethod==='生食'&&['不確定','無油'].includes(i.oil)){
   grams=['g','克'].includes(unit)?count:['個','條'].includes(unit)?count*100:null;values=[89,1.09,22.84,0.33];source='USDA FDC 173944';assumptions.push('香蕉每個／條暫按100g去皮果肉。');
  }else if(i.name==='白飯'&&['蒸','水煮','不確定'].includes(i.cookingMethod)&&['不確定','無油'].includes(i.oil)){
   grams=['g','克'].includes(unit)?count:unit==='碗'?count*150:null;values=[130,2.69,28.17,0.28];source='USDA FDC 168878';assumptions.push('白飯按無油熟白飯，每碗暫按150g。');
  }else return null;
  if(grams===null||!Number.isFinite(grams))return null;
  items.push({...i,...Object.fromEntries(['calories','protein','carbs','fat'].map((k,n)=>[k,Math.round(values[n]*grams)/100])),nutritionSource:source});
 }
 return {items,confidence:'local',notes:'本機資料庫估算，未呼叫 AI。'+[...new Set(assumptions)].join('')+'實際大小不同可改填克數；有醬汁或額外配料請寫入備註，改用 AI 分析。'};
};

window.fitlogAnalysisError=function(error){
 const message=String(error?.message||error||'');
 if(/AI_BUSY|503|UNAVAILABLE|high demand/i.test(message))return 'AI 暫時繁忙，重試仍未成功。草稿已保留，請稍後再試。';
 if(/AI_QUOTA|429|Daily analyzeFood(?:Day)? limit/i.test(message))return '分析請求過密或配額已用完，草稿已保留。請稍後再試，或使用支援本機估算的食物。';
 if(/AI_AUTH|GEMINI_API_KEY|Unauthorized/i.test(message))return '分析連線設定或存取權有問題，請管理者檢查 API Key／App Token。草稿已保留。';
 if(/AI_MODEL|404/i.test(message))return '目前 AI 模型不可用，亦未能找到可用後備模型。草稿已保留。';
 if(/AI_REQUEST|400/i.test(message))return 'AI 不接受目前請求，請管理者檢查 Key、模型與請求格式。草稿已保留。';
 if(/invalid result|AI_FORMAT|nutrition result|no result|JSON/i.test(message))return 'AI 未回傳完整營養結果，草稿已保留，請重試。';
 if(/too many|too-large|description too long|missing day food/i.test(message))return '今次輸入太多或格式有問題，請減少相片／文字後再試。草稿已保留。';
 return '分析連線未成功，請檢查網絡後重試。草稿已保留。';
};
