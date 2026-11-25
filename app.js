"use strict";
/* ================================================================
   الطباعة
   ================================================================ */
function printDoc(html,page){
  $("print").innerHTML=html;
  $("pageStyle").textContent="@media print{@page{"+page+"}}";
  document.body.classList.add("printing");
  const done=()=>{document.body.classList.remove("printing");window.removeEventListener("afterprint",done)};
  window.addEventListener("afterprint",done);
  setTimeout(()=>{try{window.print()}catch(e){}setTimeout(done,1500)},60);
}
const P80="size:80mm auto;margin:3mm";
const PA4="size:A4;margin:12mm";
const ltr=s=>'<span dir="ltr">'+esc(s)+'</span>';
const contact=()=>[ME.shop_address?esc(ME.shop_address):"",ME.shop_phone?ltr(ME.shop_phone):""].filter(Boolean).join(" · ");
function shopHead(){return '<h2>'+esc(ME.shop_name)+'</h2>'+(contact()?'<div class="c">'+contact()+'</div>':'')}
function a4Head(title,sub){return '<div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:6px"><div><h1>'+esc(title)+'</h1><div>'+(sub||"")+'</div></div><div style="text-align:left"><b>'+esc(ME.shop_name)+'</b><br>'+contact()+'<br>'+dShow(Date.now())+'</div></div>'}

/* ملصق A6 للمنتج (من الدليل الأصلي) */
function printLabel(p){
  printDoc('<div class="lbl"><img src="'+img(p)+'" alt=""><div class="n">'+esc(p.name)+'</div><div class="code">'+(esc(locCode(p))||"—")+'</div>'+
    '<div class="boxes"><div>الرف<b>'+(esc(p.rack)||"&nbsp;")+'</b></div><div>الدرج<b>'+(esc(p.drawer)||"&nbsp;")+'</b></div><div>البوكس<b>'+(esc(p.box)||"&nbsp;")+'</b></div></div>'+
    '<div style="font-size:9pt">#'+p.id+(p.barcode?' · '+esc(p.barcode):'')+'</div></div>',"size:105mm 148mm;margin:5mm");
}
/* قائمة الممرات A4: كل ممر في ورقة */
function printAisles(){
  const g={};P.filter(has).forEach(p=>{const k=p.rack.charAt(0);(g[k]=g[k]||[]).push(p)});
  const keys=Object.keys(g).sort();if(!keys.length)return toast("ما فيش منتجات محدد مكانها",1);
  const cmp=(a,b)=>a.rack.localeCompare(b.rack,"en",{numeric:true})||(+a.drawer||0)-(+b.drawer||0)||(+a.box||0)-(+b.box||0);
  printDoc('<div class="a4">'+keys.map(k=>'<div class="pg">'+a4Head("ممر "+k,g[k].length+" منتج · الأدراج تترقم من تحت لفوق")+
    '<table><thead><tr><th>الرف</th><th>الدرج</th><th>البوكس</th><th>#</th><th>المنتج</th><th>الكمية</th></tr></thead><tbody>'+
    g[k].sort(cmp).map(p=>'<tr><td dir="ltr">'+esc(p.rack)+'</td><td>'+esc(p.drawer)+'</td><td>'+esc(p.box)+'</td><td>'+p.id+'</td><td>'+esc(p.name)+'</td><td>'+p.qty+'</td></tr>').join("")+'</tbody></table></div>').join("")+'</div>',PA4);
}

/* ================================================================
   المنتجات
   ================================================================ */
const VIEWS={};
const can=k=>!!(ME&&(ME.perms||[]).includes(k));
VIEWS.products=()=>{
  const placed=P.filter(has).length,val=isAdmin()?P.reduce((a,p)=>a+p.qty*(+p.cost||0),0):0;
  $("view").innerHTML='<div class="tools">'+searchBox("اسم المنتج، الرف (A1)، التصنيف أو الباركود…")+
    '<div class="chips">'+[["all","الكل"],["placed","محدد مكانه"],["unplaced","بدون مكان"],["low","قرّب يكمل"],["out","خالص"]].concat(isSeller()?[]:[["neg","بالسالب"],["off","موقوف"]]).map(([k,t])=>'<button class="chip" type="button" data-act="filt" data-f="'+k+'" aria-pressed="'+(FILT===k)+'">'+t+'</button>').join("")+'</div>'+
    '<div class="btns">'+catSelect()+(isAdmin()?'<button class="btn primary" type="button" data-act="newProduct">+ منتج جديد</button><button class="btn" type="button" data-act="labels">🏷️ ملصقات السعر</button>':'')+'<button class="btn" type="button" data-act="printAisles">🖨️ قائمة الممرات A4</button>'+(isAdmin()?'<button class="btn" type="button" data-act="xlsProducts">⬇️ Excel</button>':'')+'</div>'+
    '<div class="sub"><span>محدد مكانه <b>'+placed+'/'+P.length+'</b></span>'+(!isSeller()&&P.some(p=>p.qty<0)?'<button class="tag w" style="border:0;cursor:pointer" data-act="filt" data-f="neg">⚠️ '+P.filter(p=>p.qty<0).length+' منتج كميته بالسالب (بيع بدون نت): صلّحه بالجرد أو الشراء</button>':'')+(isAdmin()?'<span>قيمة المخزون بالتكلفة <b dir="ltr">'+fm(val)+'</b> '+cur()+'</span>':'')+'</div></div>'+
    '<div class="grid" id="pgrid"></div><div class="empty" id="pempty" hidden>ما لقيناش منتج. جرب كلمة أقصر.</div>';
  renderProductGrid();
};
ACT.filt=b=>{FILT=b.dataset.f;refresh()};
ACT.printAisles=()=>printAisles();
function renderProductGrid(){
  const g=$("pgrid");if(!g)return;const {list,terms}=matchProducts(P,true);
  const x=document.querySelector("#view .search .x");if(x)x.hidden=!Q;
  g.innerHTML=list.map(p=>'<div class="card'+(p.active?"":" off")+'" role="button" tabindex="0" data-act="product" data-id="'+p.id+'"><div class="ph"><img src="'+img(p)+'" alt="" loading="lazy"><span class="num">#'+p.id+'</span></div>'+
    '<div class="body"><div class="name">'+hl(p.name,terms)+(p.active?'':' <span class="tag">موقوف</span>')+'</div><div>'+locHTML(p)+'</div>'+
    '<div class="inv">'+qtyHTML(p)+(isStore()?'':'<span>بيع <b dir="ltr">'+(p.price>0?fm(p.price):"-")+'</b></span>')+'</div></div></div>').join("");
  $("pempty").hidden=list.length>0;
}
ACT.newProduct=()=>productDlg(null);
ACT.product=b=>productDlg(PB[+b.dataset.id]);
let CURP=null,PEND_IMG;
function productDlg(p){
  CURP=p;PEND_IMG=undefined;const r=ME.role,adm=r==="admin",nw=!p;p=p||{id:0,name:"",category:"",barcode:"",price:0,price_ws:0,qty:0,cost:0,min_qty:null,rack:"",drawer:"",box:"",note:"",active:true};
  let h='<div class="big"><img id="pImg" src="'+(nw?placeholder({id:0,name:"+"}):img(p))+'" alt=""></div>';
  if(r==="seller"){
    h+='<div class="sec"><h3>مكانه في المخزن</h3><div>'+locHTML(p)+'</div>'+(p.note?'<div class="hint">'+esc(p.note)+'</div>':'')+'</div>'+
      '<div class="sec"><div class="sub" style="font-size:.95rem;align-items:center"><span>المتوفر '+qtyHTML(p)+'</span><span>سعر البيع '+money(p.price)+' '+cur()+'</span>'+(p.price_ws>0?'<span>جملة '+money(p.price_ws)+'</span>':'')+'</div>'+(p.barcode?'<div class="hint">الباركود <span dir="ltr" class="mono">'+esc(p.barcode)+'</span></div>':'')+'</div>'+
      '<div class="btns"><button class="btn" data-act="label">🖨️ ملصق A6</button></div>';
    return openDlg(p.name,h);
  }
  h+='<form class="db" style="padding:0" data-form="product">';
  h+='<div class="sec"><h3>الصورة</h3><div class="btns"><label class="btn" style="display:inline-block;color:var(--ink);font-size:.95rem;cursor:pointer">📷 اختار صورة<input type="file" id="pFile" accept="image/*" hidden></label>'+(nw?'':'<button class="btn" type="button" data-act="imgDel">حذف الصورة</button>')+'<span class="msg" id="imgMsg"></span></div><div class="hint">من الكاميرا أو من الصور. تتصغر بروحها وتنحفظ مع "حفظ".</div></div>';
  if(adm){
    h+='<div class="sec"><h3>بيانات المنتج</h3><label>اسم المنتج<input class="f" name="name" value="'+esc(p.name)+'" autocomplete="off" required></label>'+
      '<div class="grid3"><label>التصنيف<input class="f" name="category" list="dlCats" value="'+esc(p.category)+'" autocomplete="off"></label><label>الباركود / الكود'+(CAM_OK?' <button class="link" type="button" data-act="camField" data-f="barcode">📷</button>':'')+'<input class="f" name="barcode" dir="ltr" value="'+esc(p.barcode||"")+'" autocomplete="off" data-noscan></label><label>حد التنبيه<input class="f" name="min_qty" inputmode="numeric" placeholder="'+esc(ME.default_min_qty)+'" value="'+(p.min_qty==null?"":p.min_qty)+'"></label></div>'+
      '<div class="grid2"><label>سعر البيع قطاعي ('+cur()+')<input class="f" name="price" inputmode="decimal" dir="ltr" value="'+(p.price||"")+'"></label><label>سعر البيع جملة (اختياري)<input class="f" name="price_ws" inputmode="decimal" dir="ltr" value="'+(p.price_ws||"")+'"></label></div>'+
      '<label class="chk"><input type="checkbox" name="off"'+(p.active?"":" checked")+'> موقوف: ما يطلعش في نقطة البيع</label></div>'+
      '<div class="sec"><h3>الكرتونة (اختياري)</h3><div class="grid3"><label>كم حبة في الكرتونة<input class="f" name="pack_qty" inputmode="numeric" placeholder="مثلاً 12" value="'+(p.pack_qty||"")+'"></label><label>سعر الكرتونة<input class="f" name="pack_price" inputmode="decimal" dir="ltr" placeholder="'+(p.price&&p.pack_qty?fm(p.price*p.pack_qty):"تلقائي")+'" value="'+(+p.pack_price||"")+'"></label><label>باركود الكرتونة'+(CAM_OK?' <button class="link" type="button" data-act="camField" data-f="pack_barcode">📷</button>':'')+'<input class="f" name="pack_barcode" dir="ltr" value="'+esc(p.pack_barcode||"")+'" autocomplete="off" data-noscan></label></div><div class="hint">المخزون يقعد بالحبة. بيع كرتونة ينقص من المخزون عدد حباتها. لو سعر الكرتونة فاضي يتحسب سعر الحبة × العدد.</div></div>';
    if(!nw){const G=grp(p);h+='<div class="sec"><h3>الأصناف (مقاس، لون…)</h3>'+(G.length>1?'<div class="list">'+G.map(v=>'<div class="row" tabindex="0" data-act="product" data-id="'+v.id+'"><span class="no">'+esc(v.variant||"أساسي")+'</span><span class="mid">'+esc(v.name)+'</span><span>'+qtyHTML(v)+'</span></div>').join("")+'</div>':'<div class="hint">كل صنف منتج بروحه بباركوده ومخزونه، وفي الكاشير يطلعوا تحت كرت واحد.</div>')+
      '<div class="grid2"><label>صنف جديد<input class="f" id="varName" placeholder="مثلاً: XL أو أحمر" autocomplete="off"></label><div class="btns" style="align-self:end"><button class="btn" type="button" data-act="addVariant">+ إضافة صنف</button></div></div></div>'}
    if(!nw)h+='<div class="sec"><h3>المخزون</h3><div class="sub" style="font-size:.95rem"><span>الكمية '+qtyHTML(p)+'</span><span>التكلفة '+money(p.cost)+'</span><span>القيمة '+money(p.qty*p.cost)+'</span><span>الربح في القطعة <b dir="ltr" class="'+(p.price&&p.price<p.cost?"neg":"")+'">'+(p.price?fm(p.price-p.cost):"-")+'</b></span></div><div class="hint">الكمية تنزاد بفاتورة شراء وتنقص بالبيع. للتالف والضايع وفرق الجرد استعمل التسوية.</div>'+
      '<div class="btns"><button class="btn" type="button" data-act="adjust">تسوية الجرد</button><button class="btn" type="button" data-act="moves">حركة الصنف</button><button class="btn" type="button" data-act="label">🖨️ ملصق A6</button></div></div>';
  }else{
    h+='<div class="sec"><h3>'+esc(p.name)+'</h3><div class="sub"><span>الكمية '+qtyHTML(p)+'</span></div><div class="btns"><button class="btn" type="button" data-act="moves">حركة الصنف</button><button class="btn" type="button" data-act="label">🖨️ ملصق A6</button></div></div>';
  }
  h+='<div class="sec"><h3>مكانه في المخزن</h3><div class="grid3"><label>الرف<input class="f" name="rack" dir="ltr" style="text-transform:uppercase" placeholder="A1" value="'+esc(p.rack)+'" autocomplete="off"></label><label>الدرج<input class="f" name="drawer" inputmode="numeric" placeholder="1" value="'+esc(p.drawer)+'"></label><label>البوكس<input class="f" name="box" inputmode="numeric" placeholder="1" value="'+esc(p.box)+'"></label></div>'+
    '<div class="hint">الرف يبدا بحرف إنجليزي (A1، B2). الأدراج تترقم من تحت لفوق: درج 1 هو اللي تحت خالص.</div><label>ملاحظة (اختياري)<textarea class="f" name="note" rows="2">'+esc(p.note)+'</textarea></label></div>';
  h+='<div class="sec"><div class="btns"><button class="btn primary">حفظ</button><span class="msg" id="pMsg"></span></div></div></form>';
  openDlg(nw?"منتج جديد":p.name,h);
}
ACT.label=()=>CURP&&printLabel(CURP);
ACT.addVariant=async()=>{const p=CURP,v=$("varName").value.trim();if(!v)return toast("اكتب اسم الصنف",1);const root=p.group_id||p.id,base=(PB[root]||p).name.replace(/\s*-\s*[^-]+$/,"");
  const r=await run(()=>api("product_save",{p:{name:base+" - "+v,category:p.category,price:p.price,price_ws:p.price_ws,group_id:root,variant:v}}),null,"pMsg");if(!r)return;
  await run(()=>loadProducts());refresh();productDlg(PB[r.id]);toast("انضاف الصنف ✓ زيد كميته بفاتورة شراء")};
document.addEventListener("change",e=>{
  if(e.target.id!=="pFile")return;const f=e.target.files[0];e.target.value="";if(!f)return;
  if(!/^image\//.test(f.type))return setMsg("imgMsg","الملف مش صورة","err");
  const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onerror=()=>setMsg("imgMsg","ما قدرناش نقرو الصورة","err");
    im.onload=()=>{const k=Math.min(1,640/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));
      const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);
      let q=.75,d=c.toDataURL("image/jpeg",q);while(d.length>380000&&q>.3){q-=.1;d=c.toDataURL("image/jpeg",q)}
      PEND_IMG=d;$("pImg").src=d;setMsg("imgMsg","الصورة جاهزة، اضغط حفظ","ok")};im.src=rd.result};rd.readAsDataURL(f);
});
ACT.imgDel=()=>{PEND_IMG="";$("pImg").src=placeholder(CURP||{id:0,name:"+"});setMsg("imgMsg","انحذفت، اضغط حفظ","ok")};
FORMS.product=async f=>{
  const m="pMsg";
  await run(async()=>{
    let id=CURP?CURP.id:null;
    if(isAdmin()){
      const r=await api("product_save",{p:{id,name:f.name.value,category:f.category.value,barcode:digits(f.barcode.value).trim(),price:f.price.value,price_ws:f.price_ws.value,
        min_qty:f.min_qty.value.trim()===""?null:f.min_qty.value,active:!f.off.checked,rack:f.rack.value,drawer:f.drawer.value,box:f.box.value,note:f.note.value,
        pack_qty:f.pack_qty.value.trim()===""?null:int(f.pack_qty.value),pack_price:pos(f.pack_price.value),pack_barcode:digits(f.pack_barcode.value).trim()}});
      id=r.id;
    }else await api("product_place",{p_id:id,p_rack:f.rack.value,p_drawer:f.drawer.value,p_box:f.box.value,p_note:f.note.value});
    if(PEND_IMG!==undefined){await api("product_image_set",{p_id:id,p_data:PEND_IMG});if(PEND_IMG){IMG[id]=PEND_IMG}else delete IMG[id];PEND_IMG=undefined}
    await loadProducts();CURP=PB[id];
    if(IMG[id]){const v=LS.get("imgv",{});if(LS.set("img_"+id,IMG[id])){v[id]=CURP.img_ver;LS.set("imgv",v)}}
    refresh();productDlg(CURP);setMsg("pMsg",CURP&&CURP.price&&CURP.price<CURP.cost?"تم الحفظ ✓ (انتبه: سعر البيع أقل من التكلفة)":"تم الحفظ ✓","ok");
  },null,m);
};
ACT.adjust=()=>{const p=CURP;openDlg2("تسوية جرد: "+p.name,'<form class="db" style="padding:0" data-form="adjust"><div class="sub"><span>الكمية في المنظومة <b>'+p.qty+'</b></span><span>التكلفة <b dir="ltr">'+fm(p.cost)+'</b></span></div>'+
  '<label>الكمية الصحيحة اللي في المخزن<input class="f" name="qty" inputmode="numeric" value="'+p.qty+'"></label>'+
  '<label>السبب<select class="f" name="reason">'+Object.keys(REASONS).map(k=>'<option value="'+k+'"'+(k==="count"?" selected":"")+'>'+REASONS[k]+'</option>').join("")+'</select></label>'+
  '<label id="adjCostL" hidden>تكلفة القطعة (لرصيد أول المدة)<input class="f" name="cost" inputmode="decimal" dir="ltr" value="'+(p.cost||"")+'"></label>'+
  '<label>ملاحظة<input class="f" name="note" autocomplete="off"></label><div class="hint">«رصيد أول المدة» لإدخال البضاعة اللي عندك قبل ما تبدا المنظومة. غيرها تتسجل خسارة أو زيادة في التقارير.</div>'+
  '<div class="btns"><button class="btn primary">تسجيل التسوية</button></div><span class="msg" id="adjMsg"></span></form>')};
document.addEventListener("change",e=>{if(e.target.name==="reason"&&e.target.form&&e.target.form.dataset.form==="adjust")$("adjCostL").hidden=e.target.value!=="opening"});
FORMS.adjust=async f=>{await run(async()=>{
  await api("stock_adjust",{p_id:CURP.id,p_new_qty:int(f.qty.value),p_reason:f.reason.value,p_note:f.note.value,p_cost:f.reason.value==="opening"&&f.cost.value.trim()!==""?pos(f.cost.value):null});
  await loadProducts();CURP=PB[CURP.id];$("dlg2").close();productDlg(CURP);refresh();toast("تمت التسوية ✓")},null,"adjMsg")};
const MOVEK={buy:"شراء",sale:"بيع",sale_ret:"مرتجع بيع",buy_ret:"مرتجع شراء",adjust:"تسوية",void:"إلغاء فاتورة"};
ACT.moves=async()=>{const p=CURP;const m=await run(()=>api("product_moves",{p_id:p.id}));if(!m)return;
  openDlg2("حركة الصنف: "+p.name,tbl([["التاريخ"],["الحركة"],["الكمية",1],["بعدها",1]],m.slice().reverse().map(x=>'<tr><td dir="ltr" style="text-align:right">'+tShow(x.at)+'</td><td class="nm" style="font-weight:400">'+MOVEK[x.kind]+(x.kind==="adjust"&&REASONS[x.note]?" · "+REASONS[x.note]:"")+'<small>'+esc(x.user||"")+'</small></td><td class="r '+(x.qty<0?"neg":"pos")+'">'+(x.qty>0?"+":"")+x.qty+'</td><td class="r">'+x.qty_after+'</td></tr>'),null,"ما فيش حركات."),"");};

/* ================================================================
   نقطة البيع
   ================================================================ */
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
const newCart=()=>({items:[],party:null,discount:"",note:"",cid:uid()});
let CART=newCart(), PF="all", PAY=null, LASTFLASH=0;
const saveCart=()=>ME&&LS.set("cart_"+ME.id,CART);
const cartParty=()=>CART.party?PARTIES.find(x=>x.id===CART.party):null;
const priceFor=(p,pt)=>pt&&pt.price_level==="ws"&&p.price_ws>0?+p.price_ws:+p.price;
const PK=p=>p&&p.pack_qty>1?+p.pack_qty:0;
const unitPrice=(p,pt,pack)=>{const b=priceFor(p,pt);if(!pack||!PK(p))return b;return p.pack_price>0&&!(pt&&pt.price_level==="ws"&&p.price_ws>0)?+p.pack_price:r3(b*PK(p))};
const perOf=c=>c.pack?PK(PB[c.id])||1:1;
const inCart=id=>CART.items.reduce((a,c)=>a+(c.id===id?c.qty*perOf(c):0),0);
const lineName=c=>{const p=PB[c.id]||{name:"؟"};return p.name+(c.pack?" (كرتونة ×"+PK(p)+")":"")};
function codeHit(c){c=digits(c).trim();if(!c)return null;let p=P.find(x=>x.barcode===c);if(p)return {p,pack:false};p=P.find(x=>x.pack_barcode===c);return p?{p,pack:true}:null}
const cartSub=()=>CART.items.reduce((a,c)=>a+c.qty*c.price,0);
let PROMOS=[];
async function loadPromos(){if(!isStore())PROMOS=await cached("promos_"+ME.id,()=>api("promo_list"))}
function promoFor(p,q,price){if(!p)return null;const today=new Date().toISOString().slice(0,10);let best=null;
  PROMOS.forEach(o=>{if(!o.active||(o.starts&&o.starts>today)||(o.ends&&o.ends<today))return;
    if(!(o.product_id===p.id||(p.group_id&&o.product_id===p.group_id)||(!o.product_id&&o.category&&o.category===p.category)))return;
    const d=o.kind==="pct"?r3(q*price*o.pct/100):Math.floor(q/(o.buy+o.get))*o.get*price;if(d>0&&(!best||d>best.d))best={d:r3(d),name:o.name}});return best}
const linePromo=c=>promoFor(PB[c.id],c.qty,c.price);
const cartPromo=()=>r3(CART.items.reduce((a,c)=>{const x=linePromo(c);return a+(x?x.d:0)},0));
const LV=()=>+(ME&&ME.loyalty_value)||0;
const cartPts=()=>{const pt=cartParty(),n=Math.min(int(CART.redeem),pt?+pt.points||0:0);return n>0&&LV()>0?{n,v:r3(Math.min(n*LV(),Math.max(0,cartSub()-pos(CART.discount)-cartPromo())))}:{n:0,v:0}};
const cartTotal=()=>r3(Math.max(0,cartSub()-pos(CART.discount)-cartPromo()-cartPts().v));
const cartCount=()=>CART.items.reduce((a,c)=>a+c.qty,0);
const sellable=p=>p.active&&p.qty>0&&(isAdmin()||p.price>0);
const DEV={get snd(){return LS.get("dev_snd",true)},get autoprint(){return LS.get("dev_print",false)},get name(){return LS.get("dev_name","")}};

/* صوت المسح */
let AC=null;
function beep(ok){if(!DEV.snd)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.type="square";o.frequency.value=ok?1250:220;g.gain.value=.06;o.connect(g);g.connect(AC.destination);const t=AC.currentTime;o.start(t);o.stop(t+(ok?.07:.25))}catch(e){}}

VIEWS.pos=()=>{
  $("posbar").hidden=true;
  if(isSeller()&&!SHIFT){
    $("view").innerHTML='<div class="panel" style="max-width:460px;margin:20px auto"><div class="ph2"><h2>افتح الوردية باش تبدا تبيع</h2></div><form class="pb" data-form="shiftOpen"><label>المبلغ اللي في الدرج توا ('+cur()+')<input class="f" name="cash" inputmode="decimal" dir="ltr" placeholder="0"></label><div class="btns"><button class="btn primary">فتح الوردية</button></div><span class="msg" id="soMsg"></span></form></div>';return}
  const keys='<div class="hint keys">اختصارات: <kbd>F2</kbd> دفع · <kbd>F4</kbd> تعليق · <kbd>F6</kbd> العميل · <kbd>F7</kbd> خصم · <kbd>F8</kbd> المعلقة · <kbd>F9</kbd> آخر فاتورة</div>';
  $("view").innerHTML='<div class="pos"><section class="pos-main"><div class="tools">'+searchBox("دوّر على المنتج أو امسح الباركود…")+
    '<div class="btns"><div class="chips">'+[["all","الكل"],["fav","المفضلة"],["top","الأكثر مبيعاً"]].map(([k,t])=>'<button class="chip" type="button" data-act="pf" data-f="'+k+'" aria-pressed="'+(PF===k)+'">'+t+'</button>').join("")+'</div>'+catSelect()+(CAM_OK?'<button class="btn" type="button" data-act="posCam">📷 كاميرا</button>':'')+'<button class="btn" type="button" data-act="custDisp" title="افتحها على الشاشة الثانية">🖥️ شاشة الزبون</button></div>'+
    (DEV.name?'':'<div class="hint">سمّي هالجهاز من «حسابي» (مثلاً: كاشير 1) باش تعرف كل فاتورة من أنهي جهاز.</div>')+'</div>'+
    '<div class="grid" id="sgrid"></div><div class="empty" id="sempty" hidden>ما لقيناش منتج.</div>'+keys+'</section>'+
    '<aside class="pos-cart" id="cartPanel" aria-label="السلة"></aside></div>';
  renderPosGrid();renderCart();
};
ACT.pf=b=>{PF=b.dataset.f;document.querySelectorAll('[data-act="pf"]').forEach(x=>x.setAttribute("aria-pressed",x===b));renderPosGrid()};
const grp=p=>p.group_id?P.filter(x=>x.group_id===p.group_id&&x.active):[];
function posList(){
  let L=P.filter(p=>p.active&&(Q||!p.group_id||p.group_id===p.id));
  if(PF==="fav")L=L.filter(p=>p.fav);
  if(PF==="top")L=L.filter(p=>p.sold30>0);
  L=L.slice().sort((a,b)=>(PF==="all"?(b.fav-a.fav):0)||(b.sold30||0)-(a.sold30||0)||a.name.localeCompare(b.name,"ar"));
  return L;
}
function tileHTML(p,terms,pt){const n=inCart(p.id),pr=priceFor(p,pt);
  const G=!Q&&p.group_id===p.id?grp(p):[];
  return '<div class="card'+(sellable(p)||G.length>1?"":" off")+'" role="button" tabindex="0" data-act="'+(G.length>1?"pickVar":"add")+'" data-id="'+p.id+'">'+(G.length>1?'<span class="vars">'+G.length+' أصناف</span>':'')+'<div class="ph"><img src="'+img(p)+'" alt="" loading="lazy">'+(p.fav?'<span class="num">★</span>':'')+'<span class="incart"'+(n?'':' hidden')+'>×'+n+'</span></div>'+
    '<div class="body"><div class="name">'+hl(p.name,terms)+'</div><div class="inv"><span class="price" dir="ltr">'+(pr>0?fm(pr):'<small style="font-family:var(--f-body)">بدون سعر</small>')+'</span>'+qtyHTML(p)+'</div>'+(PK(p)?'<button class="pkb" type="button" data-act="addPack" data-id="'+p.id+'">+ كرتونة ×'+PK(p)+' · <span dir="ltr">'+fm(unitPrice(p,pt,true))+'</span></button>':'')+'</div></div>'}
function renderPosGrid(){
  const g=$("sgrid");if(!g)return;const pt=cartParty();
  const {list,terms}=matchProducts(posList(),false);
  const x=document.querySelector("#view .search .x");if(x)x.hidden=!Q;
  g.innerHTML=list.slice(0,300).map(p=>tileHTML(p,terms,pt)).join("");
  $("sempty").hidden=list.length>0;
}
function badge(id){const c=document.querySelector('#sgrid .card[data-id="'+id+'"] .incart');if(c){const n=inCart(id);c.hidden=!n;c.textContent="×"+n}}

/* السلة: ظاهرة دايماً */
function renderCart(){
  const el=$("cartPanel");if(!el)return;
  const pt=cartParty(),n=cartCount(),sub=cartSub(),d=pos(CART.discount),tot=cartTotal(),held=LS.get("held_"+ME.id,[]).length,last=LS.get("last_sale_"+ME.id,null);
  el.innerHTML='<div class="pc-head" data-act="cartToggle"><b>السلة'+(n?' <span class="tag n">'+n+' قطعة</span>':'')+'</b>'+
      '<button class="pc-cust'+(pt?" on":"")+'" type="button" data-act="pickCust" title="F6">'+(pt?esc(pt.name)+(pt.price_level==="ws"?' · جملة':''):'بيع نقدي')+' ▾</button></div>'+
    '<div class="pc-lines" id="pcLines">'+(CART.items.length?CART.items.map((c,i)=>{const p=PB[c.id]||{name:"؟",qty:0};
      return '<div class="pl" data-i="'+i+'"><div class="nm" data-act="lineEdit" data-i="'+i+'" role="button" tabindex="0">'+esc(p.name)+(c.pack?' <span class="tag n">كرتونة ×'+PK(p)+'</span>':'')+'<small dir="ltr">'+fm(c.price)+(c.ov?' *':'')+'</small></div>'+
        '<div class="qs"><button type="button" data-act="qMinus" data-i="'+i+'" aria-label="نقّص">−</button><b>'+c.qty+'</b><button type="button" data-act="qPlus" data-i="'+i+'" aria-label="زيد">+</button></div>'+
        '<span></span><span class="lt" dir="ltr">'+fm(c.qty*c.price)+'</span>'+(linePromo(c)?'<span class="promo">🏷️ '+esc(linePromo(c).name)+' −<span dir="ltr">'+fm(linePromo(c).d)+'</span></span>':'')+'</div>'}).join(""):'<div class="none">امسح باركود أو اضغط على منتج.</div>')+'</div>'+
    '<div class="pc-foot">'+
      (pt?'<div class="sub"><span>رصيده '+money(pt.balance)+'</span>'+(pt.warn_limit>0&&+pt.balance+tot>pt.warn_limit?'<span class="tag w">يفوت سقف التنبيه</span>':'')+'</div>':'')+
      (cartPromo()?'<div class="sub"><span>🏷️ العروض</span><b dir="ltr">−'+fm(cartPromo())+'</b></div>':'')+(cartPts().n?'<div class="sub"><span>⭐ '+cartPts().n+' نقطة</span><b dir="ltr">−'+fm(cartPts().v)+'</b></div>':'')+
      '<div class="sub pc-extra"><span>المجموع '+money(sub)+'</span><button class="link" style="color:var(--accent)" type="button" data-act="disc" title="F7">'+(d?'الخصم '+fm(d):'+ خصم')+'</button></div>'+
      '<div class="pc-total"><span>الإجمالي</span><b dir="ltr">'+fm(tot)+'</b></div>'+
      '<button class="btn pay" type="button" data-act="pay"'+(CART.items.length?'':' disabled')+'>دفع <kbd>F2</kbd></button>'+
      '<div class="pc-btns pc-extra"><button class="btn sm" type="button" data-act="hold"'+(CART.items.length?'':' disabled')+'>تعليق</button><button class="btn sm" type="button" data-act="held"'+(held?'':' disabled')+'>المعلقة'+(held?' ('+held+')':'')+'</button><button class="btn sm" type="button" data-act="lastSale"'+(last?'':' disabled')+'>آخر فاتورة</button></div>'+
      (CART.items.length?'<button class="link pc-extra" type="button" data-act="cClear">تفريغ السلة</button>':'')+
    '</div>';
  saveCart();dispSend();
}
ACT.cartToggle=(b,e)=>{if(e.target.closest("button"))return;$("cartPanel").classList.toggle("open")};
function flashLine(id){const i=0;const r=document.querySelector('.pl[data-i="'+i+'"]');if(r){r.classList.remove("flash");void r.offsetWidth;r.classList.add("flash");r.scrollIntoView({block:"nearest"})}}
function addToCart(id,pack){
  const p=PB[id];if(!p)return false;pack=!!pack&&PK(p)>0;const per=pack?PK(p):1,over=inCart(id)+per>p.qty;
  const why=!p.active?"موقوف":!isAdmin()&&!(p.price>0)?"ما عندهش سعر بيع":over&&ONLINE?(isOut(p)?"خالص من المخزون":"المتوفر "+fm(Math.max(0,p.qty))+" حبة بس"):"";
  if(why){beep(false);toast("«"+p.name+"» "+why,1);return false}
  if(over)toast("بدون نت: «"+p.name+"» حسب آخر نسخة خالص. البيعة تتسجل، وصلّح الكمية بالجرد أو الشراء.",1);
  const c=CART.items.find(x=>x.id===id&&!!x.pack===pack);
  if(c){c.qty++;CART.items.splice(CART.items.indexOf(c),1);CART.items.unshift(c)}else CART.items.unshift({id,qty:1,price:unitPrice(p,cartParty(),pack),ov:false,pack});
  beep(true);renderCart();badge(id);flashLine(id);return true;
}
ACT.add=b=>addToCart(+b.dataset.id);
ACT.addPack=b=>addToCart(+b.dataset.id,true);
ACT.pickVar=b=>{const p=PB[+b.dataset.id],pt=cartParty();openDlg2(p.name.replace(/\s*-\s*[^-]+$/,"")||p.name,'<div class="list">'+grp(p).map(v=>'<div class="row" tabindex="0" data-act="addVar" data-id="'+v.id+'"><span class="no">'+esc(v.variant||"أساسي")+'</span><span class="mid">'+esc(v.name)+'<br>'+qtyHTML(v)+'</span><span class="tot" dir="ltr">'+fm(priceFor(v,pt))+'</span></div>').join("")+'</div>')};
ACT.addVar=b=>{if(addToCart(+b.dataset.id))$("dlg2").close()};
/* شاشة الزبون: نافذة ثانية على نفس الجهاز (شاشة ثانية) */
let DCH=null;try{DCH=new BroadcastChannel("lub-pos")}catch(e){}
function dispSend(x){if(!DCH||!ME)return;try{DCH.postMessage(x||{shop:ME.shop_name,cur:cur(),items:CART.items.map(c=>({n:lineName(c),q:c.qty,t:r3(c.qty*c.price)})),sub:cartSub(),off:r3(cartSub()-cartTotal()),total:cartTotal(),party:(cartParty()||{}).name||""})}catch(e){}}
ACT.custDisp=()=>{window.open(location.pathname+"?display=1","lubdisp","width=900,height=650");setTimeout(()=>dispSend(),800)};
function displayMode(){document.body.innerHTML='<div id="cd"><div class="cdh" id="cdShop">…</div><div id="cdItems"></div><div class="cdt"><span>الإجمالي</span><b id="cdTot" dir="ltr">0</b></div><div id="cdMsg" class="cdm">أهلاً وسهلاً</div></div>';
  const R=d=>{if(d.done){$("cdMsg").innerHTML="شكراً لزيارتكم"+(d.change>0?'<br>الباقي لك <b dir="ltr">'+fm(d.change)+'</b>':'');$("cdItems").innerHTML="";$("cdTot").textContent=fm(d.total);return}
    $("cdShop").textContent=d.shop;$("cdItems").innerHTML=d.items.slice(0,12).map(i=>'<div class="cdi"><span>'+esc(i.n)+' × '+i.q+'</span><b dir="ltr">'+fm(i.t)+'</b></div>').join("")+(d.items.length>12?'<div class="cdi"><span>…و'+(d.items.length-12)+' منتج</span></div>':'')+(d.off>0?'<div class="cdi off"><span>خصم وعروض</span><b dir="ltr">−'+fm(d.off)+'</b></div>':'');
    $("cdTot").textContent=fm(d.total)+" "+(d.cur||"");$("cdMsg").textContent=d.items.length?(d.party?"العميل: "+d.party:""):"أهلاً وسهلاً"};
  if(DCH)DCH.onmessage=e=>R(e.data)}
ACT.posCam=()=>camScan("مسح بالكاميرا",c=>scanCode(c),true);
function scanCode(code){const h=codeHit(code);if(h)return addToCart(h.p.id,h.pack);beep(false);toast("ما فيش منتج بالباركود "+digits(code).trim(),1);return false}
ACT.qPlus=b=>{const c=CART.items[+b.dataset.i],p=PB[c.id];if(p&&(inCart(c.id)+perOf(c)<=p.qty||!ONLINE))c.qty++;else{beep(false);toast("المتوفر "+fm(p?Math.max(0,p.qty):0)+" حبة بس",1)}renderCart();badge(c.id)};
ACT.qMinus=b=>{const i=+b.dataset.i,c=CART.items[i];if(c.qty>1)c.qty--;else CART.items.splice(i,1);renderCart();badge(c.id)};
ACT.cClear=()=>confirm2("تفريغ السلة","تنشال كل المنتجات من السلة.","تفريغ",()=>{const ids=CART.items.map(c=>c.id);CART=newCart();renderCart();ids.forEach(badge);renderPosGrid()},true);
FORMS.shiftOpen=async f=>{await run(async()=>{await api("shift_open",{p_opening:pos(f.cash.value)});await loadShift();route();toast("انفتحت الوردية ✓")},null,"soMsg")};

/* تعديل سطر */
ACT.lineEdit=b=>{const i=+b.dataset.i,c=CART.items[i],p=PB[c.id];if(!c)return;
  openDlg2(p?p.name:"سطر",'<form class="db" style="padding:0" data-form="line" data-i="'+i+'"><div class="sub"><span>المتوفر <b>'+(p?p.qty:0)+'</b> حبة</span><span>السعر الأصلي <b dir="ltr">'+fm(unitPrice(p,cartParty(),c.pack))+'</b></span></div>'+
    (PK(p)?'<label>الوحدة<select class="f" name="unit"><option value="0">حبة</option><option value="1"'+(c.pack?" selected":"")+'>كرتونة ('+PK(p)+' حبة)</option></select></label>':'')+
    '<label>الكمية<input class="f bigin" name="qty" inputmode="numeric" value="'+c.qty+'" autocomplete="off"></label>'+
    (can("price")?'<label>السعر لهالفاتورة<input class="f" name="price" inputmode="decimal" dir="ltr" value="'+c.price+'"></label>':'')+
    '<div class="btns"><button class="btn primary">حفظ</button><button class="btn danger" type="button" data-act="lineDel" data-i="'+i+'">حذف من السلة</button></div><span class="msg" id="lnMsg"></span></form>');
  setTimeout(()=>{const q=document.querySelector('#dlg2 [name=qty]');if(q){q.focus();q.select()}},50)};
FORMS.line=f=>{const i=+f.dataset.i,c=CART.items[i],p=PB[c.id],q=int(f.qty.value),pk=f.unit?f.unit.value==="1":!!c.pack,per=pk?PK(p)||1:1;
  if(q<1)return setMsg("lnMsg","⚠️ الكمية لازم 1 أو أكثر","err");
  if(p&&ONLINE&&inCart(c.id)-c.qty*perOf(c)+q*per>p.qty)return setMsg("lnMsg","⚠️ المتوفر "+Math.max(0,p.qty)+" حبة بس","err");
  if(pk!==!!c.pack){c.pack=pk;if(!c.ov)c.price=unitPrice(p,cartParty(),pk)}
  c.qty=q;if(f.price){const v=pos(f.price.value);if(!(v>0))return setMsg("lnMsg","⚠️ اكتب السعر","err");if(v!==c.price){c.price=v;c.ov=true}}
  $("dlg2").close();renderCart();badge(c.id)};
ACT.lineDel=b=>{const c=CART.items.splice(+b.dataset.i,1)[0];$("dlg2").close();renderCart();if(c)badge(c.id)};

/* الخصم على الفاتورة */
ACT.disc=()=>{if(!CART.items.length)return;const adm=isAdmin(),maxD=+ME.max_seller_discount_pct||0,sub=cartSub();
  if(!adm&&!maxD)return toast("الخصم مقفول للبائع، المدير يقدر يفتحه من الإعدادات",1);
  openDlg2("خصم على الفاتورة",'<form class="db" style="padding:0" data-form="disc"><div class="sub"><span>المجموع <b dir="ltr">'+fm(sub)+'</b></span>'+(adm?'':'<span>حدك '+maxD+'٪ = <b dir="ltr">'+fm(sub*maxD/100)+'</b></span>')+'</div>'+
    '<div class="grid2"><label>مبلغ<input class="f" name="amt" inputmode="decimal" dir="ltr" value="'+esc(CART.discount)+'"></label><label>أو نسبة ٪<input class="f" name="pct" inputmode="decimal" dir="ltr"></label></div>'+
    '<div class="btns"><button class="btn primary">تطبيق</button><button class="btn" type="button" data-act="discOff">بدون خصم</button></div><span class="msg" id="dsMsg"></span></form>');
  setTimeout(()=>{const a=document.querySelector('#dlg2 [name=amt]');if(a){a.focus();a.select()}},50)};
document.addEventListener("input",e=>{const f=e.target.form;if(!f||f.dataset.form!=="disc")return;if(e.target.name==="pct"){f.amt.value=e.target.value.trim()?r3(cartSub()*pos(e.target.value)/100):""}});
FORMS.disc=f=>{const d=r3(pos(f.amt.value)),sub=cartSub(),maxD=+ME.max_seller_discount_pct||0;
  if(d>sub)return setMsg("dsMsg","⚠️ الخصم أكبر من المجموع","err");
  if(!isAdmin()&&d>sub*maxD/100+0.0005)return setMsg("dsMsg","⚠️ أكبر من حدك ("+maxD+"٪)","err");
  CART.discount=d?String(d):"";$("dlg2").close();renderCart()};
ACT.discOff=()=>{CART.discount="";$("dlg2").close();renderCart()};

/* العميل: بحث بالاسم أو الهاتف، وإضافة سريعة */
ACT.pickCust=()=>{openDlg2("العميل",'<input class="f" id="cuQ" placeholder="ابحث بالاسم أو الهاتف…" autocomplete="off"><div class="list" id="cuList" style="max-height:46vh;overflow:auto"></div>'+
  '<details><summary class="hint" style="cursor:pointer">+ عميل جديد</summary><form class="db" style="padding:8px 0 0" data-form="quickCust"><div class="grid2"><label>الاسم<input class="f" name="name" autocomplete="off"></label><label>الهاتف<input class="f" name="phone" dir="ltr" inputmode="tel" autocomplete="off"></label></div><div class="btns"><button class="btn primary">إضافة واختياره</button></div><span class="msg" id="qcMsg"></span></form></details>');
  custList();setTimeout(()=>$("cuQ").focus(),50)};
function custList(){const q=norm(($("cuQ")||{}).value||""),dq=digits(($("cuQ")||{}).value||"").replace(/\D/g,"");
  const L=PARTIES.filter(x=>x.kind==="c"&&x.active&&(!q||norm(x.name).includes(q)||(dq&&digits(x.phone).replace(/\D/g,"").includes(dq)))).slice(0,40);
  $("cuList").innerHTML='<div class="row" tabindex="0" data-act="setCust" data-id="0"><span class="no">—</span><span class="mid">بيع نقدي (بدون عميل)</span><span></span></div>'+
    L.map(x=>'<div class="row" tabindex="0" data-act="setCust" data-id="'+x.id+'"><span class="no">'+(x.price_level==="ws"?"جملة":"عميل")+'</span><span class="mid"><b style="color:var(--ink)">'+esc(x.name)+'</b>'+(x.phone?' · <span dir="ltr">'+esc(x.phone)+'</span>':'')+'</span><span class="tot" dir="ltr">'+fm(x.balance)+'</span></div>').join("")}
document.addEventListener("input",e=>{if(e.target.id==="cuQ")custList()});
document.addEventListener("keydown",e=>{if(e.target.id==="cuQ"&&e.key==="Enter"){e.preventDefault();const r=document.querySelectorAll('#cuList .row')[1]||document.querySelector('#cuList .row');if(r)r.click()}});
function setCust(id){CART.party=id||null;const pt=cartParty();CART.items.forEach(c=>{const p=PB[c.id];if(p&&!c.ov)c.price=unitPrice(p,pt,c.pack)});
  if($("dlg2").open)$("dlg2").close();renderCart();renderPosGrid();if(PAY&&$("dlg").open&&$("dlgB").dataset.kind==="pay"){if(!pt&&PAY.mode==="credit")PAY.mode="cash";payRender()}}
ACT.setCust=b=>setCust(+b.dataset.id);
FORMS.quickCust=async f=>{const r=await run(()=>api("party_quick_add",{p_name:f.name.value,p_phone:f.phone.value}),null,"qcMsg");if(!r)return;PARTIES.push(r);setCust(r.id);toast("انضاف العميل ✓")};

/* الدفع */
ACT.pay=()=>{if(!CART.items.length)return;const pt=cartParty();PAY={mode:pt&&can("credit")?"credit":"cash",due:pt&&pt.terms_days>0?dueISO(pt.terms_days):"",tendered:"",split:{cash:"",card:"",transfer:""},paid:"",pmethod:"cash",field:"tendered"};payRender();
  const i=document.querySelector('#dlgB [data-pf]');if(i)i.focus();else{const g=$("payGo");if(g)g.focus()}};
function quickAmounts(t){const s=new Set();[1,5,10,20,50,100,200].forEach(d=>{const v=Math.ceil(t/d)*d;if(v>t+0.0005)s.add(v)});return [...s].sort((a,b)=>a-b).slice(0,4)}
function payState(){const tot=cartTotal(),pt=cartParty(),m=PAY.mode;let pays=[],ok=true,msg="",change=null,due=0;
  if(m==="cash"){const t=PAY.tendered.trim()===""?tot:pos(PAY.tendered);pays=[{method:"cash",amount:tot}];change=r3(t-tot);if(change<-0.0005){ok=false;msg="المبلغ المستلم أقل من الإجمالي"}}
  else if(m==="card"||m==="transfer")pays=[{method:m,amount:tot}];
  else if(m==="split"){pays=Object.keys(PAY.split).map(k=>({method:k,amount:r3(pos(PAY.split[k]))})).filter(x=>x.amount>0);const s=r3(pays.reduce((a,x)=>a+x.amount,0));due=r3(tot-s);
    if(!pt&&Math.abs(due)>0.0005){ok=false;msg=due>0?"باقي "+fm(due)+" ما اندفعش":"المدفوع أكبر من الإجمالي بـ "+fm(-due)}else if(due<-0.0005){ok=false;msg="المدفوع أكبر من الإجمالي"}}
  else if(m==="credit"){if(!pt){ok=false;msg="اختار العميل"}const a=r3(pos(PAY.paid));if(a>0)pays=[{method:PAY.pmethod,amount:a}];due=r3(tot-a);if(due<-0.0005){ok=false;msg="المدفوع أكبر من الإجمالي"}}
  if(ok&&pt&&due>0.0005&&!can("credit")){ok=false;msg="ما عندكش صلاحية البيع بالآجل: لازم يندفع كامل"}
  return {tot,pays,ok,msg,change,due,pt};}
const dueISO=d=>{const x=new Date();x.setDate(x.getDate()+(+d||0));return x.toISOString().slice(0,10)};
function payRender(){
  const st=payState(),m=PAY.mode,pt=st.pt;
  let h='<div class="paytot"><span>الإجمالي</span><b dir="ltr">'+fm(st.tot)+'</b><small>'+cur()+(pt?' · '+esc(pt.name):'')+'</small></div>';
  h+='<div class="chips paymodes">'+[["cash","نقدي"],["card","بطاقة"],["transfer","حوالة"],["split","مقسوم"]].concat(can("credit")?[["credit","آجل على عميل"]]:[]).map(([k,t])=>'<button class="chip" type="button" data-act="payMode" data-m="'+k+'" aria-pressed="'+(m===k)+'">'+t+'</button>').join("")+'</div>';
  if(m==="cash"){
    h+='<label>استلمت من الزبون<input class="f bigin" data-pf="tendered" inputmode="decimal" dir="ltr" placeholder="'+fm(st.tot)+'" value="'+esc(PAY.tendered)+'" autocomplete="off"></label>'+
      '<div class="quick"><button type="button" data-act="qAmt" data-v="">بالضبط</button>'+quickAmounts(st.tot).map(v=>'<button type="button" data-act="qAmt" data-v="'+v+'" dir="ltr">'+fm(v)+'</button>').join("")+'</div>'+keypad()+
      '<div class="change'+(st.change<-0.0005?" short":"")+'" id="payChange"><span>'+(st.change<-0.0005?"ناقص":"الباقي للزبون")+'</span><b dir="ltr">'+fm(Math.abs(st.change||0))+'</b></div>';
  }else if(m==="card"||m==="transfer"){
    h+='<div class="change"><span>المبلغ كامل '+(m==="card"?"بالبطاقة":"بالحوالة")+'</span><b dir="ltr">'+fm(st.tot)+'</b></div>';
  }else if(m==="split"){
    h+='<div class="grid3">'+["cash","card","transfer"].map(k=>'<label>'+METHODS[k]+'<input class="f" data-pf="split.'+k+'" inputmode="decimal" dir="ltr" value="'+esc(PAY.split[k])+'" placeholder="0" autocomplete="off"></label>').join("")+'</div>'+
      '<div class="btns"><button class="btn sm" type="button" data-act="splitRest">كمّل الباقي في الخانة اللي فيها المؤشر</button></div>'+keypad()+
      '<div class="change'+(Math.abs(st.due)>0.0005&&!pt?" short":"")+'" id="payChange"><span>'+(st.due>0.0005?(pt?"الباقي على حسابه":"باقي"):st.due<-0.0005?"زيادة":"مكتمل")+'</span><b dir="ltr">'+fm(Math.abs(st.due))+'</b></div>';
  }else if(m==="credit"){
    if(!pt)h+='<div class="msg err">اختار العميل الأول. <button class="btn sm" type="button" data-act="pickCust">اختيار العميل</button></div>';
    else h+='<div class="sub"><span>رصيده الحالي '+money(pt.balance)+'</span><span>بعد الفاتورة '+money(+pt.balance+st.due)+'</span>'+(pt.warn_limit>0&&+pt.balance+st.due>pt.warn_limit?'<span class="tag w">يفوت سقف التنبيه '+fm(pt.warn_limit)+'</span>':'')+'</div>'+
      '<div class="grid2"><label>المدفوع الآن<input class="f bigin" data-pf="paid" inputmode="decimal" dir="ltr" placeholder="0" value="'+esc(PAY.paid)+'" autocomplete="off"></label><label>طريقته<select class="f" id="payPM">'+Object.keys(METHODS).filter(k=>k!=="mixed").map(k=>'<option value="'+k+'"'+(PAY.pmethod===k?" selected":"")+'>'+METHODS[k]+'</option>').join("")+'</select></label></div>'+keypad()+
      '<div class="change" id="payChange"><span>يتسجل على حسابه</span><b dir="ltr">'+fm(Math.max(0,st.due))+'</b></div>'+
      '<label>تاريخ الاستحقاق (اختياري)<input class="f" type="date" id="payDue" value="'+esc(PAY.due||"")+'"></label>'+(pt.terms_days>0?'<div class="hint">مدة السداد للعميل '+pt.terms_days+' يوم</div>':'');
  }
  if(pt&&+pt.points>0&&LV()>0)h+='<label>⭐ استعمال نقاط (رصيده '+pt.points+' = <span dir="ltr">'+fm(pt.points*LV())+'</span>)<input class="f" id="payPts" inputmode="numeric" dir="ltr" value="'+(CART.redeem||"")+'" placeholder="0"></label>';
  h+='<label>ملاحظة (اختياري)<input class="f" id="payNote" value="'+esc(CART.note)+'" autocomplete="off"></label>'+
    '<button class="btn pay" type="button" data-act="confirmSale" id="payGo"'+(st.ok?'':' disabled')+'>تم البيع <kbd>Enter</kbd></button><span class="msg'+(st.ok?'':' err')+'" id="payMsg">'+esc(st.ok?"":st.msg)+'</span>';
  openDlg("الدفع",h,"narrow pay");$("dlgB").dataset.kind="pay";
}
function keypad(){return '<div class="keypad">'+["7","8","9","4","5","6","1","2","3",".","0","⌫"].map(k=>'<button type="button" data-act="key" data-k="'+k+'">'+k+'</button>').join("")+'</div>'}
function payField(){const k=PAY.field||"tendered";return document.querySelector('#dlgB [data-pf="'+k+'"]')}
function paySet(k,v){if(k.startsWith("split."))PAY.split[k.slice(6)]=v;else PAY[k]=v}
function payUpdate(){const st=payState(),c=$("payChange"),m=PAY.mode;
  if(c){let lbl,val,cls="";if(m==="cash"){lbl=st.change<-0.0005?"ناقص":"الباقي للزبون";val=Math.abs(st.change||0);cls=st.change<-0.0005?" short":""}
    else if(m==="split"){lbl=st.due>0.0005?(st.pt?"الباقي على حسابه":"باقي"):st.due<-0.0005?"زيادة":"مكتمل";val=Math.abs(st.due);cls=Math.abs(st.due)>0.0005&&!st.pt?" short":""}
    else{lbl="يتسجل على حسابه";val=Math.max(0,st.due)}
    c.className="change"+cls;c.innerHTML='<span>'+lbl+'</span><b dir="ltr">'+fm(val)+'</b>'}
  $("payGo").disabled=!st.ok;const pm=$("payMsg");pm.className="msg"+(st.ok?"":" err");pm.textContent=st.ok?"":st.msg}
document.addEventListener("focusin",e=>{const k=e.target.dataset&&e.target.dataset.pf;if(k&&PAY)PAY.field=k});
document.addEventListener("input",e=>{const k=e.target.dataset&&e.target.dataset.pf;if(!k||!PAY)return;paySet(k,e.target.value);payUpdate()});
document.addEventListener("change",e=>{if(e.target.id==="payPts"&&PAY){const pt=cartParty();CART.redeem=Math.max(0,Math.min(int(e.target.value),pt?+pt.points:0));renderCart();payRender()}if(e.target.id==="payDue"&&PAY)PAY.due=e.target.value;if(e.target.id==="payPM"&&PAY)PAY.pmethod=e.target.value;if(e.target.id==="payNote")CART.note=e.target.value});
ACT.payMode=b=>{PAY.mode=b.dataset.m;PAY.field=PAY.mode==="cash"?"tendered":PAY.mode==="credit"?"paid":"split.cash";payRender();setTimeout(()=>{const i=payField();if(i)i.focus()},40)};
ACT.qAmt=b=>{PAY.tendered=b.dataset.v;const i=payField();if(i)i.value=PAY.tendered;payUpdate();if(b.dataset.v==="")ACT.confirmSale($("payGo"))};
ACT.key=b=>{const i=payField();if(!i)return;let v=i.value;const k=b.dataset.k;
  if(k==="⌫")v=v.slice(0,-1);else if(k==="."){if(!v.includes("."))v=(v||"0")+"."}else v=(v==="0"?"":v)+k;
  i.value=v;paySet(PAY.field,v);payUpdate()};
ACT.splitRest=()=>{const k=(PAY.field||"split.cash");if(!k.startsWith("split."))return;const other=Object.keys(PAY.split).filter(x=>"split."+x!==k).reduce((a,x)=>a+pos(PAY.split[x]),0);
  const v=r3(Math.max(0,cartTotal()-other));paySet(k,String(v));const i=payField();if(i)i.value=v;payUpdate()};
$("dlg").addEventListener("close",()=>{if($("dlgB").dataset.kind==="pay")PAY=null;$("dlgB").dataset.kind=""});
ACT.confirmSale=async b=>{
  if(!PAY)return;const st=payState();if(!st.ok)return;
  const note=$("payNote")?$("payNote").value:CART.note;CART.note=note;
  const items=CART.items.map(c=>Object.assign({product_id:c.id,qty:c.qty},c.pack?{pack:true}:{},can("price")?{price:c.price}:{}));
  const tendered=PAY.mode==="cash"&&PAY.tendered.trim()!==""?pos(PAY.tendered):null,change=st.change;
  b.disabled=true;b.textContent="جاري الحفظ…";
  const payload={client_id:CART.cid,redeem:cartPts().n||0,due_date:st.pt&&PAY.due?PAY.due:null,party_id:st.pt?st.pt.id:null,discount:pos(CART.discount),payments:st.pays,tendered,note,items,device:DEV.name};
  let r;try{r=await api("sale_create",{p:payload})}
  catch(e){if(e.net)return queueOffline(payload,st,tendered,change);b.disabled=false;b.innerHTML='تم البيع <kbd>Enter</kbd>';beep(false);
    setMsg("payMsg","⚠️ "+e.message+(/النت/.test(e.message)?" البيعة ما تأكدتش: اضغط «تم البيع» مرة ثانية، وما تتسجلش مرتين.":""),"err");return}
  beep(true);
  Object.keys(r.stock||{}).forEach(id=>{if(PB[id])PB[id].qty=r.stock[id]});
  if(st.pt&&r.balance!=null)st.pt.balance=r.balance;
  const ids=CART.items.map(c=>c.id);CART=newCart();saveCart();PAY=null;
  LS.set("last_sale_"+ME.id,r.id);
  renderCart();renderPosGrid();ids.forEach(badge);
  dispSend({done:true,total:r.sale.total,change:tendered!=null&&change>0.0005?change:0});if(st.pt&&r.sale.points!=null)st.pt.points=r.sale.points;
  saleDlg(r.sale,true,tendered!=null&&change>0.0005?change:null);
  if(DEV.autoprint)setTimeout(()=>printDoc(receiptHTML(r.sale),P80),150);
  if(r.over_limit)toast("تنبيه: رصيد العميل فات سقف التنبيه",1);
  loadProducts().then(()=>{if(VIEW==="pos")renderPosGrid()}).catch(()=>{});
};
/* البيع بدون نت: البيعة تتخزن في الجهاز وتنبعث وحدها أول ما يرجع النت */
const OUTK=()=>"outbox_"+ME.id, outbox=()=>ME?LS.get(OUTK(),[]):[];
function queueOffline(payload,st,tendered,change){
  payload=Object.assign({},payload,{offline:true,at:new Date().toISOString()});
  const L=outbox();L.push({cid:payload.client_id,at:Date.now(),total:st.tot,party:st.pt?st.pt.name:"",p:payload});
  if(!LS.set(OUTK(),L)){beep(false);return setMsg("payMsg","⚠️ ذاكرة الجهاز ممتلية، ما قدرناش نخزنوا البيعة","err")}
  const items=CART.items.map(c=>({name:lineName(c),qty:c.qty,price:c.price,returned:0}));
  CART.items.forEach(c=>{const p=PB[c.id];if(p)p.qty-=c.qty*perOf(c)});LS.set("c_prod_"+ME.id,P);
  const paid=r3(st.pays.reduce((a,x)=>a+x.amount,0));if(st.pt)st.pt.balance=r3(+st.pt.balance+st.tot-paid);
  const fake={no:"—",at:new Date().toISOString(),user:ME.name,party:st.pt?st.pt.name:"",party_id:st.pt?st.pt.id:null,subtotal:cartSub(),discount:pos(CART.discount),
    total:st.tot,paid,pays:st.pays,tendered,status:"pending",offline:true,note:payload.note,items,returns:[],balance:st.pt?st.pt.balance:null};
  beep(true);const ids=CART.items.map(c=>c.id);CART=newCart();saveCart();PAY=null;
  renderCart();renderPosGrid();ids.forEach(badge);netPill();
  saleDlg(fake,true,tendered!=null&&change>0.0005?change:null);
  if(DEV.autoprint)setTimeout(()=>printDoc(receiptHTML(fake),P80),150);
}
function netPill(){const b=$("netPill");if(!b)return;const n=outbox().length,bad=outbox().filter(x=>x.err).length;
  b.hidden=ONLINE&&!n;b.className="pill"+(ONLINE?" warn":" off");
  b.textContent=(ONLINE?"⏳ ":"📴 بدون نت")+(n?(ONLINE?"":" · ")+n+" بيعة تستنى":"")+(bad?" · "+bad+" فيها مشكلة":"")}
let SYNCING=false;
async function syncOutbox(){
  if(SYNCING||!ME||!TOKEN||!outbox().length){netPill();return}
  SYNCING=true;let sent=0;
  try{for(const x of outbox()){if(x.err)continue;
    try{await api("sale_create",{p:x.p});sent++;LS.set(OUTK(),outbox().filter(y=>y.cid!==x.cid))}
    catch(e){if(e.net||!ME)break;const L=outbox(),y=L.find(z=>z.cid===x.cid);if(y){y.err=e.message;LS.set(OUTK(),L)}}}}
  finally{SYNCING=false;netPill()}
  if(sent){toast("انبعتت "+sent+" بيعة كانت بدون نت ✓");invalidate();Promise.all([loadProducts(),loadParties(),loadShift()]).then(()=>{if(VIEW==="pos")renderPosGrid()}).catch(()=>{})}
}
setInterval(()=>{if(ME&&outbox().length)syncOutbox()},30000);
ACT.outbox=()=>{const L=outbox();
  if(!L.length)return toast(ONLINE?"كل شي متبعت ✓":"النت مقطوع. تقدر تبيع عادي، والمبيعات تنبعث وحدها لما يرجع.");
  openDlg("مبيعات بدون نت",'<div class="hint">'+(ONLINE?"النت راجع، المبيعات تنبعث وحدها.":"النت مقطوع: المبيعات متخزنة في هالجهاز وتنبعث وحدها أول ما يرجع. ما تمسحش بيانات المتصفح.")+'</div><div class="list">'+
    L.map((x,i)=>'<div class="row" style="cursor:default"><span class="no">'+(i+1)+'</span><span class="mid"><span dir="ltr">'+tShow(x.at)+'</span>'+(x.party?' · '+esc(x.party):'')+(x.err?'<br><span class="tag w">'+esc(x.err)+'</span>':'')+'</span><span class="tot" dir="ltr">'+fm(x.total)+'</span>'+
      (x.err?'<span class="btns"><button class="btn sm" data-act="obRetry" data-i="'+i+'">عاود</button><button class="btn sm danger" data-act="obDrop" data-i="'+i+'">حذف</button></span>':'')+'</div>').join("")+'</div>'+
    '<div class="btns"><button class="btn primary" data-act="obSync">ابعتهم توا</button></div>')};
ACT.obSync=async()=>{await syncOutbox();if($("dlg").open)$("dlg").close();ACT.outbox()};
ACT.obRetry=b=>{const L=outbox(),x=L[+b.dataset.i];if(x)delete x.err;LS.set(OUTK(),L);ACT.obSync()};
ACT.obDrop=b=>confirm2("حذف بيعة ما انبعتتش","البيعة هذي ما تتسجلش في المنظومة أبداً، والفلوس اللي خذيتها لازم تتسجل بيدك. متأكد؟","حذف",()=>{const L=outbox();L.splice(+b.dataset.i,1);LS.set(OUTK(),L);netPill();$("dlg").close()},true);

/* الكاميرا كقارئ باركود (التلفون والتابلت) */
const CAM_OK="BarcodeDetector" in window&&!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
async function camScan(title,onCode,cont){
  if(!CAM_OK)return toast("هالمتصفح ما يقراش الباركود بالكاميرا. استعمل Chrome على التلفون أو التابلت.",1);
  openDlg2(title,'<div class="cam"><video id="camV" playsinline muted></video><div class="camline"></div></div><div class="hint" id="camH">وجّه الكاميرا على الباركود</div><div class="btns"><button class="btn primary" type="button" data-act="camStop">تم</button></div>');
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false})}
  catch(e){$("camH").textContent="ما قدرناش نفتحوا الكاميرا. اسمح للموقع يستعمل الكاميرا من إعدادات المتصفح.";return}
  let alive=true;const stop=()=>{alive=false;stream.getTracks().forEach(t=>t.stop())};
  $("dlg2").addEventListener("close",stop,{once:true});
  const v=$("camV");v.srcObject=stream;try{await v.play()}catch(e){}
  let det;try{const fmts=await BarcodeDetector.getSupportedFormats();det=new BarcodeDetector({formats:fmts.filter(f=>!/qr|aztec|data_matrix|pdf417/.test(f))})}catch(e){det=new BarcodeDetector()}
  let last="",lastT=0;
  const tick=async()=>{if(!alive)return;
    try{const r=await det.detect(v);if(r.length){const c=r[0].rawValue,now=Date.now();
      if(c!==last||now-lastT>1500){last=c;lastT=now;const ok=onCode(c);if($("camH"))$("camH").textContent=(ok===false?"✗ ":"✓ ")+c;if(!cont){$("dlg2").close();return}}}}catch(e){}
    setTimeout(tick,180)};
  tick();
}
ACT.camStop=()=>$("dlg2").close();
ACT.camField=b=>{const i=b.closest("form")[b.dataset.f];camScan("مسح الباركود",c=>{i.value=digits(c).trim();return true},false)};

ACT.lastSale=async()=>{const id=LS.get("last_sale_"+ME.id,null);if(id)await openSale(id)};

/* قارئ الباركود والاختصارات */
let scanBuf="",scanT=0;
const byCode=c=>{const h=codeHit(c);return h?h.p:null};
document.addEventListener("keydown",e=>{
  if(!ME||VIEW!=="pos"||(isSeller()&&!SHIFT)||$("app").hidden)return;
  const d1=$("dlg").open,kind=$("dlgB").dataset.kind,d2=$("dlg2").open;
  if(d1&&kind==="pay"&&!d2){
    if((e.key==="Enter"||e.key==="F2")&&!(e.target.tagName==="BUTTON"&&e.key==="Enter"&&$("dlg").contains(e.target))&&e.target.tagName!=="SELECT"){e.preventDefault();const g=$("payGo");if(g&&!g.disabled)ACT.confirmSale(g)}
    return}
  if(d1||d2)return;
  const fk={F2:"pay",F4:"hold",F6:"pickCust",F7:"disc",F8:"held",F9:"lastSale"}[e.key];
  if(fk){e.preventDefault();ACT[fk]();return}
  const t=e.target,inQ=t.id==="q";
  if(!inQ&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))return;
  if(e.key==="Enter"){
    if(inQ){const v=t.value,hit=codeHit(v);if(hit||/^\d{6,}$/.test(digits(v).trim())){e.preventDefault();e.stopPropagation();Q="";t.value="";scanCode(v);renderPosGrid()}return}
    const code=scanBuf;scanBuf="";if(code.length>=3){e.preventDefault();e.stopPropagation();scanCode(code)}return}
  if(inQ)return;
  if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const now=Date.now();if(now-scanT>120)scanBuf="";scanBuf+=e.key;scanT=now}
},true);

/* الفواتير المعلقة (تتخزن في هالجهاز) */
ACT.hold=()=>{if(!CART.items.length)return;const h=LS.get("held_"+ME.id,[]);h.push({at:Date.now(),cart:CART});LS.set("held_"+ME.id,h);const ids=CART.items.map(c=>c.id);CART=newCart();if($("dlg").open)$("dlg").close();renderCart();ids.forEach(badge);renderPosGrid();toast("تعلقت الفاتورة ✓")};
ACT.held=()=>{const h=LS.get("held_"+ME.id,[]);if(!h.length)return;
  openDlg("الفواتير المعلقة",'<div class="list">'+h.map((x,i)=>{const n=x.cart.items.reduce((a,c)=>a+c.qty,0),t=x.cart.items.reduce((a,c)=>a+c.qty*c.price,0)-pos(x.cart.discount);
    return '<div class="row" style="cursor:default"><span class="no">'+(i+1)+'</span><span class="mid"><span dir="ltr">'+tShow(x.at)+'</span> · '+n+' قطعة'+(x.cart.party?' · '+esc(pname(x.cart.party)):'')+'<br><b class="mono" dir="ltr" style="color:var(--ink)">'+fm(t)+'</b></span><span class="btns"><button class="btn sm primary" data-act="resume" data-i="'+i+'">رجّعها للسلة</button><button class="btn sm danger" data-act="dropHeld" data-i="'+i+'">حذف</button></span></div>'}).join("")+'</div>')};
ACT.resume=b=>{const h=LS.get("held_"+ME.id,[]),x=h.splice(+b.dataset.i,1)[0];if(!x)return;
  if(CART.items.length)h.push({at:Date.now(),cart:CART});
  CART=Object.assign(newCart(),x.cart);CART.items=CART.items.filter(c=>PB[c.id]);if(!CART.cid)CART.cid=uid();LS.set("held_"+ME.id,h);$("dlg").close();renderCart();renderPosGrid()};
ACT.dropHeld=b=>{const h=LS.get("held_"+ME.id,[]);h.splice(+b.dataset.i,1);LS.set("held_"+ME.id,h);renderCart();if(h.length)ACT.held();else $("dlg").close()};

/* الإيصال */
const mName=k=>METHODS[k]||(k==="mixed"?"مقسوم":k);
const salePays=s=>s.pays&&s.pays.length?s.pays:(s.paid>0?[{method:s.method,amount:s.paid}]:[]);
function payRows(s){const L=salePays(s),td2=v=>'<td style="text-align:left" dir="ltr">'+fm(v)+'</td>';
  let r=L.length?L.map(x=>'<tr><td>المدفوع '+mName(x.method)+'</td>'+td2(x.amount)+'</tr>').join(""):'<tr><td>المدفوع</td>'+td2(0)+'</tr>';
  if(s.tendered>0&&s.tendered>+s.paid+0.0005)r+='<tr><td>استلمنا</td>'+td2(s.tendered)+'</tr><tr><td>الباقي للزبون</td>'+td2(s.tendered-s.paid)+'</tr>';
  return r}
function receiptHTML(s){
  const off=s.offline?'<div class="c"><b>'+(s.no==="—"?"فاتورة مؤقتة (بدون نت) · رقمها يطلع لما تنبعت":"بيعة انعملت بدون نت")+'</b></div>':'';
  const rows=s.items.map(i=>'<tr><td>'+esc(i.name)+(i.promo?' <small>🏷️ '+esc(i.promo)+'</small>':'')+'<br>'+i.qty+' × '+fm(i.price)+(i.returned?' <small>(مرتجع '+i.returned+')</small>':'')+'</td><td style="text-align:left;vertical-align:bottom" dir="ltr">'+fm(i.qty*i.price)+'</td></tr>').join("");
  return '<div class="rc">'+shopHead()+'<hr><div style="display:flex;justify-content:space-between"><span>فاتورة <b dir="ltr">#'+s.no+'</b></span><span dir="ltr">'+tShow(s.at)+'</span></div>'+
    '<div>البائع: '+esc(s.user)+(s.party?' · العميل: '+esc(s.party):'')+'</div>'+off+(s.status==="void"?'<div class="c"><b>*** فاتورة ملغية ***</b></div>':'')+'<hr>'+
    '<table style="width:100%">'+rows+'</table><hr><table style="width:100%">'+
    (s.discount>0?'<tr><td>المجموع</td><td style="text-align:left" dir="ltr">'+fm(s.subtotal)+'</td></tr><tr><td>الخصم</td><td style="text-align:left" dir="ltr">'+fm(s.discount)+'</td></tr>':'')+
    (s.points_used>0?'<tr><td>منها نقاط مستعملة</td><td style="text-align:left" dir="ltr">'+s.points_used+'</td></tr>':'')+
    '<tr class="tot"><td>الإجمالي</td><td style="text-align:left" dir="ltr">'+fm(s.total)+' '+esc(cur())+'</td></tr>'+
    payRows(s)+
    (s.due_date&&s.total-s.paid>0.0005?'<tr><td>تاريخ الاستحقاق</td><td style="text-align:left" dir="ltr">'+dShow(s.due_date)+'</td></tr>':'')+(s.party_id?'<tr><td>الباقي على الحساب</td><td style="text-align:left" dir="ltr">'+fm(s.total-s.paid)+'</td></tr><tr><td>رصيد الحساب الآن</td><td style="text-align:left" dir="ltr">'+fm(s.balance)+'</td></tr>':'')+
    '</table>'+(s.returns&&s.returns.length?'<hr>'+s.returns.map(r=>'<div>مرتجع #'+r.no+' بتاريخ '+dShow(r.at)+': '+fm(r.total)+'</div>').join(""):'')+
    (s.points_earned>0||s.points_used>0?'<hr><div>⭐ نقاط هالفاتورة +'+s.points_earned+(s.points!=null?' · رصيدك '+s.points+' نقطة':'')+'</div>':'')+(s.note?'<hr><div>'+esc(s.note)+'</div>':'')+'<hr><div class="c">'+esc(ME.receipt_footer||"")+'</div></div>';
}
function waPhone(ph){let d=digits(ph).replace(/\D/g,"");if(!d)return "";if(d.startsWith("00"))d=d.slice(2);else if(d.startsWith("0"))d="218"+d.slice(1);return d}
function receiptText(s){return ME.shop_name+"\nفاتورة #"+s.no+" · "+tShow(s.at)+"\n"+s.items.map(i=>"- "+i.name+" "+i.qty+"×"+fm(i.price)+" = "+fm(i.qty*i.price)).join("\n")+
  (s.discount>0?"\nالخصم: "+fm(s.discount):"")+"\nالإجمالي: "+fm(s.total)+" "+cur()+"\n"+salePays(s).map(x=>"المدفوع "+mName(x.method)+": "+fm(x.amount)).join("\n")+(s.party_id?"\nالباقي على الحساب: "+fm(s.total-s.paid)+"\nرصيدك الآن: "+fm(s.balance):"")+"\n"+(ME.receipt_footer||"")}

/* ================================================================
   الفواتير
   ================================================================ */
let INVC=null, INVF={user:"",party:"",status:""};
const invalidate=()=>{INVC=null;REPC=null;BUYC=null;ALLD=null;LEDALL=null;AUD=null;if(typeof POC!=="undefined")POC=null};
VIEWS.invoices=async()=>{
  const adm=isAdmin(),[f,t]=rangeISO(),key=f+"|"+t;
  if(!INVC||INVC.key!==key){
    $("view").innerHTML=rangeHTML()+'<div class="none">جاري التحميل…</div>';
    const d=await run(()=>adm?api("report_data",{p_from:f,p_to:t}).then(r=>r.sales):api("my_sales",{p_from:f,p_to:t}));if(!d)return;
    INVC={key,data:d};if(VIEW!=="invoices")return;
  }
  let list=INVC.data.slice().reverse();
  if(adm){if(INVF.user)list=list.filter(s=>s.user_id===+INVF.user);
    if(INVF.party==="cash")list=list.filter(s=>!s.party_id);else if(INVF.party==="credit")list=list.filter(s=>s.party_id);else if(INVF.party)list=list.filter(s=>s.party_id===+INVF.party)}
  if(INVF.status)list=list.filter(s=>s.status===INVF.status);
  const ok=list.filter(s=>s.status==="ok"),tot=ok.reduce((a,s)=>a+ +s.total,0);
  $("view").innerHTML=rangeHTML()+
    '<form class="tools" data-form="findSale"><div class="btns"><input class="f" name="no" inputmode="numeric" placeholder="رقم الفاتورة" style="width:150px;flex:none" dir="ltr"><button class="btn">فتح الفاتورة</button></div></form>'+
    (adm?'<div class="grid4" style="margin-bottom:14px"><label>المستخدم<select class="f" data-invf="user"><option value="">الكل</option>'+USERS.map(u=>'<option value="'+u.id+'"'+(INVF.user==u.id?" selected":"")+'>'+esc(u.name)+'</option>').join("")+'</select></label>'+
      '<label>العميل<select class="f" data-invf="party"><option value="">الكل</option><option value="cash"'+(INVF.party==="cash"?" selected":"")+'>نقدي بس</option><option value="credit"'+(INVF.party==="credit"?" selected":"")+'>على حساب عميل</option>'+PARTIES.filter(x=>x.kind==="c").map(x=>'<option value="'+x.id+'"'+(INVF.party==x.id?" selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label>'+
      '<label>الحالة<select class="f" data-invf="status"><option value="">الكل</option><option value="ok"'+(INVF.status==="ok"?" selected":"")+'>سليمة</option><option value="void"'+(INVF.status==="void"?" selected":"")+'>ملغية</option></select></label></div>':'')+
    '<div class="kpis">'+kpi(adm?"المبيعات":"مبيعاتي",fm(tot),rangeLabel(),"main")+kpi("عدد الفواتير",ok.length,list.length-ok.length?(list.length-ok.length)+" ملغية":"")+kpi("نقدي",fm(ok.reduce((a,s)=>a+salePays(s).filter(x=>x.method==="cash").reduce((b,x)=>b+ +x.amount,0),0)),"المدفوع نقداً")+'</div>'+
    '<div class="panel"><div class="list">'+(list.length?list.map(s=>{const n=s.items.reduce((a,i)=>a+i.qty*(i.per||1),0),ret=s.items.some(i=>i.returned);
      return '<div class="row'+(s.status==="void"?" void":"")+'" tabindex="0" data-act="openSale" data-id="'+s.id+'"><span class="no" dir="ltr">#'+s.no+'</span><span class="mid"><span dir="ltr">'+tShow(s.at)+'</span> · '+n+' قطعة · '+mName(s.method)+(adm?' · '+esc(uname(s.user_id)):'')+(s.party_id?' · '+esc(pname(s.party_id)):'')+(s.status==="void"?' <span class="tag">ملغية</span>':'')+(ret?' <span class="tag w">فيها مرتجع</span>':'')+'</span><span class="tot" dir="ltr">'+fm(s.total)+'</span></div>'}).join(""):'<div class="none">ما فيش فواتير في هالفترة.</div>')+'</div></div>';
};
document.addEventListener("change",e=>{const k=e.target.dataset.invf;if(!k)return;INVF[k]=e.target.value;refresh()});
FORMS.findSale=async f=>{const n=int(f.no.value);if(!n)return;const id=await run(()=>api("sale_find",{p_no:n}));if(id)openSale(id)};
ACT.openSale=b=>openSale(+b.dataset.id);
async function openSale(id){const s=await run(()=>api("sale_get",{p_id:id}));if(s)saleDlg(s)}
let CURS=null;
function saleDlg(s,fresh,change){
  $("dlgB").dataset.kind="";CURS=s;const adm=isAdmin(),canRet=can("returns")&&s.status==="ok"&&s.items.some(i=>i.qty>i.returned),pt=s.party_id?PARTIES.find(x=>x.id===s.party_id):null,ph=pt&&pt.phone;
  openDlg((fresh?"تم البيع ✓ · ":"")+"فاتورة #"+s.no,
    (change!=null?'<div class="change big"><span>رجّع للزبون</span><b dir="ltr">'+fm(change)+'</b></div>':'')+
    (fresh?'<div class="msg ok" style="text-align:center;font-weight:600">انخصمت الكميات من المخزون'+(s.party_id?' وتسجلت على حساب «'+esc(s.party)+'»':'')+'</div>':'')+
    '<div class="rcbox">'+receiptHTML(s)+'</div>'+
    '<div class="btns" style="justify-content:center"><button class="btn primary" data-act="printSale">🖨️ طباعة</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/'+(ph?waPhone(ph):"")+'?text='+encodeURIComponent(receiptText(s))+'">واتساب'+(ph?" للعميل":"")+'</a>'+
    (canRet?'<button class="btn" data-act="saleReturn">مرتجع</button>':'')+(can("void")&&s.status==="ok"&&!s.returns.length?'<button class="btn danger" data-act="saleVoid">إلغاء الفاتورة</button>':'')+(fresh?'<button class="btn" data-act="close" id="newSale">بيع جديد <kbd>Enter</kbd></button>':'')+'</div>');
  if(fresh)setTimeout(()=>{const b=$("newSale");if(b)b.focus()},60);
}
ACT.printSale=()=>CURS&&printDoc(receiptHTML(CURS),P80);
ACT.saleVoid=()=>confirm2("إلغاء فاتورة #"+CURS.no,"الكميات ترجع للمخزون، والفاتورة تنشال من حساب العميل، والمبلغ المدفوع يطلع من الدرج. متأكد؟","إلغاء الفاتورة",async()=>{
  const ok=await run(()=>api("sale_void",{p_sale:CURS.id}),null,"c2Msg");if(ok===undefined)return false;
  invalidate();await run(()=>Promise.all([loadProducts(),loadParties(),loadShift()]));await openSale(CURS.id);refresh();toast("انلغت الفاتورة ✓")},true);
ACT.saleReturn=()=>{const s=CURS,cr=!!s.party_id;
  openDlg("مرتجع من فاتورة #"+s.no,'<form class="db" style="padding:0" data-form="saleReturn"><div class="hint">اكتب كمية كل منتج راجع. اللي ما رجعش خليه صفر.'+(s.discount>0?' الخصم يتوزع على القطع بالنسبة.':'')+'</div>'+
    s.items.map(i=>{const left=i.qty-i.returned;return '<div class="line"><div class="top"><div><b>'+esc(i.name)+'</b><small>انباع '+i.qty+(i.returned?' · رجع قبل '+i.returned:'')+' · السعر '+fm(i.price)+'</small></div></div><label>الكمية الراجعة (حدها '+left+')<input class="f" name="q'+i.id+'" inputmode="numeric" value="0"'+(left?"":" readonly")+'></label></div>'}).join("")+
    (cr?'<div class="sec"><div class="hint">الفاتورة على حساب «'+esc(s.party)+'»: قيمة المرتجع تنقص من حسابه. لو رجعتله فلوس في يده اكتبها هنا.</div><div class="grid2"><label>رجعتله فلوس<input class="f" name="refund" inputmode="decimal" dir="ltr" placeholder="0"></label><label>طريقتها<select class="f" name="method">'+Object.keys(METHODS).map(k=>'<option value="'+k+'">'+METHODS[k]+'</option>').join("")+'</select></label></div></div>':
      (s.method==="mixed"?'<div class="hint">بيع نقدي بدفع مقسوم: اختار كيف ترجع قيمة المرتجع للزبون.</div><label>طريقة الإرجاع<select class="f" name="method">'+Object.keys(METHODS).map(k=>'<option value="'+k+'">'+METHODS[k]+'</option>').join("")+'</select></label>':
      '<div class="hint">بيع نقدي: قيمة المرتجع ترجع للزبون '+METHODS[s.method]+'.</div><input type="hidden" name="method" value="'+s.method+'">'))+
    '<label>ملاحظة<input class="f" name="note" autocomplete="off"></label><div class="btns"><button class="btn primary">تسجيل المرتجع</button><button class="btn" type="button" data-act="backSale">رجوع</button></div><span class="msg" id="srMsg"></span></form>')};
ACT.backSale=()=>saleDlg(CURS);
FORMS.saleReturn=async f=>{const s=CURS,items=s.items.map(i=>({item_id:i.id,qty:int(f["q"+i.id].value)})).filter(x=>x.qty>0);
  if(!items.length)return setMsg("srMsg","⚠️ اكتب كمية واحدة على الأقل","err");
  const r=await run(()=>api("sale_return",{p:{sale_id:s.id,items,refund:f.refund?pos(f.refund.value):null,method:f.method.value,note:f.note.value}}),null,"srMsg");if(!r)return;
  invalidate();await run(()=>Promise.all([loadProducts(),loadParties(),loadShift()]));await openSale(s.id);refresh();toast("تسجل المرتجع #"+r.no+" بقيمة "+fm(r.total)+(r.refund?" ورجع للزبون "+fm(r.refund):""))};

/* ================================================================
   الوردية والمصروفات
   ================================================================ */
const CASHK={sale:"مبيعات",collect:"تحصيل من عملاء",refund:"مرتجعات للزبائن",expense:"مصروفات",supplier_pay:"دفعات لموردين",purchase:"مشتريات",supplier_refund:"مرتجع من موردين",void:"فواتير ملغية"};
const EXPC=["إيجار","مرتبات","كهرباء","مياه","إنترنت وهاتف","نقل وتوصيل","صيانة","نظافة","ضيافة","أخرى"];
function shiftMoves(s){return tbl([["الحركة"],["الطريقة"],["عدد",1],["المبلغ",1]],s.moves.map(m=>'<tr><td>'+(CASHK[m.kind]||m.kind)+'</td><td>'+METHODS[m.method]+'</td><td class="r">'+m.n+'</td><td class="r '+(m.amount<0?"neg":"")+'">'+fm(m.amount)+'</td></tr>'),null,"ما فيش حركات فلوس لتوا.")}
function shiftHTML(s){return '<div class="sub"><span>فتحها '+esc(s.user)+'</span><span dir="ltr">'+tShow(s.opened_at)+'</span>'+(s.closed_at?'<span>قفلها <span dir="ltr">'+tShow(s.closed_at)+'</span></span>':'')+'</div>'+
  '<div class="sub"><span>افتتاحي '+money(s.opening_cash)+'</span><span>المتوقع في الدرج '+money(s.expected_cash)+'</span>'+(s.closed_at?'<span>اللي انعد '+money(s.counted_cash)+'</span><span>الفرق <b dir="ltr" class="mono '+(s.diff<0?"neg":s.diff>0?"pos":"")+'">'+fm(s.diff)+'</b></span>':'')+'</div>'+shiftMoves(s)+
  '<div class="hint">المتوقع في الدرج = الافتتاحي + كل حركة نقدية. البطاقة والحوالة ما يدخلوش الدرج.</div>'}
function shiftPrint(s){printDoc('<div class="rc">'+shopHead()+'<hr><div class="c"><b>تقرير وردية #'+s.id+'</b></div><div>'+esc(s.user)+'</div><div dir="ltr" style="text-align:right">'+tShow(s.opened_at)+(s.closed_at?' → '+tShow(s.closed_at):'')+'</div><hr><table style="width:100%">'+
  s.moves.map(m=>'<tr><td>'+(CASHK[m.kind]||m.kind)+' ('+METHODS[m.method]+')</td><td style="text-align:left" dir="ltr">'+fm(m.amount)+'</td></tr>').join("")+'</table><hr><table style="width:100%"><tr><td>افتتاحي</td><td style="text-align:left" dir="ltr">'+fm(s.opening_cash)+'</td></tr><tr class="tot"><td>المتوقع في الدرج</td><td style="text-align:left" dir="ltr">'+fm(s.expected_cash)+'</td></tr>'+
  (s.closed_at?'<tr><td>اللي انعد</td><td style="text-align:left" dir="ltr">'+fm(s.counted_cash)+'</td></tr><tr class="tot"><td>الفرق</td><td style="text-align:left" dir="ltr">'+fm(s.diff)+'</td></tr>':'')+'</table>'+(s.note?'<hr>'+esc(s.note):'')+'</div>',P80)}
let CURSH=null;
ACT.shift=async()=>{
  await run(loadShift);
  if(!SHIFT)return openDlg("الوردية",'<form class="db" style="padding:0" data-form="shiftOpen2"><div class="hint">'+(isAdmin()?"المدير يقدر يبيع بدون وردية، لكن الوردية تخليك تعرف شن لازم يكون في الدرج.":"لازم تفتح الوردية قبل البيع واستلام الفلوس.")+'</div><label>المبلغ اللي في الدرج توا<input class="f" name="cash" inputmode="decimal" dir="ltr" placeholder="0"></label><div class="btns"><button class="btn primary">فتح الوردية</button></div><span class="msg" id="so2Msg"></span></form>');
  CURSH=SHIFT;
  openDlg("الوردية المفتوحة",shiftHTML(SHIFT)+
    '<form class="sec" data-form="expense"'+(can("expenses")?'':' hidden')+'><h3>تسجيل مصروف</h3><div class="grid3"><label>النوع<input class="f" name="cat" list="dlExp" autocomplete="off" placeholder="نقل وتوصيل"></label><label>المبلغ<input class="f" name="amount" inputmode="decimal" dir="ltr"></label><label>الطريقة<select class="f" name="method">'+Object.keys(METHODS).map(k=>'<option value="'+k+'">'+METHODS[k]+'</option>').join("")+'</select></label></div><label>ملاحظة<input class="f" name="note" autocomplete="off"></label><div class="btns"><button class="btn">تسجيل المصروف</button><span class="msg" id="exMsg"></span></div></form>'+
    '<form class="sec" data-form="shiftClose"><h3>إقفال الوردية</h3><div class="hint">عد الفلوس اللي في الدرج واكتبها. المنظومة تحسب الفرق.</div><label>المبلغ اللي في الدرج فعلاً<input class="f" name="counted" inputmode="decimal" dir="ltr"></label><label>ملاحظة<input class="f" name="note" autocomplete="off"></label><div class="btns"><button class="btn primary">إقفال الوردية</button><button class="btn" type="button" data-act="printShift">🖨️ طباعة الحالة</button></div><span class="msg" id="scMsg"></span></form>');
  $("dlExp").innerHTML=EXPC.map(c=>'<option value="'+c+'">').join("");
};
FORMS.shiftOpen2=async f=>{await run(async()=>{await api("shift_open",{p_opening:pos(f.cash.value)});await loadShift();$("dlg").close();route();toast("انفتحت الوردية ✓")},null,"so2Msg")};
FORMS.expense=async f=>{const a=pos(f.amount.value);if(!f.cat.value.trim()||!a)return setMsg(f.querySelector(".msg"),"⚠️ اكتب النوع والمبلغ","err");
  const ok=await run(()=>api("expense_add",{p_category:f.cat.value,p_amount:a,p_method:f.method.value,p_note:f.note.value}),null,f.querySelector(".msg"));
  if(ok===undefined)return;invalidate();if(f.closest("#dlg")&&SHIFT){await ACT.shift();toast("تسجل المصروف ✓")}else{f.reset();setMsg(f.querySelector(".msg"),"تسجل المصروف ✓","ok");REPC=null;refresh()}};
FORMS.shiftClose=async f=>{if(f.counted.value.trim()==="")return setMsg("scMsg","⚠️ اكتب المبلغ اللي عديته","err");
  const s=await run(()=>api("shift_close",{p_counted:pos(f.counted.value),p_note:f.note.value}),null,"scMsg");if(!s)return;
  SHIFT=null;shiftPill();invalidate();route();CURSH=s;
  openDlg("انقفلت الوردية ✓",shiftHTML(s)+'<div class="btns"><button class="btn primary" data-act="printShift">🖨️ طباعة تقرير الوردية</button></div>')};
ACT.printShift=()=>CURSH&&shiftPrint(CURSH);

/* ================================================================
   المشتريات
   ================================================================ */
let BL=[], BUYH={sup:"",ref:"",method:"cash",paid:"",note:""}, BUYC=null;
const bline=()=>({name:"",qty:"",cost:"",price:"",price_ws:"",rack:"",drawer:"",box:""});
const findP=v=>{const n=norm(v);return n?(P.find(p=>p.n===n)||byCode(v)):null};
VIEWS.buy=async()=>{
  if(!BL.length)BL=[bline()];
  const sups=PARTIES.filter(x=>x.kind==="s"&&x.active);
  const inp=(i,k,ph,ex)=>'<input class="f" data-b="'+k+'" data-i="'+i+'" value="'+esc(BL[i][k])+'" placeholder="'+ph+'" autocomplete="off" '+(ex||"")+'>';
  $("view").innerHTML=(BUYH.po?'<div class="msg ok" style="margin-bottom:10px">استلام أمر الشراء #'+BUYH.pono+': راجع الكميات والأسعار اللي وصلت فعلاً واحفظ. <button class="link" data-act="poUnlink">إلغاء الربط</button></div>':'')+'<div class="panel"><div class="ph2"><h2>فاتورة شراء جديدة</h2><span class="hint">الكميات تنزاد للمخزون أول ما تحفظ</span></div><form class="pb" data-form="purchase">'+
    '<div class="grid2"><label>المورد<select class="f" data-bh="sup"><option value="">شراء نقدي بدون مورد</option>'+sups.map(x=>'<option value="'+x.id+'"'+(BUYH.sup==x.id?" selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label>'+
    '<label>رقم فاتورة المورد (اختياري)<input class="f" data-bh="ref" dir="ltr" value="'+esc(BUYH.ref)+'" autocomplete="off"></label></div>'+
    '<div style="display:grid;gap:10px">'+BL.map((l,i)=>'<div class="line" data-bl="'+i+'"><div class="top"><b>المنتج '+(i+1)+'</b>'+(BL.length>1?'<button class="link" type="button" data-act="bDel" data-i="'+i+'">حذف السطر</button>':'')+'</div>'+
      '<label>الاسم أو الباركود'+inp(i,"name","اكتب الاسم أو امسح الباركود",'list="dlProducts"')+'</label><div class="hint" data-bst="'+i+'"></div>'+
      '<label class="chk" data-bpkl="'+i+'"'+(PK(findP(l.name))?'':' hidden')+'><input type="checkbox" data-bpk="'+i+'"'+(l.pk?" checked":"")+'> بالكرتونة (الكمية والتكلفة للكرتونة)</label>'+
      '<div class="grid3"><label>الكمية'+inp(i,"qty","0",'inputmode="numeric"')+'</label><label>سعر التكلفة'+inp(i,"cost","0.00",'inputmode="decimal" dir="ltr"')+'</label><label>سعر البيع'+inp(i,"price","اختياري",'inputmode="decimal" dir="ltr"')+'</label></div>'+
      '<details><summary class="hint" style="cursor:pointer">سعر الجملة والمكان في المخزن</summary><div class="grid4" style="margin-top:8px"><label>سعر الجملة'+inp(i,"price_ws","اختياري",'inputmode="decimal" dir="ltr"')+'</label><label>الرف'+inp(i,"rack","A1",'dir="ltr" style="text-transform:uppercase"')+'</label><label>الدرج'+inp(i,"drawer","1",'inputmode="numeric"')+'</label><label>البوكس'+inp(i,"box","1",'inputmode="numeric"')+'</label></div></details>'+
      '<div class="sub"><span>مجموع السطر <b dir="ltr" data-blt="'+i+'">0</b></span></div></div>').join("")+'</div>'+
    '<div class="btns"><button class="btn" type="button" data-act="bAdd">+ زيد منتج</button></div>'+
    '<div class="total"><span>إجمالي الفاتورة بسعر التكلفة</span><b><span id="bTot" dir="ltr">0</span> <small style="font-size:.8rem">'+cur()+'</small></b></div>'+
    '<div class="grid3"><label>طريقة الدفع<select class="f" data-bh="method">'+Object.keys(METHODS).map(k=>'<option value="'+k+'"'+(BUYH.method===k?" selected":"")+'>'+METHODS[k]+'</option>').join("")+'</select></label>'+
    '<label id="bPaidL">المدفوع الآن<input class="f" data-bh="paid" inputmode="decimal" dir="ltr" placeholder="0" value="'+esc(BUYH.paid)+'"></label><div class="sub" id="bInfo" style="align-self:end;padding-bottom:10px"></div></div>'+
    '<label id="bDueL">تاريخ الاستحقاق للمورد (اختياري)<input class="f" type="date" data-bh="due" value="'+esc(BUYH.due||"")+'"></label>'+
    '<label>ملاحظة<input class="f" data-bh="note" value="'+esc(BUYH.note)+'" autocomplete="off"></label>'+
    '<div class="btns"><button class="btn primary">حفظ الفاتورة وإضافة الكميات</button><span class="msg" id="bMsg"></span></div></form></div>'+
    '<div class="panel"><div class="ph2"><h2>فواتير الشراء</h2></div><div class="pb" style="padding-bottom:0">'+rangeHTML()+'</div><div class="list" id="bList"><div class="none">جاري التحميل…</div></div></div>';
  BL.forEach((l,i)=>bInfo(i));bSums();
  const [f,t]=rangeISO(),key=f+"|"+t;
  if(!BUYC||BUYC.key!==key){const d=await run(()=>api("report_data",{p_from:f,p_to:t}));if(!d)return;BUYC={key,data:d.purchases}}
  if(VIEW!=="buy"||!$("bList"))return;
  $("bList").innerHTML=BUYC.data.length?BUYC.data.slice().reverse().map(b=>'<div class="row" tabindex="0" data-act="openPur" data-id="'+b.id+'"><span class="no" dir="ltr">#'+b.no+'</span><span class="mid"><span dir="ltr">'+tShow(b.at)+'</span> · '+(b.party_id?esc(pname(b.party_id)):"نقدي")+' · '+b.items.reduce((a,i)=>a+i.qty,0)+' قطعة'+(b.ref?' · '+esc(b.ref):'')+(b.items.some(i=>i.returned)?' <span class="tag w">فيها مرتجع</span>':'')+'</span><span class="tot" dir="ltr">'+fm(b.total)+'</span></div>').join(""):'<div class="none">ما فيش فواتير شراء في هالفترة.</div>';
};
function bInfo(i){const el=document.querySelector('[data-bst="'+i+'"]');if(!el)return;const l=BL[i],p=findP(l.name);
  const pl=document.querySelector('[data-bpkl="'+i+'"]');if(pl){pl.hidden=!PK(p);if(!PK(p))l.pk=false;pl.querySelector("input").checked=!!l.pk}
  el.innerHTML=!norm(l.name)?"":p?'موجود (#'+p.id+') · المتوفر <b>'+p.qty+'</b>'+(PK(p)?' · الكرتونة <b>'+PK(p)+'</b> حبة'+(l.pk?' → <b>'+int(l.qty)*PK(p)+'</b> حبة بتكلفة <b dir="ltr">'+fm(pos(l.cost)/PK(p))+'</b> للحبة':''):'')+' · التكلفة الحالية <b dir="ltr">'+fm(p.cost)+'</b> · البيع <b dir="ltr">'+fm(p.price)+'</b>':'<span class="tag w">منتج جديد</span> ينضاف مع حفظ الفاتورة'}
function bSums(){const t=BL.reduce((a,l)=>a+int(l.qty)*pos(l.cost),0);BL.forEach((l,i)=>{const e=document.querySelector('[data-blt="'+i+'"]');if(e)e.textContent=fm(int(l.qty)*pos(l.cost))});
  if($("bTot"))$("bTot").textContent=fm(t);if($("bPaidL"))$("bPaidL").hidden=!BUYH.sup;if($("bDueL"))$("bDueL").hidden=!BUYH.sup||t-pos(BUYH.paid)<=0.0005;
  if($("bInfo"))$("bInfo").innerHTML=BUYH.sup?'<span>الباقي علينا للمورد '+money(Math.max(0,t-pos(BUYH.paid)))+'</span>':'<span>شراء نقدي: الفاتورة مدفوعة كلها</span>'}
document.addEventListener("input",e=>{const k=e.target.dataset.b,h=e.target.dataset.bh;
  if(h){BUYH[h]=e.target.value;if(h==="sup"){const s=PARTIES.find(x=>x.id===+BUYH.sup);BUYH.due=s&&s.terms_days>0?dueISO(s.terms_days):"";const d=document.querySelector('[data-bh=due]');if(d)d.value=BUYH.due}return bSums()}
  if(!k)return;const i=+e.target.dataset.i;BL[i][k]=e.target.value;
  if(k==="name"){const p=findP(BL[i].name),row=document.querySelector('[data-bl="'+i+'"]');
    if(p){const hit=codeHit(BL[i].name);if(hit&&hit.p===p&&norm(BL[i].name)!==p.n){BL[i].name=p.name;e.target.value=p.name;if(hit.pack)BL[i].pk=true}
      [["cost",p.cost],["price",p.price],["price_ws",p.price_ws],["rack",p.rack],["drawer",p.drawer],["box",p.box]].forEach(([f,v])=>{if(!BL[i][f]&&v&&+v!==0){BL[i][f]=String(v);row.querySelector('[data-b="'+f+'"]').value=v}})}
    bInfo(i)}
  bSums()});
document.addEventListener("change",e=>{if(e.target.dataset.bh){BUYH[e.target.dataset.bh]=e.target.value;if(e.target.dataset.bh==="sup"){const s=PARTIES.find(x=>x.id===+BUYH.sup);BUYH.due=s&&s.terms_days>0?dueISO(s.terms_days):"";const d=document.querySelector('[data-bh=due]');if(d)d.value=BUYH.due}bSums()}
  if(e.target.dataset.bpk!==undefined){const i=+e.target.dataset.bpk;BL[i].pk=e.target.checked;bInfo(i)}});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.dataset&&e.target.dataset.b){e.preventDefault();e.target.dispatchEvent(new Event("input",{bubbles:true}))}});
ACT.bAdd=()=>{BL.push(bline());refresh();const r=document.querySelector('[data-bl="'+(BL.length-1)+'"] input');if(r){r.scrollIntoView({block:"center"});r.focus()}};
ACT.bDel=b=>{BL.splice(+b.dataset.i,1);refresh()};
FORMS.purchase=async()=>{
  const rows=BL.filter(l=>norm(l.name)||l.qty||l.cost);if(!rows.length)return setMsg("bMsg","⚠️ زيد منتج واحد على الأقل","err");
  for(const [i,l] of rows.entries()){const n="المنتج "+(BL.indexOf(l)+1)+": ";
    if(!norm(l.name))return setMsg("bMsg","⚠️ "+n+"اكتب الاسم","err");if(int(l.qty)<1)return setMsg("bMsg","⚠️ "+n+"اكتب الكمية","err");if(!(pos(l.cost)>0))return setMsg("bMsg","⚠️ "+n+"اكتب سعر التكلفة","err")}
  const items=rows.map(l=>{const p=findP(l.name),k=l.pk&&PK(p)?PK(p):1;return Object.assign(p?{product_id:p.id}:{name:l.name.trim()},{qty:int(l.qty)*k,cost:r3(pos(l.cost)/k),price:pos(l.price)||null,price_ws:pos(l.price_ws)||null},l.rack.trim()?{rack:l.rack,drawer:l.drawer,box:l.box}:{})});
  const r=await run(()=>api("purchase_create",{p:{po_id:BUYH.po||null,due_date:BUYH.sup&&BUYH.due?BUYH.due:null,party_id:+BUYH.sup||null,ref:BUYH.ref,paid:BUYH.sup?pos(BUYH.paid):null,method:BUYH.method,note:BUYH.note,items}}),null,"bMsg");if(!r)return;
  BL=[bline()];BUYH={sup:"",ref:"",method:"cash",paid:"",note:""};POC=null;invalidate();
  await run(()=>Promise.all([loadProducts(),loadParties(),loadShift()]));await VIEWS.buy();
  setMsg("bMsg","تم حفظ فاتورة الشراء #"+r.no+" ✓ وانزادت الكميات"+(r.new_products?" ("+r.new_products+" منتج جديد)":"")+(r.due>0?" · الباقي للمورد "+fm(r.due):""),"ok");
};
ACT.openPur=b=>openPur(+b.dataset.id);
let CURB=null;
async function openPur(id){const b=await run(()=>api("purchase_get",{p_id:id}));if(!b)return;CURB=b;
  openDlg("فاتورة شراء #"+b.no,'<div class="sub"><span dir="ltr">'+tShow(b.at)+'</span><span>'+(b.party?esc(b.party):"شراء نقدي")+'</span>'+(b.ref?'<span>فاتورة المورد '+esc(b.ref)+'</span>':'')+'<span>سجلها '+esc(b.user)+'</span></div>'+
    tbl([["المنتج"],["الكمية",1],["التكلفة",1],["المجموع",1]],b.items.map(i=>'<tr><td class="nm">'+esc(i.name)+(i.returned?'<small>رجع منها '+i.returned+'</small>':'')+'</td><td class="r">'+i.qty+'</td>'+td(i.cost)+td(i.qty*i.cost)+'</tr>'),'<tr><td colspan="3">الإجمالي</td>'+td(b.total)+'</tr><tr><td colspan="3">المدفوع مع الفاتورة ('+METHODS[b.method]+')</td>'+td(b.paid)+'</tr>')+
    (b.returns.length?'<div class="hint">'+b.returns.map(r=>'مرتجع #'+r.no+' بتاريخ '+dShow(r.at)+': '+fm(r.total)+(r.refund?' (رجّع فلوس '+fm(r.refund)+')':'')).join("<br>")+'</div>':'')+(b.note?'<div class="hint">'+esc(b.note)+'</div>':'')+
    '<div class="btns">'+(b.items.some(i=>i.qty>i.returned)?'<button class="btn" data-act="purReturn">مرتجع للمورد</button>':'')+'</div>')}
ACT.purReturn=()=>{const b=CURB,cr=!!b.party_id;
  openDlg("مرتجع من فاتورة شراء #"+b.no,'<form class="db" style="padding:0" data-form="purReturn">'+b.items.map(i=>{const left=i.qty-i.returned,p=PB[i.product_id];return '<div class="line"><div class="top"><div><b>'+esc(i.name)+'</b><small>انشرى '+i.qty+(i.returned?' · رجع قبل '+i.returned:'')+' · المتوفر توا '+(p?p.qty:0)+'</small></div></div><label>الكمية الراجعة (حدها '+Math.min(left,p?p.qty:0)+')<input class="f" name="q'+i.id+'" inputmode="numeric" value="0"></label></div>'}).join("")+
    (cr?'<div class="hint">قيمة المرتجع تنقص من اللي علينا لـ«'+esc(b.party)+'». لو رجّعلك فلوس اكتبها.</div><div class="grid2"><label>رجّعلك فلوس<input class="f" name="refund" inputmode="decimal" dir="ltr" placeholder="0"></label><label>طريقتها<select class="f" name="method">'+Object.keys(METHODS).map(k=>'<option value="'+k+'">'+METHODS[k]+'</option>').join("")+'</select></label></div>':'<div class="hint">شراء نقدي: قيمة المرتجع ترجعلك '+METHODS[b.method]+'.</div><input type="hidden" name="method" value="'+b.method+'">')+
    '<label>ملاحظة<input class="f" name="note" autocomplete="off"></label><div class="btns"><button class="btn primary">تسجيل المرتجع</button><button class="btn" type="button" data-act="backPur">رجوع</button></div><span class="msg" id="prMsg"></span></form>')};
ACT.backPur=()=>openPur(CURB.id);
FORMS.purReturn=async f=>{const b=CURB,items=b.items.map(i=>({item_id:i.id,qty:int(f["q"+i.id].value)})).filter(x=>x.qty>0);
  if(!items.length)return setMsg("prMsg","⚠️ اكتب كمية واحدة على الأقل","err");
  const r=await run(()=>api("purchase_return",{p:{purchase_id:b.id,items,refund:f.refund?pos(f.refund.value):null,method:f.method.value,note:f.note.value}}),null,"prMsg");if(!r)return;
  invalidate();await run(()=>Promise.all([loadProducts(),loadParties(),loadShift()]));await openPur(b.id);refresh();toast("تسجل مرتجع الشراء #"+r.no+" بقيمة "+fm(r.total))};

/* ================================================================
   الحسابات: العملاء والموردين
   ================================================================ */
let PTYPE="c";
/* شن مسدد من كل فاتورة: الدفعة المربوطة بفاتورة تروحلها، والباقي على أقدم فاتورة أول */
const isLate=d=>d.due&&d.rem>0.0005&&new Date(d.due+"T23:59:59")<new Date();
function alloc(rows){
  const key=x=>x.sale_id?"s"+x.sale_id:x.purchase_id?"b"+x.purchase_id:"";
  const docs=rows.filter(x=>["open","inv","buy"].includes(x.kind)).map(x=>({at:x.at,kind:x.kind,amt:+x.amount,key:key(x)||"o"+x.id,sale_id:x.sale_id,purchase_id:x.purchase_id,no:x.sale_no||x.purchase_no,due:x.due_date||null,paid:0}));
  let pool=0,payT=0,last=null;
  rows.forEach(x=>{if(!["pay","ret","refund"].includes(x.kind))return;const c=-x.amount;if(x.kind==="pay"){payT+=c;last=x.at}
    const d=key(x)?docs.find(y=>y.key===key(x)):null;if(d){d.paid+=c;if(d.paid>d.amt){pool+=d.paid-d.amt;d.paid=d.amt}else if(d.paid<0){pool+=d.paid;d.paid=0}}else pool+=c});
  docs.forEach(d=>{if(pool<=0)return;const u=Math.min(pool,d.amt-d.paid);d.paid+=u;pool-=u});
  docs.forEach(d=>{d.rem=r3(d.amt-d.paid)});
  return {docs,payT,docT:docs.reduce((a,d)=>a+d.amt,0),last,open:docs.filter(d=>d.rem>0.0005)};
}
VIEWS.accounts=()=>{
  const adm=isAdmin();if(!adm)PTYPE="c";
  const cs=PARTIES.filter(x=>x.kind==="c"),ss=PARTIES.filter(x=>x.kind==="s");
  const rec=cs.reduce((a,x)=>a+Math.max(0,+x.balance),0),pay=ss.reduce((a,x)=>a+Math.max(0,+x.balance),0),warn=cs.filter(x=>x.warn_limit>0&&+x.balance>x.warn_limit).length;
  const c=PTYPE==="c",list=(c?cs:ss).filter(x=>!Q||norm(x.name).includes(norm(Q))||digits(x.phone).includes(digits(Q))).sort((a,b)=>b.balance-a.balance);
  $("view").innerHTML='<div class="kpis">'+kpi("ديون لنا على العملاء",fm(rec),cs.filter(x=>x.balance>0).length+" عميل","main")+(adm?kpi("علينا للموردين",fm(pay),ss.filter(x=>x.balance>0).length+" مورد","bad")+kpi("الصافي",fm(rec-pay),"لنا ناقص علينا"):"")+kpi("فاتوا سقف التنبيه",warn,"","warn")+'</div>'+
    '<div class="tools">'+(adm?'<div class="chips"><button class="chip" data-act="ptype" data-t="c" aria-pressed="'+c+'">العملاء</button><button class="chip" data-act="ptype" data-t="s" aria-pressed="'+!c+'">الموردين</button></div>':'')+searchBox("دوّر بالاسم أو الهاتف…")+'</div>'+
    '<div class="panel">'+tbl([[c?"العميل":"المورد"],[c?"الرصيد عليه":"المستحق له",1]].concat(c?[["سقف التنبيه",1]]:[]),list.map(x=>'<tr tabindex="0" data-act="party" data-id="'+x.id+'"><td class="nm">'+esc(x.name)+(x.active?'':' <span class="tag n">موقوف</span>')+(c&&x.warn_limit>0&&+x.balance>x.warn_limit?' <span class="tag">فات السقف</span>':'')+(x.price_level==="ws"?' <span class="tag n">جملة</span>':'')+(x.phone?'<small dir="ltr" style="text-align:right">'+esc(x.phone)+'</small>':'')+'</td><td class="r"><b>'+fm(x.balance)+'</b></td>'+(c?'<td class="r">'+(x.warn_limit>0?fm(x.warn_limit):"-")+'</td>':'')+'</tr>'),
      '<tr><td>المجموع</td>'+td(list.reduce((a,x)=>a+ +x.balance,0))+(c?'<td></td>':'')+'</tr>',"ما فيش حسابات.")+'</div>'+
    (adm?'<div class="panel"><div class="ph2"><h2>إضافة '+(c?"عميل":"مورد")+'</h2></div><form class="pb" data-form="partyAdd"><div class="grid4"><label>الاسم<input class="f" name="name" autocomplete="off"></label><label>الهاتف<input class="f" name="phone" dir="ltr" inputmode="tel" autocomplete="off"></label>'+
      (c?'<label>سقف للتنبيه بس<input class="f" name="warn" dir="ltr" inputmode="decimal" placeholder="فاضي = بدون"></label><label>الأسعار<select class="f" name="level"><option value="retail">قطاعي</option><option value="ws">جملة</option></select></label>':'')+
      '<label>رصيد افتتاحي ('+(c?"عليه":"له")+')<input class="f" name="open" dir="ltr" inputmode="decimal" placeholder="0"></label><label>مدة السداد (أيام)<input class="f" name="terms" inputmode="numeric" placeholder="0 = بدون موعد"></label></div><div class="btns"><button class="btn primary">إضافة</button><span class="msg" id="paMsg"></span></div></form></div>':'');
};
document.addEventListener("input",e=>{if(e.target.id==="q"&&VIEW==="accounts"){const s=e.target.selectionStart;refresh();const q=$("q");q.focus();q.setSelectionRange(s,s)}});
ACT.ptype=b=>{PTYPE=b.dataset.t;refresh()};
FORMS.partyAdd=async f=>{await run(async()=>{const r=await api("party_save",{p:{kind:PTYPE,name:f.name.value,phone:f.phone.value,warn_limit:f.warn?f.warn.value:0,price_level:f.level?f.level.value:"retail",opening:f.open.value,terms_days:int(f.terms.value)}});
  await loadParties();refresh();setMsg("paMsg","تمت الإضافة ✓","ok")},null,"paMsg")};
ACT.party=b=>partyDlg(+b.dataset.id);
let CURPT=null,PDOCS=null,STMT=[],PINVF="all";
async function partyDlg(id,keepF){
  const pt=PARTIES.find(x=>x.id===id);if(!pt)return;if(!keepF)PINVF="all";
  const rows=await run(()=>api("ledger_list",{p_party:id}));if(!rows)return;
  CURPT=pt;const c=pt.kind==="c",adm=isAdmin(),A=alloc(rows),b=+pt.balance;PDOCS=A;
  let run_=0;STMT=rows.map(x=>{run_+= +x.amount;return {at:x.at,text:ledText(x,c),up:x.amount>0?+x.amount:0,down:x.amount<0?-x.amount:0,run:run_}});
  const shown=A.docs.filter(d=>PINVF==="all"||d.rem>0.0005);
  openDlg(pt.name,
    '<div class="total"><span>'+(c?(b>=0?"الرصيد عليه":"رصيد له عندنا"):(b>=0?"المستحق له علينا":"رصيد لنا عنده"))+'</span><b><span dir="ltr">'+fm(Math.abs(b))+'</span> <small style="font-size:.8rem">'+cur()+'</small></b></div>'+
    '<div class="sub"><span>'+(c?"إجمالي الفواتير":"إجمالي المشتريات")+' '+money(A.docT)+'</span><span>إجمالي المدفوع '+money(A.payT)+'</span><span>آخر دفعة <b dir="ltr">'+(A.last?dShow(A.last):"-")+'</b></span>'+(pt.phone?'<span dir="ltr">'+esc(pt.phone)+'</span>':'')+(c&&pt.warn_limit>0?'<span>سقف التنبيه '+money(pt.warn_limit)+(b>pt.warn_limit?' <span class="tag">فاته</span>':'')+'</span>':'')+'</div>'+
    (adm||(c&&can("collect"))?'<form class="sec" data-form="pay"><h3>'+(c?"تسجيل دفعة من العميل":"تسجيل دفعة للمورد")+'</h3><div class="grid3"><label>المبلغ<input class="f" name="amount" inputmode="decimal" dir="ltr" placeholder="0.00"></label><label>الطريقة<select class="f" name="method">'+Object.keys(METHODS).map(k=>'<option value="'+k+'">'+METHODS[k]+'</option>').join("")+'</select></label><label>ملاحظة<input class="f" name="note" autocomplete="off"></label></div><div class="btns"><button class="btn primary">تسجيل</button><span class="msg" id="payMsg"></span></div></form>':'')+
    '<div class="sec"><h3>الفواتير وشن مسدد منها</h3><div class="chips"><button class="chip" data-act="pinvf" data-f="all" aria-pressed="'+(PINVF==="all")+'">الكل ('+A.docs.length+')</button><button class="chip" data-act="pinvf" data-f="open" aria-pressed="'+(PINVF==="open")+'">اللي ما تسددتش ('+A.open.length+')</button></div>'+
      tbl([["الفاتورة"],["التاريخ"],["المبلغ",1],["المسدد",1],["الباقي",1]],shown.map(d=>'<tr'+(d.sale_id||d.purchase_id?' tabindex="0" data-act="'+(d.sale_id?"openSale":"openPur")+'" data-id="'+(d.sale_id||d.purchase_id)+'"':'')+'><td>'+(d.kind==="open"?"افتتاحي":'<span dir="ltr">#'+d.no+'</span>')+' <span class="tag '+(d.rem<=0.0005?"g":d.paid>0?"w":"")+'">'+(d.rem<=0.0005?"مسددة":d.paid>0?"جزئياً":"ما تسددتش")+'</span>'+(d.rem>0.0005?'<small style="display:block;color:var(--muted)">عمرها '+daysAgo(d.at)+' يوم'+(d.due?(isLate(d)?' · <b class="neg">متأخرة '+daysAgo(d.due)+' يوم</b>':' · تستحق <span dir="ltr">'+dShow(d.due)+'</span>'):'')+'</small>':'')+'</td><td dir="ltr" style="text-align:right">'+dShow(d.at)+'</td>'+td(d.amt)+td(d.paid)+'<td class="r"><b>'+fm(d.rem)+'</b></td></tr>'),null,PINVF==="open"?"كل الفواتير مسددة.":"ما فيش فواتير.")+
      '<div class="hint">الدفعات اللي مش مربوطة بفاتورة تتحسب على أقدم فاتورة أول. اضغط على الفاتورة باش تفتحها.</div></div>'+
    '<div class="sec"><h3>كشف الحساب</h3>'+tbl([["التاريخ"],["البيان"],[c?"عليه":"له",1],[c?"دفع":"دفعنا",1],["الرصيد",1]],STMT.map(x=>'<tr><td dir="ltr" style="text-align:right">'+dShow(x.at)+'</td><td class="nm" style="font-weight:400">'+esc(x.text)+'</td><td class="r">'+(x.up?fm(x.up):"")+'</td><td class="r">'+(x.down?fm(x.down):"")+'</td><td class="r"><b>'+fm(x.run)+'</b></td></tr>'),null,"ما فيش حركات.")+
      '<div class="btns"><button class="btn" data-act="printStmt">🖨️ طباعة كشف الحساب</button>'+(pt.phone?'<a class="btn" target="_blank" rel="noopener" href="https://wa.me/'+waPhone(pt.phone)+'?text='+encodeURIComponent(ME.shop_name+"\n"+pt.name+"\n"+(c?"رصيدك عندنا: ":"رصيدكم علينا: ")+fm(b)+" "+cur()+(A.open.length?"\nفواتير مفتوحة: "+A.open.map(d=>(d.kind==="open"?"افتتاحي":"#"+d.no)+" الباقي "+fm(d.rem)).join("، "):""))+'">واتساب</a>':'')+'<button class="btn" data-act="copyStmt">نسخ</button><button class="btn" data-act="xlsStmt">⬇️ Excel</button></div></div>'+
    (adm?'<form class="sec" data-form="partyEdit"><h3>بيانات الحساب</h3><div class="grid2"><label>الاسم<input class="f" name="name" value="'+esc(pt.name)+'" autocomplete="off"></label><label>الهاتف<input class="f" name="phone" dir="ltr" value="'+esc(pt.phone)+'" autocomplete="off"></label>'+
      (c?'<label>سقف للتنبيه بس<input class="f" name="warn" dir="ltr" inputmode="decimal" value="'+(pt.warn_limit>0?pt.warn_limit:"")+'" placeholder="فاضي = بدون"></label><label>الأسعار<select class="f" name="level"><option value="retail">قطاعي</option><option value="ws"'+(pt.price_level==="ws"?" selected":"")+'>جملة</option></select></label>':'')+
      '<label>مدة السداد (أيام)<input class="f" name="terms" inputmode="numeric" value="'+(pt.terms_days||"")+'" placeholder="0 = بدون موعد"></label></div><label class="chk"><input type="checkbox" name="off"'+(pt.active?"":" checked")+'> موقوف: ما يطلعش في القوائم</label><div class="btns"><button class="btn">حفظ البيانات</button><span class="msg" id="peMsg"></span></div></form>':''),"wide");
}
const LEDK={open:"رصيد افتتاحي",inv:"فاتورة بيع",buy:"فاتورة شراء",pay:"دفعة",ret:"مرتجع",refund:"فلوس مرجّعة"};
function ledText(x,c){let t=LEDK[x.kind];if(x.sale_no)t+=(x.kind==="pay"?" مع الفاتورة":"")+" #"+x.sale_no;if(x.purchase_no)t+=(x.kind==="pay"?" مع فاتورة الشراء":"")+" #"+x.purchase_no;
  if(x.kind==="pay"&&!x.sale_no&&!x.purchase_no)t=c?"دفعة من العميل":"دفعة للمورد";
  if(x.kind!=="open"&&x.kind!=="inv"&&x.kind!=="buy"&&x.method&&x.method!=="cash")t+=" ("+METHODS[x.method]+")";
  if(x.note&&x.note!==LEDK[x.kind])t+=" · "+x.note;
  if(x.user&&x.kind==="pay")t+=" · "+x.user;return t}
ACT.pinvf=b=>{PINVF=b.dataset.f;partyDlg(CURPT.id,true)};
FORMS.pay=async f=>{const a=pos(f.amount.value);if(!a)return setMsg("payMsg","⚠️ اكتب المبلغ","err");
  const r=await run(()=>api("party_payment",{p_party:CURPT.id,p_amount:a,p_method:f.method.value,p_note:f.note.value}),null,"payMsg");if(!r)return;
  invalidate();await run(()=>Promise.all([loadParties(),loadShift()]));await partyDlg(CURPT.id,true);refresh();toast("تسجلت الدفعة ✓ · الرصيد الآن "+fm(r.balance))};
FORMS.partyEdit=async f=>{await run(async()=>{await api("party_save",{p:{id:CURPT.id,name:f.name.value,phone:f.phone.value,warn_limit:f.warn?f.warn.value:0,price_level:f.level?f.level.value:"retail",active:!f.off.checked,terms_days:int(f.terms.value)}});
  await loadParties();await partyDlg(CURPT.id,true);refresh();setMsg("peMsg","تم الحفظ ✓","ok")},null,"peMsg")};
ACT.printStmt=()=>{const pt=CURPT,c=pt.kind==="c",A=PDOCS;
  printDoc('<div class="a4">'+a4Head("كشف حساب: "+pt.name,(c?"عميل":"مورد")+(pt.phone?" · "+esc(pt.phone):"")+' · الرصيد <b>'+fm(pt.balance)+' '+esc(cur())+'</b>')+
    (A.open.length?'<h3 style="margin:12px 0 0">فواتير ما تسددتش</h3><table><thead><tr><th>الفاتورة</th><th>التاريخ</th><th>المبلغ</th><th>المسدد</th><th>الباقي</th></tr></thead><tbody>'+A.open.map(d=>'<tr><td>'+(d.kind==="open"?"افتتاحي":"#"+d.no)+'</td><td>'+dShow(d.at)+'</td><td>'+fm(d.amt)+'</td><td>'+fm(d.paid)+'</td><td><b>'+fm(d.rem)+'</b></td></tr>').join("")+'</tbody></table>':'')+
    '<h3 style="margin:12px 0 0">كشف الحساب</h3><table><thead><tr><th>التاريخ</th><th>البيان</th><th>'+(c?"عليه":"له")+'</th><th>'+(c?"دفع":"دفعنا")+'</th><th>الرصيد</th></tr></thead><tbody>'+STMT.map(x=>'<tr><td>'+dShow(x.at)+'</td><td>'+esc(x.text)+'</td><td>'+(x.up?fm(x.up):"")+'</td><td>'+(x.down?fm(x.down):"")+'</td><td>'+fm(x.run)+'</td></tr>').join("")+'</tbody></table></div>',PA4)};
function copyText(t,okEl){const done=m=>toast(m);try{navigator.clipboard.writeText(t).then(()=>done("تم النسخ ✓ الصقه في إكسل"),()=>done("ما تمش النسخ"))}catch(e){toast("ما تمش النسخ",1)}}
ACT.copyStmt=()=>{const c=CURPT.kind==="c";copyText(["كشف حساب: "+CURPT.name,["التاريخ","البيان",c?"عليه":"له",c?"دفع":"دفعنا","الرصيد"].join("\t")].concat(STMT.map(x=>[dShow(x.at),x.text,x.up||"",x.down||"",r3(x.run)].join("\t"))).join("\n"))};

/* ================================================================
   التقارير (للمدير)
   ================================================================ */
let REPC=null, RTAB="summary", ALLD=null, LEDALL=null, AUD=null, RF={user:"",party:""};
const RTABS=[["summary","الأرباح والخسائر"],["sales","المبيعات"],["buy","المشتريات"],["cust","العملاء (لنا)"],["sup","الموردين (علينا)"],["stock","المخزون والطلب"],["exp","المصروفات"],["shifts","الورديات"],["audit","سجل العمليات"]];
const USES_RANGE=["summary","sales","buy","exp","shifts"];
VIEWS.reports=async()=>{
  let h='<div class="chips" style="margin-bottom:14px">'+RTABS.map(([k,t])=>'<button class="chip" data-act="rtab" data-t="'+k+'" aria-pressed="'+(RTAB===k)+'">'+t+'</button>').join("")+'<button class="chip" data-act="xlsRep" style="margin-inline-start:auto">⬇️ Excel</button></div>'+(USES_RANGE.includes(RTAB)?rangeHTML():"")+'<div id="rep"><div class="none">جاري التحميل…</div></div>';
  $("view").innerHTML=h;
  const tab=RTAB,out=await REP[tab]();if(VIEW!=="reports"||RTAB!==tab||out==null)return;$("rep").innerHTML=out;
};
ACT.rtab=b=>{RTAB=b.dataset.t;refresh()};
async function repData(){const [f,t]=rangeISO(),key=f+"|"+t;if(!REPC||REPC.key!==key){const d=await run(()=>api("report_data",{p_from:f,p_to:t}));if(!d)return null;REPC={key,d}}return REPC.d}
async function allData(){if(!ALLD){ALLD=await run(()=>api("report_data",{p_from:null,p_to:null}))}return ALLD}
const sumBy=(arr,f)=>arr.reduce((a,x)=>a+(+f(x)||0),0);
function groupRows(list,keyF){const g={};list.forEach(x=>{const k=keyF(x);(g[k]=g[k]||[]).push(x)});return g}
const REP={};
REP.summary=async()=>{const d=await repData();if(!d)return null;
  const ok=d.sales.filter(s=>s.status==="ok"),gross=sumBy(ok,s=>s.total),disc=sumBy(ok,s=>s.discount),ret=sumBy(d.sale_returns,r=>r.total),net=gross-ret;
  const cogs=sumBy(ok,s=>sumBy(s.items,i=>i.qty*i.cost))-sumBy(d.sale_returns,r=>sumBy(r.items,i=>i.qty*i.cost));
  const gp=net-cogs,exp=sumBy(d.expenses,e=>e.amount);
  const adj=d.adjustments.filter(a=>a.reason!=="opening"),adjV=sumBy(adj,a=>(a.qty_after-a.qty_before)*a.cost);
  const np=gp-exp+adjV,pur=sumBy(d.purchases,b=>b.total),pret=sumBy(d.purchase_returns,r=>r.total);
  const col=sumBy(d.collections.filter(c=>c.kind==="collect"),c=>c.amount),spay=-sumBy(d.collections.filter(c=>c.kind==="supplier_pay"),c=>c.amount);
  const meth={};ok.forEach(s=>salePays(s).forEach(x=>{meth[x.method]=(meth[x.method]||0)+ +x.amount}));d.collections.filter(c=>c.kind==="collect").forEach(c=>{meth[c.method]=(meth[c.method]||0)+ +c.amount});
  const credit=sumBy(ok.filter(s=>s.party_id),s=>s.total-s.paid);
  const row=(t,v,b,cls)=>'<tr><td'+(b?' style="font-weight:700"':'')+'>'+t+'</td><td class="r '+(cls||"")+'"'+(b?' style="font-weight:700"':'')+'>'+fm(v)+'</td></tr>';
  return '<div class="kpis">'+kpi("صافي الربح",fm(np),rangeLabel(),"main")+kpi("صافي المبيعات",fm(net),ok.length+" فاتورة")+kpi("مجمل الربح",fm(gp),net?(gp/net*100).toFixed(1)+"٪ من المبيعات":"","good")+kpi("المصروفات",fm(exp),d.expenses.length+" مصروف","bad")+'</div>'+
    '<div class="cols"><div class="panel"><div class="ph2"><h2>قائمة الدخل</h2></div><div class="tw"><table><tbody>'+
      row("إجمالي المبيعات (بعد الخصم)",gross)+row("ناقص: المرتجعات",-ret)+row("صافي المبيعات",net,1)+row("ناقص: تكلفة البضاعة المباعة",-cogs)+row("مجمل الربح",gp,1,gp<0?"neg":"pos")+
      row("ناقص: المصروفات",-exp)+row("تسويات الجرد (تالف، ضايع، فرق)",adjV,0,adjV<0?"neg":"")+row("صافي الربح",np,1,np<0?"neg":"pos")+'</tbody></table></div><div class="pb hint">الخصومات اللي انعطت في الفترة: '+fm(disc)+'. التكلفة محسوبة بسعر التكلفة وقت البيع.</div></div>'+
    '<div class="panel"><div class="ph2"><h2>حركة الفلوس</h2></div><div class="tw"><table><tbody>'+
      Object.keys(METHODS).map(k=>row("دخل "+METHODS[k]+" (مبيعات وتحصيل)",meth[k]||0)).join("")+row("مبيعات آجلة ما تحصّلتش وقتها",credit)+row("تحصيل ديون من العملاء",col)+row("دفعات للموردين",spay)+
      row("مشتريات الفترة",pur)+row("مرتجعات للموردين",pret)+'</tbody></table></div></div></div>';
};
REP.sales=async()=>{const d=await repData();if(!d)return null;
  let ok=d.sales.filter(s=>s.status==="ok");if(RF.user)ok=ok.filter(s=>s.user_id===+RF.user);
  if(RF.party==="cash")ok=ok.filter(s=>!s.party_id);else if(RF.party==="credit")ok=ok.filter(s=>s.party_id);else if(RF.party)ok=ok.filter(s=>s.party_id===+RF.party);
  const rev=sumBy(ok,s=>s.total),cost=sumBy(ok,s=>sumBy(s.items,i=>i.qty*i.cost)),pcs=sumBy(ok,s=>sumBy(s.items,i=>i.qty*(i.per||1)));
  const pr=(r,c)=>'<td class="r '+(r-c<0?"neg":"")+'">'+fm(r-c)+'</td>';
  const days=groupRows(ok,s=>dKey(s.at)),dk=Object.keys(days).sort().reverse(),mx=Math.max(1,...dk.map(k=>sumBy(days[k],s=>s.total)));
  const bp={};ok.forEach(s=>{const f=s.total/(s.subtotal||1);s.items.forEach(i=>{const x=(bp[i.product_id]=bp[i.product_id]||{name:(PB[i.product_id]||i).name,q:0,r:0,c:0});x.q+=i.qty*(i.per||1);x.r+=i.qty*i.price*f;x.c+=i.qty*i.cost})});
  const bu=groupRows(ok,s=>s.user_id),colU={};d.collections.filter(c=>c.kind==="collect").forEach(c=>{colU[c.user_id]=(colU[c.user_id]||0)+ +c.amount});
  const bc=groupRows(ok,s=>s.party_id||0);
  return '<div class="grid4" style="margin-bottom:14px"><label>المستخدم<select class="f" data-rf="user"><option value="">الكل</option>'+USERS.map(u=>'<option value="'+u.id+'"'+(RF.user==u.id?" selected":"")+'>'+esc(u.name)+'</option>').join("")+'</select></label>'+
    '<label>العميل<select class="f" data-rf="party"><option value="">الكل</option><option value="cash"'+(RF.party==="cash"?" selected":"")+'>نقدي بس</option><option value="credit"'+(RF.party==="credit"?" selected":"")+'>آجل بس</option>'+PARTIES.filter(x=>x.kind==="c").map(x=>'<option value="'+x.id+'"'+(RF.party==x.id?" selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label></div>'+
    '<div class="kpis">'+kpi("المبيعات",fm(rev),rangeLabel(),"main")+kpi("الربح",fm(rev-cost),rev?((rev-cost)/rev*100).toFixed(1)+"٪":"","good")+kpi("عدد الفواتير",ok.length,"متوسط "+fm(ok.length?rev/ok.length:0))+kpi("القطع",fm(pcs),"")+kpi("المرتجعات",fm(sumBy(d.sale_returns,r=>r.total)),d.sale_returns.length+" مرتجع","bad")+'</div>'+
    '<div class="cols"><div class="panel"><div class="ph2"><h2>حسب اليوم</h2></div>'+tbl([["اليوم"],["فواتير",1],["المبيعات",1],["الربح",1],[""]],dk.map(k=>{const L=days[k],r=sumBy(L,s=>s.total),c=sumBy(L,s=>sumBy(s.items,i=>i.qty*i.cost));return '<tr><td>'+DAYS[new Date(L[0].at).getDay()]+' <span dir="ltr" style="color:var(--muted)">'+dShow(L[0].at)+'</span></td><td class="r">'+L.length+'</td>'+td(r)+pr(r,c)+'<td><div class="bar"><i style="width:'+(r/mx*100).toFixed(1)+'%"></i></div></td></tr>'}))+'</div>'+
    '<div class="panel"><div class="ph2"><h2>حسب المستخدم</h2></div>'+tbl([["المستخدم"],["فواتير",1],["المبيعات",1],["الربح",1],["تحصيل ديون",1]],Object.keys(bu).map(k=>{const L=bu[k],r=sumBy(L,s=>s.total),c=sumBy(L,s=>sumBy(s.items,i=>i.qty*i.cost));return '<tr><td class="nm">'+esc(uname(+k))+'</td><td class="r">'+L.length+'</td>'+td(r)+pr(r,c)+td(colU[k]||0)+'</tr>'}))+'</div>'+
    (ok.some(s=>s.device)?'<div class="panel"><div class="ph2"><h2>حسب الجهاز</h2></div>'+tbl([["الجهاز"],["فواتير",1],["المبيعات",1],["بدون نت",1]],Object.entries(groupRows(ok,s=>s.device||"بدون اسم")).map(([k,L])=>'<tr><td class="nm">'+esc(k)+'</td><td class="r">'+L.length+'</td>'+td(sumBy(L,s=>s.total))+'<td class="r">'+L.filter(s=>s.offline).length+'</td></tr>'))+'</div>':'')+
    '<div class="panel"><div class="ph2"><h2>حسب العميل</h2></div>'+tbl([["العميل"],["فواتير",1],["المبيعات",1],["مدفوع وقتها",1]],Object.keys(bc).sort((a,b)=>sumBy(bc[b],s=>s.total)-sumBy(bc[a],s=>s.total)).map(k=>'<tr><td class="nm">'+(+k?esc(pname(+k)):"بيع نقدي")+'</td><td class="r">'+bc[k].length+'</td>'+td(sumBy(bc[k],s=>s.total))+td(sumBy(bc[k],s=>s.paid))+'</tr>'))+'</div>'+
    '<div class="panel"><div class="ph2"><h2>حسب طريقة الدفع</h2></div>'+tbl([["الطريقة"],["فواتير",1],["المدفوع",1]],Object.keys(METHODS).map(k=>{const L=ok.filter(s=>salePays(s).some(x=>x.method===k));return L.length?'<tr><td>'+METHODS[k]+'</td><td class="r">'+L.length+'</td>'+td(sumBy(L,s=>sumBy(salePays(s).filter(x=>x.method===k),x=>x.amount)))+'</tr>':""}).filter(Boolean),'<tr><td colspan="3" class="hint">الفاتورة المقسومة تتحسب في كل طريقة اندفع بيها.</td></tr>')+'</div></div>'+
    '<div class="panel"><div class="ph2"><h2>حسب المنتج</h2><button class="btn sm" data-act="copyRep" data-k="prod">نسخ</button></div>'+tbl([["المنتج"],["انباع",1],["المبيعات",1],["التكلفة",1],["الربح",1]],(REPX.prod=Object.values(bp).sort((a,b)=>b.r-a.r)).map(x=>'<tr><td class="nm">'+esc(x.name)+'</td><td class="r">'+x.q+'</td>'+td(x.r)+td(x.c)+pr(x.r,x.c)+'</tr>'))+'</div>'+
    (d.sale_returns.length?'<div class="panel"><div class="ph2"><h2>المرتجعات</h2></div>'+tbl([["المرتجع"],["التاريخ"],["القيمة",1],["رجع فلوس",1]],d.sale_returns.map(r=>{const s=d.sales.find(x=>x.id===r.sale_id);return '<tr tabindex="0" data-act="openSale" data-id="'+r.sale_id+'"><td>#'+r.no+' من فاتورة #'+(s?s.no:"؟")+'</td><td dir="ltr" style="text-align:right">'+tShow(r.at)+'</td>'+td(r.total)+td(r.refund)+'</tr>'}))+'</div>':'');
};
const REPX={};
document.addEventListener("change",e=>{const k=e.target.dataset.rf;if(!k)return;RF[k]=e.target.value;refresh()});
ACT.copyRep=b=>{const k=b.dataset.k,L=REPX[k]||[];
  const t=k==="prod"?["المنتج\tالكمية\tالمبيعات\tالتكلفة\tالربح"].concat(L.map(x=>[x.name,x.q,r3(x.r),r3(x.c),r3(x.r-x.c)].join("\t"))):
    k==="stock"?["رقم\tالمنتج\tالتصنيف\tالمكان\tالكمية\tالتكلفة\tسعر البيع\tالقيمة"].concat(L.map(p=>[p.id,p.name,p.category,locCode(p),p.qty,p.cost,p.price,r3(p.qty*p.cost)].join("\t"))):
    k==="parties"?["الاسم\tالفواتير\tالمدفوع\tالرصيد\tفواتير مفتوحة\tأقدم دين (يوم)\tآخر دفعة"].concat(L.map(r=>[r.p.name,r3(r.A.docT),r3(r.A.payT),r3(r.p.balance),r.A.open.length,r.age,r.A.last?dShow(r.A.last):""].join("\t"))):[];
  copyText(t.join("\n"))};
REP.buy=async()=>{const d=await repData();if(!d)return null;
  const L=d.purchases,tot=sumBy(L,b=>b.total),ret=sumBy(d.purchase_returns,r=>r.total);
  const bs=groupRows(L,b=>b.party_id||0),bp={};L.forEach(b=>b.items.forEach(i=>{const x=(bp[i.product_id]=bp[i.product_id]||{name:i.name,q:0,r:0});x.q+=i.qty;x.r+=i.qty*i.cost}));
  return '<div class="kpis">'+kpi("المشتريات",fm(tot),rangeLabel(),"main")+kpi("المدفوع معها",fm(sumBy(L,b=>b.paid)),"")+kpi("آجل",fm(tot-sumBy(L,b=>b.paid)),"وقت الفاتورة","bad")+kpi("مرتجع للموردين",fm(ret),d.purchase_returns.length+" مرتجع")+kpi("عدد الفواتير",L.length,"")+'</div>'+
    '<div class="cols"><div class="panel"><div class="ph2"><h2>حسب المورد</h2></div>'+tbl([["المورد"],["فواتير",1],["المشتريات",1],["مدفوع وقتها",1]],Object.keys(bs).sort((a,b)=>sumBy(bs[b],x=>x.total)-sumBy(bs[a],x=>x.total)).map(k=>'<tr><td class="nm">'+(+k?esc(pname(+k)):"شراء نقدي")+'</td><td class="r">'+bs[k].length+'</td>'+td(sumBy(bs[k],x=>x.total))+td(sumBy(bs[k],x=>x.paid))+'</tr>'))+'</div>'+
    '<div class="panel"><div class="ph2"><h2>حسب المنتج</h2></div>'+tbl([["المنتج"],["الكمية",1],["المبلغ",1],["متوسط التكلفة",1]],Object.values(bp).sort((a,b)=>b.r-a.r).map(x=>'<tr><td class="nm">'+esc(x.name)+'</td><td class="r">'+x.q+'</td>'+td(x.r)+td(x.r/x.q)+'</tr>'))+'</div></div>'+
    '<div class="panel"><div class="ph2"><h2>الفواتير</h2></div><div class="list">'+(L.length?L.slice().reverse().map(b=>'<div class="row" tabindex="0" data-act="openPur" data-id="'+b.id+'"><span class="no" dir="ltr">#'+b.no+'</span><span class="mid"><span dir="ltr">'+tShow(b.at)+'</span> · '+(b.party_id?esc(pname(b.party_id)):"نقدي")+(b.ref?' · '+esc(b.ref):'')+'</span><span class="tot" dir="ltr">'+fm(b.total)+'</span></div>').join(""):'<div class="none">ما فيش فواتير.</div>')+'</div></div>';
};
async function partyRep(kind){
  if(!LEDALL){LEDALL=await run(()=>api("ledger_list",{p_party:null}));if(!LEDALL)return null}
  const c=kind==="c",rows=PARTIES.filter(x=>x.kind===kind).map(p=>{const A=alloc(LEDALL.filter(l=>l.party_id===p.id));return {p,A,age:A.open.length?daysAgo(A.open[0].at):0}}).sort((a,b)=>b.p.balance-a.p.balance);
  REPX.parties=rows;const owing=rows.filter(r=>r.p.balance>0),tb=sumBy(owing,r=>r.p.balance),old=owing.slice().sort((a,b)=>b.age-a.age)[0];
  const aging=[[0,30,"أقل من 30 يوم"],[30,60,"30 إلى 60"],[60,90,"60 إلى 90"],[90,1e9,"أكثر من 90 يوم"]].map(([a,b,t])=>[t,sumBy(rows,r=>sumBy(r.A.open.filter(d=>daysAgo(d.at)>=a&&daysAgo(d.at)<b),d=>d.rem))]);
  const late=rows.map(r=>({r,v:sumBy(r.A.open.filter(isLate),d=>d.rem)})).filter(x=>x.v>0.0005);
  return '<div class="kpis">'+kpi(c?"ديون لنا على العملاء":"علينا للموردين",fm(tb),owing.length+(c?" عميل":" مورد"),"main")+kpi("متأخر عن موعده",fm(sumBy(late,x=>x.v)),late.length+(c?" عميل":" مورد"),"bad")+kpi("فواتير ما تسددتش",sumBy(rows,r=>r.A.open.length),"كلها أو جزء منها","warn")+kpi("أقدم دين",old?old.age+" يوم":"-",old?esc(old.p.name):"")+'</div>'+
    '<div class="cols"><div class="panel"><div class="ph2"><h2>'+(c?"أرصدة العملاء":"أرصدة الموردين")+'</h2><button class="btn sm" data-act="copyRep" data-k="parties">نسخ</button></div>'+tbl([[c?"العميل":"المورد"],[c?"الفواتير":"المشتريات",1],["المدفوع",1],["الرصيد",1]],rows.map(r=>'<tr tabindex="0" data-act="party" data-id="'+r.p.id+'"><td class="nm">'+esc(r.p.name)+'<small>'+(r.A.open.length?r.A.open.length+" فاتورة مفتوحة · أقدمها "+r.age+" يوم":"ما فيش فواتير مفتوحة")+(r.A.open.some(isLate)?' · <b class="neg">متأخر '+fm(sumBy(r.A.open.filter(isLate),d=>d.rem))+'</b>':'')+(r.A.last?" · آخر دفعة "+dShow(r.A.last):"")+'</small></td>'+td(r.A.docT)+td(r.A.payT)+'<td class="r"><b>'+fm(r.p.balance)+'</b></td></tr>'),
      '<tr><td>المجموع</td>'+td(sumBy(rows,r=>r.A.docT))+td(sumBy(rows,r=>r.A.payT))+td(sumBy(rows,r=>r.p.balance))+'</tr>')+'</div>'+
    '<div class="panel"><div class="ph2"><h2>أعمار الديون</h2></div>'+tbl([["عمر الفاتورة"],["الباقي",1]],aging.map(([t,v])=>'<tr><td>'+t+'</td>'+td(v)+'</tr>'))+'<div class="pb hint">الباقي من الفواتير المفتوحة حسب عمرها.</div></div></div>';
}
REP.cust=()=>partyRep("c");REP.sup=()=>partyRep("s");
let SSORT="id";
REP.stock=async()=>{
  const d=await allData();const last={};
  if(d)d.purchases.forEach(b=>b.items.forEach(i=>{last[i.product_id]={sup:b.party_id,cost:i.cost,at:b.at}}));
  const act=P.filter(p=>p.active),val=sumBy(act,p=>p.qty*p.cost),sv=sumBy(act,p=>p.qty*p.price),low=act.filter(p=>isLow(p)||isOut(p));
  REPX.order=low.map(p=>{const m=minOf(p),sug=Math.max(m*2-p.qty,m,1);return {p,m,sug,l:last[p.id]}}).sort((a,b)=>(a.l&&a.l.sup||0)-(b.l&&b.l.sup||0)||a.p.qty-b.p.qty);
  const L=act.slice().sort(SSORT==="value"?(a,b)=>b.qty*b.cost-a.qty*a.cost:SSORT==="qty"?(a,b)=>a.qty-b.qty:SSORT==="loc"?(a,b)=>(has(a)?0:1)-(has(b)?0:1)||locCode(a).localeCompare(locCode(b),"en",{numeric:true}):(a,b)=>a.id-b.id);REPX.stock=L;
  return '<div class="kpis">'+kpi("قيمة المخزون بالتكلفة",fm(val),"دينار ليبي","main")+kpi("بسعر البيع",fm(sv),"لو انباع كله")+kpi("الربح المتوقع",fm(sv-val),"","good")+kpi("الأصناف / القطع",act.length+" / "+fm(sumBy(act,p=>p.qty)),P.filter(has).length+" محدد مكانه")+kpi("قرّبت تكمل",act.filter(isLow).length,"حسب حد التنبيه","warn")+kpi("خالصة",act.filter(isOut).length,"","bad")+'</div>'+
    '<div class="panel"><div class="ph2"><h2>قائمة الطلب</h2><div class="btns"><button class="btn sm primary" data-act="poFromOrder">أمر شراء منها</button><button class="btn sm" data-act="printOrder">🖨️ طباعة</button></div></div>'+tbl([["المنتج"],["المتوفر",1],["الحد",1],["المقترح",1],["آخر مورد"],["آخر تكلفة",1]],REPX.order.map(o=>'<tr tabindex="0" data-act="product" data-id="'+o.p.id+'"><td class="nm">'+esc(o.p.name)+'</td><td class="r '+(o.p.qty?"":"neg")+'">'+o.p.qty+'</td><td class="r">'+o.m+'</td><td class="r"><b>'+o.sug+'</b></td><td>'+(o.l&&o.l.sup?esc(pname(o.l.sup)):"-")+'</td>'+(o.l?td(o.l.cost):'<td class="r">-</td>')+'</tr>'),null,"كل المنتجات فوق حد التنبيه.")+'<div class="pb hint">المقترح = ضعف حد التنبيه ناقص المتوفر.</div></div>'+
    '<div class="panel"><div class="ph2"><h2>الجرد الكامل</h2><div class="btns"><select class="f" id="ssort" style="width:auto"><option value="id">رقم المنتج</option><option value="value"'+(SSORT==="value"?" selected":"")+'>القيمة</option><option value="qty"'+(SSORT==="qty"?" selected":"")+'>الكمية (الأقل أول)</option><option value="loc"'+(SSORT==="loc"?" selected":"")+'>المكان</option></select><button class="btn sm" data-act="copyRep" data-k="stock">نسخ</button><button class="btn sm" data-act="printAisles">🖨️ الممرات A4</button></div></div>'+
      tbl([["#"],["المنتج"],["الكمية",1],["التكلفة",1],["البيع",1],["القيمة",1]],L.map(p=>'<tr tabindex="0" data-act="product" data-id="'+p.id+'"><td>'+p.id+'</td><td class="nm">'+esc(p.name)+'<small dir="ltr" style="text-align:right">'+(esc(locCode(p))||"بدون مكان")+'</small></td><td class="r">'+p.qty+'</td>'+td(p.cost)+td(p.price)+td(p.qty*p.cost)+'</tr>'),'<tr><td colspan="2">المجموع</td><td class="r">'+fm(sumBy(L,p=>p.qty))+'</td><td></td><td></td>'+td(val)+'</tr>')+'</div>'+
    (d&&d.adjustments.length?'<div class="panel"><div class="ph2"><h2>تسويات الجرد</h2></div>'+tbl([["التاريخ"],["المنتج"],["السبب"],["من",1],["إلى",1],["القيمة",1]],d.adjustments.slice().reverse().map(a=>'<tr><td dir="ltr" style="text-align:right">'+dShow(a.at)+'</td><td class="nm">'+esc(a.name)+(a.note?'<small>'+esc(a.note)+'</small>':'')+'</td><td>'+REASONS[a.reason]+'</td><td class="r">'+a.qty_before+'</td><td class="r">'+a.qty_after+'</td><td class="r '+(a.qty_after<a.qty_before?"neg":"")+'">'+fm((a.qty_after-a.qty_before)*a.cost)+'</td></tr>'))+'</div>':'');
};
document.addEventListener("change",e=>{if(e.target.id==="ssort"){SSORT=e.target.value;refresh()}});
ACT.printOrder=()=>{const L=REPX.order||[];if(!L.length)return toast("ما فيش منتجات تحت الحد",1);
  const g=groupRows(L,o=>o.l&&o.l.sup||0);
  printDoc('<div class="a4">'+Object.keys(g).map(k=>'<div class="pg">'+a4Head("قائمة طلب"+(+k?": "+pname(+k):""),g[k].length+" منتج")+'<table><thead><tr><th>#</th><th>المنتج</th><th>المتوفر</th><th>الكمية المطلوبة</th><th>آخر تكلفة</th><th>ملاحظة</th></tr></thead><tbody>'+
    g[k].map(o=>'<tr><td>'+o.p.id+'</td><td>'+esc(o.p.name)+(o.p.barcode?' <small>'+esc(o.p.barcode)+'</small>':'')+'</td><td>'+o.p.qty+'</td><td><b>'+o.sug+'</b></td><td>'+(o.l?fm(o.l.cost):"")+'</td><td style="width:25%"></td></tr>').join("")+'</tbody></table></div>').join("")+'</div>',PA4)};
REP.exp=async()=>{const d=await repData();if(!d)return null;const g=groupRows(d.expenses,e=>e.category),tot=sumBy(d.expenses,e=>e.amount);
  $("dlExp").innerHTML=[...new Set(EXPC.concat(Object.keys(g)))].map(c=>'<option value="'+esc(c)+'">').join("");
  return '<div class="kpis">'+kpi("المصروفات",fm(tot),rangeLabel(),"main")+kpi("عددها",d.expenses.length,"")+'</div>'+
    '<div class="panel"><div class="ph2"><h2>تسجيل مصروف</h2></div><form class="pb" data-form="expense"><div class="grid4"><label>النوع<input class="f" name="cat" list="dlExp" autocomplete="off" placeholder="إيجار"></label><label>المبلغ<input class="f" name="amount" inputmode="decimal" dir="ltr"></label><label>الطريقة<select class="f" name="method">'+Object.keys(METHODS).map(k=>'<option value="'+k+'">'+METHODS[k]+'</option>').join("")+'</select></label><label>ملاحظة<input class="f" name="note" autocomplete="off"></label></div><div class="btns"><button class="btn primary">تسجيل</button><span class="msg"></span></div><div class="hint">'+(SHIFT?"المصروف النقدي ينخصم من درج ورديتك.":"ما عندكش وردية مفتوحة: المصروف يتسجل بدون ما يأثر على أي درج.")+'</div></form></div>'+
    '<div class="cols"><div class="panel"><div class="ph2"><h2>حسب النوع</h2></div>'+tbl([["النوع"],["عدد",1],["المبلغ",1]],Object.keys(g).sort((a,b)=>sumBy(g[b],e=>e.amount)-sumBy(g[a],e=>e.amount)).map(k=>'<tr><td>'+esc(k)+'</td><td class="r">'+g[k].length+'</td>'+td(sumBy(g[k],e=>e.amount))+'</tr>'))+'</div>'+
    '<div class="panel"><div class="ph2"><h2>كل المصروفات</h2></div>'+tbl([["التاريخ"],["النوع"],["المبلغ",1]],d.expenses.slice().reverse().map(e=>'<tr><td dir="ltr" style="text-align:right">'+tShow(e.at)+'</td><td class="nm" style="font-weight:400">'+esc(e.category)+'<small>'+METHODS[e.method]+' · '+esc(uname(e.user_id))+(e.note?' · '+esc(e.note):'')+'</small></td>'+td(e.amount)+'</tr>'))+'</div></div>';
};
REP.shifts=async()=>{const d=await repData();if(!d)return null;REPX.shifts=d.shifts;
  return '<div class="panel">'+tbl([["الوردية"],["المستخدم"],["فتحها"],["قفلها"],["المتوقع",1],["انعد",1],["الفرق",1]],d.shifts.slice().reverse().map(s=>'<tr tabindex="0" data-act="openShift" data-id="'+s.id+'"><td>#'+s.id+(s.closed_at?'':' <span class="tag g">مفتوحة</span>')+'</td><td>'+esc(s.user)+'</td><td dir="ltr" style="text-align:right">'+tShow(s.opened_at)+'</td><td dir="ltr" style="text-align:right">'+(s.closed_at?tShow(s.closed_at):"-")+'</td>'+td(s.expected_cash)+(s.closed_at?td(s.counted_cash)+'<td class="r '+(s.diff<0?"neg":s.diff>0?"pos":"")+'"><b>'+fm(s.diff)+'</b></td>':'<td></td><td></td>')+'</tr>'),null,"ما فيش ورديات في هالفترة.")+'</div>';
};
ACT.openShift=b=>{const s=(REPX.shifts||[]).find(x=>x.id===+b.dataset.id);if(!s)return;CURSH=s;
  openDlg("وردية #"+s.id,shiftHTML(s)+(s.closed_at?'':'<form class="sec" data-form="closeOther"><h3>إقفالها (المدير)</h3><label>المبلغ اللي في الدرج فعلاً<input class="f" name="counted" inputmode="decimal" dir="ltr"></label><label>ملاحظة<input class="f" name="note"></label><div class="btns"><button class="btn primary">إقفال الوردية</button></div><span class="msg" id="coMsg"></span></form>')+'<div class="btns"><button class="btn" data-act="printShift">🖨️ طباعة</button></div>')};
FORMS.closeOther=async f=>{if(f.counted.value.trim()==="")return setMsg("coMsg","⚠️ اكتب المبلغ","err");const s=await run(()=>api("shift_close",{p_counted:pos(f.counted.value),p_note:f.note.value,p_shift:CURSH.id}),null,"coMsg");if(!s)return;
  invalidate();await loadShift();CURSH=s;openDlg("انقفلت الوردية ✓",shiftHTML(s)+'<div class="btns"><button class="btn primary" data-act="printShift">🖨️ طباعة</button></div>');refresh()};
const AUDK={user_add:"إضافة مستخدم",user_edit:"تعديل مستخدم",settings:"تعديل الإعدادات",product_add:"إضافة منتج",price_change:"تغيير سعر",stock_adjust:"تسوية جرد",shift_diff:"فرق في الدرج",discount:"خصم على فاتورة",sale_void:"إلغاء فاتورة",sale_return:"مرتجع بيع",purchase_return:"مرتجع شراء",backup:"نسخة احتياطية"};
function audText(a){const d=a.detail||{};switch(a.action){
  case "price_change":return "«"+(d.name||"")+"» من "+fm(d.price_from)+" إلى "+fm(d.price_to)+(+d.ws_from!==+d.ws_to?" · الجملة من "+fm(d.ws_from)+" إلى "+fm(d.ws_to):"");
  case "stock_adjust":return "«"+(d.name||"")+"» من "+d.from+" إلى "+d.to+" ("+(REASONS[d.reason]||d.reason)+")";
  case "shift_diff":return "وردية #"+d.shift+": المتوقع "+fm(d.expected)+" وانعد "+fm(d.counted)+" (الفرق "+fm(d.diff)+")";
  case "discount":return "فاتورة #"+d.sale+": خصم "+fm(d.discount)+" من "+fm(d.subtotal);
  case "sale_void":return "فاتورة #"+d.sale+" بقيمة "+fm(d.total);
  case "sale_return":return "مرتجع #"+d.return+" من فاتورة #"+d.sale+" بقيمة "+fm(d.total)+(+d.refund?" ورجع فلوس "+fm(d.refund):"");
  case "purchase_return":return "مرتجع #"+d.return+" من فاتورة شراء #"+d.purchase+" بقيمة "+fm(d.total);
  case "product_add":return "«"+(d.name||"")+"»";
  case "user_add":case "user_edit":return uname(d.user)+(d.role?" · "+(ROLES[d.role]||d.role):"")+(d.active===false?" · إيقاف":"")+(d.password?" · كلمة مرور جديدة":"");
  default:return Object.keys(d).map(k=>k+": "+d[k]).join("، ")}}
REP.audit=async()=>{if(!AUD){AUD=await run(()=>api("audit_list",{p_limit:500}));if(!AUD)return null}
  return '<div class="panel">'+tbl([["الوقت"],["المستخدم"],["العملية"],["التفاصيل"]],AUD.map(a=>'<tr><td dir="ltr" style="text-align:right">'+tShow(a.at)+'</td><td>'+esc(a.user||"-")+'</td><td>'+(AUDK[a.action]||esc(a.action))+'</td><td class="nm" style="font-weight:400">'+esc(audText(a))+'</td></tr>'),null,"ما فيش عمليات مسجلة.")+'</div>'};

/* ================================================================
   الإدارة: المستخدمين والإعدادات
   ================================================================ */
VIEWS.admin=()=>{
  $("view").innerHTML='<div class="panel"><div class="ph2"><h2>المستخدمين</h2></div>'+tbl([["الاسم"],["اسم المستخدم"],["الدور"],["الحالة"]],USERS.map(u=>'<tr tabindex="0" data-act="user" data-id="'+u.id+'"><td class="nm">'+esc(u.name)+(u.id===ME.id?' <span class="tag n">انت</span>':'')+'</td><td dir="ltr" style="text-align:right" class="mono">'+esc(u.username)+'</td><td>'+ROLES[u.role]+'</td><td>'+(u.active?'<span class="tag g">شغال</span>':'<span class="tag">موقوف</span>')+'</td></tr>'))+'</div>'+
    '<div class="panel"><div class="ph2"><h2>إضافة مستخدم</h2></div><form class="pb" data-form="userAdd"><div class="grid4"><label>الاسم<input class="f" name="name" autocomplete="off"></label><label>اسم المستخدم (حروف إنجليزية)<input class="f" name="username" dir="ltr" autocapitalize="none" autocomplete="off"></label><label>كلمة المرور (6 خانات أو أكثر)<input class="f" name="password" dir="ltr" autocomplete="new-password"></label><label>الدور<select class="f" name="role"><option value="seller">بائع</option><option value="store">أمين مخزن</option><option value="admin">مدير</option></select></label></div>'+
      '<div class="hint">البائع: نقطة البيع ومبيعاته ودفعات العملاء، بدون تكلفة ولا أرباح. أمين المخزن: الأماكن والصور، بدون أسعار.</div><div class="btns"><button class="btn primary">إضافة</button><span class="msg" id="uaMsg"></span></div></form></div>'+
    '<div class="panel"><div class="ph2"><h2>الإعدادات</h2></div><form class="pb" data-form="settings"><div class="grid2"><label>اسم المحل<input class="f" name="shop_name" value="'+esc(ME.shop_name)+'"></label><label>العملة<input class="f" name="currency" value="'+esc(ME.currency)+'"></label>'+
      '<label>الهاتف (يطلع في الإيصال)<input class="f" name="shop_phone" dir="ltr" value="'+esc(ME.shop_phone)+'"></label><label>العنوان<input class="f" name="shop_address" value="'+esc(ME.shop_address)+'"></label>'+
      '<label>أقصى خصم للبائع (٪ من الفاتورة)<input class="f" name="max_seller_discount_pct" inputmode="decimal" dir="ltr" value="'+esc(ME.max_seller_discount_pct)+'"></label><label>حد التنبيه الافتراضي للمنتجات<input class="f" name="default_min_qty" inputmode="numeric" value="'+esc(ME.default_min_qty)+'"></label></div>'+
      '<div class="grid2"><label>⭐ نقاط لكل دينار (0 = بدون نقاط)<input class="f" name="loyalty_rate" inputmode="decimal" dir="ltr" value="'+esc(ME.loyalty_rate||"0")+'"></label><label>قيمة النقطة لما تنصرف ('+cur()+')<input class="f" name="loyalty_value" inputmode="decimal" dir="ltr" value="'+esc(ME.loyalty_value||"0")+'"></label></div>'+
      '<label>آخر سطر في الإيصال<input class="f" name="receipt_footer" value="'+esc(ME.receipt_footer)+'"></label><label>قفل الشاشة بعد كم دقيقة بدون استعمال (0 = بدون قفل)<input class="f" name="lock_minutes" inputmode="numeric" dir="ltr" value="'+esc(ME.lock_minutes||"10")+'"></label><div class="hint">القفل يشتغل لكل مستخدم عنده رمز سري (يحطه من «حسابي»).</div><div class="btns"><button class="btn primary">حفظ الإعدادات</button><span class="msg" id="stMsg"></span></div></form></div>'+
    '<div class="panel"><div class="ph2"><h2>🏷️ العروض</h2></div><div id="promoBox"><div class="none">جاري التحميل…</div></div></div>'+
    '<div class="panel"><div class="ph2"><h2>النسخة الاحتياطية</h2></div><div class="pb"><div class="hint">الخطة المجانية في Supabase ما فيهاش نسخ احتياطية تلقائية. نزّل نسخة مرة في الأسبوع على الأقل واحفظها في مكان ثاني (فلاشة، إيميل، Google Drive).</div><label class="chk"><input type="checkbox" id="bkImg" checked> مع الصور (الملف يكبر)</label><div class="btns"><button class="btn primary" data-act="backup">⬇️ تنزيل نسخة احتياطية</button><span class="msg" id="bkMsg"></span></div><div class="hint">آخر نسخة نزلتها من هالجهاز: <b id="bkLast">'+(LS.get("lastBackup",null)?dShow(LS.get("lastBackup")):"ما فيش")+'</b></div>'+
      '<div class="sec"><h3>النسخ التلقائي اليومي</h3><div class="hint">نسخة كل يوم تتحفظ في مستودع GitHub خاص (مش العام). يحتاج «مفتاح النسخ»: تولده هنا وتحطه في أسرار المستودع الخاص. المفتاح يطلع مرة وحدة بس، ولو ولدت واحد جديد القديم يبطل.</div><div class="btns"><button class="btn" data-act="bkKey">توليد مفتاح النسخ</button></div><div id="bkKeyOut"></div></div></div></div>'+
    '<div class="panel"><div class="ph2"><h2>معلومات</h2></div><div class="pb hint">القاعدة: <span dir="ltr" class="mono">'+esc(CFG.url)+'</span><br>الصور محفوظة في القاعدة، وكل جهاز يحتفظ بنسخة منها باش الموقع يفتح أسرع.</div></div>';
};
FORMS.userAdd=async f=>{await run(async()=>{await api("user_save",{p:{name:f.name.value,username:f.username.value.trim().toLowerCase(),password:f.password.value,role:f.role.value}});await loadUsers();refresh();setMsg("uaMsg","تمت الإضافة ✓","ok")},null,"uaMsg")};
let CURU=null;
ACT.user=b=>{const u=USERS.find(x=>x.id===+b.dataset.id);if(!u)return;CURU=u;const self=u.id===ME.id;
  openDlg(u.name,'<form class="db" style="padding:0" data-form="userEdit"><div class="grid2"><label>الاسم<input class="f" name="name" value="'+esc(u.name)+'"></label><label>الدور<select class="f" name="role"'+(self?" disabled":"")+'>'+Object.keys(ROLES).map(r=>'<option value="'+r+'"'+(r===u.role?" selected":"")+'>'+ROLES[r]+'</option>').join("")+'</select></label></div>'+
    '<label>كلمة مرور جديدة (فاضي = ما تتبدلش)<input class="f" name="password" dir="ltr" autocomplete="new-password"></label>'+
    (u.role==="seller"?'<div class="sec"><h3>صلاحيات البائع</h3>'+permBoxes(u.perms)+'</div>':'')+
    (self?'<div class="hint">ما تقدرش توقف حسابك أو تبدل دورك.</div>':'<label class="chk"><input type="checkbox" name="off"'+(u.active?"":" checked")+'> موقوف: ما يقدرش يدخل (ويطلع من أي جهاز داخل منه)</label>')+
    '<div class="hint">لو الحساب انقفل بسبب محاولات غلط، الحفظ يفك القفل.</div><div class="btns"><button class="btn primary">حفظ</button></div><span class="msg" id="ueMsg"></span></form>')};
const PERMS={credit:"البيع بالآجل للعملاء",collect:"استلام دفعات العملاء",expenses:"تسجيل مصروفات من الدرج",price:"تعديل السعر في السلة",returns:"المرتجعات",void:"إلغاء الفواتير"};
const permBoxes=L=>Object.keys(PERMS).map(k=>'<label class="chk"><input type="checkbox" name="perm" value="'+k+'"'+((L||[]).includes(k)?" checked":"")+'> '+PERMS[k]+'</label>').join("")+'<div class="hint">الخصم يتحدد بالنسبة من الإعدادات. كل تعديل سعر يتسجل في سجل العمليات.</div>';
FORMS.userEdit=async f=>{const u=CURU,self=u.id===ME.id,p={id:u.id,name:f.name.value};if(u.role==="seller")p.perms=[...f.querySelectorAll('[name=perm]:checked')].map(x=>x.value);if(!self){p.role=f.role.value;p.active=!f.off.checked}if(f.password.value)p.password=f.password.value;
  await run(async()=>{await api("user_save",{p});await loadUsers();if(self)ME=await api("me");refresh();$("dlg").close();toast("تم الحفظ ✓")},null,"ueMsg")};
FORMS.settings=async f=>{const p={};["shop_name","currency","shop_phone","shop_address","receipt_footer"].forEach(k=>p[k]=f[k].value.trim());p.max_seller_discount_pct=Math.min(100,pos(f.max_seller_discount_pct.value));p.default_min_qty=int(f.default_min_qty.value);p.lock_minutes=Math.min(240,int(f.lock_minutes.value));p.loyalty_rate=pos(f.loyalty_rate.value);p.loyalty_value=pos(f.loyalty_value.value);
  await run(async()=>{await api("settings_set",{p});ME=await api("me");$("shopName").textContent=ME.shop_name;document.title=ME.shop_name;document.querySelectorAll(".cur").forEach(e=>e.textContent=cur());refresh();setMsg("stMsg","تم الحفظ ✓","ok")},null,"stMsg")};

ACT.backup=async b=>{b.disabled=true;const d=await run(()=>api("backup_export",{p_images:$("bkImg").checked}),null,"bkMsg");b.disabled=false;if(!d)return;
  const blob=new Blob([JSON.stringify(d)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="backup-"+dKey(Date.now())+".json";document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);LS.set("lastBackup",Date.now());$("bkLast").textContent=dShow(Date.now());setMsg("bkMsg","تم التنزيل ✓ ("+Math.round(blob.size/1024)+" KB)","ok")};

async function renderPromos(){const el=$("promoBox");if(!el)return;const L=await run(()=>api("promo_list"));if(!L||!$("promoBox"))return;
  el.innerHTML=tbl([["العرض"],["على"],["الخصم"],["المدة"],["الحالة"]],L.map(o=>'<tr><td class="nm">'+esc(o.name)+'</td><td>'+(o.product?esc(o.product):"تصنيف: "+esc(o.category||""))+'</td><td>'+(o.kind==="pct"?(+o.pct)+"٪":"اشري "+o.buy+" وخوذ "+o.get)+'</td><td dir="ltr" style="text-align:right">'+(o.starts?dShow(o.starts):"")+(o.ends?" → "+dShow(o.ends):"")+'</td><td><button class="btn sm'+(o.active?'':' primary')+'" data-act="promoTog" data-id="'+o.id+'">'+(o.active?"إيقاف":"تشغيل")+'</button></td></tr>'),null,"ما فيش عروض.")+
  '<form class="pb" data-form="promo"><div class="grid4"><label>اسم العرض<input class="f" name="name" placeholder="مثلاً: عرض الصيف" autocomplete="off"></label><label>النوع<select class="f" name="kind"><option value="pct">نسبة خصم ٪</option><option value="bxgy">اشري X وخوذ Y ببلاش</option></select></label>'+
  '<label>المنتج (أو فاضي)<input class="f" name="prod" list="dlProducts" autocomplete="off"></label><label>أو التصنيف<input class="f" name="cat" list="dlCats" autocomplete="off"></label>'+
  '<label>النسبة ٪<input class="f" name="pct" inputmode="decimal" dir="ltr"></label><label>اشري كم<input class="f" name="buy" inputmode="numeric" dir="ltr"></label><label>خوذ كم ببلاش<input class="f" name="get" inputmode="numeric" dir="ltr"></label><label>من<input class="f" type="date" name="starts"></label><label>إلى<input class="f" type="date" name="ends"></label></div>'+
  '<div class="hint">العرض على المنتج الأصل ينطبق على كل أصنافه. لو أكثر من عرض، يتحسب الأحسن للزبون.</div><div class="btns"><button class="btn primary">إضافة العرض</button><span class="msg" id="prMsg"></span></div></form>';window._PL=L}
FORMS.promo=async f=>{const pr=f.prod.value.trim()?findP(f.prod.value):null;if(f.prod.value.trim()&&!pr)return setMsg("prMsg","⚠️ المنتج مش موجود","err");
  const r=await run(()=>api("promo_save",{p:{name:f.name.value,kind:f.kind.value,product_id:pr?(pr.group_id||pr.id):null,category:pr?null:f.cat.value,pct:f.pct.value,buy:int(f.buy.value)||null,get:int(f.get.value)||null,starts:f.starts.value,ends:f.ends.value}}),null,"prMsg");if(!r)return;
  await loadPromos().catch(()=>{});renderPromos();toast("انضاف العرض ✓")};
{const _adm=VIEWS.admin;VIEWS.admin=()=>{_adm();renderPromos()}}
ACT.promoTog=async b=>{const o=(window._PL||[]).find(x=>x.id===+b.dataset.id);if(!o)return;
  await run(()=>api("promo_save",{p:Object.assign({},o,{active:!o.active})}));await loadPromos().catch(()=>{});renderPromos()};
ACT.bkKey=()=>confirm2("مفتاح النسخ التلقائي","لو فيه مفتاح قديم يبطل، ولازم تحط الجديد في أسرار المستودع الخاص.","توليد",async()=>{
  const k=await run(()=>api("backup_key_set"),null,"c2Msg");if(!k)return false;
  $("bkKeyOut").innerHTML='<div class="msg ok">انسخه توا وحطه في GitHub باسم <b dir="ltr">BACKUP_KEY</b>. ما يطلعش مرة ثانية.</div><input class="f mono" dir="ltr" readonly value="'+esc(k)+'" onclick="this.select()"><div class="btns"><button class="btn sm" data-act="copyKey">نسخ</button></div>'});
ACT.copyKey=()=>{const i=document.querySelector("#bkKeyOut input");if(!i)return;i.select();(navigator.clipboard?navigator.clipboard.writeText(i.value):Promise.reject()).then(()=>toast("انتسخ ✓")).catch(()=>{document.execCommand("copy");toast("انتسخ ✓")})};

/* حسابي: تغيير كلمة المرور */
ACT.account=()=>openDlg("حسابي",'<div class="sub"><span>'+esc(ME.name)+'</span><span dir="ltr" class="mono">'+esc(ME.username)+'</span><span>'+ROLES[ME.role]+'</span></div><form class="sec" data-form="pass"><h3>تغيير كلمة المرور</h3><label>كلمة المرور الحالية<input class="f" name="old" type="password" dir="ltr" autocomplete="current-password"></label><label>الجديدة (6 خانات أو أكثر)<input class="f" name="new1" type="password" dir="ltr" autocomplete="new-password"></label><label>عاودها<input class="f" name="new2" type="password" dir="ltr" autocomplete="new-password"></label><div class="btns"><button class="btn primary">تغيير</button></div><span class="msg" id="pwMsg"></span><div class="hint">بعد التغيير، أي جهاز ثاني داخل بحسابك يطلع.</div></form>'+
  '<form class="sec" data-form="pinSet"><h3>الرمز السري (PIN) '+(ME.has_pin?'<span class="tag g">محطوط</span>':'<span class="tag">مش محطوط</span>')+'</h3><div class="hint">4 لـ 6 أرقام. تفتح بيه الشاشة لما تنقفل، وتقدر تدخل بيه بدل كلمة المرور.</div><div class="grid2"><label>الرمز الجديد<input class="f" name="pin" type="password" inputmode="numeric" dir="ltr" autocomplete="off" maxlength="6"></label><label>عاوده<input class="f" name="pin2" type="password" inputmode="numeric" dir="ltr" autocomplete="off" maxlength="6"></label></div><div class="btns"><button class="btn primary">حفظ الرمز</button>'+(ME.has_pin?'<button class="btn danger" type="button" data-act="pinDel">مسح الرمز</button>':'')+'</div><span class="msg" id="pnMsg"></span></form>'+
  (isStore()?'':'<div class="sec"><h3>هالجهاز</h3><label>اسم الجهاز (يطلع في التقارير)<input class="f" id="devName" value="'+esc(DEV.name)+'" placeholder="مثلاً: كاشير 1، تابلت المخزن" maxlength="40" autocomplete="off"></label><label class="chk"><input type="checkbox" id="devSnd"'+(DEV.snd?" checked":"")+'> صوت عند المسح والبيع</label><label class="chk"><input type="checkbox" id="devPrint"'+(DEV.autoprint?" checked":"")+'> طباعة الإيصال تلقائياً بعد كل بيعة</label></div>'));
document.addEventListener("change",e=>{if(e.target.id==="devName"){LS.set("dev_name",e.target.value.trim());$("whoRole").textContent=ROLES[ME.role]+(DEV.name?" · "+DEV.name:"");toast("انحفظ اسم الجهاز ✓")}if(e.target.id==="devSnd"){LS.set("dev_snd",e.target.checked);if(e.target.checked)beep(true)}if(e.target.id==="devPrint")LS.set("dev_print",e.target.checked)});
FORMS.pinSet=async f=>{const a=digits(f.pin.value).trim(),b=digits(f.pin2.value).trim();
  if(!/^\d{4,6}$/.test(a))return setMsg("pnMsg","⚠️ الرمز لازم من 4 لـ 6 أرقام","err");if(a!==b)return setMsg("pnMsg","⚠️ الرمزين مش زي بعض","err");
  await run(async()=>{await api("pin_set",{p_pin:a});ME.has_pin=true;lockBtn();ACT.account();setMsg("pnMsg","انحفظ الرمز ✓","ok")},null,"pnMsg")};
ACT.pinDel=async()=>{await run(async()=>{await api("pin_set",{p_pin:""});ME.has_pin=false;lockBtn();ACT.account();toast("انمسح الرمز")})};

/* قفل الشاشة */
let IDLE_T=0;
const lockMin=()=>Math.max(0,int(ME&&ME.lock_minutes));
function lockBtn(){const b=$("lockBtn");if(b)b.hidden=!ME||!ME.has_pin}
function idleReset(){if(!ME||!ME.has_pin||$("lock").hidden===false)return;clearTimeout(IDLE_T);const m=lockMin();if(m>0)IDLE_T=setTimeout(lockNow,m*60000)}
["pointerdown","keydown","touchstart","wheel"].forEach(ev=>document.addEventListener(ev,idleReset,{passive:true,capture:true}));
function lockNow(){if(!ME||!ME.has_pin)return;clearTimeout(IDLE_T);LS.set("locked_"+ME.id,1);["dlg","dlg2"].forEach(d=>{if($(d).open)$(d).close()});
  const L=$("lock");L.hidden=false;L.innerHTML='<div class="box"><h1>الشاشة مقفولة</h1><p>'+esc(ME.name)+' · اكتب رمزك السري</p><input class="f pinin" id="pinIn" type="password" inputmode="numeric" dir="ltr" maxlength="6" autocomplete="off" readonly>'+
    '<div class="keypad">'+["1","2","3","4","5","6","7","8","9","⌫","0","✓"].map(k=>'<button type="button" data-act="pinKey" data-k="'+k+'">'+k+'</button>').join("")+'</div><span class="msg" id="lkMsg"></span>'+
    '<div class="btns" style="justify-content:center"><button class="link" type="button" data-act="lockSwitch">دخول بمستخدم ثاني</button></div></div>';}
ACT.lock=()=>lockNow();
ACT.pinKey=b=>{const i=$("pinIn"),k=b.dataset.k;if(k==="⌫")i.value=i.value.slice(0,-1);else if(k==="✓")unlock();else if(i.value.length<6){i.value+=k;if(i.value.length>=4&&LS.get("pinlen_"+ME.id,0)===i.value.length)unlock()}};
document.addEventListener("keydown",e=>{if($("lock").hidden)return;e.stopPropagation();if(/^\d$/.test(digits(e.key))){e.preventDefault();ACT.pinKey({dataset:{k:digits(e.key)}})}else if(e.key==="Backspace"){e.preventDefault();ACT.pinKey({dataset:{k:"⌫"}})}else if(e.key==="Enter"){e.preventDefault();unlock()}},true);
async function unlock(){const i=$("pinIn"),v=i.value;if(v.length<4)return;i.value="";
  try{const r=await api("login_pin",{p_username:ME.username,p_pin:v});
    if(!r.ok){setMsg("lkMsg",r.error==="locked"?"الحساب مقفول "+r.minutes+" دقيقة بسبب محاولات غلط.":"الرمز غلط","err");return}
    const old=TOKEN;TOKEN=r.token;LS.set("token",TOKEN);api("logout",{},old).catch(()=>{});LS.set("pinlen_"+ME.id,v.length);
    LS.del("locked_"+ME.id);$("lock").hidden=true;$("lock").innerHTML="";idleReset();loadShift().then(()=>{shiftPill();refresh()}).catch(()=>{});
  }catch(e){setMsg("lkMsg","⚠️ "+e.message,"err")}}
ACT.lockSwitch=async()=>{const id=ME.id;LS.del("locked_"+id);$("lock").hidden=true;$("lock").innerHTML="";await api("logout").catch(()=>{});endSession("")};
FORMS.pass=async f=>{if(f.new1.value!==f.new2.value)return setMsg("pwMsg","⚠️ كلمتين المرور مش زي بعض","err");
  await run(()=>api("password_change",{p_old:f.old.value,p_new:f.new1.value}),"تغيرت كلمة المرور ✓","pwMsg")};

/* ================================================================
   الجرد الكامل (من أكثر من جهاز)
   ================================================================ */
let CNT=null,CNT_T=0,CNT_ADD=true;
const cntItem=id=>CNT&&CNT.items.find(x=>x.product_id===id);
VIEWS.count=async()=>{
  clearTimeout(CNT_T);
  const c=await run(()=>api("count_current"));if(VIEW!=="count")return;CNT=c;
  if(!c){
    let h='<div class="panel" style="max-width:680px"><div class="ph2"><h2>الجرد</h2></div><div class="pb">';
    if(isAdmin())h+='<p class="hint">الجرد الكامل: تعدّوا البضاعة من أكثر من جهاز في نفس الوقت (المدير وأمناء المخزن، بقارئ الباركود أو الكاميرا أو بالاسم). البيع يقدر يستمر. لما تكمّلوا، المدير يشوف الفروقات ويعتمدها مرة وحدة.</p>'+
      '<form data-form="countOpen"><label>ملاحظة (اختياري)<input class="f" name="note" placeholder="مثلاً: جرد آخر الشهر" autocomplete="off"></label><div class="btns"><button class="btn primary">فتح جرد جديد</button></div><span class="msg" id="coMsg"></span></form>';
    else h+='<p style="margin:0">ما فيش جرد مفتوح توا. المدير يفتحه من عنده، وبعدها تقدر تعد من هنا.</p>';
    h+='</div></div>';
    if(isAdmin()){const L=await run(()=>api("count_list"))||[];if(VIEW!=="count")return;
      h+='<div class="panel"><div class="ph2"><h2>الجرود السابقة</h2></div>'+tbl([["#"],["التاريخ"],["الحالة"],["انعد",1],["تغيّر",1],["فرق القيمة",1]],L.map(x=>{const s=x.summary||{};
        return '<tr><td>'+x.id+'</td><td dir="ltr" style="text-align:right">'+dShow(x.at)+'</td><td>'+(x.status==="done"?"معتمد":x.status==="cancel"?"ملغي":"مفتوح")+(x.note?' <small>'+esc(x.note)+'</small>':'')+'</td><td class="r">'+(s.counted??"-")+'</td><td class="r">'+(s.changed??"-")+'</td>'+(s.value!=null?'<td class="r '+(s.value<0?"neg":"pos")+'">'+fm(s.value)+'</td>':'<td class="r">-</td>')+'</tr>'}),null,"ما فيش جرود قبل.")+'</div>'}
    $("view").innerHTML=h;return}
  const adm=isAdmin();
  $("view").innerHTML='<div class="panel"><div class="ph2"><h2>جرد #'+c.id+' مفتوح</h2><span class="hint">فتحه '+esc(c.user)+' · <span dir="ltr">'+tShow(c.at)+'</span>'+(c.note?' · '+esc(c.note):'')+'</span></div><div class="pb">'+
    '<div class="chips"><button class="chip" type="button" data-act="cntMode" data-m="1" aria-pressed="'+CNT_ADD+'">كل مسحة = +1</button><button class="chip" type="button" data-act="cntMode" data-m="0" aria-pressed="'+!CNT_ADD+'">بعد المسح نكتب العدد</button></div>'+
    '<div class="cntq"><input class="f bigin" id="cntQ" style="font-family:var(--f-body);font-size:1.15rem !important" placeholder="امسح الباركود أو اكتب اسم المنتج…" autocomplete="off" data-noscan>'+(CAM_OK?'<button class="btn" type="button" data-act="cntCam">📷</button>':'')+'</div>'+
    '<div class="list cnt-hits" id="cntHits"></div><div class="sub" id="cntSum"></div></div></div>'+
    '<div class="panel"><div class="ph2"><h2>اللي انعد</h2><button class="btn sm" type="button" data-act="cntReload">تحديث</button></div><div id="cntList"></div></div>'+
    (adm?'<div class="panel"><div class="ph2"><h2>الاعتماد</h2></div><div class="pb"><div class="hint">كل منتج انعد ياخذ الفرق بين العدد واللي كان في المنظومة وقت ما انعد، فالمبيعات اللي صارت وقت الجرد ما تضيعش.</div>'+
      '<label class="chk"><input type="checkbox" id="cntZero"> المنتجات اللي ما انعدتش تولي كميتها صفر</label>'+
      '<div class="btns"><button class="btn primary" type="button" data-act="cntApply">اعتماد الجرد وتعديل الكميات</button><button class="btn danger" type="button" data-act="cntCancel">إلغاء الجرد</button></div></div></div>':'');
  renderCntList();setTimeout(()=>{const q=$("cntQ");if(q)q.focus()},50);
  CNT_T=setTimeout(pollCount,15000);
};
function renderCntList(){
  const el=$("cntList");if(!el||!CNT)return;const adm=isAdmin(),act=P.filter(p=>p.active).length;
  const diffs=CNT.items.filter(i=>i.counted!==i.expected),val=sumBy(diffs,i=>(i.counted-i.expected)*(+i.cost||0));
  $("cntSum").innerHTML='<span>انعد <b>'+CNT.items.length+'</b> من <b>'+act+'</b> منتج</span>'+(adm?'<span>فيه فرق <b>'+diffs.length+'</b></span><span>فرق القيمة <b dir="ltr" class="'+(val<0?"neg":"pos")+'">'+fm(val)+'</b></span>':'');
  el.innerHTML=tbl([["المنتج"],["العدد",1]].concat(adm?[["في المنظومة",1],["الفرق",1]]:[]).concat([["عدّه"],[""]]),CNT.items.map(i=>{const d=i.counted-i.expected;
    return '<tr><td class="nm">'+esc(i.name)+'</td><td class="r"><b>'+i.counted+'</b></td>'+(adm?'<td class="r">'+i.expected+'</td><td class="r '+(d>0?"dpos":d<0?"dneg":"")+'">'+(d>0?"+":"")+d+'</td>':'')+
      '<td><small>'+esc(i.by||"")+' · <span dir="ltr">'+tShow(i.at)+'</span></small></td><td><button class="btn sm" type="button" data-act="cntEdit" data-id="'+i.product_id+'">تعديل</button></td></tr>'}),null,"لسه ما انعد شي. امسح أول منتج.");
}
async function pollCount(){clearTimeout(CNT_T);if(VIEW!=="count"||!CNT)return;
  if(!$("dlg").open&&!$("dlg2").open){try{const c=await api("count_current");if(VIEW!=="count")return;if(!c){refresh();return}CNT=c;renderCntList()}catch(e){}}
  CNT_T=setTimeout(pollCount,15000)}
ACT.cntReload=()=>VIEWS.count();
ACT.cntMode=b=>{CNT_ADD=b.dataset.m==="1";document.querySelectorAll('[data-act="cntMode"]').forEach(x=>x.setAttribute("aria-pressed",x===b));$("cntQ").focus()};
FORMS.countOpen=async f=>{await run(async()=>{await api("count_open",{p_note:f.note.value});refresh();toast("انفتح الجرد ✓ أمناء المخزن يقدروا يبدوا يعدّوا")},null,"coMsg")};
async function cntSet(id,qty,add){
  try{const r=await api("count_set",{p_product:id,p_qty:qty,p_add:add});beep(true);
    const p=PB[id],it=cntItem(id);if(it){it.counted=r.counted;it.at=new Date().toISOString();it.by=ME.name;CNT.items.splice(CNT.items.indexOf(it),1);CNT.items.unshift(it)}
    else CNT.items.unshift({product_id:id,name:p?p.name:"#"+id,expected:p?p.qty:0,counted:r.counted,cost:p?p.cost:0,at:new Date().toISOString(),by:ME.name});
    renderCntList();toast("«"+(p?p.name:id)+"» = "+r.counted);return true}
  catch(e){beep(false);toast(e.message,1);if(/ما فيش جرد مفتوح/.test(e.message))refresh();return false}}
function cntDlg(id,suggest){const p=PB[id];if(!p)return;const it=cntItem(id);
  openDlg2(p.name,'<form class="db" style="padding:0" data-form="cntSet" data-id="'+id+'"><div class="sub"><span>اللي انعد لتوا <b>'+(it?it.counted:0)+'</b></span>'+(PK(p)?'<span>الكرتونة <b>'+PK(p)+'</b> حبة</span>':'')+'</div>'+
    '<label>العدد بالحبة<input class="f bigin" name="qty" inputmode="numeric" autocomplete="off" value="'+(suggest||"")+'"></label>'+
    '<div class="btns"><button class="btn primary" name="mode" value="set">هذا هو العدد</button>'+(it?'<button class="btn" name="mode" value="add">زيده على اللي انعد</button><button class="btn danger" type="button" data-act="cntDel" data-id="'+id+'">شيله من الجرد</button>':'')+'</div><span class="msg" id="csMsg"></span></form>');
  setTimeout(()=>{const q=document.querySelector('#dlg2 [name=qty]');if(q){q.focus();q.select()}},50)}
FORMS.cntSet=async(f,e)=>{const q=int(f.qty.value),add=e&&e.submitter&&e.submitter.value==="add";
  if(f.qty.value.trim()===""||q<0)return setMsg("csMsg","⚠️ اكتب العدد","err");
  if(await cntSet(+f.dataset.id,q,add)){$("dlg2").close();const i=$("cntQ");if(i)i.focus()}};
ACT.cntEdit=b=>cntDlg(+b.dataset.id);
ACT.cntDel=async b=>{const id=+b.dataset.id;await run(async()=>{await api("count_remove",{p_product:id});CNT.items=CNT.items.filter(x=>x.product_id!==id);$("dlg2").close();renderCntList()},null,"csMsg")};
function cntCode(code){const h=codeHit(code);if(!h){beep(false);toast("ما فيش منتج بالباركود "+digits(code).trim(),1);return false}
  const n=h.pack?PK(h.p):1;if(CNT_ADD){cntSet(h.p.id,n,true);return true}cntDlg(h.p.id,h.pack?n:"");return true}
ACT.cntCam=()=>camScan("جرد بالكاميرا",c=>cntCode(c),CNT_ADD);
document.addEventListener("keydown",e=>{if(e.target.id!=="cntQ"||e.key!=="Enter")return;e.preventDefault();const v=e.target.value.trim();if(!v)return;
  if(codeHit(v)){e.target.value="";$("cntHits").innerHTML="";cntCode(v);return}
  const terms=norm(v).split(" ").filter(Boolean),L=P.filter(p=>terms.every(t=>(p.n+" "+p.k).includes(t))).slice(0,12);
  if(L.length===1){e.target.value="";$("cntHits").innerHTML="";return cntDlg(L[0].id)}
  $("cntHits").innerHTML=L.length?L.map(p=>'<div class="row" tabindex="0" data-act="cntPick" data-id="'+p.id+'"><span class="no">#'+p.id+'</span><span class="mid"><b style="color:var(--ink)">'+esc(p.name)+'</b>'+(cntItem(p.id)?' <span class="tag g">انعد '+cntItem(p.id).counted+'</span>':'')+'</span><span>'+locHTML(p)+'</span></div>').join(""):'<div class="none">ما لقيناش منتج بهالاسم أو الباركود.</div>'});
ACT.cntPick=b=>{$("cntHits").innerHTML="";$("cntQ").value="";cntDlg(+b.dataset.id)};
ACT.cntApply=()=>{const z=$("cntZero").checked,miss=P.filter(p=>p.active&&p.qty!==0&&!cntItem(p.id)).length,d=CNT.items.filter(i=>i.counted!==i.expected).length;
  confirm2("اعتماد الجرد #"+CNT.id,"تتعدل كميات <b>"+d+"</b> منتج حسب العد"+(z?"، و<b>"+miss+"</b> منتج ما انعدش تولي كميته صفر":"، والمنتجات اللي ما انعدتش تقعد زي ما هي")+". كل تعديل يتسجل كتسوية جرد. متأكد؟","اعتماد",async()=>{
    const r=await run(()=>api("count_apply",{p_zero_missing:z}),null,"c2Msg");if(!r)return false;
    await run(()=>loadProducts());invalidate();const s=r.summary||{};CNT=null;refresh();
    toast("انعتمد الجرد ✓ تعدّل "+s.changed+" منتج · فرق القيمة "+fm(s.value));})};
ACT.cntCancel=()=>confirm2("إلغاء الجرد #"+CNT.id,"العد كله يتلغى وما تتعدلش أي كمية.","إلغاء الجرد",async()=>{const r=await run(()=>api("count_cancel"),null,"c2Msg");if(r===undefined)return false;CNT=null;refresh()},true);

/* ================================================================
   ملصقات السعر بالباركود
   ================================================================ */
const EAN_L=["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const EAN_R=EAN_L.map(s=>s.replace(/./g,b=>b==="0"?"1":"0"));
const EAN_G=EAN_R.map(s=>s.split("").reverse().join(""));
const EAN_P=["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];
const C128="212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112".split(" ");
function eanOk(c){if(!/^\d{13}$/.test(c))return false;let s=0;for(let i=0;i<12;i++)s+=+c[i]*(i%2?3:1);return (10-s%10)%10===+c[12]}
/* يرجع الباركود كقائمة أعمدة سودا [بداية، عرض] بالوحدة، والعرض الكامل */
function barModules(code){
  if(eanOk(code)){const p=EAN_P[+code[0]];let b="101";for(let i=1;i<7;i++)b+=(p[i-1]==="L"?EAN_L:EAN_G)[+code[i]];b+="01010";for(let i=7;i<13;i++)b+=EAN_R[+code[i]];b+="101";
    const bars=[];for(let i=0;i<b.length;i++)if(b[i]==="1"){if(bars.length&&bars[bars.length-1][0]+bars[bars.length-1][1]===i+9)bars[bars.length-1][1]++;else bars.push([i+9,1])}
    return {bars,w:b.length+18}}
  const vals=[104];for(const ch of code){const v=ch.charCodeAt(0)-32;vals.push(v>=0&&v<95?v:0)}
  vals.push(vals.reduce((a,v,i)=>a+v*(i||1),0)%103);vals.push(106);
  let x=10;const bars=[];vals.forEach(v=>{C128[v].split("").forEach((w,k)=>{if(k%2===0)bars.push([x,+w]);x+=+w})});
  return {bars,w:x+10}}
function barSVG(code){const {bars,w}=barModules(code);return '<svg viewBox="0 0 '+w+' 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><rect width="'+w+'" height="40" fill="#fff"/>'+bars.map(([x,bw])=>'<rect x="'+x+'" width="'+bw+'" height="40" fill="#000"/>').join("")+'</svg>'}
function labelHTML(p,pack){const code=pack?p.pack_barcode:p.barcode,price=pack?unitPrice(p,null,true):+p.price;
  return '<div class="plbl"><div class="s">'+esc(ME.shop_name)+'</div><div class="n">'+esc(p.name)+(pack?' · كرتونة ×'+PK(p):'')+'</div><div class="pr" dir="ltr">'+(price>0?fm(price):"-")+' <small>'+esc(cur())+'</small></div>'+
    (code?barSVG(code)+'<div class="d" dir="ltr">'+esc(code)+'</div>':'<div class="s" style="text-align:center">بدون باركود</div>')+'</div>'}
ACT.labels=()=>{const L=matchProducts(P,true).list.filter(p=>p.active),nob=L.filter(p=>!p.barcode).length;
  openDlg("ملصقات السعر",'<form class="db" style="padding:0" data-form="labels"><div class="sub"><span>المنتجات الظاهرة في القائمة توا: <b>'+L.length+'</b></span>'+(nob?'<span class="tag w">'+nob+' بدون باركود</span>':'')+'</div>'+
    '<div class="hint">بدّل البحث والتصنيف في صفحة المنتجات قبل لو تبي ملصقات لمنتجات معينة.</div>'+
    (nob?'<div class="btns"><button class="btn" type="button" data-act="bcFill">توليد باركود للـ '+nob+' منتج اللي ما عندهمش</button></div><div class="hint">رقم داخلي للمحل يبدا بـ 20، يتقرا بأي قارئ.</div>':'')+
    '<label>المقاس<select class="f" name="size"><option value="small">ملصق صغير 40×25 مم (طابعة ملصقات)</option><option value="a4">ورقة A4 · 24 ملصق (3 × 8)</option></select></label>'+
    '<label>كم نسخة<select class="f" name="copies"><option value="1">نسخة وحدة لكل منتج</option><option value="qty">على عدد الحبات في المخزن</option><option value="n">عدد أكتبه</option></select></label>'+
    '<label id="lblNL" hidden>العدد لكل منتج<input class="f" name="n" inputmode="numeric" value="2"></label>'+
    '<label class="chk"><input type="checkbox" name="packs" checked> وملصق للكرتونة للمنتجات اللي عندها كرتونة</label>'+
    '<div class="btns"><button class="btn primary">🖨️ طباعة</button></div><span class="msg" id="lbMsg"></span></form>')};
document.addEventListener("change",e=>{if(e.target.name==="copies"&&e.target.form&&e.target.form.dataset.form==="labels")$("lblNL").hidden=e.target.value!=="n"});
ACT.bcFill=async()=>{const L=matchProducts(P,true).list.filter(p=>p.active&&!p.barcode).map(p=>p.id);
  const n=await run(()=>api("barcode_fill",{p_ids:L}),null,"lbMsg");if(n==null)return;await run(()=>loadProducts());refresh();ACT.labels();toast("تولّد باركود لـ "+n+" منتج ✓")};
FORMS.labels=f=>{const L=matchProducts(P,true).list.filter(p=>p.active),cp=f.copies.value,n=Math.max(1,int(f.n.value));
  const out=[];L.forEach(p=>{const k=cp==="qty"?Math.max(0,p.qty):cp==="n"?n:1;for(let i=0;i<k;i++)out.push(labelHTML(p,false));
    if(f.packs.checked&&PK(p)){const kp=cp==="qty"?Math.floor(Math.max(0,p.qty)/PK(p)):cp==="n"?n:1;for(let i=0;i<kp;i++)out.push(labelHTML(p,true))}});
  if(!out.length)return setMsg("lbMsg","⚠️ ما فيش ملصقات تنطبع","err");
  if(out.length>1500)return setMsg("lbMsg","⚠️ "+out.length+" ملصق واجد. قلل المنتجات أو العدد.","err");
  if(f.size.value==="a4")printDoc('<div class="lsheet">'+out.join("")+'</div>',"size:A4;margin:6mm 0");
  else printDoc(out.join(""),"size:40mm 25mm;margin:0");
};

/* ================================================================
   اللوحة الرئيسية (للمدير)
   ================================================================ */
const pctCh=(a,b)=>b>0.0005?((a-b)/b*100):null;
const chTag=(a,b)=>{const c=pctCh(a,b);return c==null?"":(c>=0?"▲ ":"▼ ")+Math.abs(c).toFixed(0)+"٪ عن أمس"};
const ALERTK={negative_stock:"مخزون بالسالب",shift_diff:"فرق في الدرج",offline_no_shift:"بيع بدون نت بدون وردية",price_override:"تعديل سعر"};
function alertText(a){const d=a.detail||{};
  if(a.action==="negative_stock")return "فاتورة #"+d.sale+": "+(d.products||[]).map(x=>x.name).join("، ");
  if(a.action==="shift_diff")return "وردية #"+d.shift+": المتوقع "+fm(d.expected)+" والمعدود "+fm(d.counted)+" (فرق "+fm(d.diff)+")";
  if(a.action==="price_override")return "فاتورة #"+d.sale+": «"+(d.name||"")+"» من "+fm(d.from)+" إلى "+fm(d.to);
  if(a.action==="offline_no_shift")return "فاتورة #"+d.sale;return ""}
VIEWS.home=async()=>{
  const d=await run(()=>api("dashboard"));if(!d||VIEW!=="home")return;
  const t=d.days[d.days.length-1],y=d.days[d.days.length-2],mx=Math.max(1,...d.days.map(x=>+x.total));
  const mProfit=+d.month.total-+d.month.cost-(+d.month_ret.total-+d.month_ret.cost),cash=sumBy(d.shifts,s=>s.cash);
  const go=(h,txt)=>'<button class="link" data-act="go" data-h="'+h+'">'+txt+'</button>';
  $("view").innerHTML=
    '<div class="kpis">'+kpi("مبيعات اليوم",fm(t.total),t.n+" فاتورة · "+chTag(+t.total,+y.total),"main")+kpi("ربح اليوم",fm(t.profit),chTag(+t.profit,+y.profit),"good")+
      kpi("مبيعات الشهر",fm(d.month.total),d.month.n+" فاتورة · ربح "+fm(mProfit))+kpi("مصروفات",fm(d.exp_today),"اليوم · الشهر "+fm(d.exp_month),"bad")+
      kpi("في الأدراج توا",fm(cash),d.shifts.length+" وردية مفتوحة")+'</div>'+
    '<div class="cols">'+
      '<div class="panel"><div class="ph2"><h2>آخر 14 يوم</h2>'+go("reports","التقارير")+'</div><div class="pb"><div class="chart14">'+d.days.map(x=>{const v=+x.total,dt=new Date(x.d);
        return '<div class="c14" title="'+dShow(x.d)+' · '+fm(v)+' · ربح '+fm(x.profit)+'"><i style="height:'+(v/mx*100).toFixed(1)+'%"></i><span>'+dt.getDate()+'</span></div>'}).join("")+'</div></div></div>'+
      '<div class="panel"><div class="ph2"><h2>تنبيهات</h2></div><div class="list">'+
        [d.stock.neg?['bad',d.stock.neg+' منتج كميته بالسالب','products:neg']:null,d.stock.out?['w',d.stock.out+' منتج خالص','products:out']:null,d.stock.low?['w',d.stock.low+' منتج قرّب يكمل','products:low']:null,
         +d.cust.overdue>0.0005?['bad','ديون عملاء فات موعدها '+fm(d.cust.overdue)+' ('+d.cust.n_overdue+' عميل)','accounts']:null,
         +d.sup.overdue>0.0005?['bad','علينا للموردين فات موعده '+fm(d.sup.overdue),'reports:sup']:null,
         +d.sup.next_amount>0.0005?['w','يستحق للموردين خلال 7 أيام '+fm(d.sup.next_amount),'reports:sup']:null,
         d.po_open.n?['n',d.po_open.n+' أمر شراء مفتوح بقيمة '+fm(d.po_open.total),'po']:null,
         d.count_open?['n','فيه جرد مفتوح #'+d.count_open,'count']:null,
         d.offline_today?['n',d.offline_today+' بيعة انعملت بدون نت اليوم','invoices']:null].filter(Boolean).map(([c,tx,h])=>'<div class="row" tabindex="0" data-act="go" data-h="'+h+'"><span class="tag '+c+'">!</span><span class="mid">'+tx+'</span><span></span></div>').join("")+
        (d.alerts.length?d.alerts.map(a=>'<div class="row" style="cursor:default"><span class="no">'+ALERTK[a.action]+'</span><span class="mid">'+esc(alertText(a))+'<br><small dir="ltr">'+tShow(a.at)+'</small> · <small>'+esc(a.user||"")+'</small></span><span></span></div>').join(""):'')+
        '</div></div>'+
      '<div class="panel"><div class="ph2"><h2>الأدراج المفتوحة</h2></div>'+tbl([["البائع"],["فتحها"],["مبيعات الوردية",1],["في الدرج",1]],d.shifts.map(s=>'<tr><td class="nm">'+esc(s.user)+'</td><td dir="ltr" style="text-align:right">'+tShow(s.opened_at)+'</td>'+td(s.sales)+td(s.cash)+'</tr>'),null,"ما فيش ورديات مفتوحة.")+'</div>'+
      '<div class="panel"><div class="ph2"><h2>الأكثر مبيعاً (7 أيام)</h2></div>'+tbl([["المنتج"],["حبات",1],["المبيعات",1]],d.top.map(x=>'<tr tabindex="0" data-act="product" data-id="'+x.product_id+'"><td class="nm">'+esc(x.name)+'</td><td class="r">'+fm(x.q)+'</td>'+td(x.r)+'</tr>'))+'</div>'+
    '</div>'+
    '<div class="kpis" style="margin-top:14px">'+kpi("ديون العملاء",fm(d.cust.debt),d.cust.n+" عميل · متأخر "+fm(d.cust.overdue))+kpi("علينا للموردين",fm(d.sup.due),d.sup.next?"أقرب موعد "+dShow(d.sup.next):"")+
      kpi("قيمة المخزون",fm(d.stock.value),d.stock.n+" صنف")+'</div>';
};
ACT.go=b=>{const [v,f]=b.dataset.h.split(":");if(v==="products"&&f)FILT=f;if(v==="reports"&&f)RTAB=f;location.hash=v};

/* ================================================================
   أوامر الشراء
   ================================================================ */
let POC=null,POED=null;
const poline=()=>({name:"",qty:"",cost:""});
const POST={open:["مفتوح","w"],received:["مستلم","g"],cancel:["ملغي","n"]};
VIEWS.po=async()=>{
  if(!POC){const L=await run(()=>api("po_list"));if(!L)return;POC=L}if(VIEW!=="po")return;
  const sups=PARTIES.filter(x=>x.kind==="s"&&x.active);
  let h='';
  if(POED){const inp=(i,k,ph,ex)=>'<input class="f" data-po="'+k+'" data-i="'+i+'" value="'+esc(POED.lines[i][k])+'" placeholder="'+ph+'" autocomplete="off" '+(ex||"")+'>';
    h+='<div class="panel"><div class="ph2"><h2>'+(POED.id?"تعديل أمر الشراء #"+POED.no:"أمر شراء جديد")+'</h2><button class="link" data-act="poClose">رجوع</button></div><form class="pb" data-form="poSave">'+
      '<div class="grid2"><label>المورد<select class="f" id="poSup"><option value="">بدون مورد</option>'+sups.map(x=>'<option value="'+x.id+'"'+(POED.sup==x.id?" selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label><label>ملاحظة<input class="f" id="poNote" value="'+esc(POED.note)+'" autocomplete="off"></label></div>'+
      '<div class="btns"><button class="btn" type="button" data-act="poSuggest">اقتراح: اللي قرّب يكمل'+(POED.sup?' من هالمورد':'')+'</button></div>'+
      '<div style="display:grid;gap:8px">'+POED.lines.map((l,i)=>{const p=findP(l.name);return '<div class="line"><div class="grid3"><label>المنتج'+inp(i,"name","الاسم أو الباركود",'list="dlProducts"')+'</label><label>الكمية (حبة)'+inp(i,"qty","0",'inputmode="numeric"')+'</label><label>التكلفة المتوقعة'+inp(i,"cost",p?fm(p.cost):"0",'inputmode="decimal" dir="ltr"')+'</label></div>'+
        '<div class="sub">'+(p?'<span>المتوفر <b>'+p.qty+'</b></span><span>الحد <b>'+minOf(p)+'</b></span>'+(PK(p)?'<span>الكرتونة '+PK(p)+' حبة'+(int(l.qty)?' = <b>'+(int(l.qty)/PK(p)).toFixed(1).replace(/\.0$/,"")+'</b> كرتونة':'')+'</span>':''):(l.name?'<span class="tag w">مش موجود في المنتجات</span>':''))+'<button class="link" type="button" data-act="poDel" data-i="'+i+'">حذف</button></div></div>'}).join("")+'</div>'+
      '<div class="btns"><button class="btn" type="button" data-act="poAdd">+ منتج</button></div>'+
      '<div class="total"><span>الإجمالي المتوقع</span><b dir="ltr" id="poTot">'+fm(POED.lines.reduce((a,l)=>{const p=findP(l.name);return a+int(l.qty)*(l.cost===""&&p?+p.cost:pos(l.cost))},0))+'</b></div>'+
      '<div class="btns"><button class="btn primary">حفظ أمر الشراء</button><span class="msg" id="poMsg"></span></div></form></div>';
  }else h+='<div class="btns" style="margin-bottom:12px"><button class="btn primary" data-act="poNew">+ أمر شراء جديد</button></div>';
  const open=POC.filter(o=>o.status==="open");
  h+='<div class="panel"><div class="ph2"><h2>أوامر الشراء</h2><span class="hint">'+open.length+' مفتوح · '+fm(sumBy(open,o=>o.total))+' '+cur()+'</span></div><div class="list">'+(POC.length?POC.map(o=>'<div class="row" tabindex="0" data-act="poOpen" data-id="'+o.id+'"><span class="no" dir="ltr">#'+o.no+'</span><span class="mid"><span dir="ltr">'+dShow(o.at)+'</span> · '+(o.party?esc(o.party):"بدون مورد")+' · '+o.items.length+' صنف <span class="tag '+POST[o.status][1]+'">'+POST[o.status][0]+'</span>'+(o.purchase_no?' · فاتورة شراء #'+o.purchase_no:'')+'</span><span class="tot" dir="ltr">'+fm(o.total)+'</span></div>').join(""):'<div class="none">ما فيش أوامر شراء. اعمل واحد، أو من التقارير ← المخزون والطلب ← «أمر شراء منها».</div>')+'</div></div>';
  $("view").innerHTML=h;
};
ACT.poNew=()=>{POED={id:null,sup:"",note:"",lines:[poline()]};refresh()};
ACT.poClose=()=>{POED=null;refresh()};
ACT.poAdd=()=>{POED.lines.push(poline());refresh()};
ACT.poDel=b=>{POED.lines.splice(+b.dataset.i,1);if(!POED.lines.length)POED.lines.push(poline());refresh()};
document.addEventListener("input",e=>{const k=e.target.dataset.po;if(!k||!POED)return;POED.lines[+e.target.dataset.i][k]=e.target.value;
  const t=$("poTot");if(t)t.textContent=fm(POED.lines.reduce((a,l)=>{const p=findP(l.name);return a+int(l.qty)*(l.cost===""&&p?+p.cost:pos(l.cost))},0))});
document.addEventListener("change",e=>{if(!POED)return;if(e.target.id==="poSup")POED.sup=e.target.value;if(e.target.id==="poNote")POED.note=e.target.value;if(e.target.dataset.po==="name"){const p=findP(e.target.value);if(p&&e.target.value!==p.name){POED.lines[+e.target.dataset.i].name=p.name}refresh()}});
ACT.poSuggest=async()=>{const L=await run(()=>api("po_suggest",{p_party:+POED.sup||null}));if(!L)return;
  if(!L.length)return toast("ما فيش منتجات تحت حد التنبيه"+(POED.sup?" من هالمورد":""),1);
  const have=new Set(POED.lines.map(l=>(findP(l.name)||{}).id));POED.lines=POED.lines.filter(l=>norm(l.name));
  L.forEach(x=>{if(!have.has(x.product_id))POED.lines.push({name:x.name,qty:String(x.qty),cost:String(+x.cost)})});if(!POED.lines.length)POED.lines.push(poline());refresh();toast("انضاف "+L.length+" منتج")};
ACT.poFromOrder=async()=>{POED={id:null,sup:"",note:"",lines:[poline()]};POC=null;location.hash="po";await new Promise(r=>setTimeout(r,50));ACT.poSuggest()};
FORMS.poSave=async()=>{const rows=POED.lines.filter(l=>norm(l.name));if(!rows.length)return setMsg("poMsg","⚠️ زيد منتج","err");
  const items=[];for(const l of rows){const p=findP(l.name);if(!p)return setMsg("poMsg","⚠️ «"+l.name+"» مش موجود في المنتجات. زيده من المنتجات أو المشتريات الأول.","err");if(int(l.qty)<1)return setMsg("poMsg","⚠️ اكتب كمية «"+p.name+"»","err");items.push({product_id:p.id,qty:int(l.qty),cost:l.cost===""?null:pos(l.cost)})}
  const r=await run(()=>api("po_save",{p:{id:POED.id,party_id:+POED.sup||null,note:POED.note,items}}),null,"poMsg");if(!r)return;
  POED=null;POC=null;await VIEWS.po();toast("انحفظ أمر الشراء #"+r.no+" ✓");const o=POC&&POC.find(x=>x.id===r.id);if(o)poDlg(o)};
function poText(o){return ME.shop_name+"\nأمر شراء #"+o.no+" · "+dShow(o.at)+"\n"+o.items.map((i,k)=>(k+1)+". "+i.name+" — "+i.qty+" حبة"+(i.pack_qty>1&&i.qty%i.pack_qty===0?" ("+(i.qty/i.pack_qty)+" كرتونة)":"")).join("\n")+(o.note?"\n"+o.note:"")}
function poDlg(o){
  openDlg("أمر شراء #"+o.no,'<div class="sub"><span>'+(o.party?esc(o.party):"بدون مورد")+'</span><span dir="ltr">'+tShow(o.at)+'</span><span class="tag '+POST[o.status][1]+'">'+POST[o.status][0]+'</span><span>'+esc(o.user)+'</span></div>'+(o.note?'<div class="hint">'+esc(o.note)+'</div>':'')+
    tbl([["المنتج"],["الكمية",1],["التكلفة",1],["المجموع",1]],o.items.map(i=>'<tr><td class="nm">'+esc(i.name)+'</td><td class="r">'+i.qty+'</td>'+td(i.cost)+td(i.qty*i.cost)+'</tr>'),'<tr><td colspan="3">الإجمالي</td>'+td(o.total)+'</tr>')+
    '<div class="btns"><button class="btn" data-act="poPrint">🖨️ طباعة A4</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/'+(o.party_phone?waPhone(o.party_phone):"")+'?text='+encodeURIComponent(poText(o))+'">واتساب'+(o.party_phone?" للمورد":"")+'</a>'+
    (o.status==="open"?'<button class="btn primary" data-act="poReceive">استلام البضاعة</button><button class="btn" data-act="poEdit">تعديل</button><button class="btn danger" data-act="poCancel">إلغاء</button>':'')+
    (o.purchase_id?'<button class="btn" data-act="openPur" data-id="'+o.purchase_id+'">فاتورة الشراء #'+o.purchase_no+'</button>':'')+'</div>');
  CURPO=o}
let CURPO=null;
ACT.poOpen=b=>{const o=POC.find(x=>x.id===+b.dataset.id);if(o)poDlg(o)};
ACT.poPrint=()=>{const o=CURPO;printDoc('<div class="a4">'+a4Head("أمر شراء #"+o.no,(o.party?"المورد: <b>"+esc(o.party)+"</b> · ":"")+dShow(o.at))+
  '<table><thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>التكلفة</th><th>المجموع</th></tr></thead><tbody>'+o.items.map((i,k)=>'<tr><td>'+(k+1)+'</td><td>'+esc(i.name)+'</td><td>'+i.qty+(i.pack_qty>1&&i.qty%i.pack_qty===0?' ('+(i.qty/i.pack_qty)+' كرتونة)':'')+'</td><td>'+fm(i.cost)+'</td><td>'+fm(i.qty*i.cost)+'</td></tr>').join("")+
  '</tbody><tfoot><tr><td colspan="4">الإجمالي المتوقع</td><td>'+fm(o.total)+'</td></tr></tfoot></table>'+(o.note?'<p>'+esc(o.note)+'</p>':'')+'</div>',PA4)};
ACT.poEdit=()=>{const o=CURPO;POED={id:o.id,no:o.no,sup:o.party_id||"",note:o.note,lines:o.items.map(i=>({name:i.name,qty:String(i.qty),cost:String(+i.cost)}))};$("dlg").close();refresh()};
ACT.poCancel=()=>confirm2("إلغاء أمر الشراء #"+CURPO.no,"الأمر يتلغى وما يأثرش على المخزون.","إلغاء الأمر",async()=>{const r=await run(()=>api("po_cancel",{p_id:CURPO.id}),null,"c2Msg");if(r===undefined)return false;POC=null;$("dlg").close();refresh()},true);
ACT.poReceive=()=>{const o=CURPO;BL=o.items.map(i=>Object.assign(bline(),{name:(PB[i.product_id]||i).name,qty:String(i.qty),cost:String(+i.cost)}));
  const s=PARTIES.find(x=>x.id===o.party_id);BUYH={sup:o.party_id?String(o.party_id):"",ref:"",method:"cash",paid:"",note:"أمر شراء #"+o.no,po:o.id,pono:o.no,due:s&&s.terms_days>0?dueISO(s.terms_days):""};
  $("dlg").close();location.hash="buy";refresh()};
ACT.poUnlink=()=>{delete BUYH.po;delete BUYH.pono;refresh()};

/* ================================================================
   تصدير Excel (.xlsx حقيقي، بدون مكتبات)
   ================================================================ */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
function zip(files){const enc=new TextEncoder(),parts=[],cen=[];let off=0;
  const u16=v=>[v&255,(v>>8)&255],u32=v=>[v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];
  files.forEach(([name,txt])=>{const nb=enc.encode(name),db=enc.encode(txt),c=crc32(db);
    const lh=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(c),...u32(db.length),...u32(db.length),...u16(nb.length),...u16(0)]);
    parts.push(lh,nb,db);cen.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(c),...u32(db.length),...u32(db.length),...u16(nb.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nb);
    off+=lh.length+nb.length+db.length});
  const cl=cen.reduce((a,x)=>a+x.length,0);
  return new Blob([...parts,...cen,new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cl),...u32(off),...u16(0)])],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})}
const xesc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"");
function colName(i){let s="";i++;while(i){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s}
function xlsx(sheets){
  const names=new Set();sheets.forEach(s=>{let n=(s.name||"Sheet").replace(/[\[\]:*?\/\\]/g," ").slice(0,28).trim()||"Sheet",k=n,i=2;while(names.has(k))k=n+" "+(i++);names.add(k);s.name=k});
  const sh=s=>{const w=[];s.rows.forEach(r=>r.forEach((v,i)=>{w[i]=Math.min(60,Math.max(w[i]||8,String(v==null?"":v).length+2))}));
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
      (w.length?'<cols>'+w.map((x,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+x+'" customWidth="1"/>').join("")+'</cols>':'')+'<sheetData>'+
      s.rows.map((r,ri)=>'<row r="'+(ri+1)+'">'+r.map((v,ci)=>{const ref=colName(ci)+(ri+1),st=ri===0?' s="1"':'';if(v==null||v==="")return '';
        return typeof v==="number"&&isFinite(v)?'<c r="'+ref+'"'+st+'><v>'+v+'</v></c>':'<c r="'+ref+'"'+st+' t="inlineStr"><is><t xml:space="preserve">'+xesc(v)+'</t></is></c>'}).join("")+'</row>').join("")+'</sheetData></worksheet>'};
  const files=[["[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("")+'</Types>'],
    ["_rels/.rels",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>'<sheet name="'+xesc(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join("")+'</sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join("")+'<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ["xl/styles.xml",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF4"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']];
  sheets.forEach((s,i)=>files.push(["xl/worksheets/sheet"+(i+1)+".xml",sh(s)]));
  return zip(files)}
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000)}
const cellVal=td=>{const t=(td.innerText||td.textContent||"").replace(/\s+/g," ").trim();if(td.classList.contains("r")){const n=t.replace(/[٬,]/g,"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^\d.\-]/g,"");if(n&&/^-?\d+(\.\d+)?$/.test(n))return +n}return t};
function tablesToSheets(root,fallback){return [...root.querySelectorAll("table")].map((t,i)=>{const pn=t.closest(".panel,.sec"),h=pn&&pn.querySelector("h2,h3");
  return {name:(h?h.textContent.trim():fallback+" "+(i+1)),rows:[...t.querySelectorAll("tr")].map(tr=>[...tr.children].map(c=>c.tagName==="TH"?c.textContent.trim():cellVal(c)))}}).filter(s=>s.rows.length>1)}
const fileDate=()=>new Date().toISOString().slice(0,10);
ACT.xlsRep=()=>{const S=tablesToSheets($("rep"),"جدول");const tab=(RTABS.find(x=>x[0]===RTAB)||["",""])[1];
  const k=[...document.querySelectorAll("#rep .kpi")].map(x=>[x.querySelector("span").textContent,x.querySelector("b").textContent.trim(),x.querySelector("small").textContent]);
  if(k.length)S.unshift({name:"ملخص",rows:[["البند","القيمة","تفاصيل"]].concat(k.map(([a,b,c])=>[a,typeof b==="number"?b:(+String(b).replace(/[^\d.\-]/g,"")||b),c]))});
  if(!S.length)return toast("ما فيش جداول في هالتقرير",1);download(xlsx(S),"lub-market_report_"+RTAB+"_"+fileDate()+".xlsx");toast("تنزل ملف Excel ✓")};
ACT.xlsProducts=()=>{const L=matchProducts(P,true).list;
  download(xlsx([{name:"المنتجات",rows:[["#","المنتج","التصنيف","الباركود","الكمية","التكلفة","سعر البيع","سعر الجملة","قيمة المخزون","حبات الكرتونة","سعر الكرتونة","باركود الكرتونة","المكان","حد التنبيه","الحالة"]].concat(
    L.map(p=>[p.id,p.name,p.category||"",p.barcode||"",+p.qty,+p.cost||0,+p.price||0,+p.price_ws||0,r3(p.qty*(+p.cost||0)),p.pack_qty||"",+p.pack_price||"",p.pack_barcode||"",locCode(p)||"",minOf(p),p.active?"نشط":"موقوف"]))}]),"lub-market_products_"+fileDate()+".xlsx")};
ACT.xlsStmt=()=>{const pt=CURPT;download(xlsx([{name:"كشف الحساب",rows:[["التاريخ","البيان",pt.kind==="c"?"عليه":"له",pt.kind==="c"?"دفع":"دفعنا","الرصيد"]].concat(STMT.map(x=>[dShow(x.at),x.text,x.up||"",x.down||"",r3(x.run)]))},
  {name:"الفواتير",rows:[["الفاتورة","التاريخ","الاستحقاق","المبلغ","المسدد","الباقي"]].concat(PDOCS.docs.map(d=>[d.kind==="open"?"افتتاحي":"#"+d.no,dShow(d.at),d.due?dShow(d.due):"",d.amt,r3(d.paid),d.rem]))}]),"lub-market_statement_"+(pt.kind==="c"?"customer":"supplier")+pt.id+"_"+fileDate()+".xlsx")};

/* ================================================================
   البداية
   ================================================================ */
if(new URLSearchParams(location.search).has("display"))displayMode();else start();
