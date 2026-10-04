
/* ---------- Farm shop ---------- */
const CATS = ['Vegetables','Fruit','Eggs & dairy','Pantry','Drinks','Bakery','Body & home','Other'];
const lowState = p => Number(p.stock || 0) <= 0 ? 'out' : Number(p.stock || 0) <= Number(p.lowAt || 0) ? 'low' : '';
function pageShop(){
  return `<div class="page"><div class="page-head"><div><h1>Farm shop</h1><p class="lede">What’s on the shelf, what it costs, and what’s running low.</p></div>
    <div class="head-actions"><button class="btn primary" type="button" id="addP">Add product</button></div></div>
    <div class="stats" id="r-sstats" style="margin-bottom:18px"></div>
    <div id="r-alerts"></div>
    <div class="toolbar"><input class="field-in search" id="sq" type="search" placeholder="Search products" value="${esc(state.shop.q)}" aria-label="Search products">
      <select class="field-in" id="scat" aria-label="Category"><option value="">All categories</option>${CATS.map(c => `<option ${state.shop.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <label style="display:flex;align-items:center;gap:6px;font-size:14px"><input type="checkbox" id="slow" ${state.shop.low ? 'checked' : ''}>Low stock only</label></div>
    <div id="r-products"></div></div>`;
}
function bindShop(){
  $('#addP').addEventListener('click', () => openProduct());
  $('#sq').addEventListener('input', e => { state.shop.q = e.target.value; fillShop(); });
  $('#scat').addEventListener('change', e => { state.shop.cat = e.target.value; fillShop(); });
  $('#slow').addEventListener('change', e => { state.shop.low = e.target.checked; fillShop(); });
}
function fillShop(){
  const box = $('#r-products'); if (!box) return;
  const all = state.products.filter(p => p.active !== false), low = all.filter(p => lowState(p));
  const value = all.reduce((n, p) => n + Number(p.stock || 0) * Number(p.price || 0), 0);
  $('#r-sstats').innerHTML = [[all.length, 'Products'], [low.length, 'Low or out of stock'], [fmtMoney(value), 'Stock at retail value']].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#r-alerts').innerHTML = low.length ? `<div class="alert"><b>${low.length === 1 ? '1 product needs' : low.length + ' products need'} restocking</b><ul>${low.slice(0, 6).map(p => `<li>${esc(p.name)}: ${Number(p.stock || 0) <= 0 ? 'out of stock' : `${esc(p.stock)} ${esc(p.unit || '')} left, alert at ${esc(p.lowAt)}`}</li>`).join('')}${low.length > 6 ? `<li>and ${low.length - 6} more</li>` : ''}</ul></div>` : '';
  if (state.mode === 'loading'){ box.innerHTML = '<div class="empty"><p>Loading…</p></div>'; return; }
  if (!state.products.length){ box.innerHTML = `<div class="empty"><h2>No products yet</h2><p>Add what the farm shop sells: produce, eggs, pantry goods, drinks. Set a low-stock alert on each so nothing runs out quietly.</p><button class="btn primary" type="button" id="emptyP">Add the first product</button></div>`; $('#emptyP').addEventListener('click', () => openProduct()); return; }
  const q = state.shop.q.trim().toLowerCase();
  const list = sortByName(all.filter(p => (!q || p.name.toLowerCase().includes(q)) && (!state.shop.cat || p.category === state.shop.cat) && (!state.shop.low || lowState(p))));
  if (!list.length){ box.innerHTML = '<div class="empty"><p>No products match.</p></div>'; return; }
  box.innerHTML = `<div class="list"><div class="row head srow"><span>Product</span><span class="c-cat">Category</span><span class="c-price">Price</span><span>In stock</span><span></span></div>
    ${list.map(p => { const ls = lowState(p); return `<button type="button" class="row srow" data-id="${esc(p.id)}">
      <span class="who" style="display:block"><b>${esc(p.name)}</b><span class="muted" style="font-size:13px">${esc(p.unit ? 'per ' + p.unit : '')}</span></span>
      <span class="c-cat muted">${esc(p.category || '—')}</span>
      <span class="c-price">${fmtMoney(p.price)}${p.memberPrice ? `<br><span class="muted" style="font-size:12.5px">members ${fmtMoney(p.memberPrice)}</span>` : ''}</span>
      <span class="stock ${ls}">${esc(p.stock ?? 0)} ${esc(p.unit || '')}${ls === 'out' ? ' · out' : ls === 'low' ? ' · low' : ''}</span>
      <span class="muted" style="font-size:13px">Edit</span></button>`; }).join('')}</div>`;
  box.querySelectorAll('.row[data-id]').forEach(r => r.addEventListener('click', () => openProduct(state.products.find(p => p.id === r.dataset.id))));
}
function openProduct(p){
  const edit = !!p; p = p || {category:'Vegetables', unit:'kg', stock:0, lowAt:5, ledger:[]};
  const body = `
    <div class="fld"><label for="p-name">Product</label><input id="p-name" name="name" value="${esc(p.name)}" placeholder="e.g. Cherry tomatoes"><span class="err">Enter a name.</span></div>
    <div class="grid2">
      <div class="fld"><label for="p-cat">Category</label><select id="p-cat" name="category">${CATS.map(c => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="fld"><label for="p-unit">Sold per</label><input id="p-unit" name="unit" value="${esc(p.unit)}" placeholder="kg, bunch, dozen, jar"></div>
    </div>
    <div class="grid2">
      <div class="fld"><label for="p-price">Price</label><input id="p-price" name="price" type="number" min="0" step="any" value="${esc(p.price ?? '')}"><span class="err">Enter a price.</span></div>
      <div class="fld"><label for="p-mprice">Member price</label><input id="p-mprice" name="memberPrice" type="number" min="0" step="any" value="${esc(p.memberPrice ?? '')}" placeholder="Same as price"></div>
    </div>
    <div class="grid2">
      <div class="fld"><label for="p-stock">In stock now</label><input id="p-stock" name="stock" type="number" min="0" step="any" value="${esc(p.stock ?? 0)}"></div>
      <div class="fld"><label for="p-low">Alert when at or below</label><input id="p-low" name="lowAt" type="number" min="0" step="any" value="${esc(p.lowAt ?? 5)}"></div>
    </div>
    <div class="fld"><label for="p-desc">Notes</label><textarea id="p-desc" name="description" placeholder="Supplier, harvest rhythm, anything the shop team should know">${esc(p.description)}</textarea></div>
    ${edit ? `<div class="subhead">Quick stock change</div><div class="adj"><button type="button" class="btn" id="qSale">Record a sale</button><button type="button" class="btn" id="qRestock">Restock</button></div><div class="grid2" style="margin-top:10px"><div class="fld"><label for="q-amt">Quantity</label><input id="q-amt" type="number" min="0" step="any" value="1"></div></div>
      <div class="subhead">Recent changes</div><div class="ledger">${(p.ledger || []).slice(-8).reverse().map(l => `<div class="n"><span>${new Date(l.at).toLocaleDateString('en-US', {month:'short', day:'numeric'})} ${l.type}</span><b>${l.delta > 0 ? '+' : ''}${l.delta}</b></div>`).join('') || '<p class="muted" style="margin:0">No changes recorded.</p>'}</div>` : ''}`;
  const foot = `${edit ? '<button type="button" class="btn danger" id="delBtn">Delete</button>' : ''}<span class="spacer"></span><button type="button" class="btn ghost" onclick="closeDrawer()">Cancel</button><button type="submit" class="btn primary">${edit ? 'Save product' : 'Add product'}</button>`;
  openDrawer(edit ? 'Edit product' : 'Add product', body, foot, async fd => {
    const v = Object.fromEntries(fd.entries()); v.name = v.name.trim();
    $('#p-name').closest('.fld').classList.toggle('invalid', !v.name); $('#p-price').closest('.fld').classList.toggle('invalid', v.price === '');
    if (!v.name || v.price === '') return;
    const rec = {...stripId(p), ...v, price:Number(v.price), memberPrice:v.memberPrice === '' ? null : Number(v.memberPrice), stock:Number(v.stock || 0), lowAt:Number(v.lowAt || 0), active:true, ledger:p.ledger || []};
    if (edit && Number(v.stock) !== Number(p.stock)) rec.ledger = [...rec.ledger, {at:new Date().toISOString(), type:'adjusted', delta:Number(v.stock) - Number(p.stock || 0)}].slice(-40);
    try { await upsert('products', edit ? p.id : null, rec); closeDrawer(); toast(edit ? 'Product saved' : `${rec.name} added`); } catch(err){ toast(writeError(err)); }
  });
  if (edit){
    const quick = async (type) => { const n = Number($('#q-amt').value || 0); if (!n) return; const delta = type === 'sale' ? -n : n; const cur = state.products.find(x => x.id === p.id);
      try { await upsert('products', p.id, {...stripId(cur), stock:Math.max(0, Number(cur.stock || 0) + delta), ledger:[...(cur.ledger || []), {at:new Date().toISOString(), type, delta}].slice(-40)}); closeDrawer(); toast(type === 'sale' ? 'Sale recorded' : 'Restocked'); } catch(err){ toast(writeError(err)); } };
    $('#qSale').addEventListener('click', () => quick('sale')); $('#qRestock').addEventListener('click', () => quick('restock'));
    deleteButton('Product deleted', () => removeDoc('products', p.id));
  }
}

/* ---------- Tickets & gate check-in ---------- */
const ticketUrl = id => `${ARTIFACT_URL}#ticket/${id}`;
const ticketCode = id => 'ARK-' + String(id).replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
function drawQR(el, text){
  el.innerHTML = '';
  if (typeof QRCode === 'undefined'){ el.innerHTML = `<div style="width:184px;height:184px;display:grid;place-items:center;color:#777;font-size:12px;text-align:center;padding:12px">QR code loads on the published page</div>`; return; }
  new QRCode(el, {text, width:184, height:184, correctLevel:QRCode.CorrectLevel.M});
}
function pageTicket(){ return `${portalHead('Your ticket')}<div class="p-body" id="r-ticket"></div>`; }
function fillTicket(){
  const box = $('#r-ticket'); if (!box) return;
  $('#pName').textContent = state.org.name || 'The ARK';
  if (state.mode === 'loading'){ box.innerHTML = '<div class="empty"><p>Loading…</p></div>'; return; }
  const r = state.registrations.find(x => x.id === state.route.id);
  const o = r && state.offerings.find(x => x.id === r.offeringId);
  if (!r || !o){ box.innerHTML = `<div class="ticket"><span class="state bad">Not valid</span><h1>Ticket not found</h1><p class="muted">This ticket may have been cancelled or the link is incomplete.</p></div>`; return; }
  const t = (o.tickets || []).find(x => x.id === r.ticketId), f = person(o.facilitatorId);
  const used = !!r.checkedInAt, past = r.sessionDate < today(), cancelled = (o.skipDates || []).includes(r.sessionDate);
  const stateHtml = cancelled ? '<span class="state bad">Session cancelled</span>' : used ? `<span class="state used">Checked in ${new Date(r.checkedInAt).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})}</span>` : past ? '<span class="state used">Expired</span>' : '<span class="state ok">Valid</span>';
  const mail = r.email ? `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent('Your ticket: ' + o.title)}&body=${encodeURIComponent(`Hi ${firstName(r.name)},\n\nHere is your ticket for ${o.title} on ${fmtDate(r.sessionDate, {weekday:'long', month:'long', day:'numeric'})}, ${timeRange(o)}${o.location ? ' at ' + o.location : ''}.\n\nShow this at the gate:\n${ticketUrl(r.id)}\n\nSee you there,\n${state.org.name || 'The ARK'}`)}` : '';
  box.innerHTML = `<div class="ticket">
      <span class="ptype">${esc(state.org.name || 'The ARK')} · ${kindName(o.kind)}</span>
      <h1>${esc(o.title)}</h1>
      <p style="margin:4px 0 0">${esc(fmtDate(r.sessionDate, {weekday:'long', month:'long', day:'numeric'}))}, ${esc(timeRange(o))}${o.location ? ' at ' + esc(o.location) : ''}${f ? ', with ' + esc(f.name) : ''}</p>
      <div class="qr" id="qr"></div>
      <div class="code">${ticketCode(r.id)}</div>
      <p style="margin:10px 0 0"><b>${esc(r.name)}</b>${t ? `<br><span class="muted">${esc(t.name)}, ${money(t.price, t.currency)}${t.price && !r.paid ? ', unpaid' : t.price ? ', paid' : ''}</span>` : '<br><span class="muted">Member, included</span>'}</p>
      ${stateHtml}
      <div class="acts">
        ${state.canWrite !== false && !used && !cancelled ? `<button type="button" class="btn primary" id="checkIn">Check in at gate</button>` : ''}
        ${state.canWrite !== false && mail ? `<a class="btn" href="${esc(mail)}">Email ticket</a>` : ''}
        <button type="button" class="btn" id="copyT">Copy link</button>
      </div>
      <p class="gate-note" style="margin-top:16px">Security scans the code with any phone camera. It opens this page and shows whether the ticket is valid.</p>
    </div>
    <p style="text-align:center;margin-top:18px"><a class="ev-back" href="#event/${esc(o.id)}">← Back to ${esc(o.title)}</a></p>`;
  drawQR($('#qr'), ticketUrl(r.id));
  $('#copyT').addEventListener('click', e => { const i = document.createElement('input'); i.value = ticketUrl(r.id); document.body.appendChild(i); copyLink(i, e.target); setTimeout(() => i.remove(), 2000); });
  const ci = $('#checkIn'); if (ci) ci.addEventListener('click', async () => { try { await upsert('registrations', r.id, {...stripId(r), checkedInAt:new Date().toISOString()}); toast(`${r.name} checked in`); } catch(err){ toast(writeError(err)); } });
}
function fillCheckins(){
  const box = $('#r-checkins'); if (!box) return;
  const td = today(), regs = state.registrations.filter(r => r.sessionDate === td);
  const list = regs.map(r => ({r, o:state.offerings.find(x => x.id === r.offeringId)})).filter(x => x.o).sort((a, b) => (a.o.startTime || '').localeCompare(b.o.startTime || '') || a.r.name.localeCompare(b.r.name));
  if (!list.length){ box.innerHTML = '<div class="empty"><h2>No bookings today</h2><p>Bookings for today’s sessions show here with a check-in button. Security can also scan a ticket’s QR code.</p></div>'; return; }
  box.innerHTML = `<p class="gate-note">${list.filter(x => x.r.checkedInAt).length} of ${list.length} checked in today. Tap a name to check them in, or scan their ticket.</p>
    <div class="list"><div class="row head chk"><span>Person</span><span class="c-c2">Session</span><span>Ticket</span><span></span></div>
    ${list.map(({r, o}) => `<div class="row chk" style="cursor:default"><span class="who"><span class="av" style="background:${r.checkedInAt ? 'var(--leaf)' : 'var(--slate)'}">${r.checkedInAt ? '✓' : esc(initials(r.name))}</span><span><b>${esc(r.name)}</b><span>${esc(r.email || '')}</span></span></span>
      <span class="c-c2">${esc(fmtTime(o.startTime))} ${esc(o.title)}</span>
      <span class="muted" style="font-size:13px">${(() => { const t = (o.tickets || []).find(x => x.id === r.ticketId); return t ? esc(t.name) + (t.price && !r.paid ? ', unpaid' : '') : 'Member'; })()}</span>
      <span class="acts" style="display:flex;gap:6px;justify-content:flex-end">${r.checkedInAt ? `<span class="status on">In</span>` : `<button type="button" class="btn primary" data-ci="${esc(r.id)}" style="padding:6px 10px">Check in</button>`}<a class="btn" href="#ticket/${esc(r.id)}" style="padding:6px 10px">Ticket</a></span></div>`).join('')}</div>`;
  box.querySelectorAll('[data-ci]').forEach(b => b.addEventListener('click', async () => { const r = state.registrations.find(x => x.id === b.dataset.ci); try { await upsert('registrations', r.id, {...stripId(r), checkedInAt:new Date().toISOString()}); } catch(err){ toast(writeError(err)); } }));
}

/* ---------- Portal members tab ---------- */
function fillPortalMembers(){
  const box = $('#r-pmembers'); if (!box) return;
  const list = sortByName(state.contacts.filter(isActiveMember));
  if (state.mode === 'loading'){ box.innerHTML = '<div class="empty"><p>Loading…</p></div>'; return; }
  if (!list.length){ box.innerHTML = '<div class="empty"><p>The directory fills in as members join.</p></div>'; return; }
  box.innerHTML = `<p class="gate-note">${list.length} members. Say hi at the next farm dinner.</p><div class="dir">${list.map(c => `<div class="mcard"><span class="av" style="background:${tierColor(c.tier)}">${esc(initials(c.name))}</span><h3>${esc(c.name)}</h3><span class="tier ${tierClass(c.tier)}">${tierName(c.tier)}</span><div class="sub">${esc((c.interests || []).slice(0, 3).join(', ') || c.location || '')}</div></div>`).join('')}</div>`;
}

/* ---------- Ask AI ---------- */
function aiContext(){
  const td = today(), ws = weekStart(td);
  const upcoming = sessions(td, addDays(td, 7), {published:true}).slice(0, 25).map(s => `${s.date} ${s.o.startTime || ''} ${s.o.title}${s.cancelled ? ' (cancelled)' : ''} booked ${regsFor(s.o.id, s.date).length}${s.o.capacity ? '/' + s.o.capacity : ''}`);
  const open = state.tasks.filter(t => (t.status || 'backlog') !== 'done').map(t => `${t.title} [${statusName(t.status)}, ${priName(t.priority)}${t.dueDate ? ', due ' + t.dueDate : ''}${person(t.assigneeId) ? ', ' + person(t.assigneeId).name : ''}]`);
  const members = state.contacts.filter(isActiveMember);
  const ctx = {
    today:td, organization:state.org.name || 'The ARK', location:state.org.location || 'Santa Teresa, Costa Rica', currency:state.org.currency || 'CRC',
    team:state.team.filter(m => m.status !== 'inactive').map(m => `${m.name} (${m.title || typeName(m.type)}${divById(m.divisionId) ? ', ' + divById(m.divisionId).name : ''})`),
    divisions:state.divisions.map(d => d.name),
    members:{active:members.length, founding:members.filter(c => c.tier === 'founding').length, byTier:TIERS.slice(1).map(([k, l]) => `${l}: ${members.filter(c => c.tier === k).length}`)},
    contacts:{total:state.contacts.length, stewards:state.contacts.filter(c => c.type === 'steward').length, membershipPipeline:PIPELINES.memberships.stages.map(([k, l]) => `${l}: ${state.contacts.filter(c => (c.stages || {}).memberships === k).length}`), realEstatePipeline:PIPELINES.estate.stages.map(([k, l]) => `${l}: ${state.contacts.filter(c => (c.stages || {}).estate === k).length}`)},
    people:state.contacts.slice(0, 80).map(c => `${c.name}: ${ptypeName(c.type)}${c.tier ? ', ' + tierName(c.tier) : ''}${c.lot ? ', lot ' + c.lot : ''}${(c.interests || []).length ? ', interests ' + c.interests.join('/') : ''}${(c.notes || []).length ? ', last note: ' + c.notes[c.notes.length - 1].text.slice(0, 120) : ''}`),
    scheduleNext7Days:upcoming, classesAndEvents:state.offerings.map(o => `${o.title} (${o.kind}, ${whenLabel(o)}, ${o.status})`),
    openTasks:open.slice(0, 60), sendQueueDue:queueItems().length,
    farmShop:state.products.filter(p => p.active !== false).map(p => `${p.name} ${p.stock}${p.unit ? ' ' + p.unit : ''} @ ${fmtMoney(p.price)}${lowState(p) ? ' LOW' : ''}`)
  };
  if (state.canEdit) ctx.finance = state.finance.filter(f => f.updatedAt).map(f => `${f.id}: revenue ${fmtMoney(revTotal(f))}, expenses ${fmtMoney(f.expenses)}, cash ${fmtMoney(f.cash)}, AR ${fmtMoney(f.ar)}, AP ${fmtMoney(f.ap)}`);
  return ctx;
}
function openAsk(){
  const examples = ['What’s happening this week?', 'Who’s overdue on tasks?', 'Which members are into surfing?', 'What’s low in the farm shop?', 'Draft a WhatsApp inviting members to Saturday’s dinner'];
  openDrawer('Ask AI', `
    <div class="fld"><label for="askIn">Ask anything about The ARK’s data on this page</label><textarea id="askIn" placeholder="e.g. Who hasn’t paid for the farm dinner yet?" style="min-height:70px"></textarea></div>
    <div class="ask-ex">${examples.map(e => `<button type="button" data-ex="${esc(e)}">${esc(e)}</button>`).join('')}</div>
    <div class="ans wait" id="askOut" hidden></div>
    ${state.ai === null ? '<p class="note">AI answers work on the published page when you’re signed in to Claude.</p>' : ''}`,
    `<span class="spacer"></span><button type="button" class="btn ghost" onclick="closeDrawer()">Close</button><button type="submit" class="btn primary" ${state.ai === null ? 'disabled' : ''}>Ask</button>`,
    async () => {
      const q = $('#askIn').value.trim(); if (!q) return;
      const out = $('#askOut'); out.hidden = false; out.classList.add('wait'); out.textContent = 'Thinking…';
      const sys = `You are the assistant inside ARK OS, the operating system for ${state.org.name || 'The ARK'}, a members club and regenerative community. Answer from the data below only; if it isn’t there, say so plainly. Be concise, plain, and specific: names, numbers, dates. No markdown headings, no bullet symbols other than a simple dash, no hype. If asked to draft a message, write it ready to send in the club’s voice: warm, short, never salesy.\n\nDATA:\n${JSON.stringify(aiContext())}\n\nQUESTION: ${q}`;
      try { const r = await state.ai(sys, {modelTier:'default', cache:false, onText:({text}) => { out.textContent = text; out.classList.remove('wait'); }}); out.textContent = r.text; out.classList.remove('wait'); }
      catch(err){ out.textContent = err && err.code === 'not_granted' ? 'AI wasn’t allowed for this page.' : err && err.code === 'rate_limited' ? 'Too many requests. Try again in a minute.' : 'Couldn’t get an answer. Try again.'; }
    });
  document.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => { $('#askIn').value = b.dataset.ex; $('#askIn').focus(); }));
}
$('#askBtn').addEventListener('click', openAsk);

/* ---------- Sample data ---------- */
async function loadSampleData(btn){
  if (btn) btn.disabled = true;
  const S = {sample:true}, td = today();
  try {
    const divIds = {};
    for (const d of SUGGESTED.slice(0, 5)) divIds[d.name] = await upsert('divisions', null, {...d, leadId:'', ...S});
    const team = [
      ['Polina Marchenko','Programming lead','facilitator','Programming','lead'], ['Sach Patel','CRM & technical build','team','Tech & CRM','admin'],
      ['Luis Mora','Head of security','team','Operations & maintenance','security'], ['Camila Rojas','Farm & shop manager','team','Farm & shop','shop'],
      ['Tomás Vega','Maintenance crew lead','crew','Operations & maintenance','crew'], ['Maya Chen','Yoga & breathwork facilitator','facilitator','Programming','facilitator'],
      ['Diego Fallas','Muay Thai coach','facilitator','Programming','facilitator']];
    const tIds = {};
    for (const [name, title, type, div, role] of team) tIds[name] = await upsert('team', null, {name, title, type, divisionId:divIds[div] || divIds['Operations & maintenance'] || '', role, status:'active', email:name.split(' ')[0].toLowerCase() + '@theark.world', ...S});
    const offs = [
      {kind:'class', title:'Sunrise vinyasa', facilitator:'Maya Chen', location:'The Shala', days:[1,3,5], startTime:'07:00', endTime:'08:00', capacity:16, access:'members', tickets:[{id:uid(), name:'Guest drop-in', price:8000, currency:'CRC', qty:4, link:''}]},
      {kind:'class', title:'Muay Thai fundamentals', facilitator:'Diego Fallas', location:'Gym', days:[2,4], startTime:'17:30', endTime:'18:45', capacity:12, access:'members', tickets:[]},
      {kind:'class', title:'Breathwork & cold plunge', facilitator:'Maya Chen', location:'Spa deck', days:[6], startTime:'08:00', endTime:'09:15', capacity:10, access:'members', tickets:[]},
      {kind:'class', title:'Padel open play', facilitator:'Polina Marchenko', location:'Courts', days:[0,3], startTime:'16:00', endTime:'18:00', capacity:8, access:'everyone', tickets:[{id:uid(), name:'Guest', price:5000, currency:'CRC', qty:null, link:''}]},
      {kind:'event', title:'Farm-to-table dinner', facilitator:'Camila Rojas', location:'Farm', repeat:'none', startDate:addDays(weekStart(td), 5), startTime:'18:30', endTime:'21:30', capacity:24, access:'everyone', tickets:[{id:uid(), name:'Member seat', price:18000, currency:'CRC', qty:12, link:''}, {id:uid(), name:'Guest seat', price:25000, currency:'CRC', qty:12, link:''}], description:'Twelve seats at one long table. Everything on the plate grew within sight of where you’re sitting.'},
      {kind:'event', title:'Founding members evening', facilitator:'Polina Marchenko', location:'The House', repeat:'none', startDate:addDays(td, 10), startTime:'17:00', endTime:'19:00', capacity:40, access:'everyone', tickets:[], description:'Drinks on the deck, a walk through the land, and the founding offer explained in person.'}];
    const oIds = [];
    for (const o of offs) oIds.push(await upsert('offerings', null, {kind:o.kind, title:o.title, description:o.description || '', facilitatorId:tIds[o.facilitator] || '', location:o.location, repeat:o.repeat || 'weekly', startDate:o.startDate || addDays(td, -21), endDate:'', days:o.days || [dow(o.startDate)], startTime:o.startTime, endTime:o.endTime, capacity:o.capacity, access:o.access, status:'published', skipDates:[], tickets:o.tickets, cover:null, ...S}));
    const people = [
      ['Ana Lopez','member','founding','ana@example.com','+506 8888 1101','Santa Teresa',['yoga','surfing','sauna mornings'],'active','Farm dinner in August'],
      ['Ben Ortiz','member','standard','ben@example.com','+506 8888 1102','Nomad, here until March',['padel','cowork','music'],'active','Referred by Ana'],
      ['Clara Núñez','member','founding','clara@example.com','+506 8888 1103','Mal País',['breathwork','regenerative farming'],'active','ARK Day'],
      ['Jonas Weber','steward','founding','jonas@example.com','+49 170 000 0004','Lot 12, on-site',['architecture','permaculture'],'active','Lot owner since 2025'],
      ['Sofía Herrera','steward','','sofia@example.com','+506 8888 1105','Lot 7',['horses','ceramics'],'active','Lot owner'],
      ['Marcus Hill','contact','','marcus@example.com','+1 415 000 0006','San Francisco, visiting Nov',['investing','trail running'],'active','Instagram'],
      ['Lena Fischer','contact','','lena@example.com','+41 79 000 0007','Zürich',['yoga','founder'],'active','Waitlist form'],
      ['Rafa Castillo','contact','','rafa@example.com','+506 8888 1108','Cóbano',['land','cattle to agroforestry'],'active','Introduced by Marco'],
      ['Emily Park','member','annual','emily@example.com','+1 647 000 0009','Toronto, winters here',['cowork','pickleball'],'paused','Catamaran trip']];
    const stages = {Marcus:{memberships:'invited'}, Lena:{memberships:'applied'}, Rafa:{estate:'visit'}, Jonas:{estate:'closed'}, Sofía:{estate:'contract'}, Ben:{memberships:'active'}, Ana:{memberships:'active'}, Clara:{memberships:'active'}, Emily:{memberships:'active'}};
    const cIds = {};
    for (const [name, type, tier, email, phone, location, interests, mstatus, source] of people){
      const first = name.split(' ')[0];
      cIds[name] = await upsert('contacts', null, {name, type, tier, email, phone, location, interests, mstatus, source, instagram:'@' + first.toLowerCase(), lot:type === 'steward' ? (first === 'Jonas' ? '12' : '7') : '', resident:first === 'Jonas', memberSince:tier ? addDays(td, -40) : '', renewsOn:tier ? addDays(td, -40 + 365) : '', stages:stages[first] || {}, notes:[{id:uid(), text:`Met via ${source.toLowerCase()}. ${interests[0]} is the way in.`, at:new Date(Date.now() - 86400000 * 9).toISOString()}], enrollments:[], ...S});
    }
    await upsert('sequences', null, {name:'Waitlist welcome', description:'New waitlist signups who haven’t applied yet', steps:[
      {channel:'email', delayDays:0, subject:'You’re on the list', body:'Hi {{first_name}},\n\nThanks for joining the {{org}} waitlist. We bring in a small group at a time and read every application ourselves.\n\nWhen you have a few minutes, tell us a bit about you through the application link. We’ll be in touch soon after.\n\nSee you in Santa Teresa'},
      {channel:'whatsapp', delayDays:3, subject:'', body:'Hey {{first_name}}, it’s {{org}}. Did you get a chance to look at the application? Happy to answer anything first.'},
      {channel:'email', delayDays:5, subject:'Founding spots', body:'Hi {{first_name}},\n\nA quick note: founding memberships lock in the lowest rate for life, and there are 50 of them. If {{org}} feels right, this is the moment.\n\nThe door’s open.'}], ...S});
    await upsert('sequences', null, {name:'Land inquiry follow-up', description:'People who asked about lots', steps:[
      {channel:'whatsapp', delayDays:0, subject:'', body:'Hi {{first_name}}, great talking about the land. Want to walk it together this week? Mornings are best.'},
      {channel:'email', delayDays:4, subject:'Lots, structure, and what’s next', body:'Hi {{first_name}},\n\nAs promised, here’s how ownership works at {{org}}, what’s still available, and how a reservation moves to contract. Reply with any questions, or pick a time to walk the land.'}], ...S});
    // bookings
    const mk = (oi, date, name, email, ticketIdx, paid) => { const o = offs[oi]; return upsert('registrations', null, {offeringId:oIds[oi], sessionDate:date, name, email, ticketId:ticketIdx === null ? '' : (o.tickets[ticketIdx] || {}).id || '', paid, source:'staff', ...S}); };
    const dinner = offs[4].startDate;
    await mk(4, dinner, 'Ana Lopez', 'ana@example.com', 0, true); await mk(4, dinner, 'Ben Ortiz', 'ben@example.com', 0, true); await mk(4, dinner, 'Marcus Hill', 'marcus@example.com', 1, false); await mk(4, dinner, 'Lena Fischer', 'lena@example.com', 1, true);
    const nextMon = addDays(weekStart(td), td > weekStart(td) ? 7 : 0);
    await mk(0, nextMon, 'Clara Núñez', 'clara@example.com', null, false); await mk(0, nextMon, 'Ana Lopez', 'ana@example.com', null, false);
    const tasks = [
      ['Fix sauna door hinge','maintenance','urgent',addDays(td, -1),'Tomás Vega','Operations & maintenance','doing','Spa deck'],
      ['Order padel balls and nets','purchase','medium',addDays(td, 6),'Polina Marchenko','Programming','next','Courts'],
      ['Set up gate check-in device','task','high',addDays(td, 3),'Luis Mora','Operations & maintenance','next','Gate'],
      ['Prep dinner table and lights','event','high',addDays(weekStart(td), 5),'Camila Rojas','Farm & shop','backlog','Farm'],
      ['Clear drainage before rains','maintenance','high',addDays(td, 2),'Tomás Vega','Operations & maintenance','backlog','Farm'],
      ['Review 3 pending applications','task','medium',addDays(td, 1),'Polina Marchenko','Memberships','doing',''],
      ['Replace cold plunge filter','maintenance','low',addDays(td, 12),'Tomás Vega','Operations & maintenance','backlog','Spa deck'],
      ['Print QR signs for classes','task','low',addDays(td, -3),'Sach Patel','Tech & CRM','done','']];
    for (const [title, kind, priority, dueDate, who, div, status, location] of tasks) await upsert('tasks', null, {title, description:'', kind, priority, dueDate, assigneeId:tIds[who] || '', divisionId:divIds[div] || '', status, location, ...S, ...(status === 'done' ? {completedAt:new Date().toISOString()} : {})});
    const prods = [['Cherry tomatoes','Vegetables','kg',3500,3000,4,5],['Lettuce mix','Vegetables','bag',2200,1800,14,6],['Farm eggs','Eggs & dairy','dozen',4500,4000,9,8],['Kombucha, ginger','Drinks','bottle',3000,2500,22,10],['Sourdough loaf','Bakery','loaf',4000,3500,0,4],['Raw honey','Pantry','jar',7500,6500,11,3],['Bananas','Fruit','bunch',1500,1200,18,5],['Coconut oil','Body & home','jar',6000,5000,2,3]];
    for (const [name, category, unit, price, memberPrice, stock, lowAt] of prods) await upsert('products', null, {name, category, unit, price, memberPrice, stock, lowAt, active:true, description:'', ledger:[], ...S});
    if (state.canEdit){
      const m0 = monthKey(td), m1 = addMonths(m0, -1), m2 = addMonths(m0, -2);
      await upsert('finance', m2, {membership:2600000, events:310000, shop:420000, fnb:880000, land:0, other:0, expenses:3900000, cash:7200000, ar:600000, ap:950000, cashDate:'', notes:'Seeding month, soft launch.', ...S});
      await upsert('finance', m1, {membership:4100000, events:650000, shop:610000, fnb:1240000, land:0, other:150000, expenses:4300000, cash:9100000, ar:1200000, ap:700000, cashDate:'', notes:'Founding members evening drove 11 sign-ups.', ...S});
      await upsert('finance', m0, {membership:5200000, events:420000, shop:380000, fnb:900000, land:0, other:0, expenses:2100000, cash:9800000, ar:1450000, ap:420000, cashDate:td, notes:'Month in progress.', ...S});
    }
    toast('Sample data loaded');
  } catch(err){ toast(writeError(err)); if (btn) btn.disabled = false; }
}
async function removeSampleData(btn){
  if (btn) btn.disabled = true;
  try {
    for (const coll of ['registrations','offerings','tasks','products','sequences','contacts','team','divisions','finance'])
      for (const d of state[coll].filter(x => x.sample)) await removeDoc(coll, d.id);
    toast('Sample data removed');
  } catch(err){ toast(writeError(err)); if (btn) btn.disabled = false; }
}
const hasSample = () => ['team','contacts','offerings','tasks','products'].some(c => state[c].some(x => x.sample));
