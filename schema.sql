-- =====================================================================
--  منظومة المخزن والمبيعات — قاعدة البيانات (PostgreSQL / Supabase)
--  تتشغل مرة وحدة في SQL Editor. تشغيلها مرة ثانية ما يمسحش البيانات.
--
--  الفكرة: الجداول كلها مقفولة. الموقع ما يلمسهاش مباشرة، يكلم الدوال
--  اللي تحت بس، وكل دالة تتأكد من المستخدم ودوره قبل ما تدير أي شي.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------ الجداول ------------------------------

create table if not exists settings (
  key   text primary key,
  value jsonb not null
);
insert into settings(key,value) values
  ('shop_name','"اسم المحل"'), ('currency','"د.ل"'),
  ('max_seller_discount_pct','0'), ('default_min_qty','5'),
  ('shop_phone','""'), ('shop_address','""'), ('receipt_footer','"شكراً لزيارتكم"')
on conflict do nothing;

create table if not exists counters (          -- أرقام الفواتير متسلسلة بدون فراغات
  name text primary key,
  last int not null
);

create table if not exists users (
  id           serial primary key,
  username     text not null unique check (username ~ '^[a-z][a-z0-9._-]{2,19}$'),
  name         text not null,
  role         text not null check (role in ('admin','seller','store')),
  pass_hash    text not null,
  active       boolean not null default true,
  failed_count int not null default 0,
  locked_until timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists sessions (
  token_hash bytea primary key,
  user_id    int not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists products (
  id         serial primary key,
  name       text not null,
  name_norm  text not null unique,
  category   text not null default '',
  barcode    text unique,
  cost       numeric(14,3) not null default 0 check (cost >= 0),      -- متوسط سعر التكلفة
  price      numeric(14,3) not null default 0 check (price >= 0),     -- سعر البيع قطاعي
  price_ws   numeric(14,3) not null default 0 check (price_ws >= 0),  -- سعر البيع جملة
  qty        int not null default 0 check (qty >= 0),
  min_qty    int check (min_qty >= 0),
  rack       text not null default '',
  drawer     text not null default '',
  box        text not null default '',
  note       text not null default '',
  active     boolean not null default true,
  img_ver    int not null default 0,
  created_at timestamptz not null default now()
);
-- نفس المكان ما يتسجلش لمنتجين
create unique index if not exists products_place_uq on products(rack,drawer,box) where rack <> '';

create table if not exists product_images (
  product_id int primary key references products(id) on delete cascade,
  data       text not null,
  updated_at timestamptz not null default now()
);

create table if not exists parties (            -- العملاء والموردين
  id          serial primary key,
  kind        text not null check (kind in ('c','s')),
  name        text not null,
  name_norm   text not null,
  phone       text not null default '',
  warn_limit  numeric(14,3) not null default 0,                 -- سقف للتنبيه بس، ما يمنعش البيع
  price_level text not null default 'retail' check (price_level in ('retail','ws')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (kind, name_norm)
);

create table if not exists shifts (             -- الورديات (الخزينة)
  id            serial primary key,
  user_id       int not null references users(id),
  opened_at     timestamptz not null default now(),
  opening_cash  numeric(14,3) not null default 0,
  closed_at     timestamptz,
  expected_cash numeric(14,3),
  counted_cash  numeric(14,3),
  diff          numeric(14,3),
  note          text not null default ''
);
create unique index if not exists shifts_one_open on shifts(user_id) where closed_at is null;

create table if not exists sales (
  id        serial primary key,
  no        int not null unique,                -- رقم الفاتورة
  at        timestamptz not null default now(),
  user_id   int not null references users(id),
  party_id  int references parties(id),
  shift_id  int references shifts(id),
  subtotal  numeric(14,3) not null default 0,
  discount  numeric(14,3) not null default 0,
  total     numeric(14,3) not null default 0,
  paid      numeric(14,3) not null default 0,   -- المدفوع وقت البيع
  method    text not null default 'cash' check (method in ('cash','card','transfer')),
  status    text not null default 'ok' check (status in ('ok','void')),
  note      text not null default ''
);
create index if not exists sales_at on sales(at);

create table if not exists sale_items (
  id         serial primary key,
  sale_id    int not null references sales(id) on delete cascade,
  product_id int not null references products(id),
  name       text not null,
  qty        int not null check (qty > 0),
  price      numeric(14,3) not null,
  cost       numeric(14,3) not null,
  returned   int not null default 0 check (returned >= 0)
);
create index if not exists sale_items_sale on sale_items(sale_id);

create table if not exists sale_returns (
  id       serial primary key,
  no       int not null unique,
  sale_id  int not null references sales(id),
  at       timestamptz not null default now(),
  user_id  int not null references users(id),
  shift_id int references shifts(id),
  total    numeric(14,3) not null,
  refund   numeric(14,3) not null default 0,    -- اللي ترجّع للزبون فلوس
  method   text not null default 'cash',
  note     text not null default ''
);
create table if not exists sale_return_items (
  id           serial primary key,
  return_id    int not null references sale_returns(id) on delete cascade,
  sale_item_id int not null references sale_items(id),
  product_id   int not null references products(id),
  name         text not null,
  qty          int not null check (qty > 0),
  price        numeric(14,3) not null,
  cost         numeric(14,3) not null
);

create table if not exists purchases (
  id       serial primary key,
  no       int not null unique,
  at       timestamptz not null default now(),
  user_id  int not null references users(id),
  party_id int references parties(id),
  shift_id int references shifts(id),
  ref      text not null default '',            -- رقم فاتورة المورد
  total    numeric(14,3) not null default 0,
  paid     numeric(14,3) not null default 0,
  method   text not null default 'cash' check (method in ('cash','card','transfer')),
  note     text not null default ''
);
create index if not exists purchases_at on purchases(at);

create table if not exists purchase_items (
  id          serial primary key,
  purchase_id int not null references purchases(id) on delete cascade,
  product_id  int not null references products(id),
  name        text not null,
  qty         int not null check (qty > 0),
  cost        numeric(14,3) not null,
  returned    int not null default 0 check (returned >= 0)
);
create index if not exists purchase_items_p on purchase_items(purchase_id);

create table if not exists purchase_returns (
  id          serial primary key,
  no          int not null unique,
  purchase_id int not null references purchases(id),
  at          timestamptz not null default now(),
  user_id     int not null references users(id),
  shift_id    int references shifts(id),
  total       numeric(14,3) not null,
  refund      numeric(14,3) not null default 0, -- اللي رجّعه المورد فلوس
  method      text not null default 'cash',
  note        text not null default ''
);
create table if not exists purchase_return_items (
  id               serial primary key,
  return_id        int not null references purchase_returns(id) on delete cascade,
  purchase_item_id int not null references purchase_items(id),
  product_id       int not null references products(id),
  name             text not null,
  qty              int not null check (qty > 0),
  cost             numeric(14,3) not null
);

-- دفتر الذمم: الموجب يزيد الرصيد (على العميل / للمورد)، والسالب ينقصه
create table if not exists ledger (
  id          serial primary key,
  party_id    int not null references parties(id),
  at          timestamptz not null default now(),
  kind        text not null check (kind in ('open','inv','buy','pay','ret','refund')),
  amount      numeric(14,3) not null,
  sale_id     int references sales(id),
  purchase_id int references purchases(id),
  method      text not null default 'cash',
  user_id     int references users(id),
  note        text not null default ''
);
create index if not exists ledger_party on ledger(party_id, at);

-- كل حركة على كمية أي منتج تتسجل هنا
create table if not exists stock_moves (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  product_id int not null references products(id),
  kind       text not null check (kind in ('buy','sale','sale_ret','buy_ret','adjust','void')),
  qty        int not null,
  qty_after  int not null,
  cost       numeric(14,3) not null default 0,
  ref_id     int,
  user_id    int references users(id),
  note       text not null default ''
);
create index if not exists stock_moves_p on stock_moves(product_id, at);

create table if not exists adjustments (        -- تسويات الجرد
  id         serial primary key,
  at         timestamptz not null default now(),
  user_id    int not null references users(id),
  product_id int not null references products(id),
  qty_before int not null,
  qty_after  int not null,
  cost       numeric(14,3) not null,
  reason     text not null check (reason in ('opening','damaged','lost','count','other')),
  note       text not null default ''
);

create table if not exists expenses (
  id       serial primary key,
  at       timestamptz not null default now(),
  user_id  int not null references users(id),
  shift_id int references shifts(id),
  category text not null,
  amount   numeric(14,3) not null check (amount > 0),
  method   text not null default 'cash' check (method in ('cash','card','transfer')),
  note     text not null default ''
);
create index if not exists expenses_at on expenses(at);

-- كل فلوس دخلت أو طلعت. اللي طريقته cash هو اللي يأثر على الدرج
create table if not exists cash_moves (
  id       bigserial primary key,
  at       timestamptz not null default now(),
  shift_id int references shifts(id),
  user_id  int not null references users(id),
  kind     text not null check (kind in ('sale','collect','refund','expense','supplier_pay','purchase','supplier_refund','void')),
  amount   numeric(14,3) not null,              -- موجب دخل، سالب طلع
  method   text not null default 'cash',
  ref_id   int,
  note     text not null default ''
);
create index if not exists cash_moves_shift on cash_moves(shift_id);
create index if not exists cash_moves_at on cash_moves(at);

create table if not exists audit (              -- سجل العمليات الحساسة
  id      bigserial primary key,
  at      timestamptz not null default now(),
  user_id int references users(id),
  action  text not null,
  detail  jsonb not null default '{}'
);

-- ------------------- تحديثات المرحلة 1 (آمنة لو تعاودت) -------------------
alter table users    add column if not exists pin_hash text;
alter table products add column if not exists fav boolean not null default false;
alter table sales    add column if not exists pays jsonb not null default '[]';
alter table sales    add column if not exists tendered numeric(14,3);
alter table sales    add column if not exists client_id text;
create unique index if not exists sales_client_id on sales(client_id) where client_id is not null;
alter table sales drop constraint if exists sales_method_check;
alter table sales add constraint sales_method_check check (method in ('cash','card','transfer','mixed'));
insert into settings(key,value) values ('lock_minutes','10') on conflict do nothing;

-- ------------------- تحديثات المرحلة 2 -------------------
-- الكرتونة: كم حبة فيها، وسعرها، وباركودها. المخزون يقعد بالحبة
alter table products add column if not exists pack_qty int check (pack_qty is null or pack_qty >= 2);
alter table products add column if not exists pack_price numeric(14,3) not null default 0 check (pack_price >= 0);
alter table products add column if not exists pack_barcode text;
create unique index if not exists products_pack_barcode on products(pack_barcode) where pack_barcode is not null;
-- البيع بدون نت ممكن يخلي المخزون بالسالب لين يتصلح بالجرد أو الشراء
alter table products drop constraint if exists products_qty_check;
-- سطر البيع: الكمية بالوحدة المباعة (حبة أو كرتونة)، و per = كم حبة في الوحدة
alter table sale_items add column if not exists per int not null default 1 check (per >= 1);
alter table sales add column if not exists device text not null default '';
alter table sales add column if not exists offline boolean not null default false;

-- ------------------- تحديثات المرحلة 3 -------------------
-- صلاحيات البائع: null = الافتراضي (آجل، تحصيل، مصروفات)
alter table users add column if not exists perms jsonb;
-- مدة السداد لكل عميل أو مورد (أيام). 0 = بدون موعد
alter table parties add column if not exists terms_days int not null default 0 check (terms_days between 0 and 365);
alter table sales add column if not exists due_date date;
alter table purchases add column if not exists due_date date;
alter table purchases add column if not exists po_id int;
create table if not exists purchase_orders (
  id          serial primary key,
  no          int not null unique,
  at          timestamptz not null default now(),
  user_id     int not null references users(id),
  party_id    int references parties(id),
  status      text not null default 'open' check (status in ('open','received','cancel')),
  note        text not null default '',
  items       jsonb not null default '[]',      -- [{product_id, name, qty, cost}]
  total       numeric(14,3) not null default 0,
  purchase_id int references purchases(id),
  updated_at  timestamptz not null default now()
);

-- ------------------- تحديثات المرحلة 4 -------------------
alter table parties  add column if not exists points int not null default 0;
alter table products add column if not exists group_id int;           -- الأصناف: كل مقاس/لون منتج بروحه، ومجموعين بنفس group_id
alter table products add column if not exists variant text not null default '';
alter table sales    add column if not exists points_earned int not null default 0;
alter table sales    add column if not exists points_used int not null default 0;
alter table sales    add column if not exists promo_disc numeric(14,3) not null default 0;
alter table sale_items add column if not exists promo text;
create table if not exists promos (
  id         serial primary key,
  name       text not null,
  kind       text not null check (kind in ('pct','bxgy')),   -- نسبة خصم، أو اشري X وخوذ Y ببلاش
  product_id int references products(id),
  category   text,
  pct        numeric(5,2),
  buy        int,
  get        int,
  starts     date,
  ends       date,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
insert into settings(key,value) values ('loyalty_rate','0'),('loyalty_value','0') on conflict do nothing;

-- الجرد الكامل: يتعد من أكثر من جهاز، والمدير يعتمده
create table if not exists counts (
  id         serial primary key,
  at         timestamptz not null default now(),
  user_id    int not null references users(id),
  status     text not null default 'open' check (status in ('open','done','cancel')),
  note       text not null default '',
  closed_at  timestamptz,
  closed_by  int references users(id),
  summary    jsonb
);
create unique index if not exists counts_one_open on counts((true)) where status='open';
create table if not exists count_items (
  count_id   int not null references counts(id) on delete cascade,
  product_id int not null references products(id),
  expected   int not null,                 -- الكمية في المنظومة لما انعد أول مرة
  counted    int not null check (counted >= 0),
  at         timestamptz not null default now(),
  user_id    int references users(id),
  primary key (count_id, product_id)
);

-- ------------------------- قفل الجداول -------------------------
do $$
declare t text;
begin
  foreach t in array array['settings','counters','users','sessions','products','product_images','parties','shifts','sales','sale_items',
    'sale_returns','sale_return_items','purchases','purchase_items','purchase_returns','purchase_return_items',
    'ledger','stock_moves','adjustments','expenses','cash_moves','audit','counts','count_items','purchase_orders','promos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from public', t);
    if exists (select 1 from pg_roles where rolname='anon') then execute format('revoke all on %I from anon, authenticated', t); end if;
  end loop;
end $$;

-- =========================== دوال داخلية ===========================

create or replace function _num(v text) returns numeric language sql immutable as $$
  select nullif(regexp_replace(translate(replace(replace(coalesce(v,''),'٫','.'),'،','.'),'٠١٢٣٤٥٦٧٨٩','0123456789'),'[^0-9.]','','g'),'')::numeric
$$;

create or replace function _norm(v text) returns text language sql immutable as $$
  select btrim(regexp_replace(translate(regexp_replace(lower(coalesce(v,'')),'[ً-ْـ]','','g'),'أإآٱةىؤئ','ااااهيوي'),'\s+',' ','g'))
$$;

create or replace function _slot(v text) returns text language sql immutable as $$
  select regexp_replace(upper(regexp_replace(translate(coalesce(v,''),'٠١٢٣٤٥٦٧٨٩','0123456789'),'\s+','','g')),'^0+(?=[0-9])','')
$$;

create or replace function _next(p_name text) returns int language sql security definer set search_path=public as $$
  insert into counters(name,last) values (p_name,1) on conflict (name) do update set last=counters.last+1 returning last
$$;

create or replace function _setting(k text) returns jsonb language sql stable security definer set search_path=public as $$
  select value from settings where key=k
$$;

create or replace function _auth(p_token text, p_roles text[] default null) returns users
language plpgsql security definer set search_path=public,extensions as $$
declare u users;
begin
  select us.* into u from sessions s join users us on us.id=s.user_id
   where s.token_hash=digest(coalesce(p_token,''),'sha256') and s.expires_at>now() and us.active;
  if not found then raise exception 'AUTH: انتهت الجلسة، ادخل من جديد' using errcode='28000'; end if;
  if p_roles is not null and not (u.role = any(p_roles)) then raise exception 'ما عندكش صلاحية لهالعملية' using errcode='42501'; end if;
  return u;
end $$;

-- الصلاحيات: المدير كل شي. البائع حسب اللي حدده المدير
create or replace function _perms(u users) returns jsonb language sql immutable as $$
  select case when u.role='admin' then '["credit","collect","expenses","price","returns","void"]'::jsonb
              when u.role='seller' then coalesce(u.perms,'["credit","collect","expenses"]'::jsonb) else '[]'::jsonb end
$$;
create or replace function _can(u users, p text) returns boolean language sql immutable as $$ select _perms(u) ? p $$;
create or replace function _need(u users, p text) returns void language plpgsql immutable as $$
begin
  if not _can(u,p) then raise exception 'ما عندكش صلاحية لهالعملية، كلّم المدير' using errcode='42501'; end if;
end $$;

create or replace function _audit(p_user int, p_action text, p_detail jsonb) returns void
language sql security definer set search_path=public as $$
  insert into audit(user_id,action,detail) values (p_user,p_action,coalesce(p_detail,'{}'))
$$;

create or replace function _shift(p_user int) returns int language sql stable security definer set search_path=public as $$
  select id from shifts where user_id=p_user and closed_at is null
$$;

create or replace function _cash(p_shift int, p_user int, p_kind text, p_amount numeric, p_method text, p_ref int, p_note text) returns void
language sql security definer set search_path=public as $$
  insert into cash_moves(shift_id,user_id,kind,amount,method,ref_id,note)
  select p_shift,p_user,p_kind,p_amount,coalesce(p_method,'cash'),p_ref,coalesce(p_note,'') where p_amount <> 0
$$;

create or replace function _method(v text) returns text language plpgsql immutable as $$
begin
  if coalesce(v,'cash') not in ('cash','card','transfer') then raise exception 'طريقة الدفع مش معروفة'; end if;
  return coalesce(v,'cash');
end $$;

-- يغيّر كمية منتج ويسجل الحركة. المنتج لازم يكون مقفول (for update) عند اللي ينادي
create or replace function _move(p_product int, p_kind text, p_qty int, p_cost numeric, p_ref int, p_user int, p_note text) returns int
language plpgsql security definer set search_path=public as $$
declare q int; nm text;
begin
  select qty, name into q, nm from products where id=p_product for update;
  if q + p_qty < 0 and p_qty < 0 and coalesce(current_setting('app.allow_neg', true),'') <> '1' then
    raise exception 'الكمية المتوفرة من «%» هي % بس', nm, greatest(q,0);
  end if;
  update products set qty = qty + p_qty where id=p_product;
  insert into stock_moves(product_id,kind,qty,qty_after,cost,ref_id,user_id,note)
  values (p_product,p_kind,p_qty,q+p_qty,coalesce(p_cost,0),p_ref,p_user,coalesce(p_note,''));
  return q + p_qty;
end $$;

-- رقم EAN-13 من 12 رقم (يحسب رقم التحقق)
create or replace function _ean13(d12 text) returns text language sql immutable as $$
  select d12 || ((10 - (sum(substr(d12,i,1)::int * case when i % 2 = 0 then 3 else 1 end) % 10)) % 10)::text
  from generate_series(1,12) i
$$;

create or replace function _place(p_product int, p_rack text, p_drawer text, p_box text) returns void
language plpgsql security definer set search_path=public as $$
declare r text := _slot(p_rack); d text := _slot(p_drawer); b text := _slot(p_box); o record;
begin
  if r = '' and (d <> '' or b <> '') then raise exception 'اكتب الرف الأول، مثلاً A1'; end if;
  if r <> '' and r !~ '^[A-Z][0-9]*$' then raise exception 'الرف لازم يبدا بحرف إنجليزي وبعده رقم، مثلاً A1 أو B2'; end if;
  if r <> '' then
    select id, name into o from products where rack=r and drawer=d and box=b and id <> p_product;
    if found then raise exception 'تكرار! المكان % مسجل للمنتج «%» (#%)', concat_ws('-',r,nullif(d,''),nullif(b,'')), o.name, o.id; end if;
  end if;
  update products set rack=r, drawer=d, box=b where id=p_product;
end $$;

create or replace function _balance(p_party int) returns numeric language sql stable security definer set search_path=public as $$
  select coalesce(sum(amount),0) from ledger where party_id=p_party
$$;

-- ============================ الدخول ============================

-- أول تشغيل: تعمل حساب المدير. تشتغل مرة وحدة بس، لما ما يكونش فيه أي مستخدم
create or replace function setup(p_shop text, p_username text, p_name text, p_password text) returns json
language plpgsql security definer set search_path=public,extensions as $$
begin
  lock table users in exclusive mode;
  if exists (select 1 from users) then raise exception 'المنظومة مجهزة من قبل'; end if;
  if length(coalesce(p_password,'')) < 6 then raise exception 'كلمة المرور لازم 6 خانات أو أكثر'; end if;
  insert into users(username,name,role,pass_hash) values (lower(btrim(p_username)), btrim(p_name), 'admin', crypt(p_password, gen_salt('bf',10)));
  if btrim(coalesce(p_shop,'')) <> '' then update settings set value=to_jsonb(btrim(p_shop)) where key='shop_name'; end if;
  return json_build_object('ok',true);
end $$;

create or replace function public_info() returns json language sql stable security definer set search_path=public as $$
  select json_build_object('shop_name',_setting('shop_name'),'currency',_setting('currency'),'needs_setup',not exists(select 1 from users))
$$;

-- ترجع {ok:false} بدل الخطأ باش عداد المحاولات الغلط ينحفظ
-- الدخول بكلمة المرور أو بالرمز السري (PIN). نفس عداد المحاولات الغلط للاثنين
create or replace function _login(p_username text, p_secret text, p_pin boolean) returns json
language plpgsql security definer set search_path=public,extensions as $$
declare u users; tok text; h text;
begin
  select * into u from users where username=lower(btrim(coalesce(p_username,''))) for update;
  if not found then perform crypt(coalesce(p_secret,''), gen_salt('bf',8)); return json_build_object('ok',false,'error','bad'); end if;
  if u.locked_until is not null and u.locked_until > now() then
    return json_build_object('ok',false,'error','locked','minutes',ceil(extract(epoch from u.locked_until-now())/60));
  end if;
  h := case when p_pin then u.pin_hash else u.pass_hash end;
  if h is null then return json_build_object('ok',false,'error','nopin'); end if;
  if h <> crypt(coalesce(p_secret,''), h) then
    update users set failed_count=case when failed_count+1>=5 then 0 else failed_count+1 end,
      locked_until=case when failed_count+1>=5 then now()+interval '5 minutes' else null end where id=u.id;
    return json_build_object('ok',false,'error','bad');
  end if;
  if not u.active then return json_build_object('ok',false,'error','off'); end if;
  update users set failed_count=0, locked_until=null where id=u.id;
  delete from sessions where expires_at < now();
  tok := encode(gen_random_bytes(32),'hex');
  insert into sessions(token_hash,user_id,expires_at) values (digest(tok,'sha256'), u.id, now()+interval '7 days');
  return json_build_object('ok',true,'token',tok,'user',json_build_object('id',u.id,'username',u.username,'name',u.name,'role',u.role));
end $$;

create or replace function login(p_username text, p_password text) returns json
language sql security definer set search_path=public as $$ select _login(p_username, p_password, false) $$;

create or replace function login_pin(p_username text, p_pin text) returns json
language sql security definer set search_path=public as $$ select _login(p_username, p_pin, true) $$;

-- كل مستخدم يحط رمزه السري (4 لـ 6 أرقام). فاضي = يمسحه
create or replace function pin_set(p_token text, p_pin text) returns void
language plpgsql security definer set search_path=public,extensions as $$
declare u users := _auth(p_token);
begin
  if coalesce(p_pin,'') = '' then update users set pin_hash=null where id=u.id; return; end if;
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'الرمز السري لازم من 4 لـ 6 أرقام'; end if;
  update users set pin_hash=crypt(p_pin, gen_salt('bf',8)) where id=u.id;
end $$;

create or replace function logout(p_token text) returns void language sql security definer set search_path=public,extensions as $$
  delete from sessions where token_hash=digest(coalesce(p_token,''),'sha256')
$$;

create or replace function me(p_token text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token);
begin
  return json_build_object('id',u.id,'username',u.username,'name',u.name,'role',u.role,
    'shop_name',_setting('shop_name'),'currency',_setting('currency'),
    'max_seller_discount_pct',_setting('max_seller_discount_pct'),'default_min_qty',_setting('default_min_qty'),
    'shop_phone',_setting('shop_phone'),'shop_address',_setting('shop_address'),'receipt_footer',_setting('receipt_footer'),
    'loyalty_rate',_setting('loyalty_rate'),'loyalty_value',_setting('loyalty_value'),'logo',_setting('logo'),
    'lock_minutes',_setting('lock_minutes'),'has_pin',u.pin_hash is not null,
    'shift',(select row_to_json(s) from shifts s where s.user_id=u.id and s.closed_at is null),'perms',_perms(u));
end $$;

create or replace function password_change(p_token text, p_old text, p_new text) returns void
language plpgsql security definer set search_path=public,extensions as $$
declare u users := _auth(p_token);
begin
  if u.pass_hash <> crypt(coalesce(p_old,''), u.pass_hash) then raise exception 'كلمة المرور الحالية غلط'; end if;
  if length(coalesce(p_new,'')) < 6 then raise exception 'كلمة المرور لازم 6 خانات أو أكثر'; end if;
  update users set pass_hash=crypt(p_new, gen_salt('bf',10)) where id=u.id;
  delete from sessions where user_id=u.id and token_hash <> digest(p_token,'sha256');
end $$;

-- =========================== المستخدمين ===========================

create or replace function user_list(p_token text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']);
begin
  return (select coalesce(json_agg(json_build_object('id',x.id,'username',x.username,'name',x.name,'role',x.role,'active',x.active,'has_pin',x.pin_hash is not null,'perms',_perms(x)) order by x.id),'[]') from users x);
end $$;

-- p: {id?, username, name, role, password?, active?}
create or replace function user_save(p_token text, p jsonb) returns json
language plpgsql security definer set search_path=public,extensions as $$
declare u users := _auth(p_token, array['admin']); t users; v_id int := (p->>'id')::int; pw text := p->>'password';
begin
  if pw is not null and length(pw) < 6 then raise exception 'كلمة المرور لازم 6 خانات أو أكثر'; end if;
  if v_id is null then
    if pw is null then raise exception 'اكتب كلمة المرور'; end if;
    if btrim(coalesce(p->>'name','')) = '' then raise exception 'اكتب الاسم'; end if;
    if lower(btrim(coalesce(p->>'username',''))) !~ '^[a-z][a-z0-9._-]{2,19}$' then raise exception 'اسم المستخدم: حروف إنجليزية وأرقام، 3 خانات أو أكثر، ويبدا بحرف'; end if;
    if exists (select 1 from users where username=lower(btrim(p->>'username'))) then raise exception 'اسم المستخدم هذا موجود من قبل'; end if;
    insert into users(username,name,role,pass_hash,perms) values (lower(btrim(p->>'username')), btrim(p->>'name'), coalesce(p->>'role','seller'), crypt(pw, gen_salt('bf',10)),
      case when jsonb_typeof(p->'perms')='array' then (select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements_text(p->'perms') v where v in ('credit','collect','expenses','price','returns','void')) end) returning id into v_id;
    perform _audit(u.id,'user_add',jsonb_build_object('user',v_id,'role',p->>'role'));
  else
    select * into t from users where id=v_id for update;
    if not found then raise exception 'المستخدم مش موجود'; end if;
    if t.id=u.id and (coalesce((p->>'active')::boolean,true)=false or coalesce(p->>'role',t.role)<>'admin') then raise exception 'ما تقدرش توقف حسابك أو تبدل دورك'; end if;
    update users set name=coalesce(nullif(btrim(p->>'name'),''),name), role=coalesce(p->>'role',role),
      active=coalesce((p->>'active')::boolean,active), pass_hash=case when pw is null then pass_hash else crypt(pw, gen_salt('bf',10)) end,
      failed_count=0, locked_until=null, pin_hash=case when p ? 'pin' and coalesce(p->>'pin','')='' then null else pin_hash end,
      perms=case when jsonb_typeof(p->'perms')='array' then (select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements_text(p->'perms') v where v in ('credit','collect','expenses','price','returns','void')) else perms end where id=v_id;
    if pw is not null or coalesce((p->>'active')::boolean,true)=false then delete from sessions where user_id=v_id and user_id<>u.id; end if;
    perform _audit(u.id,'user_edit',jsonb_build_object('user',v_id,'role',p->>'role','active',p->'active','password',pw is not null,'perms',p->'perms'));
  end if;
  return json_build_object('id',v_id);
end $$;

create or replace function settings_set(p_token text, p jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); k text;
begin
  for k in select jsonb_object_keys(p) loop
    if k not in ('shop_name','currency','max_seller_discount_pct','default_min_qty','shop_phone','shop_address','receipt_footer','lock_minutes','loyalty_rate','loyalty_value','logo') then raise exception 'إعداد مش معروف: %', k; end if;
    if k='logo' and coalesce(p->>k,'') <> '' and ((p->>k) !~ '^data:image/(png|jpeg|webp);base64,' or length(p->>k) > 300000) then raise exception 'الشعار لازم صورة وحجمها صغير'; end if;
    insert into settings(key,value) values (k,p->k) on conflict (key) do update set value=excluded.value;
  end loop;
  perform _audit(u.id,'settings',p);
end $$;

-- ============================ المنتجات ============================

-- كل دور يشوف اللي يخصه: البائع بدون تكلفة، وأمين المخزن بدون أي سعر
create or replace function product_list(p_token text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token);
begin
  return (with s30 as (select i.product_id, sum((i.qty - i.returned)*i.per) q from sale_items i join sales s on s.id=i.sale_id
                       where s.status='ok' and s.at > now() - interval '30 days' group by 1)
    select coalesce(json_agg(
    jsonb_build_object('id',p.id,'name',p.name,'category',p.category,'barcode',p.barcode,'qty',p.qty,'min_qty',p.min_qty,
      'rack',p.rack,'drawer',p.drawer,'box',p.box,'note',p.note,'active',p.active,'img_ver',p.img_ver,'fav',p.fav,'sold30',coalesce(s30.q,0),'pack_qty',p.pack_qty,'pack_barcode',p.pack_barcode,'group_id',p.group_id,'variant',p.variant)
    || case when u.role in ('admin','seller') then jsonb_build_object('price',p.price,'price_ws',p.price_ws,'pack_price',p.pack_price) else '{}'::jsonb end
    || case when u.role='admin' then jsonb_build_object('cost',p.cost) else '{}'::jsonb end
    order by p.id),'[]')
  from products p left join s30 on s30.product_id=p.id where p.active or u.role <> 'seller');
end $$;

-- p: {id?, name, category, barcode, price, price_ws, min_qty, active, rack, drawer, box, note}
-- الكمية والتكلفة ما يتعدلوش من هنا: يتغيروا بفاتورة الشراء والبيع والتسوية
create or replace function product_save(p_token text, p jsonb) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); v_id int := (p->>'id')::int; o products; nm text := btrim(regexp_replace(coalesce(p->>'name',''),'\s+',' ','g'));
  bc text := nullif(btrim(translate(coalesce(p->>'barcode',''),'٠١٢٣٤٥٦٧٨٩','0123456789')),''); d record;
  pk int := nullif(_num(p->>'pack_qty'),0)::int; pkp numeric := coalesce(_num(p->>'pack_price'),0);
  pb text := nullif(btrim(translate(coalesce(p->>'pack_barcode',''),'٠١٢٣٤٥٦٧٨٩','0123456789')),'');
begin
  if nm = '' then raise exception 'اكتب اسم المنتج'; end if;
  select id,name into d from products where name_norm=_norm(nm) and id is distinct from v_id;
  if found then raise exception 'فيه منتج بنفس الاسم: «%» (#%)', d.name, d.id; end if;
  if bc is not null then
    select id,name into d from products where barcode=bc and id is distinct from v_id;
    if found then raise exception 'الباركود هذا مسجل للمنتج «%» (#%)', d.name, d.id; end if;
  end if;
  if pk is not null and pk < 2 then raise exception 'الكرتونة لازم فيها حبتين أو أكثر'; end if;
  if pk is null then pb := null; pkp := 0; end if;
  if pb is not null then
    if pb = bc then raise exception 'باركود الكرتونة لازم يختلف عن باركود الحبة'; end if;
    select id,name into d from products where (pack_barcode=pb or barcode=pb) and id is distinct from v_id;
    if found then raise exception 'باركود الكرتونة مسجل للمنتج «%» (#%)', d.name, d.id; end if;
  end if;
  if bc is not null then
    select id,name into d from products where pack_barcode=bc and id is distinct from v_id;
    if found then raise exception 'الباركود هذا مسجل ككرتونة للمنتج «%» (#%)', d.name, d.id; end if;
  end if;
  if v_id is null then
    insert into products(name,name_norm,category,barcode,price,price_ws,min_qty,active,note,fav)
    values (nm,_norm(nm),btrim(coalesce(p->>'category','')),bc,coalesce(_num(p->>'price'),0),coalesce(_num(p->>'price_ws'),0),
            _num(p->>'min_qty')::int,coalesce((p->>'active')::boolean,true),btrim(coalesce(p->>'note','')),coalesce((p->>'fav')::boolean,false))
    returning id into v_id;
    update products set pack_qty=pk, pack_price=pkp, pack_barcode=pb, group_id=(p->>'group_id')::int, variant=btrim(coalesce(p->>'variant','')) where id=v_id;
    if (p->>'group_id') is not null then update products set group_id=(p->>'group_id')::int where id=(p->>'group_id')::int and group_id is null; end if;
    perform _audit(u.id,'product_add',jsonb_build_object('product',v_id,'name',nm));
  else
    select * into o from products where id=v_id for update;
    if not found then raise exception 'المنتج مش موجود'; end if;
    update products set name=nm, name_norm=_norm(nm), category=btrim(coalesce(p->>'category',category)), barcode=bc,
      price=coalesce(_num(p->>'price'),0), price_ws=coalesce(_num(p->>'price_ws'),0), min_qty=_num(p->>'min_qty')::int,
      active=coalesce((p->>'active')::boolean,active), note=btrim(coalesce(p->>'note',note)), fav=coalesce((p->>'fav')::boolean,fav),
      pack_qty=case when p ? 'pack_qty' then pk else pack_qty end, pack_price=case when p ? 'pack_qty' then pkp else pack_price end,
      pack_barcode=case when p ? 'pack_qty' then pb else pack_barcode end,
      group_id=case when p ? 'group_id' then (p->>'group_id')::int else group_id end, variant=btrim(coalesce(p->>'variant',variant)) where id=v_id;
    if o.price <> coalesce(_num(p->>'price'),0) or o.price_ws <> coalesce(_num(p->>'price_ws'),0) then
      perform _audit(u.id,'price_change',jsonb_build_object('product',v_id,'name',nm,'price_from',o.price,'price_to',coalesce(_num(p->>'price'),0),'ws_from',o.price_ws,'ws_to',coalesce(_num(p->>'price_ws'),0)));
    end if;
  end if;
  if p ? 'rack' then perform _place(v_id, p->>'rack', p->>'drawer', p->>'box'); end if;
  return json_build_object('id',v_id);
end $$;

create or replace function product_place(p_token text, p_id int, p_rack text, p_drawer text, p_box text, p_note text) returns void
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','store']);
begin
  perform 1 from products where id=p_id for update;
  if not found then raise exception 'المنتج مش موجود'; end if;
  perform _place(p_id,p_rack,p_drawer,p_box);
  update products set note=btrim(coalesce(p_note,note)) where id=p_id;
end $$;

-- الصورة تتبعث مصغرة من المتصفح (data:image/...). فاضي = حذف الصورة
create or replace function product_image_set(p_token text, p_id int, p_data text) returns int
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','store']); v int;
begin
  if coalesce(p_data,'') <> '' and (p_data !~ '^data:image/(jpeg|png|webp);base64,' or length(p_data) > 400000) then raise exception 'الصورة مش مقبولة أو حجمها كبير'; end if;
  update products set img_ver=img_ver+1 where id=p_id returning img_ver into v;
  if not found then raise exception 'المنتج مش موجود'; end if;
  if coalesce(p_data,'') = '' then delete from product_images where product_id=p_id;
  else insert into product_images(product_id,data) values (p_id,p_data) on conflict (product_id) do update set data=excluded.data, updated_at=now();
  end if;
  return v;
end $$;

-- p_have: {"رقم المنتج": نسخة الصورة اللي عند المتصفح}. ترجع اللي تبدلت بس
create or replace function product_images(p_token text, p_have jsonb default '{}') returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token);
begin
  return (select coalesce(json_agg(json_build_object('id',p.id,'ver',p.img_ver,'data',i.data)),'[]')
          from products p join product_images i on i.product_id=p.id
          where coalesce((p_have->>(p.id::text))::int,-1) <> p.img_ver);
end $$;

-- تسوية الجرد: تكتب الكمية الصحيحة والسبب. opening = رصيد أول المدة (ومعاه التكلفة)
create or replace function stock_adjust(p_token text, p_id int, p_new_qty int, p_reason text, p_note text, p_cost numeric default null) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); o products; a int;
begin
  select * into o from products where id=p_id for update;
  if not found then raise exception 'المنتج مش موجود'; end if;
  if p_new_qty is null or p_new_qty < 0 then raise exception 'الكمية غلط'; end if;
  if p_reason not in ('opening','damaged','lost','count','other') then raise exception 'سبب التسوية مش معروف'; end if;
  if p_new_qty = o.qty and (p_reason <> 'opening' or p_cost is null) then raise exception 'الكمية ما تبدلتش'; end if;
  if p_reason = 'opening' and p_cost is not null then
    if p_cost < 0 then raise exception 'التكلفة غلط'; end if;
    update products set cost=p_cost where id=p_id; o.cost := p_cost;
  end if;
  insert into adjustments(user_id,product_id,qty_before,qty_after,cost,reason,note) values (u.id,p_id,o.qty,p_new_qty,o.cost,p_reason,coalesce(p_note,'')) returning id into a;
  if p_new_qty <> o.qty then perform _move(p_id,'adjust',p_new_qty-o.qty,o.cost,a,u.id,p_reason); end if;
  perform _audit(u.id,'stock_adjust',jsonb_build_object('product',p_id,'name',o.name,'from',o.qty,'to',p_new_qty,'reason',p_reason));
  return json_build_object('id',a,'qty',p_new_qty);
end $$;

create or replace function product_moves(p_token text, p_id int) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','store']);
begin
  return (select coalesce(json_agg(jsonb_build_object('at',m.at,'kind',m.kind,'qty',m.qty,'qty_after',m.qty_after,'ref_id',m.ref_id,'user',us.name,'note',m.note)
            || case when u.role='admin' then jsonb_build_object('cost',m.cost) else '{}'::jsonb end order by m.id),'[]')
          from stock_moves m left join users us on us.id=m.user_id where m.product_id=p_id);
end $$;

-- ======================= العملاء والموردين =======================

create or replace function party_list(p_token text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']);
begin
  return (select coalesce(json_agg(json_build_object('id',id,'kind',kind,'name',name,'phone',phone,'warn_limit',warn_limit,
            'price_level',price_level,'active',active,'balance',_balance(id),'terms_days',terms_days,'points',points) order by id),'[]')
          from parties where kind='c' or u.role='admin');
end $$;

-- p: {id?, kind, name, phone, warn_limit, price_level, active, opening?}
create or replace function party_save(p_token text, p jsonb) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); v_id int := (p->>'id')::int; nm text := btrim(regexp_replace(coalesce(p->>'name',''),'\s+',' ','g')); k text := p->>'kind'; op numeric;
begin
  if nm = '' then raise exception 'اكتب الاسم'; end if;
  if v_id is null then
    if k not in ('c','s') then raise exception 'النوع غلط'; end if;
    if exists (select 1 from parties where kind=k and name_norm=_norm(nm)) then raise exception 'الاسم هذا موجود من قبل'; end if;
    insert into parties(kind,name,name_norm,phone,warn_limit,price_level,terms_days)
    values (k,nm,_norm(nm),btrim(coalesce(p->>'phone','')),coalesce(_num(p->>'warn_limit'),0),coalesce(p->>'price_level','retail'),least(coalesce(_num(p->>'terms_days'),0),365)::int) returning id into v_id;
    op := coalesce(_num(p->>'opening'),0);
    if op > 0 then insert into ledger(party_id,kind,amount,user_id,note) values (v_id,'open',op,u.id,'رصيد افتتاحي'); end if;
  else
    select kind into k from parties where id=v_id for update;
    if not found then raise exception 'الحساب مش موجود'; end if;
    if exists (select 1 from parties where kind=k and name_norm=_norm(nm) and id<>v_id) then raise exception 'الاسم هذا موجود من قبل'; end if;
    update parties set name=nm, name_norm=_norm(nm), phone=btrim(coalesce(p->>'phone',phone)), warn_limit=coalesce(_num(p->>'warn_limit'),0),
      price_level=coalesce(p->>'price_level',price_level), active=coalesce((p->>'active')::boolean,active),
      terms_days=case when p ? 'terms_days' then least(coalesce(_num(p->>'terms_days'),0),365)::int else terms_days end where id=v_id;
  end if;
  return json_build_object('id',v_id);
end $$;

-- عميل جديد من شاشة الكاشير (البائع أو المدير): اسم وهاتف بس
create or replace function party_quick_add(p_token text, p_name text, p_phone text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']); nm text := btrim(regexp_replace(coalesce(p_name,''),'\s+',' ','g')); v parties;
begin
  if nm = '' then raise exception 'اكتب اسم العميل'; end if;
  if exists (select 1 from parties where kind='c' and name_norm=_norm(nm)) then raise exception 'فيه عميل بنفس الاسم'; end if;
  insert into parties(kind,name,name_norm,phone) values ('c',nm,_norm(nm),btrim(coalesce(p_phone,''))) returning * into v;
  perform _audit(u.id,'party_add',jsonb_build_object('party',v.id,'name',nm));
  return json_build_object('id',v.id,'kind','c','name',v.name,'phone',v.phone,'warn_limit',0,'price_level','retail','active',true,'balance',0,'points',0);
end $$;

-- دفعة: من عميل (البائع أو المدير) أو لمورد (المدير بس). أي مبلغ، جزئي أو كامل
create or replace function party_payment(p_token text, p_party int, p_amount numeric, p_method text, p_note text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']); pt parties; sh int; m text := _method(p_method); l int;
begin
  select * into pt from parties where id=p_party for update;
  if not found then raise exception 'الحساب مش موجود'; end if;
  if pt.kind='s' and u.role<>'admin' then raise exception 'ما عندكش صلاحية لهالعملية' using errcode='42501'; end if;
  perform _need(u,'collect');
  if p_amount is null or p_amount <= 0 then raise exception 'اكتب المبلغ'; end if;
  sh := _shift(u.id);
  if u.role='seller' and sh is null then raise exception 'افتح الوردية قبل ما تستلم فلوس'; end if;
  insert into ledger(party_id,kind,amount,method,user_id,note) values (pt.id,'pay',-p_amount,m,u.id,coalesce(p_note,'')) returning id into l;
  perform _cash(sh,u.id,case when pt.kind='c' then 'collect' else 'supplier_pay' end,case when pt.kind='c' then p_amount else -p_amount end,m,l,pt.name);
  return json_build_object('id',l,'balance',_balance(pt.id));
end $$;

-- كل حركات الذمم، ومنها يطلع كشف الحساب وشن مسدد من كل فاتورة
create or replace function ledger_list(p_token text, p_party int default null) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']);
begin
  return (select coalesce(json_agg(json_build_object('id',l.id,'party_id',l.party_id,'at',l.at,'kind',l.kind,'amount',l.amount,
            'sale_id',l.sale_id,'sale_no',(select no from sales where id=l.sale_id),'purchase_id',l.purchase_id,'purchase_no',(select no from purchases where id=l.purchase_id),'method',l.method,'user',us.name,'note',l.note,
            'due_date',case when l.kind='inv' then (select due_date from sales where id=l.sale_id) when l.kind='buy' then (select due_date from purchases where id=l.purchase_id) end) order by l.at,l.id),'[]')
          from ledger l join parties pt on pt.id=l.party_id left join users us on us.id=l.user_id
          where (p_party is null or l.party_id=p_party) and (pt.kind='c' or u.role='admin'));
end $$;

-- ============================ الورديات ============================

create or replace function shift_open(p_token text, p_opening numeric) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']); s int;
begin
  if _shift(u.id) is not null then raise exception 'عندك وردية مفتوحة'; end if;
  if coalesce(p_opening,0) < 0 then raise exception 'المبلغ غلط'; end if;
  insert into shifts(user_id,opening_cash) values (u.id,coalesce(p_opening,0)) returning id into s;
  return json_build_object('id',s);
end $$;

create or replace function _shift_json(p_shift int) returns json language sql stable security definer set search_path=public as $$
  select json_build_object('id',s.id,'user_id',s.user_id,'user',us.name,'opened_at',s.opened_at,'opening_cash',s.opening_cash,
    'closed_at',s.closed_at,'counted_cash',s.counted_cash,'diff',s.diff,'note',s.note,
    'expected_cash', s.opening_cash + coalesce((select sum(amount) from cash_moves where shift_id=s.id and method='cash'),0),
    'moves',(select coalesce(json_agg(json_build_object('kind',kind,'method',method,'amount',amt,'n',n)),'[]')
             from (select kind,method,sum(amount) amt,count(*) n from cash_moves where shift_id=s.id group by kind,method) x))
  from shifts s join users us on us.id=s.user_id where s.id=p_shift
$$;

create or replace function shift_current(p_token text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']);
begin
  return _shift_json(_shift(u.id));
end $$;

-- الإقفال: المستخدم يكتب اللي عده في الدرج، والمنظومة تحسب الفرق. المدير يقدر يقفل وردية غيره
create or replace function shift_close(p_token text, p_counted numeric, p_note text, p_shift int default null) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']); s shifts; ex numeric;
begin
  select * into s from shifts where id=coalesce(p_shift,_shift(u.id)) for update;
  if not found or s.closed_at is not null then raise exception 'ما فيش وردية مفتوحة'; end if;
  if s.user_id<>u.id and u.role<>'admin' then raise exception 'ما عندكش صلاحية لهالعملية' using errcode='42501'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'اكتب المبلغ اللي في الدرج'; end if;
  ex := s.opening_cash + coalesce((select sum(amount) from cash_moves where shift_id=s.id and method='cash'),0);
  update shifts set closed_at=now(), expected_cash=ex, counted_cash=p_counted, diff=p_counted-ex, note=coalesce(p_note,'') where id=s.id;
  if p_counted <> ex then perform _audit(u.id,'shift_diff',jsonb_build_object('shift',s.id,'expected',ex,'counted',p_counted,'diff',p_counted-ex)); end if;
  return _shift_json(s.id);
end $$;

-- ============================== البيع ==============================

-- الدفعات في فاتورة: [{method, amount}] بعد جمع نفس الطريقة. القديمة اللي ما فيهاش تقسيم تتحسب من method و paid
create or replace function _pays(s sales) returns jsonb language sql immutable as $$
  select case when jsonb_array_length(s.pays) > 0 then s.pays
              when s.paid > 0 then jsonb_build_array(jsonb_build_object('method',s.method,'amount',s.paid)) else '[]'::jsonb end
$$;

create or replace function _sale_json(p_id int, p_admin boolean) returns json
language sql stable security definer set search_path=public as $$
  select json_build_object('id',s.id,'no',s.no,'at',s.at,'user',us.name,'user_id',s.user_id,'party_id',s.party_id,'party',pt.name,'party_phone',pt.phone,
    'subtotal',s.subtotal,'discount',s.discount,'total',s.total,'paid',s.paid,'method',s.method,'pays',_pays(s),'tendered',s.tendered,'status',s.status,'note',s.note,'device',s.device,'offline',s.offline,'due_date',s.due_date,'promo_disc',s.promo_disc,'points_used',s.points_used,'points_earned',s.points_earned,
    'points',(select points from parties where id=s.party_id),'balance',case when s.party_id is not null then _balance(s.party_id) end,
    'items',(select json_agg(jsonb_build_object('id',i.id,'product_id',i.product_id,'name',i.name,'qty',i.qty,'price',i.price,'returned',i.returned,'per',i.per,'promo',i.promo)
              || case when p_admin then jsonb_build_object('cost',i.cost) else '{}'::jsonb end order by i.id) from sale_items i where i.sale_id=s.id),
    'returns',(select coalesce(json_agg(json_build_object('no',r.no,'at',r.at,'total',r.total,'refund',r.refund) order by r.id),'[]') from sale_returns r where r.sale_id=s.id))
  from sales s join users us on us.id=s.user_id left join parties pt on pt.id=s.party_id where s.id=p_id
$$;



-- p: {client_id?, party_id?, items:[{product_id, qty, price?}], discount?, payments?:[{method, amount}], tendered?, note?}
--    (القديم: paid? و method? بدل payments، ويقعد شغال)
-- client_id: رقم يولده الجهاز لكل بيعة. لو نفس البيعة تتبعث مرتين (النت قطع) تتسجل مرة وحدة بس
-- كله في عملية وحدة: يا تتم كلها يا ما يتسجل منها شي
create or replace function sale_create(p_token text, p jsonb) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']); sh int; pt parties; pr products; it jsonb; sid int; sno int; ex int;
  q int; v_price numeric; v_sub numeric := 0; v_disc numeric := coalesce(_num(p->>'discount'),0); v_total numeric; v_paid numeric := 0;
  v_pays jsonb := '[]'; pm jsonb; m text; a numeric; b numeric; v_main text; cid text := nullif(btrim(coalesce(p->>'client_id','')),'');
  v_off boolean := coalesce((p->>'offline')::boolean,false); v_at timestamptz := now(); per int; nm text; neg jsonb := '[]';
  pd numeric; pn text; v_promo numeric := 0; v_red int := greatest(coalesce((p->>'redeem')::int,0),0); v_pv numeric := 0; v_earn int := 0; iid int;
begin
  if cid is not null then
    select id into ex from sales where client_id=cid;
    if ex is not null then
      return json_build_object('id',ex,'duplicate',true,'no',(select no from sales where id=ex),'total',(select total from sales where id=ex),
        'balance',(select _balance(party_id) from sales where id=ex and party_id is not null),'over_limit',false,'sale',_sale_json(ex,u.role='admin'),
        'stock',(select coalesce(json_object_agg(pr2.id,pr2.qty),'{}') from products pr2 where pr2.id in (select product_id from sale_items where sale_id=ex)));
    end if;
  end if;
  sh := _shift(u.id);
  -- بيعة انعملت بدون نت وتوها توصل: تاخذ وقت الجهاز (لين 7 أيام)، وتقبل المخزون بالسالب
  if v_off then
    begin v_at := least(greatest((p->>'at')::timestamptz, now() - interval '7 days'), now()); exception when others then v_at := now(); end;
    perform set_config('app.allow_neg','1',true);
  end if;
  if u.role='seller' and sh is null and not v_off then raise exception 'افتح الوردية قبل البيع'; end if;
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') = 0 then raise exception 'السلة فاضية'; end if;
  if (p->>'party_id') is not null then
    select * into pt from parties where id=(p->>'party_id')::int and kind='c' and (active or v_off) for update;
    if not found then raise exception 'العميل مش موجود'; end if;
  end if;
  sno := _next('sale');
  insert into sales(no,at,user_id,party_id,shift_id,method,note,client_id,device,offline)
  values (sno,v_at,u.id,pt.id,sh,'cash',coalesce(p->>'note',''),cid,left(btrim(coalesce(p->>'device','')),40),v_off) returning id into sid;
  for it in select value from jsonb_array_elements(p->'items') order by (value->>'product_id')::int loop
    q := (it->>'qty')::int;
    if q is null or q < 1 then raise exception 'كمية غلط في السلة'; end if;
    select * into pr from products where id=(it->>'product_id')::int for update;
    if not found or (not pr.active and not v_off) then raise exception 'منتج مش موجود أو موقوف'; end if;
    per := 1; nm := pr.name;
    v_price := case when pt.price_level='ws' and pr.price_ws > 0 then pr.price_ws else pr.price end;
    if coalesce((it->>'pack')::boolean,false) then
      if coalesce(pr.pack_qty,0) < 2 then raise exception 'المنتج «%» ما عندهش كرتونة', pr.name; end if;
      per := pr.pack_qty; nm := pr.name || ' (كرتونة ×' || per || ')';
      v_price := case when pr.pack_price > 0 and not (pt.price_level='ws' and pr.price_ws > 0) then pr.pack_price else v_price * per end;
    end if;
    if _can(u,'price') and (it->>'price') is not null and _num(it->>'price') is distinct from v_price then
      perform _audit(u.id,'price_override',jsonb_build_object('sale',sno,'product',pr.id,'name',pr.name,'from',v_price,'to',_num(it->>'price')));
      v_price := _num(it->>'price');
    end if;
    if v_price is null or v_price <= 0 then raise exception 'المنتج «%» ما عندهش سعر بيع', pr.name; end if;
    insert into sale_items(sale_id,product_id,name,qty,price,cost,per) values (sid,pr.id,nm,q,v_price,pr.cost*per,per) returning id into iid;
    select x.disc, x.name into pd, pn from _promo(pr, q, v_price) x;
    if pd > 0 then update sale_items set promo=pn where id=iid; v_promo := v_promo + pd; end if;
    if _move(pr.id,'sale',-q*per,pr.cost,sid,u.id,null) < 0 then
      neg := neg || jsonb_build_array(jsonb_build_object('product',pr.id,'name',pr.name));
    end if;
    v_sub := v_sub + q*v_price;
  end loop;
  if jsonb_array_length(neg) > 0 then perform _audit(u.id,'negative_stock',jsonb_build_object('sale',sno,'products',neg)); end if;
  if v_off and sh is null then perform _audit(u.id,'offline_no_shift',jsonb_build_object('sale',sno)); end if;
  if v_disc < 0 or v_disc > v_sub then raise exception 'الخصم غلط'; end if;
  if u.role='seller' and v_disc > v_sub * coalesce((_setting('max_seller_discount_pct'))::numeric,0) / 100 + 0.0005 then
    raise exception 'الخصم أكبر من المسموح للبائع (%٪)', _setting('max_seller_discount_pct');
  end if;
  -- العروض ونقاط الولاء: ما يدخلوش في حد خصم البائع
  if v_red > 0 then
    if pt.id is null then raise exception 'النقاط تنصرف لعميل بس'; end if;
    if v_red > pt.points then raise exception 'رصيد النقاط % بس', pt.points; end if;
    v_pv := least(round(v_red * coalesce((_setting('loyalty_value'))::numeric,0),3), v_sub - v_disc - v_promo);
    if v_pv <= 0 then raise exception 'صرف النقاط مقفول من الإعدادات'; end if;
  end if;
  v_total := v_sub - v_disc - v_promo - v_pv;
  if pt.id is not null then v_earn := floor(v_total * coalesce((_setting('loyalty_rate'))::numeric,0))::int; end if;
  if pt.id is not null and (v_red > 0 or v_earn > 0) then update parties set points=points - v_red + v_earn where id=pt.id; end if;
  -- الدفعات
  if jsonb_typeof(p->'payments') = 'array' and jsonb_array_length(p->'payments') > 0 then
    for pm in select value from jsonb_array_elements(p->'payments') loop
      m := _method(pm->>'method'); a := round(coalesce(_num(pm->>'amount'),0),3);
      if a > 0 then v_pays := v_pays || jsonb_build_array(jsonb_build_object('method',m,'amount',a)); end if;
    end loop;
  elsif pt.id is null then
    v_pays := jsonb_build_array(jsonb_build_object('method',_method(p->>'method'),'amount',v_total));
  elsif coalesce(_num(p->>'paid'),0) > 0 then
    v_pays := jsonb_build_array(jsonb_build_object('method',_method(p->>'method'),'amount',round(_num(p->>'paid'),3)));
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('method',k,'amount',s) order by s desc),'[]'), coalesce(sum(s),0) into v_pays, v_paid
    from (select x->>'method' k, sum((x->>'amount')::numeric) s from jsonb_array_elements(v_pays) x group by 1) z;
  if pt.id is null and abs(v_paid - v_total) > 0.0005 then
    raise exception 'البيع النقدي لازم يندفع كامل: الإجمالي % والمدفوع %', v_total, v_paid;
  end if;
  if v_paid > v_total + 0.0005 then raise exception 'المدفوع أكبر من إجمالي الفاتورة'; end if;
  if pt.id is not null and v_total - v_paid > 0.0005 and not _can(u,'credit') then raise exception 'ما عندكش صلاحية البيع بالآجل، كلّم المدير' using errcode='42501'; end if;
  if pt.id is not null and v_total - v_paid > 0.0005 then
    update sales set due_date=coalesce(nullif(p->>'due_date','')::date, case when pt.terms_days > 0 then v_at::date + pt.terms_days end) where id=sid;
  end if;
  v_main := case when jsonb_array_length(v_pays) > 1 then 'mixed' when jsonb_array_length(v_pays) = 1 then v_pays->0->>'method' else coalesce(_method(p->>'method'),'cash') end;
  update sales set subtotal=v_sub, discount=v_disc + v_promo + v_pv, promo_disc=v_promo, points_used=v_red, points_earned=v_earn, total=v_total, paid=v_paid, pays=v_pays, method=v_main,
    tendered=case when _num(p->>'tendered') > 0 then _num(p->>'tendered') end where id=sid;
  if pt.id is not null then
    insert into ledger(party_id,kind,amount,sale_id,user_id) values (pt.id,'inv',v_total,sid,u.id);
    for pm in select value from jsonb_array_elements(v_pays) loop
      insert into ledger(party_id,kind,amount,sale_id,method,user_id) values (pt.id,'pay',-(pm->>'amount')::numeric,sid,pm->>'method',u.id);
    end loop;
    b := _balance(pt.id);
  end if;
  for pm in select value from jsonb_array_elements(v_pays) loop
    perform _cash(sh,u.id,'sale',(pm->>'amount')::numeric,pm->>'method',sid,null);
  end loop;
  if v_disc > 0 then perform _audit(u.id,'discount',jsonb_build_object('sale',sno,'discount',v_disc,'subtotal',v_sub)); end if;
  return json_build_object('id',sid,'no',sno,'subtotal',v_sub,'discount',v_disc,'total',v_total,'paid',v_paid,'due',v_total-v_paid,
    'balance',b,'over_limit',pt.id is not null and pt.warn_limit > 0 and b > pt.warn_limit,
    'sale',_sale_json(sid,u.role='admin'),
    'stock',(select coalesce(json_object_agg(pr2.id,pr2.qty),'{}') from products pr2 where pr2.id in (select product_id from sale_items where sale_id=sid)));
end $$;

-- إلغاء فاتورة كاملة (للمدير). ما تنلغاش لو فيها مرتجع
create or replace function sale_void(p_token text, p_sale int) returns void
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']); s sales; it sale_items; sh int; it2 jsonb;
begin
  perform _need(u,'void');
  select * into s from sales where id=p_sale for update;
  if not found or s.status='void' then raise exception 'الفاتورة مش موجودة أو ملغية'; end if;
  if exists (select 1 from sale_returns where sale_id=s.id) then raise exception 'الفاتورة فيها مرتجع، ما تنلغاش'; end if;
  for it in select * from sale_items where sale_id=s.id order by product_id loop
    perform _move(it.product_id,'void',(it.qty - it.returned)*it.per,it.cost/it.per,s.id,u.id,null);
  end loop;
  delete from ledger where sale_id=s.id;
  -- الفلوس ترجع من نفس الوردية لو مازالت مفتوحة، وإلا من وردية المدير
  select id into sh from shifts where id=s.shift_id and closed_at is null;
  for it2 in select value from jsonb_array_elements(_pays(s)) loop
    perform _cash(coalesce(sh,_shift(u.id)),u.id,'void',-(it2->>'amount')::numeric,it2->>'method',s.id,null);
  end loop;
  update sales set status='void' where id=s.id;
  if s.party_id is not null and (s.points_used > 0 or s.points_earned > 0) then update parties set points=points + s.points_used - s.points_earned where id=s.party_id; end if;
  perform _audit(u.id,'sale_void',jsonb_build_object('sale',s.no,'total',s.total));
end $$;

-- مرتجع بيع جزئي أو كامل (للمدير)
-- p: {sale_id, items:[{item_id, qty}], refund?, method?, note?}
create or replace function sale_return(p_token text, p jsonb) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']); s sales; it jsonb; si sale_items; q int; rid int; rno int; v numeric := 0; f numeric; ratio numeric; sh int; m text := _method(p->>'method'); up numeric;
begin
  perform _need(u,'returns');
  select * into s from sales where id=(p->>'sale_id')::int for update;
  if not found or s.status='void' then raise exception 'الفاتورة مش موجودة أو ملغية'; end if;
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') = 0 then raise exception 'اختار اللي بيترجع'; end if;
  ratio := case when s.subtotal > 0 then s.total / s.subtotal else 1 end;      -- الخصم يتوزع على القطع
  sh := _shift(u.id);
  rno := _next('sale_return');
  insert into sale_returns(no,sale_id,user_id,shift_id,total,method,note) values (rno,s.id,u.id,sh,0,m,coalesce(p->>'note','')) returning id into rid;
  for it in select value from jsonb_array_elements(p->'items') loop
    q := (it->>'qty')::int;
    select * into si from sale_items where id=(it->>'item_id')::int and sale_id=s.id for update;
    if not found then raise exception 'سطر مش موجود في الفاتورة'; end if;
    if q is null or q < 1 or q > si.qty - si.returned then raise exception 'الكمية المرتجعة من «%» أكبر من اللي انباع (%)', si.name, si.qty - si.returned; end if;
    up := round(si.price * ratio, 3);
    insert into sale_return_items(return_id,sale_item_id,product_id,name,qty,price,cost) values (rid,si.id,si.product_id,si.name,q,up,si.cost);
    update sale_items set returned=returned+q where id=si.id;
    perform _move(si.product_id,'sale_ret',q*si.per,si.cost/si.per,rid,u.id,null);
    v := v + q*up;
  end loop;
  if s.party_id is null then f := v;
  else f := coalesce(_num(p->>'refund'),0);
    if f > v then raise exception 'المبلغ المرجّع أكبر من قيمة المرتجع'; end if;
    insert into ledger(party_id,kind,amount,sale_id,user_id,note) values (s.party_id,'ret',-v,s.id,u.id,'مرتجع #'||rno);
    if f > 0 then insert into ledger(party_id,kind,amount,sale_id,method,user_id,note) values (s.party_id,'refund',f,s.id,m,u.id,'مرتجع #'||rno); end if;
  end if;
  update sale_returns set total=v, refund=f where id=rid;
  perform _cash(sh,u.id,'refund',-f,m,rid,null);
  perform _audit(u.id,'sale_return',jsonb_build_object('return',rno,'sale',s.no,'total',v,'refund',f));
  return json_build_object('id',rid,'no',rno,'total',v,'refund',f);
end $$;

-- ============================= الشراء =============================

-- p: {party_id?, ref?, paid?, method?, note?, items:[{product_id? | name, qty, cost, price?, price_ws?, category?, barcode?, rack?, drawer?, box?}]}
-- الكميات تنزاد، والتكلفة تتحسب بالمتوسط، والمنتج الجديد ينضاف
create or replace function purchase_create(p_token text, p jsonb) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); pt parties; pr products; it jsonb; pid int; q int; c numeric; v_total numeric := 0; v_paid numeric; m text := _method(p->>'method');
  sh int; nm text; added int := 0; prod int; pno int;
begin
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') = 0 then raise exception 'زيد منتج واحد على الأقل'; end if;
  if (p->>'party_id') is not null then
    select * into pt from parties where id=(p->>'party_id')::int and kind='s' and active for update;
    if not found then raise exception 'المورد مش موجود'; end if;
  end if;
  sh := _shift(u.id);
  pno := _next('purchase');
  insert into purchases(no,user_id,party_id,shift_id,ref,method,note) values (pno,u.id,pt.id,sh,btrim(coalesce(p->>'ref','')),m,coalesce(p->>'note','')) returning id into pid;
  for it in select value from jsonb_array_elements(p->'items') loop
    q := (it->>'qty')::int; c := _num(it->>'cost');
    if q is null or q < 1 then raise exception 'اكتب الكمية لكل منتج'; end if;
    if c is null or c <= 0 then raise exception 'اكتب سعر التكلفة لكل منتج'; end if;
    prod := (it->>'product_id')::int;
    if prod is null then
      nm := btrim(regexp_replace(coalesce(it->>'name',''),'\s+',' ','g'));
      if nm = '' then raise exception 'اكتب اسم المنتج'; end if;
      select id into prod from products where name_norm=_norm(nm);
      if prod is null then
        insert into products(name,name_norm,category,barcode) values (nm,_norm(nm),btrim(coalesce(it->>'category','')),nullif(btrim(coalesce(it->>'barcode','')),'')) returning id into prod;
        added := added + 1;
      end if;
    end if;
    select * into pr from products where id=prod for update;
    if not found then raise exception 'منتج مش موجود'; end if;
    if exists (select 1 from purchase_items where purchase_id=pid and product_id=pr.id) then raise exception 'المنتج «%» مكرر في نفس الفاتورة', pr.name; end if;
    update products set
      cost = case when pr.qty > 0 and pr.cost > 0 then round((pr.qty*pr.cost + q*c)/(pr.qty+q),3) else c end,
      price = case when coalesce(_num(it->>'price'),0) > 0 then _num(it->>'price') else price end,
      price_ws = case when coalesce(_num(it->>'price_ws'),0) > 0 then _num(it->>'price_ws') else price_ws end
    where id=pr.id;
    if coalesce(it->>'rack','') <> '' then perform _place(pr.id, it->>'rack', it->>'drawer', it->>'box'); end if;
    insert into purchase_items(purchase_id,product_id,name,qty,cost) values (pid,pr.id,pr.name,q,c);
    perform _move(pr.id,'buy',q,c,pid,u.id,null);
    v_total := v_total + q*c;
  end loop;
  if pt.id is null then v_paid := v_total;
  else v_paid := coalesce(_num(p->>'paid'),0);
    if v_paid > v_total then raise exception 'المدفوع أكبر من إجمالي الفاتورة'; end if;
    insert into ledger(party_id,kind,amount,purchase_id,user_id,note) values (pt.id,'buy',v_total,pid,u.id,btrim(coalesce(p->>'ref','')));
    if v_paid > 0 then insert into ledger(party_id,kind,amount,purchase_id,method,user_id) values (pt.id,'pay',-v_paid,pid,m,u.id); end if;
  end if;
  update purchases set total=v_total, paid=v_paid,
    due_date=case when pt.id is not null and v_total - v_paid > 0.0005 then coalesce(nullif(p->>'due_date','')::date, case when pt.terms_days > 0 then current_date + pt.terms_days end) end where id=pid;
  if (p->>'po_id') is not null then
    update purchase_orders set status='received', purchase_id=pid, updated_at=now() where id=(p->>'po_id')::int and status='open';
    if not found then raise exception 'أمر الشراء مش موجود أو مستلم قبل'; end if;
    update purchases set po_id=(p->>'po_id')::int where id=pid;
  end if;
  perform _cash(sh,u.id,'purchase',-v_paid,m,pid,null);
  return json_build_object('id',pid,'no',pno,'total',v_total,'paid',v_paid,'due',v_total-v_paid,'new_products',added);
end $$;

-- مرتجع شراء للمورد (للمدير)
-- p: {purchase_id, items:[{item_id, qty}], refund?, method?, note?}
create or replace function purchase_return(p_token text, p jsonb) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); pu purchases; it jsonb; pi purchase_items; q int; rid int; rno int; v numeric := 0; f numeric; sh int; m text := _method(p->>'method');
begin
  select * into pu from purchases where id=(p->>'purchase_id')::int for update;
  if not found then raise exception 'فاتورة الشراء مش موجودة'; end if;
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') = 0 then raise exception 'اختار اللي بيترجع'; end if;
  sh := _shift(u.id);
  rno := _next('purchase_return');
  insert into purchase_returns(no,purchase_id,user_id,shift_id,total,method,note) values (rno,pu.id,u.id,sh,0,m,coalesce(p->>'note','')) returning id into rid;
  for it in select value from jsonb_array_elements(p->'items') loop
    q := (it->>'qty')::int;
    select * into pi from purchase_items where id=(it->>'item_id')::int and purchase_id=pu.id for update;
    if not found then raise exception 'سطر مش موجود في الفاتورة'; end if;
    if q is null or q < 1 or q > pi.qty - pi.returned then raise exception 'الكمية المرتجعة من «%» أكبر من اللي انشرى (%)', pi.name, pi.qty - pi.returned; end if;
    insert into purchase_return_items(return_id,purchase_item_id,product_id,name,qty,cost) values (rid,pi.id,pi.product_id,pi.name,q,pi.cost);
    update purchase_items set returned=returned+q where id=pi.id;
    perform _move(pi.product_id,'buy_ret',-q,pi.cost,rid,u.id,null);
    v := v + q*pi.cost;
  end loop;
  if pu.party_id is null then f := v;
  else f := coalesce(_num(p->>'refund'),0);
    if f > v then raise exception 'المبلغ المرجّع أكبر من قيمة المرتجع'; end if;
    insert into ledger(party_id,kind,amount,purchase_id,user_id,note) values (pu.party_id,'ret',-v,pu.id,u.id,'مرتجع #'||rno);
    if f > 0 then insert into ledger(party_id,kind,amount,purchase_id,method,user_id,note) values (pu.party_id,'refund',f,pu.id,m,u.id,'مرتجع #'||rno); end if;
  end if;
  update purchase_returns set total=v, refund=f where id=rid;
  perform _cash(sh,u.id,'supplier_refund',f,m,rid,null);
  perform _audit(u.id,'purchase_return',jsonb_build_object('return',rno,'purchase',pu.no,'total',v,'refund',f));
  return json_build_object('id',rid,'no',rno,'total',v,'refund',f);
end $$;

-- =========================== المصروفات ===========================

create or replace function expense_add(p_token text, p_category text, p_amount numeric, p_method text, p_note text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']); sh int; e int; m text := _method(p_method);
begin
  perform _need(u,'expenses');
  if btrim(coalesce(p_category,'')) = '' then raise exception 'اكتب نوع المصروف'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'اكتب المبلغ'; end if;
  sh := _shift(u.id);
  if u.role='seller' and sh is null then raise exception 'افتح الوردية قبل ما تسجل مصروف'; end if;
  insert into expenses(user_id,shift_id,category,amount,method,note) values (u.id,sh,btrim(p_category),p_amount,m,coalesce(p_note,'')) returning id into e;
  perform _cash(sh,u.id,'expense',-p_amount,m,e,btrim(p_category));
  return json_build_object('id',e);
end $$;

-- ============================ التقارير ============================

-- مبيعات البائع نفسه، بدون تكلفة ولا أرباح
create or replace function my_sales(p_token text, p_from timestamptz, p_to timestamptz) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']);
begin
  return (select coalesce(json_agg(json_build_object('id',s.id,'no',s.no,'at',s.at,'party_id',s.party_id,'subtotal',s.subtotal,'discount',s.discount,
            'total',s.total,'paid',s.paid,'method',s.method,'pays',_pays(s),'tendered',s.tendered,'status',s.status,'device',s.device,'offline',s.offline,
            'items',(select json_agg(json_build_object('id',i.id,'product_id',i.product_id,'name',i.name,'qty',i.qty,'price',i.price,'returned',i.returned,'per',i.per) order by i.id) from sale_items i where i.sale_id=s.id)) order by s.id),'[]')
          from sales s where s.user_id=u.id and s.at >= coalesce(p_from,'-infinity') and s.at <= coalesce(p_to,'infinity'));
end $$;

-- كل بيانات الفترة للمدير، والتقارير تتحسب منها في الموقع
create or replace function report_data(p_token text, p_from timestamptz, p_to timestamptz) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); f timestamptz := coalesce(p_from,'-infinity'); t timestamptz := coalesce(p_to,'infinity');
begin
  return json_build_object(
    'sales',(select coalesce(json_agg(json_build_object('id',s.id,'no',s.no,'at',s.at,'user_id',s.user_id,'party_id',s.party_id,'shift_id',s.shift_id,
        'subtotal',s.subtotal,'discount',s.discount,'total',s.total,'paid',s.paid,'method',s.method,'pays',_pays(s),'status',s.status,'note',s.note,'device',s.device,'offline',s.offline,'due_date',s.due_date,
        'items',(select json_agg(json_build_object('id',i.id,'product_id',i.product_id,'name',i.name,'qty',i.qty,'price',i.price,'cost',i.cost,'returned',i.returned,'per',i.per) order by i.id) from sale_items i where i.sale_id=s.id)) order by s.id),'[]')
      from sales s where s.at between f and t),
    'sale_returns',(select coalesce(json_agg(json_build_object('id',r.id,'no',r.no,'sale_id',r.sale_id,'at',r.at,'user_id',r.user_id,'total',r.total,'refund',r.refund,'method',r.method,'note',r.note,
        'items',(select json_agg(json_build_object('product_id',i.product_id,'name',i.name,'qty',i.qty,'price',i.price,'cost',i.cost,'per',si.per)) from sale_return_items i join sale_items si on si.id=i.sale_item_id where i.return_id=r.id)) order by r.id),'[]')
      from sale_returns r where r.at between f and t),
    'purchases',(select coalesce(json_agg(json_build_object('id',b.id,'no',b.no,'at',b.at,'user_id',b.user_id,'party_id',b.party_id,'ref',b.ref,'total',b.total,'paid',b.paid,'method',b.method,'note',b.note,'due_date',b.due_date,'po_id',b.po_id,
        'items',(select json_agg(json_build_object('id',i.id,'product_id',i.product_id,'name',i.name,'qty',i.qty,'cost',i.cost,'returned',i.returned) order by i.id) from purchase_items i where i.purchase_id=b.id)) order by b.id),'[]')
      from purchases b where b.at between f and t),
    'purchase_returns',(select coalesce(json_agg(json_build_object('id',r.id,'no',r.no,'purchase_id',r.purchase_id,'at',r.at,'user_id',r.user_id,'total',r.total,'refund',r.refund,'method',r.method,'note',r.note,
        'items',(select json_agg(json_build_object('product_id',i.product_id,'name',i.name,'qty',i.qty,'cost',i.cost)) from purchase_return_items i where i.return_id=r.id)) order by r.id),'[]')
      from purchase_returns r where r.at between f and t),
    'expenses',(select coalesce(json_agg(json_build_object('id',e.id,'at',e.at,'user_id',e.user_id,'category',e.category,'amount',e.amount,'method',e.method,'note',e.note) order by e.id),'[]')
      from expenses e where e.at between f and t),
    'adjustments',(select coalesce(json_agg(json_build_object('id',a.id,'at',a.at,'user_id',a.user_id,'product_id',a.product_id,'name',pr.name,'qty_before',a.qty_before,'qty_after',a.qty_after,'cost',a.cost,'reason',a.reason,'note',a.note) order by a.id),'[]')
      from adjustments a join products pr on pr.id=a.product_id where a.at between f and t),
    'collections',(select coalesce(json_agg(json_build_object('at',c.at,'user_id',c.user_id,'kind',c.kind,'amount',c.amount,'method',c.method) order by c.id),'[]')
      from cash_moves c where c.at between f and t and c.kind in ('collect','supplier_pay')),
    'shifts',(select coalesce(json_agg(_shift_json(s.id) order by s.id),'[]') from shifts s where s.opened_at between f and t or s.closed_at is null));
end $$;

-- فاتورة بيع وحدة بتفاصيلها ومرتجعاتها (للطباعة والمرتجع). البائع ما يشوفش التكلفة
create or replace function sale_get(p_token text, p_id int) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']); r json := _sale_json(p_id, u.role='admin');
begin
  if r is null then raise exception 'الفاتورة مش موجودة'; end if;
  return r;
end $$;

-- البحث برقم الفاتورة
create or replace function sale_find(p_token text, p_no int) returns int
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']); v int;
begin
  select id into v from sales where no=p_no;
  if v is null then raise exception 'ما فيش فاتورة بالرقم %', p_no; end if;
  return v;
end $$;

create or replace function purchase_get(p_token text, p_id int) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); r json;
begin
  select json_build_object('id',b.id,'no',b.no,'at',b.at,'user',us.name,'party_id',b.party_id,'party',pt.name,'party_phone',pt.phone,'ref',b.ref,'total',b.total,'paid',b.paid,'method',b.method,'note',b.note,'due_date',b.due_date,
    'items',(select json_agg(json_build_object('id',i.id,'product_id',i.product_id,'name',i.name,'qty',i.qty,'cost',i.cost,'returned',i.returned) order by i.id) from purchase_items i where i.purchase_id=b.id),
    'returns',(select coalesce(json_agg(json_build_object('no',r.no,'at',r.at,'total',r.total,'refund',r.refund) order by r.id),'[]') from purchase_returns r where r.purchase_id=b.id))
  into r from purchases b join users us on us.id=b.user_id left join parties pt on pt.id=b.party_id where b.id=p_id;
  if r is null then raise exception 'فاتورة الشراء مش موجودة'; end if;
  return r;
end $$;

create or replace function audit_list(p_token text, p_limit int default 200) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']);
begin
  return (select coalesce(json_agg(x order by (x->>'id')::bigint desc),'[]') from (
            select jsonb_build_object('id',a.id,'at',a.at,'user',us.name,'action',a.action,'detail',a.detail) x
            from audit a left join users us on us.id=a.user_id order by a.id desc limit least(coalesce(p_limit,200),1000)) q);
end $$;

-- نسخة احتياطية كاملة: كل الجداول ما عدا الجلسات وكلمات المرور والرموز
create or replace function _backup_json(p_images boolean, p_by text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r jsonb := jsonb_build_object('version',1,'at',now(),'by',p_by); t text; v jsonb;
begin
  foreach t in array array['counters','products','parties','shifts','sales','sale_items','sale_returns','sale_return_items',
    'purchases','purchase_items','purchase_returns','purchase_return_items','ledger','stock_moves','adjustments','expenses','cash_moves','audit','counts','count_items','purchase_orders','promos'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) order by 1),''[]'') from %I x', t) into v;
    r := r || jsonb_build_object(t, v);
  end loop;
  r := r || jsonb_build_object('settings',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from settings x where key <> 'backup_key_hash'));
  r := r || jsonb_build_object('users',(select coalesce(jsonb_agg(to_jsonb(x) - 'pass_hash' - 'pin_hash' - 'failed_count' - 'locked_until'),'[]') from users x));
  if p_images then r := r || jsonb_build_object('product_images',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from product_images x)); end if;
  return r;
end $$;

create or replace function backup_export(p_token text, p_images boolean default true) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']);
begin
  perform _audit(u.id,'backup',jsonb_build_object('images',p_images));
  return _backup_json(p_images, u.username);
end $$;

-- مفتاح النسخ التلقائي: المدير يولده مرة، ويتحط في أسرار GitHub. يطلع مرة وحدة بس
create or replace function backup_key_set(p_token text) returns text
language plpgsql security definer set search_path=public,extensions as $$
declare u users := _auth(p_token, array['admin']); k text := encode(gen_random_bytes(24),'hex');
begin
  insert into settings(key,value) values ('backup_key_hash', to_jsonb(encode(digest(k,'sha256'),'hex')))
    on conflict (key) do update set value=excluded.value;
  perform _audit(u.id,'backup_key',jsonb_build_object());
  return k;
end $$;

create or replace function backup_auto(p_key text, p_images boolean default false) returns json
language plpgsql security definer set search_path=public,extensions as $$
declare h text := (select value#>>'{}' from settings where key='backup_key_hash');
begin
  if h is null or coalesce(p_key,'') = '' or encode(digest(p_key,'sha256'),'hex') <> h then
    raise exception 'AUTH: مفتاح النسخ غلط' using errcode='28000';
  end if;
  insert into audit(user_id,action,detail) values (null,'backup_auto',jsonb_build_object('images',p_images));
  return _backup_json(p_images, 'auto');
end $$;

-- ======================= أعمار الديون والاستحقاق =======================
-- كل دفعة تسدد أقدم فاتورة أول. يرجع لكل حساب: الباقي، المتأخر (فات موعده)، وتوزيعه حسب العمر
create or replace function _aging(p_kind text) returns table(party_id int, unpaid numeric, overdue numeric, a30 numeric, a60 numeric, a90 numeric, a90p numeric, oldest date, next_due date)
language sql stable security definer set search_path=public as $$
  with l as (select l.id, l.party_id, l.amount, l.at, case when l.kind='inv' then s.due_date when l.kind='buy' then b.due_date end due
             from ledger l join parties pt on pt.id=l.party_id and pt.kind=p_kind
             left join sales s on s.id=l.sale_id left join purchases b on b.id=l.purchase_id),
  cr as (select party_id, -sum(amount) c from l where amount < 0 group by 1),
  d as (select l.*, sum(l.amount) over (partition by l.party_id order by l.at, l.id) cum from l where amount > 0),
  u as (select d.party_id, d.at, d.due, greatest(0, least(d.amount, d.cum - coalesce(cr.c,0))) un from d left join cr on cr.party_id=d.party_id)
  select party_id, sum(un), coalesce(sum(un) filter (where due < current_date),0),
    coalesce(sum(un) filter (where at > now()-interval '30 days'),0),
    coalesce(sum(un) filter (where at <= now()-interval '30 days' and at > now()-interval '60 days'),0),
    coalesce(sum(un) filter (where at <= now()-interval '60 days' and at > now()-interval '90 days'),0),
    coalesce(sum(un) filter (where at <= now()-interval '90 days'),0),
    min(at::date) filter (where un > 0), min(due) filter (where un > 0 and due >= current_date)
  from u group by party_id having sum(un) > 0.0005
$$;

create or replace function aging(p_token text, p_kind text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']);
begin
  if p_kind not in ('c','s') or (p_kind='s' and u.role<>'admin') then raise exception 'ما عندكش صلاحية لهالعملية' using errcode='42501'; end if;
  return (select coalesce(json_agg(json_build_object('party_id',a.party_id,'unpaid',a.unpaid,'overdue',a.overdue,'a30',a.a30,'a60',a.a60,'a90',a.a90,'a90p',a.a90p,'oldest',a.oldest,'next_due',a.next_due) order by a.overdue desc, a.unpaid desc),'[]') from _aging(p_kind) a);
end $$;

-- ============================ أوامر الشراء ============================
-- p: {id?, party_id?, note?, items:[{product_id, qty, cost?}]}
create or replace function po_save(p_token text, p jsonb) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); v_id int := (p->>'id')::int; o purchase_orders; it jsonb; pr products; arr jsonb := '[]'; t numeric := 0; q int; c numeric;
begin
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') = 0 then raise exception 'زيد منتج واحد على الأقل'; end if;
  if (p->>'party_id') is not null and not exists (select 1 from parties where id=(p->>'party_id')::int and kind='s') then raise exception 'المورد مش موجود'; end if;
  for it in select value from jsonb_array_elements(p->'items') loop
    select * into pr from products where id=(it->>'product_id')::int;
    if not found then raise exception 'منتج مش موجود'; end if;
    q := (it->>'qty')::int; c := coalesce(_num(it->>'cost'), pr.cost);
    if q is null or q < 1 then raise exception 'اكتب كمية «%»', pr.name; end if;
    arr := arr || jsonb_build_array(jsonb_build_object('product_id',pr.id,'name',pr.name,'qty',q,'cost',c,'pack_qty',pr.pack_qty));
    t := t + q*c;
  end loop;
  if v_id is null then
    insert into purchase_orders(no,user_id,party_id,note,items,total) values (_next('po'),u.id,(p->>'party_id')::int,btrim(coalesce(p->>'note','')),arr,t) returning * into o;
  else
    update purchase_orders set party_id=(p->>'party_id')::int, note=btrim(coalesce(p->>'note','')), items=arr, total=t, updated_at=now() where id=v_id and status='open' returning * into o;
    if not found then raise exception 'أمر الشراء مش موجود أو ما عادش مفتوح'; end if;
  end if;
  return json_build_object('id',o.id,'no',o.no,'total',o.total);
end $$;

create or replace function po_list(p_token text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']);
begin
  return (select coalesce(json_agg(json_build_object('id',o.id,'no',o.no,'at',o.at,'user',us.name,'party_id',o.party_id,'party',pt.name,'party_phone',pt.phone,'status',o.status,'note',o.note,
            'items',o.items,'total',o.total,'purchase_id',o.purchase_id,'purchase_no',(select no from purchases where id=o.purchase_id)) order by o.id desc),'[]')
          from (select * from purchase_orders order by id desc limit 300) o join users us on us.id=o.user_id left join parties pt on pt.id=o.party_id);
end $$;

create or replace function po_cancel(p_token text, p_id int) returns void
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']);
begin
  update purchase_orders set status='cancel', updated_at=now() where id=p_id and status='open';
  if not found then raise exception 'أمر الشراء مش موجود أو ما عادش مفتوح'; end if;
end $$;

-- اقتراح الطلب: المنتجات اللي وصلت حد التنبيه. لو حددت مورد: اللي آخر مرة انشروا منه
create or replace function po_suggest(p_token text, p_party int default null) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); dm int := coalesce((_setting('default_min_qty'))::int,5);
begin
  return (select coalesce(json_agg(json_build_object('product_id',p.id,'name',p.name,'qty',greatest(coalesce(p.min_qty,dm)*2 - p.qty, 1),'cost',coalesce(lp.cost,p.cost),'now',p.qty,'min',coalesce(p.min_qty,dm),'last_party',lp.party_id) order by p.name),'[]')
          from products p
          left join lateral (select b.party_id, i.cost from purchase_items i join purchases b on b.id=i.purchase_id where i.product_id=p.id order by b.at desc limit 1) lp on true
          where p.active and p.qty <= coalesce(p.min_qty,dm) and (p_party is null or lp.party_id=p_party)
            and not exists (select 1 from purchase_orders o where o.status='open' and o.items @> jsonb_build_array(jsonb_build_object('product_id',p.id))));
end $$;

-- ============================ اللوحة الرئيسية ============================
create or replace function dashboard(p_token text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); d0 timestamptz := date_trunc('day', now()); dm int := coalesce((_setting('default_min_qty'))::int,5);
begin
  return json_build_object(
    'days',(select coalesce(json_agg(json_build_object('d',g.d,'total',coalesce(x.t,0),'profit',coalesce(x.t,0)-coalesce(x.c,0)-coalesce(r.rv,0)+coalesce(r.rc,0),'n',coalesce(x.n,0),'ret',coalesce(r.rv,0)) order by g.d),'[]')
      from generate_series(d0 - interval '13 days', d0, interval '1 day') g(d)
      left join (select date_trunc('day',s.at) d, sum(s.total) t, count(*) n, sum((select sum(i.qty*i.cost) from sale_items i where i.sale_id=s.id)) c from sales s where s.status='ok' and s.at >= d0 - interval '13 days' group by 1) x on x.d=g.d
      left join (select date_trunc('day',r.at) d, sum(r.total) rv, sum((select sum(i.qty*i.cost) from sale_return_items i where i.return_id=r.id)) rc from sale_returns r where r.at >= d0 - interval '13 days' group by 1) r on r.d=g.d),
    'month',(select json_build_object('total',coalesce(sum(s.total),0),'n',count(*),'cost',coalesce(sum((select sum(i.qty*i.cost) from sale_items i where i.sale_id=s.id)),0)) from sales s where s.status='ok' and s.at >= date_trunc('month',now())),
    'month_ret',(select json_build_object('total',coalesce(sum(r.total),0),'cost',coalesce(sum((select sum(i.qty*i.cost) from sale_return_items i where i.return_id=r.id)),0)) from sale_returns r where r.at >= date_trunc('month',now())),
    'exp_today',(select coalesce(sum(amount),0) from expenses where at >= d0),
    'exp_month',(select coalesce(sum(amount),0) from expenses where at >= date_trunc('month',now())),
    'offline_today',(select count(*) from sales where offline and at >= d0),
    'shifts',(select coalesce(json_agg(json_build_object('id',s.id,'user',us.name,'opened_at',s.opened_at,
                'cash',s.opening_cash + coalesce((select sum(amount) from cash_moves where shift_id=s.id and method='cash'),0),
                'sales',(select coalesce(sum(total),0) from sales where shift_id=s.id and status='ok')) order by s.opened_at),'[]')
              from shifts s join users us on us.id=s.user_id where s.closed_at is null),
    'cust',(select json_build_object('debt',coalesce(sum(unpaid),0),'overdue',coalesce(sum(overdue),0),'n_overdue',count(*) filter (where overdue > 0.0005),'n',count(*)) from _aging('c')),
    'sup',(select json_build_object('due',coalesce(sum(unpaid),0),'overdue',coalesce(sum(overdue),0),'n_overdue',count(*) filter (where overdue > 0.0005),
             'next',(select min(next_due) from _aging('s')),'next_amount',(select coalesce(sum(b.total-b.paid),0) from purchases b where b.due_date between current_date and current_date + 7)) from _aging('s')),
    'stock',(select json_build_object('value',coalesce(sum(greatest(qty,0)*cost),0),'low',count(*) filter (where active and qty > 0 and qty <= coalesce(min_qty,dm)),
             'out',count(*) filter (where active and qty = 0),'neg',count(*) filter (where qty < 0),'n',count(*) filter (where active)) from products),
    'top',(select coalesce(json_agg(t),'[]') from (select i.product_id, max(p.name) name, sum(i.qty*i.per) q, sum(i.qty*i.price) r from sale_items i join sales s on s.id=i.sale_id join products p on p.id=i.product_id
             where s.status='ok' and s.at >= d0 - interval '6 days' group by 1 order by 4 desc limit 6) t),
    'po_open',(select json_build_object('n',count(*),'total',coalesce(sum(total),0)) from purchase_orders where status='open'),
    'count_open',(select id from counts where status='open'),
    'alerts',(select coalesce(json_agg(json_build_object('at',a.at,'user',us.name,'action',a.action,'detail',a.detail) order by a.id desc),'[]')
              from (select * from audit where action in ('negative_stock','shift_diff','offline_no_shift','price_override') and at > now() - interval '7 days' order by id desc limit 12) a left join users us on us.id=a.user_id));
end $$;

-- ============================ العروض ============================
-- أحسن عرض لسطر: نسبة خصم أو اشري X وخوذ Y. يرجع قيمة الخصم واسم العرض
create or replace function _promo(pr products, q int, price numeric) returns table(disc numeric, name text)
language sql stable security definer set search_path=public as $$
  select d, n from (
    select case when o.kind='pct' then round(q*price*o.pct/100,3)
                else (q / (o.buy+o.get)) * o.get * price end d, o.name n
    from promos o where o.active and (o.starts is null or o.starts <= current_date) and (o.ends is null or o.ends >= current_date)
      and (o.product_id = pr.id or o.product_id = pr.group_id or (o.product_id is null and o.category is not null and o.category = pr.category))) x
  where d > 0 order by d desc limit 1
$$;

create or replace function promo_list(p_token text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','seller']);
begin
  return (select coalesce(json_agg(json_build_object('id',o.id,'name',o.name,'kind',o.kind,'product_id',o.product_id,'product',pr.name,'category',o.category,'pct',o.pct,'buy',o.buy,'get',o.get,'starts',o.starts,'ends',o.ends,'active',o.active) order by o.id desc),'[]')
          from promos o left join products pr on pr.id=o.product_id where o.active or u.role='admin');
end $$;

-- p: {id?, name, kind, product_id?|category?, pct?|buy,get, starts?, ends?, active?}
create or replace function promo_save(p_token text, p jsonb) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); v int := (p->>'id')::int; k text := p->>'kind';
begin
  if btrim(coalesce(p->>'name','')) = '' then raise exception 'اكتب اسم العرض'; end if;
  if k not in ('pct','bxgy') then raise exception 'نوع العرض غلط'; end if;
  if (p->>'product_id') is null and btrim(coalesce(p->>'category','')) = '' then raise exception 'اختار المنتج أو التصنيف'; end if;
  if k='pct' and not coalesce(_num(p->>'pct') between 0.01 and 100, false) then raise exception 'نسبة الخصم من 1 لـ 100'; end if;
  if k='bxgy' and (coalesce((p->>'buy')::int,0) < 1 or coalesce((p->>'get')::int,0) < 1) then raise exception 'اكتب اشري كم وخوذ كم'; end if;
  if v is null then
    insert into promos(name,kind,product_id,category,pct,buy,get,starts,ends) values (btrim(p->>'name'),k,(p->>'product_id')::int,nullif(btrim(coalesce(p->>'category','')),''),
      _num(p->>'pct'),(p->>'buy')::int,(p->>'get')::int,nullif(p->>'starts','')::date,nullif(p->>'ends','')::date) returning id into v;
  else
    update promos set name=btrim(p->>'name'),kind=k,product_id=(p->>'product_id')::int,category=nullif(btrim(coalesce(p->>'category','')),''),pct=_num(p->>'pct'),buy=(p->>'buy')::int,get=(p->>'get')::int,
      starts=nullif(p->>'starts','')::date,ends=nullif(p->>'ends','')::date,active=coalesce((p->>'active')::boolean,active) where id=v;
  end if;
  perform _audit(u.id,'promo',p);
  return json_build_object('id',v);
end $$;

-- ============================ الباركود ============================
-- المنتجات اللي ما عندهاش باركود تاخذ رقم داخلي للمحل (يبدا بـ 20) باش تنطبع ملصقاتها
create or replace function barcode_fill(p_token text, p_ids int[] default null) returns int
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); n int := 0; r record; c text;
begin
  for r in select id from products where barcode is null and (p_ids is null or id = any(p_ids)) order by id for update loop
    c := _ean13('20' || lpad(r.id::text,10,'0'));
    if exists (select 1 from products where barcode=c or pack_barcode=c) then continue; end if;
    update products set barcode=c where id=r.id; n := n + 1;
  end loop;
  if n > 0 then perform _audit(u.id,'barcode_fill',jsonb_build_object('count',n)); end if;
  return n;
end $$;

-- ============================ الجرد الكامل ============================
create or replace function _count_json(p_count int, p_admin boolean) returns json
language sql stable security definer set search_path=public as $$
  select json_build_object('id',c.id,'at',c.at,'user',us.name,'status',c.status,'note',c.note,'closed_at',c.closed_at,'summary',c.summary,
    'items',(select coalesce(json_agg(jsonb_build_object('product_id',i.product_id,'name',p.name,'expected',i.expected,'counted',i.counted,
                'now',p.qty,'at',i.at,'by',u2.name) || case when p_admin then jsonb_build_object('cost',p.cost) else '{}'::jsonb end order by i.at desc),'[]')
             from count_items i join products p on p.id=i.product_id left join users u2 on u2.id=i.user_id where i.count_id=c.id))
  from counts c join users us on us.id=c.user_id where c.id=p_count
$$;

create or replace function count_open(p_token text, p_note text default '') returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); v int;
begin
  if exists (select 1 from counts where status='open') then raise exception 'فيه جرد مفتوح، كمّله أو الغيه الأول'; end if;
  insert into counts(user_id,note) values (u.id,btrim(coalesce(p_note,''))) returning id into v;
  perform _audit(u.id,'count_open',jsonb_build_object('count',v));
  return _count_json(v, true);
end $$;

create or replace function count_current(p_token text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','store']);
begin
  return _count_json((select id from counts where status='open'), u.role='admin');
end $$;

-- p_add: true = يزيد على اللي انعد (مسح باركود حبة حبة)، false = يكتب العدد كامل
create or replace function count_set(p_token text, p_product int, p_qty int, p_add boolean default false) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','store']); c int; pr products; v int;
begin
  select id into c from counts where status='open' for update;
  if c is null then raise exception 'ما فيش جرد مفتوح'; end if;
  select * into pr from products where id=p_product;
  if not found then raise exception 'المنتج مش موجود'; end if;
  if p_qty is null or (not p_add and p_qty < 0) then raise exception 'العدد غلط'; end if;
  insert into count_items(count_id,product_id,expected,counted,user_id) values (c,pr.id,pr.qty,greatest(p_qty,0),u.id)
  on conflict (count_id,product_id) do update
    set counted=greatest(case when p_add then count_items.counted + p_qty else p_qty end,0), at=now(), user_id=u.id
  returning counted into v;
  return json_build_object('product_id',pr.id,'counted',v);
end $$;

create or replace function count_remove(p_token text, p_product int) returns void
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin','store']);
begin
  delete from count_items where product_id=p_product and count_id=(select id from counts where status='open');
end $$;

-- الاعتماد: كل منتج انعد ياخذ الفرق (المعدود - اللي كان في المنظومة وقت العد) على كميته الحالية
-- p_zero_missing: المنتجات اللي ما انعدتش وكميتها أكبر من صفر تولي صفر
create or replace function count_apply(p_token text, p_zero_missing boolean default false) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); c counts; r record; nq int; a int; n int := 0; vd numeric := 0; plus int := 0; minus int := 0;
begin
  select * into c from counts where status='open' for update;
  if not found then raise exception 'ما فيش جرد مفتوح'; end if;
  for r in select i.*, p.qty cur, p.cost, p.name from count_items i join products p on p.id=i.product_id where i.count_id=c.id order by i.product_id loop
    perform 1 from products where id=r.product_id for update;
    nq := greatest(r.cur + (r.counted - r.expected), 0);
    if nq <> r.cur then
      insert into adjustments(user_id,product_id,qty_before,qty_after,cost,reason,note) values (u.id,r.product_id,r.cur,nq,r.cost,'count','جرد #'||c.id) returning id into a;
      perform _move(r.product_id,'adjust',nq-r.cur,r.cost,a,u.id,'count');
      n := n + 1; vd := vd + (nq-r.cur)*r.cost;
      if nq > r.cur then plus := plus + 1; else minus := minus + 1; end if;
    end if;
  end loop;
  if p_zero_missing then
    for r in select p.* from products p where p.active and p.qty <> 0 and not exists (select 1 from count_items i where i.count_id=c.id and i.product_id=p.id) order by p.id for update loop
      insert into adjustments(user_id,product_id,qty_before,qty_after,cost,reason,note) values (u.id,r.id,r.qty,0,r.cost,'count','جرد #'||c.id||' (ما انعدش)') returning id into a;
      perform _move(r.id,'adjust',-r.qty,r.cost,a,u.id,'count');
      n := n + 1; vd := vd - r.qty*r.cost; minus := minus + 1;
    end loop;
  end if;
  update counts set status='done', closed_at=now(), closed_by=u.id,
    summary=jsonb_build_object('counted',(select count(*) from count_items where count_id=c.id),'changed',n,'plus',plus,'minus',minus,'value',vd,'zero_missing',p_zero_missing)
  where id=c.id;
  perform _audit(u.id,'count_apply',jsonb_build_object('count',c.id,'changed',n,'value',vd));
  return _count_json(c.id, true);
end $$;

create or replace function count_cancel(p_token text) returns void
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']); v int;
begin
  update counts set status='cancel', closed_at=now(), closed_by=u.id where status='open' returning id into v;
  if v is null then raise exception 'ما فيش جرد مفتوح'; end if;
  perform _audit(u.id,'count_cancel',jsonb_build_object('count',v));
end $$;

create or replace function count_list(p_token text) returns json
language plpgsql security definer set search_path=public as $$
declare u users := _auth(p_token, array['admin']);
begin
  return (select coalesce(json_agg(json_build_object('id',c.id,'at',c.at,'user',us.name,'status',c.status,'note',c.note,'closed_at',c.closed_at,'summary',c.summary) order by c.id desc),'[]')
          from counts c join users us on us.id=c.user_id);
end $$;

-- ----------------- من يقدر ينادي الدوال -----------------
-- الدوال الداخلية (اللي تبدا بـ _) مقفولة. الباقي مفتوح للموقع، وكل وحدة تتحقق من المستخدم بروحها
do $$
declare f record; has_anon boolean := exists (select 1 from pg_roles where rolname='anon');
begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' loop
    execute format('revoke all on function %s from public', f.sig);
    if has_anon then
      execute format('revoke all on function %s from anon, authenticated', f.sig);
      if left(f.proname,1) <> '_' then execute format('grant execute on function %s to anon, authenticated', f.sig); end if;
    end if;
  end loop;
end $$;
