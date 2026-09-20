window.createFoodEntry=function(api){
 const {$,$$,esc,openSheet,closeSheet,toast,sync,day,resizeImage,commit,getEpoch}=api;
 const KEY='fitlog-food-draft-v2',BATCH_KEY='fitlog-food-day-draft-v1',NUTRIENTS=['calories','protein','carbs','fat'],MEAL_TYPES=['早餐','午餐','晚餐','小食','運動後餐'];
 const GROUPS={
  '水果':['香蕉','蘋果','橙','奇異果','藍莓','士多啤梨','提子','西瓜'],
  '原型食物':['雞蛋','雞胸肉','雞髀','魚柳','三文魚','牛肉','豆腐','番薯','粟米'],
  '住家餸菜':['蒜蓉炒菜','蒸雞','蒸魚','番茄炒蛋','蒸水蛋','炒西蘭花','清炒雜菜','煲湯'],
  '外賣／茶餐廳':['豆腐枝竹魚柳飯','叉燒飯','白切雞飯','海南雞飯','肉絲炒麵','沙嗲牛肉麵','雲吞麵','兩餸飯'],
  '飯麵主食':['白飯','糙米飯','米粉','意粉','燕麥','全麥麵包','烏冬','通粉'],
  '蛋白粉／補充品':['乳清蛋白粉（沖水）','分離乳清蛋白粉（沖水）','植物蛋白粉（沖水）','蛋白棒'],
  '飲品':['無糖熱奶茶','無糖凍奶茶','鮮奶','低脂奶','無糖豆漿','黑咖啡','拿鐵','無糖茶'],
  '水':['水'],
  '零食':['乳酪','希臘乳酪','果仁','餅乾','朱古力','薯片'],
  '其他':[]
 };
 let draft=null,revision=0,busy=false,job=0,batchDraft=null,batchBusy=false,batchImages={};
 const blank=()=>({date:day(),mealType:'午餐',items:[],notes:'',result:null});
 function readDraft(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}}
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(draft))}catch(e){toast('未能保存草稿，請勿關閉頁面')}}
 function changed(){revision++;draft.result=null;persist();renderResult()}
 function choice(values,current){return values.map(v=>`<option ${v===current?'selected':''}>${esc(v)}</option>`).join('')}
 function categoryFor(name){return Object.keys(GROUPS).find(c=>GROUPS[c].includes(name))||'其他'}
 function defaults(category,name){return {category,name,cookingMethod:category==='水果'?'生食':category==='水'||category==='飲品'||category==='蛋白粉／補充品'?'即飲／沖調':'不確定',portion:category==='水果'?'1個':name==='雞蛋'?'1隻':category==='水'?'250 ml':category==='飲品'||category==='蛋白粉／補充品'?'1杯':'1份',oil:'不確定',notes:''}}
 function open(){job++;busy=false;draft=readDraft()||blank();if(!Array.isArray(draft.items))draft=blank();revision++;render();}
 function render(){
  openSheet('新增飲食',`<p class="food-help">水煮蛋、香蕉、白飯及水支援本機估算；其他交由 AI。草稿自動保存在此裝置。</p>
   <div class="form-grid"><div class="form-row"><label for="mealDate">日期</label><input class="control" id="mealDate" type="date" value="${esc(draft.date)}"></div><div class="form-row"><label for="mealType">餐別</label><select class="control" id="mealType">${choice(['早餐','午餐','晚餐','小食','運動後餐'],draft.mealType)}</select></div></div>
   <div class="chips" id="foodCategories">${Object.keys(GROUPS).map(c=>`<button class="chip" data-category="${esc(c)}">${esc(c)}</button>`).join('')}</div>
   <div id="recentFoods"></div><div id="quickFoods"></div><div id="foodItems"></div>
   <div class="form-row"><label for="mealNotes">補充說明（選填）</label><textarea class="control" id="mealNotes" placeholder="例如：飯只食半碗，餸全食；或直接寫低一餐食咗乜">${esc(draft.notes)}</textarea></div>
   <button class="primary" id="estimateFood">分析營養</button><p id="foodStatus" class="food-help" role="status"></p><div id="foodResult" aria-live="polite"></div><button class="primary" id="confirmFood" hidden>確認並儲存</button><button class="danger-link" id="clearFoodDraft">清除草稿</button>`);
  $('#mealDate').onchange=e=>{draft.date=e.target.value;persist()};$('#mealType').onchange=e=>{draft.mealType=e.target.value;persist()};
  $('#mealNotes').oninput=e=>{draft.notes=e.target.value;changed()};
  $$('#foodCategories button').forEach(b=>b.onclick=()=>showCategory(b.dataset.category));
  $('#estimateFood').onclick=estimate;$('#confirmFood').onclick=save;
  $('#clearFoodDraft').onclick=()=>{if(!confirm('確定清除未儲存嘅食物草稿？'))return;job++;busy=false;draft=blank();revision++;persist();render()};
  renderItems();renderResult();showCategory('水果');renderRecents();
 }
 function recentFoods(){try{return JSON.parse(localStorage.getItem('fitlog-food-recents')||'[]')}catch(e){return []}}
 function renderRecents(){const recent=recentFoods();$('#recentFoods').innerHTML=recent.length?'<p class="food-help">最近用過（保留份量及標籤備註）</p><div class="food-quick">'+recent.map((i,n)=>`<button class="chip" data-recent="${n}">${esc(i.name)} · ${esc(i.portion)}</button>`).join('')+'</div>':'';$$('[data-recent]').forEach(b=>b.onclick=()=>{draft.items.push({...recent[+b.dataset.recent]});changed();renderItems()})}
 function showCategory(category){
  $$('#foodCategories button').forEach(b=>b.classList.toggle('on',b.dataset.category===category));
  $('#quickFoods').innerHTML=`<div class="food-quick">${GROUPS[category].map(name=>`<button class="chip" data-food="${esc(name)}">＋ ${esc(name)}</button>`).join('')}<button class="chip" id="otherFood">＋ 自訂${esc(category==='其他'?'食物':category)}</button></div>`;
  $$('#quickFoods [data-food]').forEach(b=>b.onclick=()=>add(category,b.dataset.food));$('#otherFood').onclick=()=>add(category,'');
 }
 function add(category,name){draft.items.push(defaults(category,name));changed();renderItems();}
 function portions(item){if(item.category==='水')return ['250 ml','500 ml','1 L','2 L'];if(item.category==='飲品'||item.category==='蛋白粉／補充品')return ['半杯','1杯','2杯','250 ml','500 ml'];if(item.name.includes('雞蛋'))return ['1隻','2隻','3隻','4隻'];if(item.name==='蒸雞')return ['¼隻','半隻','1隻'];if(item.category==='水果')return ['半個','1個','2個','100 g'];return ['半份','1份','半碗','1碗','100 g','200 g']}
 function renderItems(){
  $('#foodItems').innerHTML=draft.items.map((i,n)=>`<article class="food-item" data-index="${n}"><div class="food-item-head"><b>${esc(i.category||'其他')}</b><button class="delete-entry" data-remove="${n}">刪除</button></div>
   <div class="form-row"><label>食物名稱</label><input class="control" data-field="name" value="${esc(i.name)}" placeholder="例如：雞蛋"></div>
   <div class="form-grid"><div class="form-row"><label>煮法</label><select class="control" data-field="cookingMethod">${choice([...new Set([i.cookingMethod,'不確定','水煮','溏心','蒸','炒','煎','烤','炸','灼','生食','即飲／沖調'])],i.cookingMethod)}</select></div><div class="form-row"><label>用油</label><select class="control" data-field="oil">${choice(['不確定','無油','少油','正常','多油'],i.oil)}</select></div></div>
   <div class="form-row"><label>實際食用份量（連單位）</label><input class="control" data-field="portion" value="${esc(i.portion)}" placeholder="例如：4隻、半隻、半碗、2 L"></div>
   <div class="food-quick">${portions(i).map(p=>`<button class="chip" data-portion="${esc(p)}">${esc(p)}</button>`).join('')}</div>
   <details ${i.notes?'open':''}><summary>補充／包裝標籤（選填）</summary><input class="control" data-field="notes" value="${esc(i.notes)}" placeholder="例如：每杯 27g protein、飯半碗餸全食"></details></article>`).join('');
  $$('#foodItems [data-field]').forEach(el=>{el.oninput=()=>{const n=+el.closest('[data-index]').dataset.index;draft.items[n][el.dataset.field]=el.value;changed()}});
  $$('#foodItems [data-portion]').forEach(b=>b.onclick=()=>{const article=b.closest('[data-index]'),i=draft.items[+article.dataset.index];i.portion=b.dataset.portion;article.querySelector('[data-field="portion"]').value=i.portion;changed()});
  $$('#foodItems [data-remove]').forEach(b=>b.onclick=()=>{if(!confirm('確定刪除呢項食物？'))return;draft.items.splice(+b.dataset.remove,1);changed();renderItems()});
 }
 function validResult(r){return r&&Array.isArray(r.items)&&r.items.length>0&&r.items.every(i=>typeof i.name==='string'&&NUTRIENTS.every(k=>typeof i[k]==='number'&&Number.isFinite(i[k])&&i[k]>=0))}
 function renderResult(){
  if(!$('#foodResult'))return;const r=draft.result;$('#confirmFood').hidden=!validResult(r);
  if(!validResult(r)){$('#foodResult').innerHTML='<p class="food-help">未分析／資料已更改，請按「分析營養」。</p>';return}
  const totals=r.items.reduce((a,i)=>{NUTRIENTS.forEach(k=>a[k]+=i[k]);return a},{calories:0,protein:0,carbs:0,fat:0});
  $('#foodResult').innerHTML=r.items.map(i=>`<div class="meal"><div><h3>${esc(i.name)}</h3><p>${esc(i.portion)} · ${esc(i.cookingMethod)}</p><div class="tags"><span class="tag blue">蛋白質 ${Math.round(i.protein)} g</span><span class="tag" style="color:var(--orange)">碳水 ${Math.round(i.carbs)} g</span><span class="tag" style="color:var(--pink)">脂肪 ${Math.round(i.fat)} g</span></div></div><strong>${Math.round(i.calories)} kcal</strong></div>`).join('')+`<div class="summary"><span>本餐估算</span><strong>${Math.round(totals.calories)} kcal</strong></div><p class="food-help">${esc(r.notes||'營養為估算值，請先確認食物及份量。')}</p>`;
 }
 async function estimate(){
  if(busy)return;if(!draft.items.length&&!draft.notes.trim())return toast('請先選擇食物或填寫說明');
  if(draft.items.some(i=>!i.name.trim()||!i.portion.trim()))return toast('請填食物名稱及份量');
  busy=true;const requestId=++job,start=revision,epoch=getEpoch();$('#estimateFood').disabled=true;$('#foodStatus').textContent='正在分析；AI 如繁忙會自動重試及檢查後備模型，請稍候。';
  try{
   const result=window.fitlogLocalNutrition(draft)||await sync('analyzeFood',{foodText:JSON.stringify({items:draft.items,notes:draft.notes,mealType:draft.mealType})});
   if(requestId!==job)return;
   if(start!==revision){if(getEpoch()===epoch)$('#foodStatus').textContent='輸入已更改，請再按分析營養。';return}
   if(!validResult(result))throw new Error('invalid result');draft.result=result;persist();if(getEpoch()===epoch){renderResult();$('#foodStatus').textContent='分析完成，確認份量後即可儲存。'}
  }catch(e){if(requestId===job&&getEpoch()===epoch)$('#foodStatus').textContent=window.fitlogAnalysisError(e)}
  finally{if(requestId===job){busy=false;if(getEpoch()===epoch)$('#estimateFood').disabled=false}}
 }
 function save(){if(!validResult(draft.result))return toast('請先分析營養');if(!draft.date)return toast('請選擇日期');
  const items=draft.result.items,totals=items.reduce((a,i)=>{NUTRIENTS.forEach(k=>a[k]+=i[k]);return a},{calories:0,protein:0,carbs:0,fat:0});
  commit({date:draft.date,type:draft.mealType,items,...totals,foodInput:draft.items,notes:draft.notes});
  try{const recent=[...draft.items,...recentFoods()],seen=new Set();localStorage.setItem('fitlog-food-recents',JSON.stringify(recent.filter(i=>{const key=JSON.stringify(i);if(seen.has(key))return false;seen.add(key);return true}).slice(0,12)))}catch(e){}
  localStorage.removeItem(KEY);draft=null;job++;busy=false;closeSheet();toast('飲食已儲存');
 }
 function blankBatch(){return {date:day(),meals:MEAL_TYPES.map(mealType=>({mealType,text:'',correction:'',result:null}))}}
 function readBatch(){try{const v=JSON.parse(localStorage.getItem(BATCH_KEY)||'null');if(!v||!Array.isArray(v.meals))return null;const byType=Object.fromEntries(v.meals.map(m=>[m.mealType,m]));return {date:v.date||day(),meals:MEAL_TYPES.map(mealType=>({...{mealType,text:'',correction:'',result:null},...(byType[mealType]||{})}))}}catch(e){return null}}
 function persistBatch(){try{localStorage.setItem(BATCH_KEY,JSON.stringify(batchDraft))}catch(e){toast('未能保存全日草稿，請勿關閉頁面')}}
 function mealTotals(result){return (result?.items||[]).reduce((a,i)=>{NUTRIENTS.forEach(k=>a[k]+=+i[k]||0);return a},{calories:0,protein:0,carbs:0,fat:0})}
 function validDayResult(result){return result&&Array.isArray(result.meals)&&result.meals.length&&result.meals.every(m=>MEAL_TYPES.includes(m.mealType)&&validResult(m))}
 function batchActiveMeals(){return batchDraft.meals.filter(m=>m.text.trim()||batchImages[m.mealType])}
 function openBatch(){job++;batchBusy=false;batchDraft=readBatch()||blankBatch();renderBatch()}
 function renderBatch(){
  const active=batchActiveMeals();
  const validCount=active.filter(m=>validResult(m.result)).length;
  const total=active.reduce((a,m)=>{const t=mealTotals(m.result);NUTRIENTS.forEach(k=>a[k]+=t[k]);return a},{calories:0,protein:0,carbs:0,fat:0});
  openSheet('補錄全日',`<p class="food-help batch-notice">早餐、午餐、晚餐、小食可以一次過填。最後只會送出一次 AI 分析；相片只留在目前頁面記憶，不會保存到裝置或 Google Sheet。</p>
   <div class="batch-day-head"><div class="form-row"><label for="batchDate">日期</label><input class="control" id="batchDate" type="date" value="${esc(batchDraft.date)}"></div><span class="food-help">${active.length?`${validCount}/${active.length} 餐已分析`:'未有輸入'}</span></div>
   <div id="batchMeals">${batchDraft.meals.map(batchMealHtml).join('')}</div>
   ${validCount?`<div class="summary batch-total"><span>已分析合計</span><strong>${Math.round(total.calories)} kcal</strong><small>P ${Math.round(total.protein)}g · C ${Math.round(total.carbs)}g · F ${Math.round(total.fat)}g</small></div>`:''}
   <button class="primary" id="analyzeBatch" ${active.length?'':'disabled'}>✨ 一次分析全部${active.length?` ${active.length} 餐`:''}</button><p id="batchStatus" class="food-help" role="status"></p>
   <button class="primary" id="saveBatch" ${active.length&&validCount===active.length?'':'hidden'}>確認並儲存全部</button><button class="danger-link" id="clearBatch">清除全日草稿</button>`);
  $('#batchDate').onchange=e=>{batchDraft.date=e.target.value;persistBatch()};
  $$('[data-batch-text]').forEach(el=>el.oninput=()=>{const m=batchDraft.meals.find(x=>x.mealType===el.dataset.batchText);m.text=el.value;m.result=null;m.correction='';persistBatch();const resultBox=el.closest('.batch-meal')?.querySelector('.batch-result');if(resultBox)resultBox.innerHTML='<p class="food-help">內容已更改，請重新分析呢餐或再一次分析全部。</p>';const totalBox=document.querySelector('.batch-total');if(totalBox)totalBox.remove();updateBatchAnalyzeLabel()});
  $$('[data-batch-photo-button]').forEach(b=>b.onclick=()=>{const input=$$('[data-batch-photo]').find(x=>x.dataset.batchPhoto===b.dataset.batchPhotoButton);if(input)input.click()});
  $$('[data-batch-photo]').forEach(inp=>inp.onchange=async e=>{const type=inp.dataset.batchPhoto,file=e.target.files[0];if(!file)return;const state=$$('[data-batch-photo-state]').find(x=>x.dataset.batchPhotoState===type);try{state.textContent='正在處理相片…';const imageBase64=await resizeImage(file);batchImages[type]={imageBase64,mimeType:'image/jpeg',name:file.name};const m=batchDraft.meals.find(x=>x.mealType===type);m.result=null;persistBatch();renderBatch()}catch(err){toast('相片讀取失敗，請重新選擇')}});
  $$('[data-remove-batch-photo]').forEach(b=>b.onclick=()=>{delete batchImages[b.dataset.removeBatchPhoto];const m=batchDraft.meals.find(x=>x.mealType===b.dataset.removeBatchPhoto);m.result=null;persistBatch();renderBatch()});
  $$('[data-batch-correction]').forEach(el=>el.oninput=()=>{const m=batchDraft.meals.find(x=>x.mealType===el.dataset.batchCorrection);m.correction=el.value;persistBatch();if($('#saveBatch'))$('#saveBatch').hidden=true});
  $$('[data-reanalyze-meal]').forEach(b=>b.onclick=()=>reanalyzeBatchMeal(b.dataset.reanalyzeMeal));
  $('#analyzeBatch').onclick=analyzeBatch;
  if($('#saveBatch'))$('#saveBatch').onclick=saveBatch;
  $('#clearBatch').onclick=()=>{if(!confirm('確定清除全日補錄草稿？'))return;batchDraft=blankBatch();batchImages={};localStorage.removeItem(BATCH_KEY);renderBatch()};
 }
 function batchMealHtml(m){
  const hasPhoto=!!batchImages[m.mealType],r=m.result,t=mealTotals(r);
  return `<article class="batch-meal" data-batch-meal="${esc(m.mealType)}"><div class="batch-meal-head"><h3>${esc(m.mealType)}</h3><span class="batch-photo-state ${hasPhoto?'on':''}" data-batch-photo-state="${esc(m.mealType)}">${hasPhoto?'✓ 已加相片':'文字或相片均可'}</span></div>
   <textarea class="control" data-batch-text="${esc(m.mealType)}" placeholder="例如：叉燒飯，飯食半碗；凍奶茶走甜">${esc(m.text)}</textarea>
   <input type="file" accept="image/*" capture="environment" hidden data-batch-photo="${esc(m.mealType)}"><div class="batch-actions"><button class="secondary" data-batch-photo-button="${esc(m.mealType)}">${hasPhoto?'更換相片':'＋ 加相片'}</button>${hasPhoto?`<button class="secondary" data-remove-batch-photo="${esc(m.mealType)}">移除相片</button>`:'<span></span>'}</div>
   ${validResult(r)?`<div class="batch-result">${r.items.map(i=>`<div class="meal"><div><h3>${esc(i.name)}</h3><p>${esc(i.portion)} · ${esc(i.cookingMethod)}</p><div class="tags"><span class="tag blue">P ${Math.round(i.protein)}g</span><span class="tag" style="color:var(--orange)">C ${Math.round(i.carbs)}g</span><span class="tag" style="color:var(--pink)">F ${Math.round(i.fat)}g</span></div></div><strong>${Math.round(i.calories)} kcal</strong></div>`).join('')}<div class="summary"><span>${esc(m.mealType)}估算</span><strong>${Math.round(t.calories)} kcal</strong></div><p class="food-help">${esc(r.notes||'營養為估算值。')}</p><div class="batch-correction"><textarea class="control" data-batch-correction="${esc(m.mealType)}" placeholder="如有需要：例如其實雞皮冇食、飯只食 1/3 碗">${esc(m.correction||'')}</textarea><button class="secondary" data-reanalyze-meal="${esc(m.mealType)}">只重分析呢餐</button></div></div>`:''}</article>`
 }
 function updateBatchAnalyzeLabel(){const active=batchActiveMeals(),b=$('#analyzeBatch');if(!b)return;b.disabled=!active.length;b.textContent=`✨ 一次分析全部${active.length?` ${active.length} 餐`:''}`;if($('#saveBatch'))$('#saveBatch').hidden=true}
 async function analyzeBatch(){
  if(batchBusy)return;const active=batchActiveMeals();if(!active.length)return toast('請至少填一餐或加入相片');if(!batchDraft.date)return toast('請選擇日期');
  batchBusy=true;const requestId=++job,epoch=getEpoch();$('#analyzeBatch').disabled=true;$('#batchStatus').textContent=`正在一次分析 ${active.length} 餐；AI 如繁忙會自動重試及切換後備模型。`;
  try{
   const payload={meals:active.map(m=>({mealType:m.mealType,text:m.text,...(batchImages[m.mealType]||{})}))};
   const result=await sync('analyzeFoodDay',payload);if(requestId!==job)return;if(!validDayResult(result))throw new Error('invalid day nutrition result');
   result.meals.forEach(r=>{const m=batchDraft.meals.find(x=>x.mealType===r.mealType);if(m){m.result=r;m.correction=''}});persistBatch();if(getEpoch()===epoch){renderBatch();const s=$('#batchStatus');if(s)s.textContent=`分析完成，共 ${result.meals.length} 餐。確認後可一次儲存。`}
  }catch(e){if(requestId===job&&getEpoch()===epoch){const s=$('#batchStatus');if(s)s.textContent=window.fitlogAnalysisError(e)}}
  finally{if(requestId===job){batchBusy=false;if(getEpoch()===epoch&&$('#analyzeBatch'))$('#analyzeBatch').disabled=false}}
 }
 async function reanalyzeBatchMeal(type){
  if(batchBusy)return;const m=batchDraft.meals.find(x=>x.mealType===type);if(!m)return;batchBusy=true;const requestId=++job,epoch=getEpoch();const b=$$('[data-reanalyze-meal]').find(x=>x.dataset.reanalyzeMeal===type);if(b)b.disabled=true;const s=$('#batchStatus');if(s)s.textContent=`正在只重分析${type}…`;
  try{
   const img=batchImages[type]||{};const foodText=JSON.stringify({mealType:type,description:m.text,correction:m.correction||'',instruction:'請按 correction 修正原本描述；只分析這一餐。'});const r=await sync('analyzeFood',{foodText,...img});if(requestId!==job)return;if(!validResult(r))throw new Error('invalid result');r.mealType=type;m.result=r;m.correction='';persistBatch();if(getEpoch()===epoch)renderBatch()
  }catch(e){if(requestId===job&&getEpoch()===epoch){const st=$('#batchStatus');if(st)st.textContent=window.fitlogAnalysisError(e)}}finally{if(requestId===job)batchBusy=false}
 }
 function saveBatch(){
  const active=batchActiveMeals();if(!active.length)return toast('未有可儲存餐點');const missing=active.filter(m=>!validResult(m.result));if(missing.length)return toast(`仲有 ${missing.length} 餐未完成分析`);if(!batchDraft.date)return toast('請選擇日期');
  active.forEach(m=>{const totals=mealTotals(m.result);commit({date:batchDraft.date,type:m.mealType,items:m.result.items,...totals,batchInput:m.text,notes:[m.text,m.result.notes].filter(Boolean).join(' · ')})});
  const count=active.length;localStorage.removeItem(BATCH_KEY);batchDraft=null;batchImages={};job++;batchBusy=false;closeSheet();toast(`已儲存 ${count} 餐`)
 }
 $('#manualMeal').onclick=open;$('#batchMeal').onclick=openBatch;
 $('#chooseFood').onclick=()=>{if(readDraft()&&!confirm('已有食物草稿。確定用新相片取代？取消後可按「揀食物／文字新增」繼續草稿。'))return;$('#foodFile').click()};
 $('#foodFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;const requestId=++job;openSheet('分析食物','<p class="food-help">分析相片中；AI 如繁忙會自動重試及檢查後備模型…</p>');const epoch=getEpoch();try{const imageBase64=await resizeImage(file);const r=await sync('analyzeFood',{imageBase64,mimeType:'image/jpeg'});if(requestId!==job)return;if(!validResult(r))throw new Error('invalid result');draft={...blank(),mealType:r.mealType||'午餐',items:r.items.map(i=>({...defaults(categoryFor(i.name),i.name),portion:i.portion,cookingMethod:i.cookingMethod,oil:i.oil})),result:r};persist();if(getEpoch()===epoch)render();else toast('相片分析已存草稿，稍後可繼續')}catch(e){if(requestId===job&&getEpoch()===epoch){openSheet('分析暫未成功',`<p class="food-help">${esc(window.fitlogAnalysisError(e))}</p><p class="food-help">相片不會儲存；重試相片分析需重新選相。原有文字草稿仍保留。</p><button class="secondary" id="returnFoodDraft">返回文字新增</button>`);$('#returnFoodDraft').onclick=open}}finally{$('#foodFile').value=''}};
};
