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
VIEWS.products=()=>{
  const placed=P.filter(has).length,val=isAdmin()?P.reduce((a,p)=>a+p.qty*(+p.cost||0),0):0;
  $("view").innerHTML='<div class="tools">'+searchBox("اسم المنتج، الرف (A1)، التصنيف أو الباركود…")+
    '<div class="chips">'+[["all","الكل"],["placed","محدد مكانه"],["unplaced","بدون مكان"],["low","قرّب يكمل"],["out","خالص"]].concat(isSeller()?[]:[["off","موقوف"]]).map(([k,t])=>'<button class="chip" type="button" data-act="filt" data-f="'+k+'" aria-pressed="'+(FILT===k)+'">'+t+'</button>').join("")+'</div>'+
    '<div class="btns">'+catSelect()+(isAdmin()?'<button class="btn primary" type="button" data-act="newProduct">+ منتج جديد</button>':'')+'<button class="btn" type="button" data-act="printAisles">🖨️ قائمة الممرات A4</button></div>'+
    '<div class="sub"><span>محدد مكانه <b>'+placed+'/'+P.length+'</b></span>'+(isAdmin()?'<span>قيمة المخزون بالتكلفة <b dir="ltr">'+fm(val)+'</b> '+cur()+'</span>':'')+'</div></div>'+
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
      '<div class="grid3"><label>التصنيف<input class="f" name="category" list="dlCats" value="'+esc(p.category)+'" autocomplete="off"></label><label>الباركود / الكود<input class="f" name="barcode" dir="ltr" value="'+esc(p.barcode||"")+'" autocomplete="off" data-noscan></label><label>حد التنبيه<input class="f" name="min_qty" inputmode="numeric" placeholder="'+esc(ME.default_min_qty)+'" value="'+(p.min_qty==null?"":p.min_qty)+'"></label></div>'+
      '<div class="grid2"><label>سعر البيع قطاعي ('+cur()+')<input class="f" name="price" inputmode="decimal" dir="ltr" value="'+(p.price||"")+'"></label><label>سعر البيع جملة (اختياري)<input class="f" name="price_ws" inputmode="decimal" dir="ltr" value="'+(p.price_ws||"")+'"></label></div>'+
      '<label class="chk"><input type="checkbox" name="off"'+(p.active?"":" checked")+'> موقوف: ما يطلعش في نقطة البيع</label></div>';
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
        min_qty:f.min_qty.value.trim()===""?null:f.min_qty.value,active:!f.off.checked,rack:f.rack.value,drawer:f.drawer.value,box:f.box.value,note:f.note.value}});
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
const newCart=()=>({items:[],party:null,discount:"",method:"cash",paid:"",note:""});
let CART=newCart();
const saveCart=()=>ME&&LS.set("cart_"+ME.id,CART);
const cartParty=()=>CART.party?PARTIES.find(x=>x.id===CART.party):null;
const priceFor=(p,pt)=>pt&&pt.price_level==="ws"&&p.price_ws>0?+p.price_ws:+p.price;
const inCart=id=>{const c=CART.items.find(x=>x.id===id);return c?c.qty:0};
const cartSub=()=>CART.items.reduce((a,c)=>a+c.qty*c.price,0);
const cartTotal=()=>Math.max(0,cartSub()-pos(CART.discount));
const sellable=p=>p.active&&p.qty>0&&(isAdmin()||p.price>0);
VIEWS.pos=()=>{
  if(isSeller()&&!SHIFT){$("posbar").hidden=true;
    $("view").innerHTML='<div class="panel" style="max-width:460px;margin:20px auto"><div class="ph2"><h2>افتح الوردية باش تبدا تبيع</h2></div><form class="pb" data-form="shiftOpen"><label>المبلغ اللي في الدرج توا ('+cur()+')<input class="f" name="cash" inputmode="decimal" dir="ltr" placeholder="0"></label><div class="btns"><button class="btn primary">فتح الوردية</button></div><span class="msg" id="soMsg"></span></form></div>';return}
  $("posbar").hidden=false;
  $("view").innerHTML='<div class="tools">'+searchBox("دوّر على المنتج أو امسح الباركود…")+'<div class="btns">'+catSelect()+'</div></div><div class="grid" id="sgrid"></div><div class="empty" id="sempty" hidden>ما لقيناش منتج.</div>';
  renderPosGrid();
};
function renderPosGrid(){
  const g=$("sgrid");if(!g)return;const pt=cartParty();
  const {list,terms}=matchProducts(P.filter(p=>p.active),false);
  const x=document.querySelector("#view .search .x");if(x)x.hidden=!Q;
  g.innerHTML=list.map(p=>{const n=inCart(p.id),pr=priceFor(p,pt);return '<div class="card'+(sellable(p)?"":" off")+'" role="button" tabindex="0" data-act="add" data-id="'+p.id+'"><div class="ph"><img src="'+img(p)+'" alt="" loading="lazy">'+(n?'<span class="incart">×'+n+'</span>':'')+'</div>'+
    '<div class="body"><div class="name">'+hl(p.name,terms)+'</div><div class="inv"><span class="price" dir="ltr">'+(pr>0?fm(pr):'<small style="font-family:var(--f-body)">بدون سعر</small>')+'</span>'+qtyHTML(p)+'</div></div></div>'}).join("");
  $("sempty").hidden=list.length>0;bar();
}
function bar(){const n=CART.items.reduce((a,c)=>a+c.qty,0),held=LS.get("held_"+ME.id,[]).length;
  $("bCount").textContent=n?"السلة: "+n+" قطعة":"السلة فاضية";$("bTotal").textContent=fm(cartTotal());$("bPay").disabled=!n;$("bHold").hidden=!n;
  $("bHeld").hidden=!held;$("bHeld").textContent="المعلقة ("+held+")"}
function addToCart(id,quiet){
  const p=PB[id];if(!p)return false;
  const why=!p.active?"موقوف":isOut(p)?"خالص من المخزون":!isAdmin()&&!(p.price>0)?"ما عندهش سعر بيع":inCart(id)>=p.qty?"المتوفر "+fm(p.qty)+" بس":"";
  if(why){toast("«"+p.name+"» "+why,1);return false}
  const c=CART.items.find(x=>x.id===id);if(c)c.qty++;else CART.items.push({id,qty:1,price:priceFor(p,cartParty()),ov:false});
  saveCart();if(VIEW==="pos")renderPosGrid();if(!quiet)toast("انزاد للسلة: "+p.name+" ×"+inCart(id));return true;
}
ACT.add=b=>addToCart(+b.dataset.id,true);
FORMS.shiftOpen=async f=>{await run(async()=>{await api("shift_open",{p_opening:pos(f.cash.value)});await loadShift();route();toast("انفتحت الوردية ✓")},null,"soMsg")};

/* قارئ الباركود: يكتب الأرقام بسرعة ويضغط Enter */
let scanBuf="",scanT=0;
const byCode=c=>{c=digits(c).trim();return c?P.find(p=>p.barcode&&p.barcode===c):null};
document.addEventListener("keydown",e=>{
  if(!ME||VIEW!=="pos"||(isSeller()&&!SHIFT))return;
  const d1=$("dlg").open,cartOpen=d1&&$("dlgB").dataset.kind==="cart";
  if((d1&&!cartOpen)||$("dlg2").open)return;
  const t=e.target,inQ=t.id==="q";
  if(!inQ&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))return;
  if(e.key==="Enter"){
    if(inQ){const v=t.value,p=byCode(v);if(p||/^\d{6,}$/.test(digits(v).trim())){e.preventDefault();e.stopPropagation();Q="";t.value="";if(p)addToCart(p.id);else toast("ما فيش منتج بالباركود "+digits(v).trim(),1);renderPosGrid()}return}
    const code=scanBuf;scanBuf="";if(code.length>=3){e.preventDefault();e.stopPropagation();const p=byCode(code);if(p){if(addToCart(p.id)&&cartOpen)cartDlg()}else toast("ما فيش منتج بالباركود "+code,1)}return}
  if(inQ)return;
  if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const now=Date.now();if(now-scanT>120)scanBuf="";scanBuf+=e.key;scanT=now}
},true);

/* السلة */
ACT.cart=()=>cartDlg();
function cartDlg(){
  const pt=cartParty(),adm=isAdmin(),maxD=+ME.max_seller_discount_pct||0,cs=PARTIES.filter(x=>x.kind==="c"&&x.active);
  let h='<div style="display:grid;gap:10px" id="cLines">'+(CART.items.length?CART.items.map((c,i)=>{const p=PB[c.id]||{name:"؟",qty:0};return '<div class="line" data-i="'+i+'"><div class="top"><div><b>'+esc(p.name)+'</b><small>المتوفر '+fm(p.qty)+'</small></div><button class="link" type="button" data-act="cDel" data-i="'+i+'">حذف</button></div>'+
    '<div class="row2"><label>الكمية<div class="step"><button type="button" data-act="cDec" data-i="'+i+'" aria-label="نقّص">−</button><input class="f" data-c="qty" data-i="'+i+'" inputmode="numeric" value="'+c.qty+'"><button type="button" data-act="cInc" data-i="'+i+'" aria-label="زيد">+</button></div></label>'+
    '<label>السعر<input class="f" data-c="price" data-i="'+i+'" inputmode="decimal" dir="ltr" value="'+(c.price||"")+'"'+(adm?"":" readonly")+'></label><div class="lt" dir="ltr" data-lt="'+i+'">'+fm(c.qty*c.price)+'</div></div></div>'}).join(""):'<div class="none">السلة فاضية.</div>')+'</div>';
  h+='<div class="sec"><h3>العميل</h3><select class="f" id="cParty"><option value="">بيع نقدي (بدون عميل)</option>'+cs.map(x=>'<option value="'+x.id+'"'+(pt&&pt.id===x.id?" selected":"")+'>'+esc(x.name)+(x.price_level==="ws"?" (جملة)":"")+'</option>').join("")+'</select><div class="sub" id="cPInfo"></div></div>';
  h+='<div class="sec"><h3>الدفع</h3><div class="chips">'+Object.keys(METHODS).map(k=>'<button class="chip" type="button" data-act="cMethod" data-m="'+k+'" aria-pressed="'+(CART.method===k)+'">'+METHODS[k]+'</button>').join("")+'</div>'+
    '<div class="grid2"><label>الخصم ('+cur()+')'+(adm?'':' · حدك '+maxD+'٪')+'<input class="f" data-c="discount" inputmode="decimal" dir="ltr" placeholder="0" value="'+esc(CART.discount)+'"'+(!adm&&!maxD?" readonly":"")+'></label>'+
    '<label'+(pt?'':' hidden')+' id="cPaidL">المدفوع الآن<input class="f" data-c="paid" inputmode="decimal" dir="ltr" placeholder="0" value="'+esc(CART.paid)+'"></label></div>'+
    '<label>ملاحظة (اختياري)<input class="f" data-c="note" value="'+esc(CART.note)+'" autocomplete="off"></label></div>';
  h+='<div class="sub" id="cSums"></div><div class="total"><span>الإجمالي</span><b><span id="cTotal" dir="ltr">0</span> <small style="font-size:.8rem">'+cur()+'</small></b></div>'+
    '<div class="btns"><button class="btn primary" type="button" data-act="checkout"'+(CART.items.length?"":" disabled")+'>إتمام البيع</button><button class="btn" type="button" data-act="hold">تعليق</button><button class="btn" type="button" data-act="cClear">تفريغ</button></div><span class="msg" id="cMsg"></span>';
  openDlg("السلة",h);$("dlgB").dataset.kind="cart";cartSums();
}
$("dlg").addEventListener("close",()=>{const k=$("dlgB").dataset.kind;$("dlgB").dataset.kind="";if(k==="cart"&&VIEW==="pos")renderPosGrid()});
function cartSums(){
  const pt=cartParty(),sub=cartSub(),d=pos(CART.discount),tot=cartTotal(),paid=pt?Math.min(pos(CART.paid),tot):tot;
  CART.items.forEach((c,i)=>{const e=document.querySelector('[data-lt="'+i+'"]');if(e)e.textContent=fm(c.qty*c.price)});
  if($("cTotal"))$("cTotal").textContent=fm(tot);
  if($("cSums"))$("cSums").innerHTML='<span>المجموع '+money(sub)+'</span>'+(d?'<span>الخصم '+money(d)+'</span>':'')+(pt?'<span>الباقي على العميل '+money(tot-paid)+'</span>':'');
  if($("cPInfo")){$("cPInfo").innerHTML=pt?'<span>رصيده الحالي '+money(pt.balance)+'</span><span>بعد الفاتورة '+money(+pt.balance+tot-paid)+'</span>'+(pt.warn_limit>0&&+pt.balance+tot-paid>pt.warn_limit?'<span class="tag w">تنبيه: رصيده يفوت السقف '+fm(pt.warn_limit)+'</span>':'')+(pt.price_level==="ws"?'<span class="tag n">أسعار الجملة</span>':''):''}
  bar();saveCart();
}
document.addEventListener("input",e=>{const k=e.target.dataset.c;if(!k)return;const i=+e.target.dataset.i;
  if(k==="qty"){const c=CART.items[i],p=PB[c.id];c.qty=Math.max(1,Math.min(int(e.target.value)||1,p?p.qty:1))}
  else if(k==="price"){if(!isAdmin())return;CART.items[i].price=pos(e.target.value);CART.items[i].ov=true}
  else CART[k]=e.target.value;
  cartSums()});
document.addEventListener("change",e=>{if(e.target.id!=="cParty")return;CART.party=+e.target.value||null;const pt=cartParty();
  CART.items.forEach(c=>{const p=PB[c.id];if(p&&!c.ov)c.price=priceFor(p,pt)});if(!pt)CART.paid="";saveCart();cartDlg()});
ACT.cInc=b=>{const c=CART.items[+b.dataset.i],p=PB[c.id];if(p&&c.qty<p.qty)c.qty++;else toast("المتوفر "+fm(p?p.qty:0)+" بس",1);saveCart();cartDlg()};
ACT.cDec=b=>{const c=CART.items[+b.dataset.i];if(c.qty>1)c.qty--;saveCart();cartDlg()};
ACT.cDel=b=>{CART.items.splice(+b.dataset.i,1);saveCart();cartDlg()};
ACT.cClear=()=>{CART=newCart();saveCart();cartDlg()};
ACT.cMethod=b=>{CART.method=b.dataset.m;document.querySelectorAll('[data-act="cMethod"]').forEach(x=>x.setAttribute("aria-pressed",x===b));saveCart()};
ACT.checkout=async b=>{
  const pt=cartParty(),tot=cartTotal(),bad=CART.items.find(c=>!(c.price>0));
  if(bad)return setMsg("cMsg","⚠️ اكتب السعر للمنتج «"+(PB[bad.id]||{}).name+"»","err");
  if(pt&&pos(CART.paid)>tot+1e-9)return setMsg("cMsg","⚠️ المدفوع أكبر من الإجمالي","err");
  b.disabled=true;
  const r=await run(()=>api("sale_create",{p:{party_id:pt?pt.id:null,discount:pos(CART.discount),paid:pt?pos(CART.paid):null,method:CART.method,note:CART.note,
    items:CART.items.map(c=>Object.assign({product_id:c.id,qty:c.qty},isAdmin()?{price:c.price}:{}))}}),null,"cMsg");
  b.disabled=false;if(!r)return;
  CART=newCart();saveCart();
  await run(()=>Promise.all([loadProducts(),loadParties(),loadShift()]));
  const s=await run(()=>api("sale_get",{p_id:r.id}));renderPosGrid();
  if(s)saleDlg(s,true);
  if(r.over_limit)toast("تنبيه: رصيد العميل فات سقف التنبيه",1);
};

/* الفواتير المعلقة (تتخزن في هالجهاز) */
ACT.hold=()=>{if(!CART.items.length)return;const h=LS.get("held_"+ME.id,[]);h.push({at:Date.now(),cart:CART});LS.set("held_"+ME.id,h);CART=newCart();saveCart();if($("dlg").open)$("dlg").close();renderPosGrid();toast("تعلقت الفاتورة ✓")};
ACT.held=()=>{const h=LS.get("held_"+ME.id,[]);
  openDlg("الفواتير المعلقة",h.length?'<div class="list">'+h.map((x,i)=>{const n=x.cart.items.reduce((a,c)=>a+c.qty,0),t=x.cart.items.reduce((a,c)=>a+c.qty*c.price,0)-pos(x.cart.discount);
    return '<div class="row" style="cursor:default"><span class="no">'+(i+1)+'</span><span class="mid"><span dir="ltr">'+tShow(x.at)+'</span> · '+n+' قطعة'+(x.cart.party?' · '+esc(pname(x.cart.party)):'')+'<br><b class="mono" dir="ltr" style="color:var(--ink)">'+fm(t)+'</b></span><span class="btns"><button class="btn sm primary" data-act="resume" data-i="'+i+'">رجّعها للسلة</button><button class="btn sm danger" data-act="dropHeld" data-i="'+i+'">حذف</button></span></div>'}).join("")+'</div>':'<div class="none">ما فيش فواتير معلقة.</div>')};
ACT.resume=b=>{const h=LS.get("held_"+ME.id,[]),x=h.splice(+b.dataset.i,1)[0];if(!x)return;
  if(CART.items.length)h.push({at:Date.now(),cart:CART});
  CART=x.cart;CART.items=CART.items.filter(c=>PB[c.id]);LS.set("held_"+ME.id,h);saveCart();renderPosGrid();cartDlg()};
ACT.dropHeld=b=>{const h=LS.get("held_"+ME.id,[]);h.splice(+b.dataset.i,1);LS.set("held_"+ME.id,h);bar();ACT.held()};

/* الإيصال */
function receiptHTML(s){
  const rows=s.items.map(i=>'<tr><td>'+esc(i.name)+'<br>'+i.qty+' × '+fm(i.price)+(i.returned?' <small>(مرتجع '+i.returned+')</small>':'')+'</td><td style="text-align:left;vertical-align:bottom" dir="ltr">'+fm(i.qty*i.price)+'</td></tr>').join("");
  return '<div class="rc">'+shopHead()+'<hr><div style="display:flex;justify-content:space-between"><span>فاتورة <b dir="ltr">#'+s.no+'</b></span><span dir="ltr">'+tShow(s.at)+'</span></div>'+
    '<div>البائع: '+esc(s.user)+(s.party?' · العميل: '+esc(s.party):'')+'</div>'+(s.status==="void"?'<div class="c"><b>*** فاتورة ملغية ***</b></div>':'')+'<hr>'+
    '<table style="width:100%">'+rows+'</table><hr><table style="width:100%">'+
    (s.discount>0?'<tr><td>المجموع</td><td style="text-align:left" dir="ltr">'+fm(s.subtotal)+'</td></tr><tr><td>الخصم</td><td style="text-align:left" dir="ltr">'+fm(s.discount)+'</td></tr>':'')+
    '<tr class="tot"><td>الإجمالي</td><td style="text-align:left" dir="ltr">'+fm(s.total)+' '+esc(cur())+'</td></tr>'+
    '<tr><td>المدفوع ('+METHODS[s.method]+')</td><td style="text-align:left" dir="ltr">'+fm(s.paid)+'</td></tr>'+
    (s.party_id?'<tr><td>الباقي على الحساب</td><td style="text-align:left" dir="ltr">'+fm(s.total-s.paid)+'</td></tr><tr><td>رصيد الحساب الآن</td><td style="text-align:left" dir="ltr">'+fm(s.balance)+'</td></tr>':'')+
    '</table>'+(s.returns&&s.returns.length?'<hr>'+s.returns.map(r=>'<div>مرتجع #'+r.no+' بتاريخ '+dShow(r.at)+': '+fm(r.total)+'</div>').join(""):'')+
    (s.note?'<hr><div>'+esc(s.note)+'</div>':'')+'<hr><div class="c">'+esc(ME.receipt_footer||"")+'</div></div>';
}
function waPhone(ph){let d=digits(ph).replace(/\D/g,"");if(!d)return "";if(d.startsWith("00"))d=d.slice(2);else if(d.startsWith("0"))d="218"+d.slice(1);return d}
function receiptText(s){return ME.shop_name+"\nفاتورة #"+s.no+" · "+tShow(s.at)+"\n"+s.items.map(i=>"- "+i.name+" "+i.qty+"×"+fm(i.price)+" = "+fm(i.qty*i.price)).join("\n")+
  (s.discount>0?"\nالخصم: "+fm(s.discount):"")+"\nالإجمالي: "+fm(s.total)+" "+cur()+"\nالمدفوع: "+fm(s.paid)+(s.party_id?"\nالباقي على الحساب: "+fm(s.total-s.paid)+"\nرصيدك الآن: "+fm(s.balance):"")+"\n"+(ME.receipt_footer||"")}

/* ================================================================
   الفواتير
   ================================================================ */
let INVC=null, INVF={user:"",party:"",status:""};
const invalidate=()=>{INVC=null;REPC=null;BUYC=null;ALLD=null;LEDALL=null;AUD=null};
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
    '<div class="kpis">'+kpi(adm?"المبيعات":"مبيعاتي",fm(tot),rangeLabel(),"main")+kpi("عدد الفواتير",ok.length,list.length-ok.length?(list.length-ok.length)+" ملغية":"")+kpi("نقدي",fm(ok.filter(s=>s.method==="cash").reduce((a,s)=>a+ +s.paid,0)),"المدفوع نقداً")+'</div>'+
    '<div class="panel"><div class="list">'+(list.length?list.map(s=>{const n=s.items.reduce((a,i)=>a+i.qty,0),ret=s.items.some(i=>i.returned);
      return '<div class="row'+(s.status==="void"?" void":"")+'" tabindex="0" data-act="openSale" data-id="'+s.id+'"><span class="no" dir="ltr">#'+s.no+'</span><span class="mid"><span dir="ltr">'+tShow(s.at)+'</span> · '+n+' قطعة · '+METHODS[s.method]+(adm?' · '+esc(uname(s.user_id)):'')+(s.party_id?' · '+esc(pname(s.party_id)):'')+(s.status==="void"?' <span class="tag">ملغية</span>':'')+(ret?' <span class="tag w">فيها مرتجع</span>':'')+'</span><span class="tot" dir="ltr">'+fm(s.total)+'</span></div>'}).join(""):'<div class="none">ما فيش فواتير في هالفترة.</div>')+'</div></div>';
};
document.addEventListener("change",e=>{const k=e.target.dataset.invf;if(!k)return;INVF[k]=e.target.value;refresh()});
FORMS.findSale=async f=>{const n=int(f.no.value);if(!n)return;const id=await run(()=>api("sale_find",{p_no:n}));if(id)openSale(id)};
ACT.openSale=b=>openSale(+b.dataset.id);
async function openSale(id){const s=await run(()=>api("sale_get",{p_id:id}));if(s)saleDlg(s)}
let CURS=null;
function saleDlg(s,fresh){
  CURS=s;const adm=isAdmin(),canRet=adm&&s.status==="ok"&&s.items.some(i=>i.qty>i.returned),pt=s.party_id?PARTIES.find(x=>x.id===s.party_id):null,ph=pt&&pt.phone;
  openDlg((fresh?"تم البيع ✓ · ":"")+"فاتورة #"+s.no,
    (fresh?'<div class="msg ok" style="text-align:center;font-weight:600">انخصمت الكميات من المخزون'+(s.party_id?' وتسجلت على حساب «'+esc(s.party)+'»':'')+'</div>':'')+
    '<div class="rcbox">'+receiptHTML(s)+'</div>'+
    '<div class="btns" style="justify-content:center"><button class="btn primary" data-act="printSale">🖨️ طباعة</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/'+(ph?waPhone(ph):"")+'?text='+encodeURIComponent(receiptText(s))+'">واتساب'+(ph?" للعميل":"")+'</a>'+
    (canRet?'<button class="btn" data-act="saleReturn">مرتجع</button>':'')+(adm&&s.status==="ok"&&!s.returns.length?'<button class="btn danger" data-act="saleVoid">إلغاء الفاتورة</button>':'')+(fresh?'<button class="btn" data-act="close">بيع جديد</button>':'')+'</div>');
}
ACT.printSale=()=>CURS&&printDoc(receiptHTML(CURS),P80);
ACT.saleVoid=()=>confirm2("إلغاء فاتورة #"+CURS.no,"الكميات ترجع للمخزون، والفاتورة تنشال من حساب العميل، والمبلغ المدفوع يطلع من الدرج. متأكد؟","إلغاء الفاتورة",async()=>{
  const ok=await run(()=>api("sale_void",{p_sale:CURS.id}),null,"c2Msg");if(ok===undefined)return false;
  invalidate();await run(()=>Promise.all([loadProducts(),loadParties(),loadShift()]));await openSale(CURS.id);refresh();toast("انلغت الفاتورة ✓")},true);
ACT.saleReturn=()=>{const s=CURS,cr=!!s.party_id;
  openDlg("مرتجع من فاتورة #"+s.no,'<form class="db" style="padding:0" data-form="saleReturn"><div class="hint">اكتب كمية كل منتج راجع. اللي ما رجعش خليه صفر.'+(s.discount>0?' الخصم يتوزع على القطع بالنسبة.':'')+'</div>'+
    s.items.map(i=>{const left=i.qty-i.returned;return '<div class="line"><div class="top"><div><b>'+esc(i.name)+'</b><small>انباع '+i.qty+(i.returned?' · رجع قبل '+i.returned:'')+' · السعر '+fm(i.price)+'</small></div></div><label>الكمية الراجعة (حدها '+left+')<input class="f" name="q'+i.id+'" inputmode="numeric" value="0"'+(left?"":" readonly")+'></label></div>'}).join("")+
    (cr?'<div class="sec"><div class="hint">الفاتورة على حساب «'+esc(s.party)+'»: قيمة المرتجع تنقص من حسابه. لو رجعتله فلوس في يده اكتبها هنا.</div><div class="grid2"><label>رجعتله فلوس<input class="f" name="refund" inputmode="decimal" dir="ltr" placeholder="0"></label><label>طريقتها<select class="f" name="method">'+Object.keys(METHODS).map(k=>'<option value="'+k+'">'+METHODS[k]+'</option>').join("")+'</select></label></div></div>':
      '<div class="hint">بيع نقدي: قيمة المرتجع ترجع للزبون '+METHODS[s.method]+'.</div><input type="hidden" name="method" value="'+s.method+'">')+
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
    '<form class="sec" data-form="expense"><h3>تسجيل مصروف</h3><div class="grid3"><label>النوع<input class="f" name="cat" list="dlExp" autocomplete="off" placeholder="نقل وتوصيل"></label><label>المبلغ<input class="f" name="amount" inputmode="decimal" dir="ltr"></label><label>الطريقة<select class="f" name="method">'+Object.keys(METHODS).map(k=>'<option value="'+k+'">'+METHODS[k]+'</option>').join("")+'</select></label></div><label>ملاحظة<input class="f" name="note" autocomplete="off"></label><div class="btns"><button class="btn">تسجيل المصروف</button><span class="msg" id="exMsg"></span></div></form>'+
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
  $("view").innerHTML='<div class="panel"><div class="ph2"><h2>فاتورة شراء جديدة</h2><span class="hint">الكميات تنزاد للمخزون أول ما تحفظ</span></div><form class="pb" data-form="purchase">'+
    '<div class="grid2"><label>المورد<select class="f" data-bh="sup"><option value="">شراء نقدي بدون مورد</option>'+sups.map(x=>'<option value="'+x.id+'"'+(BUYH.sup==x.id?" selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label>'+
    '<label>رقم فاتورة المورد (اختياري)<input class="f" data-bh="ref" dir="ltr" value="'+esc(BUYH.ref)+'" autocomplete="off"></label></div>'+
    '<div style="display:grid;gap:10px">'+BL.map((l,i)=>'<div class="line" data-bl="'+i+'"><div class="top"><b>المنتج '+(i+1)+'</b>'+(BL.length>1?'<button class="link" type="button" data-act="bDel" data-i="'+i+'">حذف السطر</button>':'')+'</div>'+
      '<label>الاسم أو الباركود'+inp(i,"name","اكتب الاسم أو امسح الباركود",'list="dlProducts"')+'</label><div class="hint" data-bst="'+i+'"></div>'+
      '<div class="grid3"><label>الكمية'+inp(i,"qty","0",'inputmode="numeric"')+'</label><label>سعر التكلفة'+inp(i,"cost","0.00",'inputmode="decimal" dir="ltr"')+'</label><label>سعر البيع'+inp(i,"price","اختياري",'inputmode="decimal" dir="ltr"')+'</label></div>'+
      '<details><summary class="hint" style="cursor:pointer">سعر الجملة والمكان في المخزن</summary><div class="grid4" style="margin-top:8px"><label>سعر الجملة'+inp(i,"price_ws","اختياري",'inputmode="decimal" dir="ltr"')+'</label><label>الرف'+inp(i,"rack","A1",'dir="ltr" style="text-transform:uppercase"')+'</label><label>الدرج'+inp(i,"drawer","1",'inputmode="numeric"')+'</label><label>البوكس'+inp(i,"box","1",'inputmode="numeric"')+'</label></div></details>'+
      '<div class="sub"><span>مجموع السطر <b dir="ltr" data-blt="'+i+'">0</b></span></div></div>').join("")+'</div>'+
    '<div class="btns"><button class="btn" type="button" data-act="bAdd">+ زيد منتج</button></div>'+
    '<div class="total"><span>إجمالي الفاتورة بسعر التكلفة</span><b><span id="bTot" dir="ltr">0</span> <small style="font-size:.8rem">'+cur()+'</small></b></div>'+
    '<div class="grid3"><label>طريقة الدفع<select class="f" data-bh="method">'+Object.keys(METHODS).map(k=>'<option value="'+k+'"'+(BUYH.method===k?" selected":"")+'>'+METHODS[k]+'</option>').join("")+'</select></label>'+
    '<label id="bPaidL">المدفوع الآن<input class="f" data-bh="paid" inputmode="decimal" dir="ltr" placeholder="0" value="'+esc(BUYH.paid)+'"></label><div class="sub" id="bInfo" style="align-self:end;padding-bottom:10px"></div></div>'+
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
  el.innerHTML=!norm(l.name)?"":p?'موجود (#'+p.id+') · المتوفر <b>'+p.qty+'</b> · التكلفة الحالية <b dir="ltr">'+fm(p.cost)+'</b> · البيع <b dir="ltr">'+fm(p.price)+'</b>':'<span class="tag w">منتج جديد</span> ينضاف مع حفظ الفاتورة'}
function bSums(){const t=BL.reduce((a,l)=>a+int(l.qty)*pos(l.cost),0);BL.forEach((l,i)=>{const e=document.querySelector('[data-blt="'+i+'"]');if(e)e.textContent=fm(int(l.qty)*pos(l.cost))});
  if($("bTot"))$("bTot").textContent=fm(t);if($("bPaidL"))$("bPaidL").hidden=!BUYH.sup;
  if($("bInfo"))$("bInfo").innerHTML=BUYH.sup?'<span>الباقي علينا للمورد '+money(Math.max(0,t-pos(BUYH.paid)))+'</span>':'<span>شراء نقدي: الفاتورة مدفوعة كلها</span>'}
document.addEventListener("input",e=>{const k=e.target.dataset.b,h=e.target.dataset.bh;
  if(h){BUYH[h]=e.target.value;return bSums()}
  if(!k)return;const i=+e.target.dataset.i;BL[i][k]=e.target.value;
  if(k==="name"){const p=findP(BL[i].name),row=document.querySelector('[data-bl="'+i+'"]');
    if(p){if(byCode(BL[i].name)===p&&norm(BL[i].name)!==p.n){BL[i].name=p.name;e.target.value=p.name}
      [["cost",p.cost],["price",p.price],["price_ws",p.price_ws],["rack",p.rack],["drawer",p.drawer],["box",p.box]].forEach(([f,v])=>{if(!BL[i][f]&&v&&+v!==0){BL[i][f]=String(v);row.querySelector('[data-b="'+f+'"]').value=v}})}
    bInfo(i)}
  bSums()});
document.addEventListener("change",e=>{if(e.target.dataset.bh){BUYH[e.target.dataset.bh]=e.target.value;bSums()}});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.dataset&&e.target.dataset.b){e.preventDefault();e.target.dispatchEvent(new Event("input",{bubbles:true}))}});
ACT.bAdd=()=>{BL.push(bline());refresh();const r=document.querySelector('[data-bl="'+(BL.length-1)+'"] input');if(r){r.scrollIntoView({block:"center"});r.focus()}};
ACT.bDel=b=>{BL.splice(+b.dataset.i,1);refresh()};
FORMS.purchase=async()=>{
  const rows=BL.filter(l=>norm(l.name)||l.qty||l.cost);if(!rows.length)return setMsg("bMsg","⚠️ زيد منتج واحد على الأقل","err");
  for(const [i,l] of rows.entries()){const n="المنتج "+(BL.indexOf(l)+1)+": ";
    if(!norm(l.name))return setMsg("bMsg","⚠️ "+n+"اكتب الاسم","err");if(int(l.qty)<1)return setMsg("bMsg","⚠️ "+n+"اكتب الكمية","err");if(!(pos(l.cost)>0))return setMsg("bMsg","⚠️ "+n+"اكتب سعر التكلفة","err")}
  const items=rows.map(l=>{const p=findP(l.name);return Object.assign(p?{product_id:p.id}:{name:l.name.trim()},{qty:int(l.qty),cost:pos(l.cost),price:pos(l.price)||null,price_ws:pos(l.price_ws)||null},l.rack.trim()?{rack:l.rack,drawer:l.drawer,box:l.box}:{})});
  const r=await run(()=>api("purchase_create",{p:{party_id:+BUYH.sup||null,ref:BUYH.ref,paid:BUYH.sup?pos(BUYH.paid):null,method:BUYH.method,note:BUYH.note,items}}),null,"bMsg");if(!r)return;
  BL=[bline()];BUYH={sup:"",ref:"",method:"cash",paid:"",note:""};invalidate();
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
function alloc(rows){
  const key=x=>x.sale_id?"s"+x.sale_id:x.purchase_id?"b"+x.purchase_id:"";
  const docs=rows.filter(x=>["open","inv","buy"].includes(x.kind)).map(x=>({at:x.at,kind:x.kind,amt:+x.amount,key:key(x)||"o"+x.id,sale_id:x.sale_id,purchase_id:x.purchase_id,no:x.sale_no||x.purchase_no,paid:0}));
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
      '<label>رصيد افتتاحي ('+(c?"عليه":"له")+')<input class="f" name="open" dir="ltr" inputmode="decimal" placeholder="0"></label></div><div class="btns"><button class="btn primary">إضافة</button><span class="msg" id="paMsg"></span></div></form></div>':'');
};
document.addEventListener("input",e=>{if(e.target.id==="q"&&VIEW==="accounts"){const s=e.target.selectionStart;refresh();const q=$("q");q.focus();q.setSelectionRange(s,s)}});
ACT.ptype=b=>{PTYPE=b.dataset.t;refresh()};
FORMS.partyAdd=async f=>{await run(async()=>{const r=await api("party_save",{p:{kind:PTYPE,name:f.name.value,phone:f.phone.value,warn_limit:f.warn?f.warn.value:0,price_level:f.level?f.level.value:"retail",opening:f.open.value}});
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
    (adm||c?'<form class="sec" data-form="pay"><h3>'+(c?"تسجيل دفعة من العميل":"تسجيل دفعة للمورد")+'</h3><div class="grid3"><label>المبلغ<input class="f" name="amount" inputmode="decimal" dir="ltr" placeholder="0.00"></label><label>الطريقة<select class="f" name="method">'+Object.keys(METHODS).map(k=>'<option value="'+k+'">'+METHODS[k]+'</option>').join("")+'</select></label><label>ملاحظة<input class="f" name="note" autocomplete="off"></label></div><div class="btns"><button class="btn primary">تسجيل</button><span class="msg" id="payMsg"></span></div></form>':'')+
    '<div class="sec"><h3>الفواتير وشن مسدد منها</h3><div class="chips"><button class="chip" data-act="pinvf" data-f="all" aria-pressed="'+(PINVF==="all")+'">الكل ('+A.docs.length+')</button><button class="chip" data-act="pinvf" data-f="open" aria-pressed="'+(PINVF==="open")+'">اللي ما تسددتش ('+A.open.length+')</button></div>'+
      tbl([["الفاتورة"],["التاريخ"],["المبلغ",1],["المسدد",1],["الباقي",1]],shown.map(d=>'<tr'+(d.sale_id||d.purchase_id?' tabindex="0" data-act="'+(d.sale_id?"openSale":"openPur")+'" data-id="'+(d.sale_id||d.purchase_id)+'"':'')+'><td>'+(d.kind==="open"?"افتتاحي":'<span dir="ltr">#'+d.no+'</span>')+' <span class="tag '+(d.rem<=0.0005?"g":d.paid>0?"w":"")+'">'+(d.rem<=0.0005?"مسددة":d.paid>0?"جزئياً":"ما تسددتش")+'</span>'+(d.rem>0.0005?'<small style="display:block;color:var(--muted)">عمرها '+daysAgo(d.at)+' يوم</small>':'')+'</td><td dir="ltr" style="text-align:right">'+dShow(d.at)+'</td>'+td(d.amt)+td(d.paid)+'<td class="r"><b>'+fm(d.rem)+'</b></td></tr>'),null,PINVF==="open"?"كل الفواتير مسددة.":"ما فيش فواتير.")+
      '<div class="hint">الدفعات اللي مش مربوطة بفاتورة تتحسب على أقدم فاتورة أول. اضغط على الفاتورة باش تفتحها.</div></div>'+
    '<div class="sec"><h3>كشف الحساب</h3>'+tbl([["التاريخ"],["البيان"],[c?"عليه":"له",1],[c?"دفع":"دفعنا",1],["الرصيد",1]],STMT.map(x=>'<tr><td dir="ltr" style="text-align:right">'+dShow(x.at)+'</td><td class="nm" style="font-weight:400">'+esc(x.text)+'</td><td class="r">'+(x.up?fm(x.up):"")+'</td><td class="r">'+(x.down?fm(x.down):"")+'</td><td class="r"><b>'+fm(x.run)+'</b></td></tr>'),null,"ما فيش حركات.")+
      '<div class="btns"><button class="btn" data-act="printStmt">🖨️ طباعة كشف الحساب</button>'+(pt.phone?'<a class="btn" target="_blank" rel="noopener" href="https://wa.me/'+waPhone(pt.phone)+'?text='+encodeURIComponent(ME.shop_name+"\n"+pt.name+"\n"+(c?"رصيدك عندنا: ":"رصيدكم علينا: ")+fm(b)+" "+cur()+(A.open.length?"\nفواتير مفتوحة: "+A.open.map(d=>(d.kind==="open"?"افتتاحي":"#"+d.no)+" الباقي "+fm(d.rem)).join("، "):""))+'">واتساب</a>':'')+'<button class="btn" data-act="copyStmt">نسخ</button></div></div>'+
    (adm?'<form class="sec" data-form="partyEdit"><h3>بيانات الحساب</h3><div class="grid2"><label>الاسم<input class="f" name="name" value="'+esc(pt.name)+'" autocomplete="off"></label><label>الهاتف<input class="f" name="phone" dir="ltr" value="'+esc(pt.phone)+'" autocomplete="off"></label>'+
      (c?'<label>سقف للتنبيه بس<input class="f" name="warn" dir="ltr" inputmode="decimal" value="'+(pt.warn_limit>0?pt.warn_limit:"")+'" placeholder="فاضي = بدون"></label><label>الأسعار<select class="f" name="level"><option value="retail">قطاعي</option><option value="ws"'+(pt.price_level==="ws"?" selected":"")+'>جملة</option></select></label>':'')+
      '</div><label class="chk"><input type="checkbox" name="off"'+(pt.active?"":" checked")+'> موقوف: ما يطلعش في القوائم</label><div class="btns"><button class="btn">حفظ البيانات</button><span class="msg" id="peMsg"></span></div></form>':''),"wide");
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
FORMS.partyEdit=async f=>{await run(async()=>{await api("party_save",{p:{id:CURPT.id,name:f.name.value,phone:f.phone.value,warn_limit:f.warn?f.warn.value:0,price_level:f.level?f.level.value:"retail",active:!f.off.checked}});
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
  let h='<div class="chips" style="margin-bottom:14px">'+RTABS.map(([k,t])=>'<button class="chip" data-act="rtab" data-t="'+k+'" aria-pressed="'+(RTAB===k)+'">'+t+'</button>').join("")+'</div>'+(USES_RANGE.includes(RTAB)?rangeHTML():"")+'<div id="rep"><div class="none">جاري التحميل…</div></div>';
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
  const meth={};ok.forEach(s=>{meth[s.method]=(meth[s.method]||0)+ +s.paid});d.collections.filter(c=>c.kind==="collect").forEach(c=>{meth[c.method]=(meth[c.method]||0)+ +c.amount});
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
  const rev=sumBy(ok,s=>s.total),cost=sumBy(ok,s=>sumBy(s.items,i=>i.qty*i.cost)),pcs=sumBy(ok,s=>sumBy(s.items,i=>i.qty));
  const pr=(r,c)=>'<td class="r '+(r-c<0?"neg":"")+'">'+fm(r-c)+'</td>';
  const days=groupRows(ok,s=>dKey(s.at)),dk=Object.keys(days).sort().reverse(),mx=Math.max(1,...dk.map(k=>sumBy(days[k],s=>s.total)));
  const bp={};ok.forEach(s=>{const f=s.total/(s.subtotal||1);s.items.forEach(i=>{const x=(bp[i.product_id]=bp[i.product_id]||{name:i.name,q:0,r:0,c:0});x.q+=i.qty;x.r+=i.qty*i.price*f;x.c+=i.qty*i.cost})});
  const bu=groupRows(ok,s=>s.user_id),colU={};d.collections.filter(c=>c.kind==="collect").forEach(c=>{colU[c.user_id]=(colU[c.user_id]||0)+ +c.amount});
  const bc=groupRows(ok,s=>s.party_id||0);
  return '<div class="grid4" style="margin-bottom:14px"><label>المستخدم<select class="f" data-rf="user"><option value="">الكل</option>'+USERS.map(u=>'<option value="'+u.id+'"'+(RF.user==u.id?" selected":"")+'>'+esc(u.name)+'</option>').join("")+'</select></label>'+
    '<label>العميل<select class="f" data-rf="party"><option value="">الكل</option><option value="cash"'+(RF.party==="cash"?" selected":"")+'>نقدي بس</option><option value="credit"'+(RF.party==="credit"?" selected":"")+'>آجل بس</option>'+PARTIES.filter(x=>x.kind==="c").map(x=>'<option value="'+x.id+'"'+(RF.party==x.id?" selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label></div>'+
    '<div class="kpis">'+kpi("المبيعات",fm(rev),rangeLabel(),"main")+kpi("الربح",fm(rev-cost),rev?((rev-cost)/rev*100).toFixed(1)+"٪":"","good")+kpi("عدد الفواتير",ok.length,"متوسط "+fm(ok.length?rev/ok.length:0))+kpi("القطع",fm(pcs),"")+kpi("المرتجعات",fm(sumBy(d.sale_returns,r=>r.total)),d.sale_returns.length+" مرتجع","bad")+'</div>'+
    '<div class="cols"><div class="panel"><div class="ph2"><h2>حسب اليوم</h2></div>'+tbl([["اليوم"],["فواتير",1],["المبيعات",1],["الربح",1],[""]],dk.map(k=>{const L=days[k],r=sumBy(L,s=>s.total),c=sumBy(L,s=>sumBy(s.items,i=>i.qty*i.cost));return '<tr><td>'+DAYS[new Date(L[0].at).getDay()]+' <span dir="ltr" style="color:var(--muted)">'+dShow(L[0].at)+'</span></td><td class="r">'+L.length+'</td>'+td(r)+pr(r,c)+'<td><div class="bar"><i style="width:'+(r/mx*100).toFixed(1)+'%"></i></div></td></tr>'}))+'</div>'+
    '<div class="panel"><div class="ph2"><h2>حسب المستخدم</h2></div>'+tbl([["المستخدم"],["فواتير",1],["المبيعات",1],["الربح",1],["تحصيل ديون",1]],Object.keys(bu).map(k=>{const L=bu[k],r=sumBy(L,s=>s.total),c=sumBy(L,s=>sumBy(s.items,i=>i.qty*i.cost));return '<tr><td class="nm">'+esc(uname(+k))+'</td><td class="r">'+L.length+'</td>'+td(r)+pr(r,c)+td(colU[k]||0)+'</tr>'}))+'</div>'+
    '<div class="panel"><div class="ph2"><h2>حسب العميل</h2></div>'+tbl([["العميل"],["فواتير",1],["المبيعات",1],["مدفوع وقتها",1]],Object.keys(bc).sort((a,b)=>sumBy(bc[b],s=>s.total)-sumBy(bc[a],s=>s.total)).map(k=>'<tr><td class="nm">'+(+k?esc(pname(+k)):"بيع نقدي")+'</td><td class="r">'+bc[k].length+'</td>'+td(sumBy(bc[k],s=>s.total))+td(sumBy(bc[k],s=>s.paid))+'</tr>'))+'</div>'+
    '<div class="panel"><div class="ph2"><h2>حسب طريقة الدفع</h2></div>'+tbl([["الطريقة"],["فواتير",1],["المدفوع",1]],Object.keys(METHODS).map(k=>{const L=ok.filter(s=>s.method===k);return L.length?'<tr><td>'+METHODS[k]+'</td><td class="r">'+L.length+'</td>'+td(sumBy(L,s=>s.paid))+'</tr>':""}).filter(Boolean))+'</div></div>'+
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
  return '<div class="kpis">'+kpi(c?"ديون لنا على العملاء":"علينا للموردين",fm(tb),owing.length+(c?" عميل":" مورد"),"main")+kpi("فواتير ما تسددتش",sumBy(rows,r=>r.A.open.length),"كلها أو جزء منها","warn")+kpi("أقدم دين",old?old.age+" يوم":"-",old?esc(old.p.name):"")+'</div>'+
    '<div class="cols"><div class="panel"><div class="ph2"><h2>'+(c?"أرصدة العملاء":"أرصدة الموردين")+'</h2><button class="btn sm" data-act="copyRep" data-k="parties">نسخ</button></div>'+tbl([[c?"العميل":"المورد"],[c?"الفواتير":"المشتريات",1],["المدفوع",1],["الرصيد",1]],rows.map(r=>'<tr tabindex="0" data-act="party" data-id="'+r.p.id+'"><td class="nm">'+esc(r.p.name)+'<small>'+(r.A.open.length?r.A.open.length+" فاتورة مفتوحة · أقدمها "+r.age+" يوم":"ما فيش فواتير مفتوحة")+(r.A.last?" · آخر دفعة "+dShow(r.A.last):"")+'</small></td>'+td(r.A.docT)+td(r.A.payT)+'<td class="r"><b>'+fm(r.p.balance)+'</b></td></tr>'),
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
    '<div class="panel"><div class="ph2"><h2>قائمة الطلب</h2><div class="btns"><button class="btn sm" data-act="printOrder">🖨️ طباعة</button></div></div>'+tbl([["المنتج"],["المتوفر",1],["الحد",1],["المقترح",1],["آخر مورد"],["آخر تكلفة",1]],REPX.order.map(o=>'<tr tabindex="0" data-act="product" data-id="'+o.p.id+'"><td class="nm">'+esc(o.p.name)+'</td><td class="r '+(o.p.qty?"":"neg")+'">'+o.p.qty+'</td><td class="r">'+o.m+'</td><td class="r"><b>'+o.sug+'</b></td><td>'+(o.l&&o.l.sup?esc(pname(o.l.sup)):"-")+'</td>'+(o.l?td(o.l.cost):'<td class="r">-</td>')+'</tr>'),null,"كل المنتجات فوق حد التنبيه.")+'<div class="pb hint">المقترح = ضعف حد التنبيه ناقص المتوفر.</div></div>'+
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
      '<label>آخر سطر في الإيصال<input class="f" name="receipt_footer" value="'+esc(ME.receipt_footer)+'"></label><div class="btns"><button class="btn primary">حفظ الإعدادات</button><span class="msg" id="stMsg"></span></div></form></div>'+
    '<div class="panel"><div class="ph2"><h2>النسخة الاحتياطية</h2></div><div class="pb"><div class="hint">الخطة المجانية في Supabase ما فيهاش نسخ احتياطية تلقائية. نزّل نسخة مرة في الأسبوع على الأقل واحفظها في مكان ثاني (فلاشة، إيميل، Google Drive).</div><label class="chk"><input type="checkbox" id="bkImg" checked> مع الصور (الملف يكبر)</label><div class="btns"><button class="btn primary" data-act="backup">⬇️ تنزيل نسخة احتياطية</button><span class="msg" id="bkMsg"></span></div><div class="hint">آخر نسخة نزلتها من هالجهاز: <b id="bkLast">'+(LS.get("lastBackup",null)?dShow(LS.get("lastBackup")):"ما فيش")+'</b></div></div></div>'+
    '<div class="panel"><div class="ph2"><h2>معلومات</h2></div><div class="pb hint">القاعدة: <span dir="ltr" class="mono">'+esc(CFG.url)+'</span><br>الصور محفوظة في القاعدة، وكل جهاز يحتفظ بنسخة منها باش الموقع يفتح أسرع.</div></div>';
};
FORMS.userAdd=async f=>{await run(async()=>{await api("user_save",{p:{name:f.name.value,username:f.username.value.trim().toLowerCase(),password:f.password.value,role:f.role.value}});await loadUsers();refresh();setMsg("uaMsg","تمت الإضافة ✓","ok")},null,"uaMsg")};
let CURU=null;
ACT.user=b=>{const u=USERS.find(x=>x.id===+b.dataset.id);if(!u)return;CURU=u;const self=u.id===ME.id;
  openDlg(u.name,'<form class="db" style="padding:0" data-form="userEdit"><div class="grid2"><label>الاسم<input class="f" name="name" value="'+esc(u.name)+'"></label><label>الدور<select class="f" name="role"'+(self?" disabled":"")+'>'+Object.keys(ROLES).map(r=>'<option value="'+r+'"'+(r===u.role?" selected":"")+'>'+ROLES[r]+'</option>').join("")+'</select></label></div>'+
    '<label>كلمة مرور جديدة (فاضي = ما تتبدلش)<input class="f" name="password" dir="ltr" autocomplete="new-password"></label>'+
    (self?'<div class="hint">ما تقدرش توقف حسابك أو تبدل دورك.</div>':'<label class="chk"><input type="checkbox" name="off"'+(u.active?"":" checked")+'> موقوف: ما يقدرش يدخل (ويطلع من أي جهاز داخل منه)</label>')+
    '<div class="hint">لو الحساب انقفل بسبب محاولات غلط، الحفظ يفك القفل.</div><div class="btns"><button class="btn primary">حفظ</button></div><span class="msg" id="ueMsg"></span></form>')};
FORMS.userEdit=async f=>{const u=CURU,self=u.id===ME.id,p={id:u.id,name:f.name.value};if(!self){p.role=f.role.value;p.active=!f.off.checked}if(f.password.value)p.password=f.password.value;
  await run(async()=>{await api("user_save",{p});await loadUsers();if(self)ME=await api("me");refresh();$("dlg").close();toast("تم الحفظ ✓")},null,"ueMsg")};
FORMS.settings=async f=>{const p={};["shop_name","currency","shop_phone","shop_address","receipt_footer"].forEach(k=>p[k]=f[k].value.trim());p.max_seller_discount_pct=Math.min(100,pos(f.max_seller_discount_pct.value));p.default_min_qty=int(f.default_min_qty.value);
  await run(async()=>{await api("settings_set",{p});ME=await api("me");$("shopName").textContent=ME.shop_name;document.title=ME.shop_name;document.querySelectorAll(".cur").forEach(e=>e.textContent=cur());refresh();setMsg("stMsg","تم الحفظ ✓","ok")},null,"stMsg")};

ACT.backup=async b=>{b.disabled=true;const d=await run(()=>api("backup_export",{p_images:$("bkImg").checked}),null,"bkMsg");b.disabled=false;if(!d)return;
  const blob=new Blob([JSON.stringify(d)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="backup-"+dKey(Date.now())+".json";document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);LS.set("lastBackup",Date.now());$("bkLast").textContent=dShow(Date.now());setMsg("bkMsg","تم التنزيل ✓ ("+Math.round(blob.size/1024)+" KB)","ok")};

/* حسابي: تغيير كلمة المرور */
ACT.account=()=>openDlg("حسابي",'<div class="sub"><span>'+esc(ME.name)+'</span><span dir="ltr" class="mono">'+esc(ME.username)+'</span><span>'+ROLES[ME.role]+'</span></div><form class="sec" data-form="pass"><h3>تغيير كلمة المرور</h3><label>كلمة المرور الحالية<input class="f" name="old" type="password" dir="ltr" autocomplete="current-password"></label><label>الجديدة (6 خانات أو أكثر)<input class="f" name="new1" type="password" dir="ltr" autocomplete="new-password"></label><label>عاودها<input class="f" name="new2" type="password" dir="ltr" autocomplete="new-password"></label><div class="btns"><button class="btn primary">تغيير</button></div><span class="msg" id="pwMsg"></span><div class="hint">بعد التغيير، أي جهاز ثاني داخل بحسابك يطلع.</div></form>');
FORMS.pass=async f=>{if(f.new1.value!==f.new2.value)return setMsg("pwMsg","⚠️ كلمتين المرور مش زي بعض","err");
  await run(()=>api("password_change",{p_old:f.old.value,p_new:f.new1.value}),"تغيرت كلمة المرور ✓","pwMsg")};

/* ================================================================
   البداية
   ================================================================ */
start();
