/* ===== НАСТРОЙКИ БИЗНЕСА — меняйте только этот блок, чтобы переделать сайт под любой другой бизнес ===== */
const CONFIG = {
  name: 'Красный шест',
  tagline: 'Барбершоп в центре города. Стрижки, борода, бритьё опасной бритвой — всё по записи, без ожидания.',
  phone: '+7 (900) 123-45-67',
  address: 'ул. Центральная, 12',
  hours: { open: 10, close: 21, step: 30 },      // часы работы и шаг записи (мин)
  daysAhead: 14, currency: '₽', closedWeekday: 0, // 0 = воскресенье выходной (поставьте -1, если работаете без выходных)
  services: [
    { id: 's1', name: 'Мужская стрижка', desc: 'Машинка + ножницы, укладка', price: 1500, min: 60 },
    { id: 's2', name: 'Стрижка бороды', desc: 'Форма, контур, уход', price: 1000, min: 30 },
    { id: 's3', name: 'Стрижка + борода', desc: 'Полный образ', price: 2300, min: 90 },
    { id: 's4', name: 'Королевское бритьё', desc: 'Опасная бритва, горячее полотенце', price: 1400, min: 60 },
    { id: 's5', name: 'Детская стрижка', desc: 'До 12 лет', price: 1000, min: 30 }
  ],
  masters: [
    { id: 'm1', name: 'Артём', role: 'Старший барбер' },
    { id: 'm2', name: 'Дмитрий', role: 'Барбер' },
    { id: 'm3', name: 'Ильяс', role: 'Барбер-стилист' }
  ]
};
/* ======================================================================================================= */
const $ = s => document.querySelector(s);
const KEY = 'bron-bookings';
const state = { service: null, master: null, date: null, time: null };
const WD = ['вс','пн','вт','ср','чт','пт','сб'];
const MON = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const money = n => n.toLocaleString('ru-RU') + ' ' + CONFIG.currency;
const dur = m => m >= 60 ? (Math.floor(m/60) + ' ч' + (m%60 ? ' ' + m%60 + ' мин' : '')) : m + ' мин';
const iso = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const fromIso = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const fmtDate = s => { const d = fromIso(s); return d.getDate() + ' ' + MON[d.getMonth()] + ', ' + WD[d.getDay()]; };
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = a => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {} };
const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const svc = id => CONFIG.services.find(x => x.id === id);
const mst = id => CONFIG.masters.find(x => x.id === id);
const toMin = t => +t.slice(0,2) * 60 + +t.slice(3);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function allSlots() {
  const r = [], { open, close, step } = CONFIG.hours;
  for (let m = open*60; m < close*60; m += step) r.push(String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0'));
  return r;
}
// «Занято»: стабильная имитация чужих записей + реальные записи из этого браузера
function isBusy(date, master, time, minutes) {
  const need = Math.ceil(minutes / CONFIG.hours.step);
  const slots = allSlots(), i = slots.indexOf(time);
  if (i + need > slots.length) return true;
  const mine = load().filter(b => b.date === date && b.master === master);
  for (let k = 0; k < need; k++) {
    const t = slots[i + k];
    if (hash(date + master + t) % 100 < 28) return true;
    if (mine.some(b => toMin(t) >= toMin(b.time) && toMin(t) < toMin(b.time) + Math.ceil(svc(b.service).min / CONFIG.hours.step) * CONFIG.hours.step)) return true;
  }
  return false;
}

function opts(el, items, name, key, html) {
  el.innerHTML = items.map(x => `<label class="opt"><input type="radio" name="${name}" value="${x.id}"${state[key] === x.id ? ' checked' : ''}>${html(x)}</label>`).join('');
  el.onchange = e => { state[key] = e.target.value; state.time = null; render(); };
}
function renderDays() {
  const box = $('#days'); box.innerHTML = '';
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 0; i < CONFIG.daysAhead; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'day';
    b.innerHTML = `<small>${i === 0 ? 'сегодня' : WD[d.getDay()]}</small><b>${d.getDate()}</b><small>${MON[d.getMonth()].slice(0,3)}</small>`;
    b.disabled = d.getDay() === CONFIG.closedWeekday;
    b.setAttribute('aria-pressed', state.date === iso(d));
    b.onclick = () => { state.date = iso(d); state.time = null; render(); };
    box.appendChild(b);
  }
}
function renderSlots() {
  const box = $('#slots'), hint = $('#slotsHint'); box.innerHTML = '';
  if (!state.service || !state.master || !state.date) { hint.textContent = 'Сначала выберите услугу, мастера и дату.'; return; }
  hint.textContent = 'Зачёркнутое время занято. Длительность услуги: ' + dur(svc(state.service).min) + '.';
  const now = new Date(), isToday = state.date === iso(now);
  allSlots().forEach(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'slot'; b.textContent = t;
    const past = isToday && toMin(t) <= now.getHours()*60 + now.getMinutes();
    b.disabled = past || isBusy(state.date, state.master, t, svc(state.service).min);
    b.setAttribute('aria-pressed', state.time === t);
    b.onclick = () => { state.time = t; render(); };
    box.appendChild(b);
  });
}
function renderSummary() {
  const s = state.service && svc(state.service), m = state.master && mst(state.master);
  const rows = [['Услуга', s ? s.name : '—'], ['Мастер', m ? m.name : '—'], ['Дата', state.date ? fmtDate(state.date) : '—'], ['Время', state.time || '—'], ['Длительность', s ? dur(s.min) : '—']];
  $('#sum').innerHTML = rows.map(r => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join('');
  $('#total').textContent = s ? money(s.price) : '—';
  $('#submit').disabled = !(s && m && state.date && state.time);
}
function renderList() {
  const items = load().sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
  $('#list').innerHTML = items.length ? items.map(b => `<li><div><b>${esc(svc(b.service).name)}</b> · ${esc(mst(b.master).name)}<br><span class="hint">${fmtDate(b.date)}, ${b.time} · ${money(svc(b.service).price)} · код ${b.code}</span></div><button class="x" data-c="${b.code}">Отменить</button></li>`).join('') : '<li class="empty">Пока нет записей. Выберите услугу выше — это займёт минуту.</li>';
}
function render() {
  renderDays(); renderSlots(); renderSummary(); renderList();
}

function init() {
  document.title = CONFIG.name + ' — онлайн-запись';
  $('#brand').textContent = CONFIG.name;
  $('#tagline').textContent = CONFIG.tagline;
  $('#facts').innerHTML = `<li><b>${String(CONFIG.hours.open).padStart(2,'0')}:00–${String(CONFIG.hours.close).padStart(2,'0')}:00</b>часы работы</li><li><b>${CONFIG.masters.length} мастера</b>на выбор</li><li><b>от ${money(Math.min(...CONFIG.services.map(s => s.price)))}</b>цены без наценок</li>`;
  $('#contactInfo').innerHTML = `<div><b>${esc(CONFIG.name)}</b></div><div>${esc(CONFIG.address)}</div><div><a href="tel:${CONFIG.phone.replace(/[^+\d]/g,'')}">${CONFIG.phone}</a></div>`;
  $('#copy').textContent = '© ' + new Date().getFullYear() + ' ' + CONFIG.name;
  opts($('#services'), CONFIG.services, 'service', 'service', s => `<em>${money(s.price)}</em><b>${esc(s.name)}</b><span>${esc(s.desc)} · ${dur(s.min)}</span>`);
  opts($('#masters'), CONFIG.masters, 'master', 'master', m => `<b>${esc(m.name)}</b><span>${esc(m.role)}</span>`);
  $('#services').onchange = e => { state.service = e.target.value; state.time = null; render(); };
  $('#masters').onchange = e => { state.master = e.target.value; state.time = null; render(); };
  $('#phone').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^\d+\-\s()]/g, ''); });
  $('#form').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#name').value.trim(), phone = $('#phone').value.trim(), err = $('#error');
    if (!(state.service && state.master && state.date && state.time)) { err.textContent = 'Выберите услугу, мастера, дату и время.'; return; }
    if (name.length < 2) { err.textContent = 'Введите имя — минимум 2 буквы.'; $('#name').focus(); return; }
    if (phone.replace(/\D/g,'').length < 10) { err.textContent = 'Введите телефон полностью, например +7 900 000-00-00.'; $('#phone').focus(); return; }
    err.textContent = '';
    const code = (hash(Date.now() + name) % 90000 + 10000).toString();
    const all = load(); all.push({ code, name, phone, note: $('#note').value.trim(), ...state }); save(all);
    $('#doneText').textContent = `${name}, ждём вас ${fmtDate(state.date)} в ${state.time}: ${svc(state.service).name}, мастер ${mst(state.master).name}.`;
    $('#doneCode').textContent = code;
    $('#done').showModal();
    state.time = null; render();
  });
  $('#doneClose').onclick = () => { $('#done').close(); location.hash = '#my'; };
  $('#list').onclick = e => {
    const c = e.target.dataset.c;
    if (c && confirm('Отменить эту запись?')) { save(load().filter(b => b.code !== c)); render(); }
  };
  render();
}
init();
