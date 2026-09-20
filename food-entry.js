window.createFoodEntry=function(api){
 const {$,$$,esc,openSheet,closeSheet,toast,sync,day,resizeImage,commit,getEpoch}=api;
 const KEY='fitlog-food-draft-v3',BATCH_KEY='fitlog-food-day-draft-v2',NUTRIENTS=['calories','protein','carbs','fat'],MEAL_TYPES=['早餐','午餐','晚餐','小食','運動後餐'];
 const GROUPS={
  '水果':['香蕉','蘋果','橙','奇異果','藍莓','士多啤梨','提子','西瓜'],
  '原型食物':['雞蛋','雞胸肉','雞髀','魚柳','三文魚','牛肉','豆腐','番薯','粟米'],
  '住家餸菜':['蒜蓉炒菜','蒸雞','蒸魚','番茄炒蛋','蒸水蛋','炒西蘭花','清炒雜菜','煲湯'],
  '外賣／茶餐廳':['豆腐枝竹魚柳飯','叉燒飯','白切雞飯','海南雞飯','肉絲炒麵','沙嗲牛肉麵','雲吞麵','兩餸飯'],
  '飯麵主食':['白飯','糙米飯','米粉','意粉','燕麥','全麥麵包','烏冬','通粉'],
  '蛋白粉／補充品':['乳清蛋白粉（沖水）','分離乳清蛋白粉（沖水）','植物蛋白粉（沖水）','蛋白棒'],
  '飲品':['無糖熱奶茶','無糖凍奶茶','鮮奶','低脂奶','無糖豆漿','黑咖啡','拿鐵','無糖茶'],
  '水':['水'],
  '零食':['乳酪','希臘乳酪','果仁','餅乾','朱古力','薯片']
 };
 const COOKING=['不確定','水煮','溏心','蒸','炒','煎','烤','炸','灼','生食','即飲／沖調'];
 const OILS=['不確定','無油','少油','正常','多油'];
 let draft=null,revision=0,busy=false,job=0,batchDraft=null,batchBusy=false;
 const blank=()=>({date:day(),mealType:'午餐',items:[],notes:'',result:null,category:'水果'});
 const blankBatch=()=>({date:day(),meals:MEAL_TYPES.map(mealType=>({mealType,items:[],notes:'',result:null,category:'水果'}))});
 function readJSON(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch(e){return null}}
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(draft))}catch(e){toast('未能保存草稿，請勿關閉頁面')}}
 function persistBatch(){try{localStorage.setItem(BATCH_KEY,JSON.stringify(batchDraft))}catch(e){toast('未能保存全日草稿，請勿關閉頁面')}}
 function choice(values,current){return values.map(v=>`<option ${v===current?'selected':''}>${esc(v)}</option>`).join('')}
 function categoryFor(name){return Object.keys(GROUPS).find(c=>GROUPS[c].includes(name))||'原型食物'}
 function defaults(category,name){return {category,name,cookingMethod:category==='水果'?'生食':category==='水'||category==='飲品'||category==='蛋白粉／補充品'?'即飲／沖調':'不確定',portion:category==='水果'?'1個':name==='雞蛋'?'1隻':name==='蒸雞'?'¼隻':category==='水'?'250 ml':category==='飲品'||category==='蛋白粉／補充品'?'1杯':'1份',oil:category==='水果'||category==='水'?'無油':'不確定',notes:''}}
 function portions(item){
  if(item.category==='水')return ['250 ml','500 ml','1 L','2 L'];
  if(item.category==='飲品'||item.category==='蛋白粉／補充品')return ['半杯','1杯','2杯','250 ml','500 ml'];
  if(item.name.includes('雞蛋'))return ['1隻','2隻','3隻','4隻'];
  if(item.name==='蒸雞')return ['¼隻','半隻','1隻'];
  if(item.category==='水果')return ['半個','1個','2個','100 g'];
  if(item.name.includes('飯')||item.category==='飯麵主食')return ['半碗','1碗','1.5碗','2碗','100 g','200 g'];
  return ['半份','1份','1.5份','2份','100 g','200 g'];
 }
 function validResult(r){return r&&Array.isArray(r.items)&&r.items.length>0&&r.items.every(i=>typeof i.name==='string'&&NUTRIENTS.every(k=>typeof i[k]==='number'&&Number.isFinite(i[k])&&i[k]>=0))}
 function totalsFor(r){return (r?.items||[]).reduce((a,i)=>{NUTRIENTS.forEach(k=>a[k]+=+i[k]||0);return a},{calories:0,protein:0,carbs:0,fat:0})}
 function resultHtml(r,label='本餐估算'){
  if(!validResult(r))return '<p class="food-help">未分析／資料已更改。</p>';
  const t=totalsFor(r);
  return r.items.map(i=>`<div class="meal"><div><h3>${esc(i.name)}</h3><p>${esc(i.portion)} · ${esc(i.cookingMethod)}</p><div class="tags"><span class="tag blue">蛋白質 ${Math.round(i.protein)} g</span><span class="tag" style="color:var(--orange)">碳水 ${Math.round(i.carbs)} g</span><span class="tag" style="color:var(--pink)">脂肪 ${Math.round(i.fat)} g</span></div></div><strong>${Math.round(i.calories)} kcal</strong></div>`).join('')+`<div class="summary"><span>${esc(label)}</span><strong>${Math.round(t.calories)} kcal</strong></div><p class="food-help">${esc(r.notes||'營養為估算值，請先確認食物及份量。')}</p>`;
 }
 function itemHtml(i,n,prefix=''){
  const idxAttr=prefix?`data-batch-item="${n}"`:`data-index="${n}"`;
  const fieldPrefix=prefix?'data-batch-field':'data-field';
  const portionAttr=prefix?'data-batch-portion':'data-portion';
  const removeAttr=prefix?'data-batch-remove':'data-remove';
  return `<article class="food-item" ${idxAttr}><div class="food-item-head"><div><b>${esc(i.name)}</b><small>${esc(i.category)}</small></div><button class="delete-entry" ${removeAttr}="${n}">刪除</button></div>
   <div class="form-grid"><div class="form-row"><label>煮法</label><select class="control" ${fieldPrefix}="cookingMethod">${choice([...new Set([i.cookingMethod,...COOKING])],i.cookingMethod)}</select></div><div class="form-row"><label>用油</label><select class="control" ${fieldPrefix}="oil">${choice(OILS,i.oil)}</select></div></div>
   <div class="form-row"><label>實際食用份量</label><div class="food-quick portion-picker">${portions(i).map(p=>`<button class="chip ${p===i.portion?'on':''}" ${portionAttr}="${esc(p)}">${esc(p)}</button>`).join('')}</div></div>
   <details ${i.notes?'open':''}><summary>補充／包裝標籤（選填）</summary><input class="control" ${fieldPrefix}="notes" value="${esc(i.notes)}" placeholder="例如：每杯 27g protein；飯半碗、餸全食"></details></article>`;
 }
 function categoriesHtml(selected,attr){return Object.keys(GROUPS).map(c=>`<button class="chip ${c===selected?'on':''}" ${attr}="${esc(c)}">${esc(c)}</button>`).join('')}
 function quickHtml(category,attr){return GROUPS[category].map(name=>`<button class="chip" ${attr}="${esc(name)}">＋ ${esc(name)}</button>`).join('')}

 // ----- Single meal picker -----
 function changed(){revision++;draft.result=null;persist();renderResult()}
 function open(){job++;busy=false;draft=readJSON(KEY)||blank();if(!Array.isArray(draft.items))draft=blank();draft.category=GROUPS[draft.category]?draft.category:'水果';revision++;render()}
 function render(){
  openSheet('新增飲食',`<p class="food-help batch-notice">揀分類 → 撳食物 → 揀份量／煮法 → 分析營養 → 確認儲存。只有「補充／標籤」需要時先打字。</p>
   <div class="form-grid"><div class="form-row"><label for="mealDate">日期</label><input class="control" id="mealDate" type="date" value="${esc(draft.date)}"></div><div class="form-row"><label for="mealType">餐別</label><select class="control" id="mealType">${choice(MEAL_TYPES,draft.mealType)}</select></div></div>
   <p class="picker-step">1 · 揀分類</p><div class="chips" id="foodCategories">${categoriesHtml(draft.category,'data-category')}</div>
   <p class="picker-step">2 · 撳食物</p><div id="quickFoods"><div class="food-quick">${quickHtml(draft.category,'data-food')}</div></div>
   <p class="picker-step">3 · 揀份量／煮法</p><div id="foodItems"></div>
   <div class="form-row"><label for="mealNotes">整餐補充（選填）</label><textarea class="control" id="mealNotes" placeholder="例如：飯半碗，餸全食">${esc(draft.notes||'')}</textarea></div>
   <button class="primary" id="estimateFood">分析營養</button><p id="foodStatus" class="food-help" role="status"></p><div id="foodResult" aria-live="polite"></div><button class="primary" id="confirmFood" hidden>確認並儲存</button><button class="danger-link" id="clearFoodDraft">清除草稿</button>`);
  $('#mealDate').onchange=e=>{draft.date=e.target.value;persist()};$('#mealType').onchange=e=>{draft.mealType=e.target.value;persist()};
  $('#mealNotes').oninput=e=>{draft.notes=e.target.value;changed()};
  $$('#foodCategories [data-category]').forEach(b=>b.onclick=()=>{draft.category=b.dataset.category;persist();render()});
  $$('#quickFoods [data-food]').forEach(b=>b.onclick=()=>{draft.items.push(defaults(draft.category,b.dataset.food));changed();render()});
  $('#estimateFood').onclick=estimate;$('#confirmFood').onclick=save;
  $('#clearFoodDraft').onclick=()=>{if(!confirm('確定清除未儲存嘅食物草稿？'))return;job++;busy=false;draft=blank();revision++;persist();render()};
  renderItems();renderResult();
 }
 function renderItems(){
  $('#foodItems').innerHTML=draft.items.length?draft.items.map((i,n)=>itemHtml(i,n)).join(''):'<p class="food-help empty-picker">未揀食物。</p>';
  $$('#foodItems [data-field]').forEach(el=>{el.oninput=()=>{const n=+el.closest('[data-index]').dataset.index;draft.items[n][el.dataset.field]=el.value;changed()}});
  $$('#foodItems [data-portion]').forEach(b=>b.onclick=()=>{const article=b.closest('[data-index]'),i=draft.items[+article.dataset.index];i.portion=b.dataset.portion;changed();render()});
  $$('#foodItems [data-remove]').forEach(b=>b.onclick=()=>{draft.items.splice(+b.dataset.remove,1);changed();render()});
 }
 function renderResult(){if(!$('#foodResult'))return;const r=draft.result;$('#confirmFood').hidden=!validResult(r);$('#foodResult').innerHTML=validResult(r)?resultHtml(r):'<p class="food-help">未分析／資料已更改，請按「分析營養」。</p>'}
 async function estimate(){
  if(busy)return;if(!draft.items.length)return toast('請先揀食物');
  busy=true;const requestId=++job,start=revision,epoch=getEpoch();$('#estimateFood').disabled=true;$('#foodStatus').textContent='正在分析；AI 如繁忙會自動重試。';
  try{
   const local=window.fitlogLocalNutrition?window.fitlogLocalNutrition(draft):null;
   const result=local||await sync('analyzeFood',{foodText:JSON.stringify({items:draft.items,notes:draft.notes,mealType:draft.mealType})});
   if(requestId!==job)return;if(start!==revision){if(getEpoch()===epoch)$('#foodStatus').textContent='選項已更改，請重新分析。';return}
   if(!validResult(result))throw new Error('invalid result');draft.result=result;persist();if(getEpoch()===epoch){renderResult();$('#foodStatus').textContent='分析完成，確認後即可儲存。'}
  }catch(e){if(requestId===job&&getEpoch()===epoch)$('#foodStatus').textContent=window.fitlogAnalysisError?window.fitlogAnalysisError(e):'分析未成功，草稿已保留。'}
  finally{if(requestId===job){busy=false;if(getEpoch()===epoch&&$('#estimateFood'))$('#estimateFood').disabled=false}}
 }
 function rememberItems(items){try{const old=readJSON('fitlog-food-recents')||[],all=[...items,...old],seen=new Set(),clean=all.filter(i=>{const k=JSON.stringify(i);if(seen.has(k))return false;seen.add(k);return true}).slice(0,12);localStorage.setItem('fitlog-food-recents',JSON.stringify(clean))}catch(e){}}
 function save(){if(!validResult(draft.result))return toast('請先分析營養');if(!draft.date)return toast('請選擇日期');const t=totalsFor(draft.result);commit({date:draft.date,type:draft.mealType,items:draft.result.items,...t,foodInput:draft.items,notes:draft.notes});rememberItems(draft.items);localStorage.removeItem(KEY);draft=null;job++;busy=false;closeSheet();toast('飲食已儲存')}

 // ----- Whole-day batch picker (same picker UX, one AI call) -----
 function readBatch(){const d=readJSON(BATCH_KEY);if(!d||!Array.isArray(d.meals))return null;const by={};d.meals.forEach(m=>{if(m&&MEAL_TYPES.includes(m.mealType))by[m.mealType]=m});return {date:d.date||day(),meals:MEAL_TYPES.map(mealType=>{const m=by[mealType]||{};return {mealType,items:Array.isArray(m.items)?m.items:[],notes:typeof m.notes==='string'?m.notes:'',result:m.result||null,category:GROUPS[m.category]?m.category:'水果'}})}}
 function activeMeals(){return batchDraft.meals.filter(m=>m.items.length)}
 function invalidateMeal(m){m.result=null;persistBatch()}
 function openBatch(){job++;batchBusy=false;batchDraft=readBatch()||blankBatch();renderBatch()}
 function batchMealHtml(m,mi){
  const r=m.result,t=totalsFor(r),count=m.items.length;
  return `<details class="batch-meal" data-meal-index="${mi}" ${count?'open':''}><summary class="batch-meal-head"><div><h3>${esc(m.mealType)}</h3><small>${count?`${count} 項食物`:'未揀食物'}</small></div><span>${validResult(r)?`✓ ${Math.round(t.calories)} kcal`:'›'}</span></summary><div class="batch-meal-body">
   <p class="picker-step">1 · 揀分類</p><div class="chips batch-categories">${categoriesHtml(m.category,'data-batch-category')}</div>
   <p class="picker-step">2 · 撳食物</p><div class="food-quick batch-quick">${quickHtml(m.category,'data-batch-food')}</div>
   <p class="picker-step">3 · 揀份量／煮法</p><div class="batch-items">${count?m.items.map((i,n)=>itemHtml(i,n,'batch')).join(''):'<p class="food-help empty-picker">未揀食物。</p>'}</div>
   <div class="form-row"><label>補充／整餐說明（選填）</label><textarea class="control" data-batch-notes placeholder="例如：飯半碗，餸全食">${esc(m.notes||'')}</textarea></div>
   <div class="batch-result">${validResult(r)?resultHtml(r,m.mealType+'估算'):''}</div>
   ${validResult(r)?`<button class="secondary" data-reanalyze="${mi}">只重分析呢餐</button>`:''}
  </div></details>`
 }
 function renderBatch(){
  const active=activeMeals(),validCount=active.filter(m=>validResult(m.result)).length,total=active.reduce((a,m)=>{const t=totalsFor(m.result);NUTRIENTS.forEach(k=>a[k]+=t[k]);return a},{calories:0,protein:0,carbs:0,fat:0});
  openSheet('補錄全日',`<p class="food-help batch-notice">唔使打食物名稱。每一餐都係：揀分類 → 撳食物 → 揀份量／煮法。全部揀好先一次過分析。</p>
   <div class="batch-day-head"><div class="form-row"><label for="batchDate">日期</label><input class="control" id="batchDate" type="date" value="${esc(batchDraft.date)}"></div><span class="food-help">${active.length?`${validCount}/${active.length} 餐已分析`:'未有食物'}</span></div>
   <div id="batchMeals">${batchDraft.meals.map(batchMealHtml).join('')}</div>
   ${validCount?`<div class="summary batch-total"><span>已分析合計</span><strong>${Math.round(total.calories)} kcal</strong><small>P ${Math.round(total.protein)}g · C ${Math.round(total.carbs)}g · F ${Math.round(total.fat)}g</small></div>`:''}
   <button class="primary" id="analyzeBatch" ${active.length?'':'disabled'}>✨ 一次分析全部${active.length?` ${active.length} 餐`:''}</button><p id="batchStatus" class="food-help" role="status"></p>
   <button class="primary" id="saveBatch" ${active.length&&validCount===active.length?'':'hidden'}>確認並儲存全部</button><button class="danger-link" id="clearBatch">清除全日草稿</button>`);
  $('#batchDate').onchange=e=>{batchDraft.date=e.target.value;persistBatch()};
  $$('[data-batch-category]').forEach(b=>b.onclick=e=>{e.preventDefault();const card=b.closest('[data-meal-index]'),m=batchDraft.meals[+card.dataset.mealIndex];m.category=b.dataset.batchCategory;persistBatch();renderBatch()});
  $$('[data-batch-food]').forEach(b=>b.onclick=e=>{e.preventDefault();const card=b.closest('[data-meal-index]'),m=batchDraft.meals[+card.dataset.mealIndex];m.items.push(defaults(m.category,b.dataset.batchFood));invalidateMeal(m);renderBatch()});
  $$('[data-batch-field]').forEach(el=>el.oninput=()=>{const card=el.closest('[data-meal-index]'),m=batchDraft.meals[+card.dataset.mealIndex],item=el.closest('[data-batch-item]');m.items[+item.dataset.batchItem][el.dataset.batchField]=el.value;invalidateMeal(m)});
  $$('[data-batch-portion]').forEach(b=>b.onclick=e=>{e.preventDefault();const card=b.closest('[data-meal-index]'),m=batchDraft.meals[+card.dataset.mealIndex],item=b.closest('[data-batch-item]');m.items[+item.dataset.batchItem].portion=b.dataset.batchPortion;invalidateMeal(m);renderBatch()});
  $$('[data-batch-remove]').forEach(b=>b.onclick=e=>{e.preventDefault();const card=b.closest('[data-meal-index]'),m=batchDraft.meals[+card.dataset.mealIndex];m.items.splice(+b.dataset.batchRemove,1);invalidateMeal(m);renderBatch()});
  $$('[data-batch-notes]').forEach(el=>el.oninput=()=>{const card=el.closest('[data-meal-index]'),m=batchDraft.meals[+card.dataset.mealIndex];m.notes=el.value;invalidateMeal(m);if($('#saveBatch'))$('#saveBatch').hidden=true});
  $$('[data-reanalyze]').forEach(b=>b.onclick=e=>{e.preventDefault();reanalyzeMeal(+b.dataset.reanalyze)});
  $('#analyzeBatch').onclick=analyzeBatch;if($('#saveBatch'))$('#saveBatch').onclick=saveBatch;
  $('#clearBatch').onclick=()=>{if(!confirm('確定清除全日補錄草稿？'))return;batchDraft=blankBatch();localStorage.removeItem(BATCH_KEY);renderBatch()}
 }
 async function analyzeBatch(){
  if(batchBusy)return;const active=activeMeals();if(!active.length)return toast('請至少揀一餐食物');if(!batchDraft.date)return toast('請選擇日期');
  batchBusy=true;const requestId=++job,epoch=getEpoch();$('#analyzeBatch').disabled=true;$('#batchStatus').textContent=`正在一次分析 ${active.length} 餐；只會送出一個批量 AI request。`;
  try{
   const payload={meals:active.map(m=>({mealType:m.mealType,items:m.items,notes:m.notes}))};
   const result=await sync('analyzeFoodDay',payload);if(requestId!==job)return;if(!result||!Array.isArray(result.meals))throw new Error('invalid day nutrition result');
   result.meals.forEach(r=>{const m=batchDraft.meals.find(x=>x.mealType===r.mealType);if(m&&validResult(r))m.result=r});persistBatch();if(getEpoch()===epoch)renderBatch();
  }catch(e){if(requestId===job&&getEpoch()===epoch){const s=$('#batchStatus');if(s)s.textContent=window.fitlogAnalysisError?window.fitlogAnalysisError(e):'分析未成功，草稿已保留。'}}
  finally{if(requestId===job){batchBusy=false;if(getEpoch()===epoch&&$('#analyzeBatch'))$('#analyzeBatch').disabled=false}}
 }
 async function reanalyzeMeal(mi){
  if(batchBusy)return;const m=batchDraft.meals[mi];if(!m||!m.items.length)return;batchBusy=true;const requestId=++job,epoch=getEpoch();const s=$('#batchStatus');if(s)s.textContent=`正在重分析${m.mealType}…`;
  try{const r=await sync('analyzeFood',{foodText:JSON.stringify({mealType:m.mealType,items:m.items,notes:m.notes})});if(requestId!==job)return;if(!validResult(r))throw new Error('invalid result');m.result=r;persistBatch();if(getEpoch()===epoch)renderBatch()}
  catch(e){if(requestId===job&&getEpoch()===epoch){const st=$('#batchStatus');if(st)st.textContent=window.fitlogAnalysisError?window.fitlogAnalysisError(e):'分析未成功，草稿已保留。'}}finally{if(requestId===job)batchBusy=false}
 }
 function saveBatch(){
  const active=activeMeals();if(!active.length)return toast('未有可儲存餐點');const missing=active.filter(m=>!validResult(m.result));if(missing.length)return toast(`仲有 ${missing.length} 餐未完成分析`);if(!batchDraft.date)return toast('請選擇日期');
  active.forEach(m=>{const t=totalsFor(m.result);commit({date:batchDraft.date,type:m.mealType,items:m.result.items,...t,foodInput:m.items,notes:m.notes});rememberItems(m.items)});
  const count=active.length;localStorage.removeItem(BATCH_KEY);batchDraft=null;job++;batchBusy=false;closeSheet();toast(`已儲存 ${count} 餐`)
 }

 $('#manualMeal').onclick=open;$('#batchMeal').onclick=openBatch;
 $('#chooseFood').onclick=()=>{$('#foodFile').click()};
 $('#foodFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;const requestId=++job;openSheet('分析食物','<p class="food-help">分析相片中；AI 如繁忙會自動重試…</p>');const epoch=getEpoch();try{const imageBase64=await resizeImage(file);const r=await sync('analyzeFood',{imageBase64,mimeType:'image/jpeg'});if(requestId!==job)return;if(!validResult(r))throw new Error('invalid result');draft={...blank(),mealType:r.mealType||'午餐',items:r.items.map(i=>({...defaults(categoryFor(i.name),i.name),portion:i.portion,cookingMethod:i.cookingMethod,oil:i.oil})),result:r};persist();if(getEpoch()===epoch)render();else toast('相片分析已存草稿，稍後可繼續')}catch(e){if(requestId===job&&getEpoch()===epoch){closeSheet();toast(window.fitlogAnalysisError?window.fitlogAnalysisError(e):'分析失敗')}}finally{$('#foodFile').value=''}};
};
