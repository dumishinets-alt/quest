/* Відкриті дані проти корупції — логіка уроку */
(function(){
  const D = window.ODQ_DATA;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const fmt = n => Math.round(n).toLocaleString('uk-UA');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // ====== Прогрес (localStorage, з обробкою помилок) ======
  const STORAGE_KEY = 'odq.progress.v1';
  const TASK_IDS = ['stars', 'p1', 'p2', 'p3', 'f1', 'f2', 'f3', 'tools',
                    ...D.tasks.map(t => t.id), 'report', 'quiz'];
  const MODULE_TASKS = {
    opendata: ['stars'], portal: ['p1', 'p2', 'p3'], prozorro: ['f1', 'f2', 'f3'],
    registries: ['tools'], investigation: [...D.tasks.map(t => t.id), 'report'], test: ['quiz']
  };
  const state = load();

  function load(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { done:{}, draft:{} }; }
    catch(e){ return { done:{}, draft:{} }; }
  }
  function save(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){ /* сховище недоступне */ }
  }
  function markDone(id){
    if (state.done[id]) return;
    state.done[id] = true; save(); renderProgress();
  }
  function renderProgress(){
    const n = TASK_IDS.filter(id => state.done[id]).length;
    $('#progress-text').textContent = `${n} / ${TASK_IDS.length}`;
    $('#progress-fill').style.width = (100 * n / TASK_IDS.length) + '%';
    Object.entries(MODULE_TASKS).forEach(([mod, ids]) => {
      const complete = ids.every(id => state.done[id]);
      $$(`[data-go="${mod}"]`).forEach(a => a.classList.toggle('done', complete));
    });
  }

  // ====== Навігація між модулями ======
  const MODULES = $$('[data-module]').map(s => s.id);
  function go(id, scroll=true){
    if (!MODULES.includes(id)) id = 'start';
    $$('[data-module]').forEach(s => s.hidden = s.id !== id);
    $$('.tabs a').forEach(a => {
      if (a.dataset.go === id){ a.setAttribute('aria-current', 'page'); a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      else a.removeAttribute('aria-current');
    });
    if (scroll) window.scrollTo({ top: 0 });
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-go]');
    if (!a) return;
    e.preventDefault();
    go(a.dataset.go);
    try { history.replaceState(null, '', '#' + a.dataset.go); } catch(err){ /* без історії */ }
  });
  window.addEventListener('hashchange', () => go(location.hash.slice(1)));

  // ====== Старт: стрічка фактів ======
  const tickerLines = D.tenders.map(t => `${t.id} · ${t.customer} · ${t.title} · ${fmt(t.contract)} грн`);
  let tickerIdx = 0;
  function tick(){
    $('#ticker-line').textContent = '› ' + tickerLines[tickerIdx];
    tickerIdx = (tickerIdx + 1) % tickerLines.length;
  }
  tick(); setInterval(tick, 3200);

  // ====== Універсальне питання з варіантами ======
  function choiceQA(container, { id, q, options, answer, explain, hint, num }){
    const box = document.createElement('div');
    box.className = 'qa' + (state.done[id] ? ' ok' : '');
    box.innerHTML = `<div class="qa-q">${num ? `<span class="num-badge">${esc(num)}</span>` : ''}${esc(q)}</div>
      <div class="qa-opts">${options.map((o, i) => `<button type="button" data-i="${i}">${esc(o)}</button>`).join('')}</div>
      ${hint ? `<details class="qa-hint"><summary>Підказка</summary>${esc(hint)}</details>` : ''}
      <div class="qa-explain" ${state.done[id] ? '' : 'hidden'}>${esc(explain || '')}</div>`;
    const ex = $('.qa-explain', box);
    if (state.done[id]) $(`[data-i="${answer}"]`, box).classList.add('picked-ok');
    $$('.qa-opts button', box).forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      $$('.qa-opts button', box).forEach(x => x.classList.remove('picked-ok', 'picked-no'));
      if (i === answer){
        b.classList.add('picked-ok'); box.classList.add('ok'); ex.hidden = !explain; markDone(id);
      } else {
        b.classList.add('picked-no');
      }
    }));
    container.appendChild(box);
  }

  function numberQA(container, { id, q, answer, tolerance=0, explain, hint, num }){
    const box = document.createElement('div');
    box.className = 'qa' + (state.done[id] ? ' ok' : '');
    box.innerHTML = `<div class="qa-q"><span class="num-badge">${esc(num)}</span>${esc(q)}</div>
      <div class="qa-row">
        <label class="sr" for="ans-${id}">Відповідь</label>
        <input id="ans-${id}" type="number" inputmode="numeric" placeholder="Число">
        <button type="button" class="btn ghost small-btn">Перевірити</button>
        <span class="feedback" role="status"></span>
      </div>
      <details class="qa-hint"><summary>Підказка</summary>${esc(hint)}</details>
      <div class="qa-explain" ${state.done[id] ? '' : 'hidden'}>${esc(explain)}</div>`;
    const input = $('input', box), fb = $('.feedback', box), ex = $('.qa-explain', box);
    if (state.done[id]) input.value = answer;
    const check = () => {
      const v = parseFloat(String(input.value).replace(/\s/g, '').replace(',', '.'));
      if (Number.isFinite(v) && Math.abs(v - answer) <= tolerance){
        fb.textContent = 'Правильно'; fb.className = 'feedback ok'; box.classList.add('ok'); ex.hidden = false; markDone(id);
      } else {
        fb.textContent = 'Ще не так. Перевірте дані в таблиці.'; fb.className = 'feedback no';
      }
    };
    $('button', box).addEventListener('click', check);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    container.appendChild(box);
  }

  // ====== Модуль 1: п'ять зірок ======
  const starPicks = {};
  const shuffledStars = [...D.stars].sort((a, b) => a.label.localeCompare(b.label, 'uk'));
  function renderStars(){
    const list = $('#stars-list');
    list.innerHTML = '';
    shuffledStars.forEach(item => {
      const row = document.createElement('div');
      row.className = 'star-row';
      row.dataset.id = item.id;
      row.innerHTML = `<div>${esc(item.label)}</div>
        <div class="star-pick" role="radiogroup" aria-label="Оцінка: ${esc(item.label)}">
          ${[1,2,3,4,5].map(n => `<button type="button" data-n="${n}" aria-label="${n} з 5">★</button>`).join('')}
        </div>
        <div class="star-why" hidden>${esc(item.why)}</div>`;
      $$('.star-pick button', row).forEach(b => b.addEventListener('click', () => {
        starPicks[item.id] = +b.dataset.n;
        $$('.star-pick button', row).forEach(x => x.classList.toggle('on', +x.dataset.n <= starPicks[item.id]));
        row.classList.remove('ok', 'no');
      }));
      if (state.done.stars){
        starPicks[item.id] = item.stars;
        $$('.star-pick button', row).forEach(x => x.classList.toggle('on', +x.dataset.n <= item.stars));
        row.classList.add('ok'); $('.star-why', row).hidden = false;
      }
      list.appendChild(row);
    });
  }
  $('#stars-check').addEventListener('click', () => {
    let right = 0;
    D.stars.forEach(item => {
      const row = $(`.star-row[data-id="${item.id}"]`);
      const ok = starPicks[item.id] === item.stars;
      if (ok) right++;
      row.classList.toggle('ok', ok);
      row.classList.toggle('no', !ok && starPicks[item.id] != null);
      $('.star-why', row).hidden = !ok;
    });
    const fb = $('#stars-feedback');
    if (right === D.stars.length){
      fb.textContent = 'Усі п\'ять правильно! Чим більше зірок, тим легше даним працювати разом.'; fb.className = 'feedback ok'; markDone('stars');
    } else {
      fb.textContent = `Правильно ${right} з ${D.stars.length}. Підказка: чи може програма прочитати файл і чи відкритий формат?`; fb.className = 'feedback no';
    }
  });

  // ====== Модуль 2: каталог data.gov.ua ======
  function renderPortal(){
    const q = $('#portal-q').value.trim().toLowerCase();
    const f = $('#portal-format').value;
    const res = D.datasets.filter(d =>
      (!q || (d.title + ' ' + d.tags.join(' ') + ' ' + d.owner).toLowerCase().includes(q)) &&
      (!f || d.formats.includes(f)));
    const ul = $('#portal-results');
    ul.innerHTML = res.length ? '' : '<li class="portal-empty">Нічого не знайдено. Спробуйте інше слово: «закупівлі», «нерухомість», «бюджет».</li>';
    res.forEach(d => {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" aria-pressed="false">
        <span>${esc(d.title)}</span>
        <span class="owner">${esc(d.owner)}</span>
        <span>${d.formats.map(x => `<span class="fmt ${x}">${x}</span>`).join('')}</span></button>`;
      $('button', li).addEventListener('click', e => {
        $$('#portal-results button').forEach(b => b.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        showDataset(d);
      });
      ul.appendChild(li);
    });
  }
  function showDataset(d){
    const box = $('#portal-detail');
    box.hidden = false;
    box.innerHTML = `<h4>${esc(d.title)}</h4>
      <dl class="meta-grid">
        <dt>Розпорядник</dt><dd>${esc(d.owner)}</dd>
        <dt>Формати</dt><dd>${d.formats.map(x => `<span class="fmt ${x}">${x}</span>`).join('')}</dd>
        <dt>Оновлення</dt><dd>${esc(d.freq)}, останнє ${esc(d.updated)}</dd>
        <dt>Ліцензія</dt><dd>Creative Commons Attribution 4.0 (CC BY 4.0)</dd>
        <dt>Рівень</dt><dd>${'★'.repeat(d.stars)}${'☆'.repeat(5 - d.stars)}</dd>
        <dt>Поля</dt><dd>${esc(d.fields)}</dd>
      </dl>
      <div class="api" title="Приклад запиту до API порталу (CKAN)">GET https://data.gov.ua/api/3/action/package_show?id=${d.id}</div>`;
  }
  $('#portal-q').addEventListener('input', renderPortal);
  $('#portal-format').addEventListener('change', renderPortal);

  const portalTasks = [
    { id: 'p1', num: '2.1', q: 'Хто розпорядник набору з меню та вартістю шкільного харчування?',
      options: ['Фінансове управління', 'Управління освіти Зорянської міської ради', 'Зорянська міська рада', 'Мінцифри'], answer: 1,
      explain: 'Розпорядник — орган, який відповідає за набір. Саме до нього можна звернутися, якщо дані застаріли.' },
    { id: 'p2', num: '2.2', q: 'Який набір найважче аналізувати програмою (лише одна зірка)?',
      options: ['Річні плани закупівель', 'Перелік закладів освіти', 'Протоколи засідань виконкому', 'Реєстр земельних ділянок'], answer: 2,
      explain: 'Скани PDF не є машинозчитуваними: таблицю з них доведеться передруковувати вручну.' },
    { id: 'p3', num: '2.3', q: 'У якому форматі опубліковано реєстр земельних ділянок, щоб одразу накласти його на карту?',
      options: ['PDF', 'XLSX', 'GeoJSON', 'DOCX'], answer: 2,
      explain: 'GeoJSON зберігає координати й межі об\'єктів, тож дані відкриваються в картографічних сервісах.' }
  ];
  portalTasks.forEach(t => choiceQA($('#portal-tasks'), t));

  // ====== Модуль 3: ProZorro ======
  function renderEco(){
    const map = $('#eco-map');
    const core = D.ecosystem.find(e => e.id === 'cbd');
    const rest = D.ecosystem.filter(e => e.id !== 'cbd');
    const label = { core: 'ядро', analytics: 'аналітика', civic: 'громадськість', control: 'контроль' };
    map.innerHTML = `<button type="button" class="eco-core" data-id="${core.id}" data-group="core" aria-pressed="false"><small>${label.core}</small>${esc(core.name)}</button>` +
      rest.map(e => `<button type="button" data-id="${e.id}" data-group="${e.group}" aria-pressed="false"><small>${label[e.group]}</small>${esc(e.name)}</button>`).join('');
    $$('button', map).forEach(b => b.addEventListener('click', () => showEco(b.dataset.id)));
    showEco('cbd');
  }
  function showEco(id){
    const e = D.ecosystem.find(x => x.id === id);
    $$('#eco-map button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
    $('#eco-info').innerHTML = `<h3>${esc(e.name)}</h3><p>${esc(e.text)}</p>`;
  }

  function renderCalc(){
    const type = $('#calc-type').value;
    const sum = Math.max(0, +$('#calc-sum').value || 0);
    const T = D.thresholds;
    const top = type === 'works' ? T.works : T.goods;
    let proc, text, color;
    if (sum < T.simplified){
      proc = 'Прямий договір'; color = 'var(--warn)';
      text = 'Конкурентна процедура не обов\'язкова, але замовник мусить дотримуватися принципів закупівель і оприлюднити звіт про договір в ProZorro. Саме тут найчастіше трапляється дроблення.';
    } else if (sum < top){
      proc = 'Спрощена закупівля'; color = 'var(--accent)';
      text = 'Оголошення в ProZorro, мінімум кілька днів на пропозиції, аукціон. Поріг: від 50 000 грн до ' + fmt(top) + ' грн.';
    } else {
      proc = 'Відкриті торги'; color = 'var(--good)';
      text = 'Повна конкурентна процедура з тендерною документацією, аукціоном і правом на оскарження в АМКУ. Поріг для ' + (type === 'works' ? 'робіт' : 'товарів і послуг') + ': від ' + fmt(top) + ' грн.';
    }
    const max = Math.max(top * 1.6, sum);
    const p1 = 100 * T.simplified / max, p2 = 100 * top / max, ps = Math.min(100, 100 * sum / max);
    $('#calc-result').innerHTML = `<span class="small">${fmt(sum)} грн →</span><b>${proc}</b><p>${text}</p>
      <div class="scale" aria-hidden="true">
        <span style="left:0;width:${p1}%;background:var(--warn-soft)"></span>
        <span style="left:${p1}%;width:${p2 - p1}%;background:var(--accent-soft)"></span>
        <span style="left:${p2}%;right:0;background:var(--good-soft)"></span>
        <span style="left:calc(${ps}% - 2px);width:4px;background:${color}"></span>
      </div>`;
  }
  $('#calc-type').addEventListener('change', renderCalc);
  $('#calc-sum').addEventListener('input', () => { $('#calc-range').value = $('#calc-sum').value; renderCalc(); });
  $('#calc-range').addEventListener('input', () => { $('#calc-sum').value = $('#calc-range').value; renderCalc(); });

  let stepIdx = 0;
  const seenSteps = new Set();
  function renderSteps(){
    $('#steps').innerHTML = D.lifecycle.map((s, i) => `<li><button type="button" data-i="${i}" aria-pressed="false">${esc(s.name)}</button></li>`).join('');
    $$('#steps button').forEach(b => b.addEventListener('click', () => showStep(+b.dataset.i)));
    showStep(0);
  }
  function showStep(i){
    stepIdx = i; seenSteps.add(i);
    $$('#steps button').forEach(b => {
      b.setAttribute('aria-pressed', String(+b.dataset.i === i));
      b.classList.toggle('seen', seenSteps.has(+b.dataset.i));
    });
    const s = D.lifecycle[i];
    $('#step-text').innerHTML = `<h3>${i + 1}. ${esc(s.name)}</h3><p>${esc(s.text)}</p>
      <div class="step-nav">
        <button type="button" class="btn ghost small-btn" ${i === 0 ? 'disabled' : ''} data-step="-1">← Назад</button>
        <button type="button" class="btn ghost small-btn" ${i === D.lifecycle.length - 1 ? 'disabled' : ''} data-step="1">Далі →</button>
      </div>`;
    $$('#step-text [data-step]').forEach(b => b.addEventListener('click', () => showStep(stepIdx + +b.dataset.step)));
  }

  $('#flags').innerHTML = D.redFlags.map(f => `<div class="flag"><h4>${esc(f.title)}</h4><p>${esc(f.text)}</p></div>`).join('');
  const flagTitles = D.redFlags.map(f => f.title);
  const flagIndex = id => D.redFlags.findIndex(f => f.id === id);
  [
    { id: 'f1', num: '3.1', q: 'Ліцей купив 30 стільців по 4 800 грн, а сусідня гімназія — такі самі по 1 900 грн. Який це прапорець?',
      answer: flagIndex('overprice'), explain: 'Порівнюйте ціну за одиницю однакових товарів (той самий CPV-код) у різних замовників.' },
    { id: 'f2', num: '3.2', q: 'Найдешевшу пропозицію відхилили, бо один файл завантажили без підпису, і договір уклали на 600 тис. грн дорожче.',
      answer: flagIndex('disq'), explain: 'Закон дозволяє замовнику дати учаснику 24 години на виправлення формальних помилок. Якщо цього не зробили — привід для скарги.' },
    { id: 'f3', num: '3.3', q: 'Компанію зареєстрували три місяці тому, статутний капітал — 1 000 грн, працівників двоє, а вона виграла договір на 8 млн грн.',
      answer: flagIndex('young'), explain: 'Перевірте таку фірму в ЄДР чи Opendatabot: хто власник і чи не пов\'язаний він із замовником.' }
  ].forEach(t => choiceQA($('#flag-tasks'), { ...t, options: flagTitles }));

  // ====== Модуль 4: реєстри ======
  $('#tools').innerHTML = D.tools.map(t => `<div class="tool"><span class="kind">${esc(t.kind)}</span>
    <a href="${t.url}" target="_blank" rel="noopener">${esc(t.name)} ↗</a><p>${esc(t.text)}</p></div>`).join('');

  const toolOptions = `<option value="">— оберіть —</option>` + D.tools.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  $('#tool-match').innerHTML = D.toolMatch.map((m, i) => `<div class="match-row" data-i="${i}">
    <label for="tm-${i}">${esc(m.q)}</label><select id="tm-${i}">${toolOptions}</select></div>`).join('');
  if (state.done.tools) D.toolMatch.forEach((m, i) => { $(`#tm-${i}`).value = m.a; $(`.match-row[data-i="${i}"]`).classList.add('ok'); });
  $('#tool-check').addEventListener('click', () => {
    let right = 0;
    D.toolMatch.forEach((m, i) => {
      const v = $(`#tm-${i}`).value;
      const ok = v === m.a || (m.alt || []).includes(v);
      if (ok) right++;
      const row = $(`.match-row[data-i="${i}"]`);
      row.classList.toggle('ok', ok); row.classList.toggle('no', !ok);
    });
    const fb = $('#tool-feedback');
    if (right === D.toolMatch.length){ fb.textContent = 'Чудово! Ви знаєте, де шукати.'; fb.className = 'feedback ok'; markDone('tools'); }
    else { fb.textContent = `Правильно ${right} з ${D.toolMatch.length}. Перечитайте картки інструментів вище.`; fb.className = 'feedback no'; }
  });

  let regSrc = 'all';
  $$('.reg-search .seg button').forEach(b => b.addEventListener('click', () => {
    regSrc = b.dataset.src;
    $$('.reg-search .seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderRegistry();
  }));
  $$('[data-reg]').forEach(b => b.addEventListener('click', () => { $('#reg-q').value = b.dataset.reg; renderRegistry(); }));
  $('#reg-q').addEventListener('input', renderRegistry);

  function tendersOf(companyName){ return D.tenders.filter(t => t.winner === companyName); }

  function renderRegistry(){
    const q = $('#reg-q').value.trim().toLowerCase();
    const box = $('#reg-results');
    if (q.length < 2){ box.innerHTML = '<p class="small">Введіть щонайменше 2 символи.</p>'; return; }
    const out = [];
    if (regSrc === 'all' || regSrc === 'edr'){
      D.companies.filter(c => (c.name + c.code + c.director + c.owners.map(o => o.name).join(' ')).toLowerCase().includes(q)).forEach(c => {
        const ts = tendersOf(c.name);
        const total = ts.reduce((s, t) => s + finalSum(t), 0);
        out.push(`<article class="dossier">
          <div class="dossier-head"><span class="dossier-src">ЄДР · досьє агрегатора</span><span class="code">ЄДРПОУ ${c.code}</span></div>
          <h4>${esc(c.name)}</h4>
          <dl class="meta-grid">
            <dt>Зареєстровано</dt><dd>${c.registered}</dd>
            <dt>Керівник</dt><dd>${esc(c.director)}</dd>
            <dt>Бенефіціари</dt><dd>${c.owners.map(o => `${esc(o.name)} (${o.share})`).join('<br>')}</dd>
            <dt>КВЕД</dt><dd>${esc(c.kved)}</dd>
            <dt>Капітал</dt><dd>${fmt(c.capital)} грн</dd>
            <dt>Працівники</dt><dd>${c.staff}</dd>
            <dt>Адреса</dt><dd>${esc(c.address)}</dd>
            <dt>Суди</dt><dd>${c.courts} справ</dd>
            <dt>Тендери шкіл</dt><dd>${ts.length} на ${fmt(total)} грн</dd>
          </dl>
          ${c.notes.length ? `<div class="alert"><b>Зверніть увагу</b>${c.notes.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}
        </article>`);
      });
    }
    if (regSrc === 'all' || regSrc === 'nazk'){
      D.declarations.filter(d => (d.name + d.position + d.family.join(' ')).toLowerCase().includes(q)).forEach(d => {
        out.push(`<article class="dossier">
          <div class="dossier-head"><span class="dossier-src">Реєстр декларацій НАЗК</span><span class="code">щорічна за ${d.year} рік</span></div>
          <h4>${esc(d.name)}</h4>
          <p class="small">${esc(d.position)}</p>
          <dl class="meta-grid">
            <dt>Члени сім'ї</dt><dd>${d.family.map(esc).join('<br>')}</dd>
            <dt>Доходи</dt><dd>${d.income.map(i => `${esc(i.who)}: ${fmt(i.sum)} грн (${esc(i.source)})`).join('<br>')}</dd>
            <dt>Нерухомість</dt><dd>${d.property.map(p => `${esc(p.who)}: ${esc(p.item)}, з ${p.since}`).join('<br>') || 'немає'}</dd>
            <dt>Транспорт</dt><dd>${d.vehicles.map(v => `${esc(v.who)}: ${esc(v.item)}, з ${v.since}`).join('<br>') || 'немає'}</dd>
            <dt>Корпоративні права</dt><dd>${esc(d.corporate)}</dd>
          </dl>
          ${d.notes.length ? `<div class="alert"><b>Зверніть увагу</b>${d.notes.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}
        </article>`);
      });
    }
    if (regSrc === 'all' || regSrc === 'rrp'){
      D.realty.filter(r => (r.owner + r.object).toLowerCase().includes(q)).forEach(r => {
        out.push(`<article class="dossier">
          <div class="dossier-head"><span class="dossier-src">Реєстр речових прав</span><span class="code">інформаційна довідка</span></div>
          <h4>${esc(r.object)}</h4>
          <dl class="meta-grid">
            <dt>Власник</dt><dd>${esc(r.owner)}</dd>
            <dt>Набуто</dt><dd>${r.acquired}</dd>
            <dt>Підстава</dt><dd>${esc(r.basis)}</dd>
          </dl>
        </article>`);
      });
    }
    box.innerHTML = out.length ? out.join('') : '<p class="small">У навчальних реєстрах нічого не знайдено. Спробуйте прізвище власника або назву компанії з таблиці закупівель.</p>';
  }

  // ====== Модуль 5: розслідування ======
  const PROC = { open: 'Відкриті торги', simple: 'Спрощена', direct: 'Прямий договір', negotiated: 'Переговорна' };
  const isCompetitive = t => t.procedure === 'open' || t.procedure === 'simple';
  const finalSum = t => t.contract + (t.changes || []).reduce((s, c) => s + c.delta, 0);
  const daysBetween = (a, b) => Math.abs(new Date(a) - new Date(b)) / 864e5;
  const FLAG_LABEL = Object.fromEntries(D.redFlags.map(f => [f.id, f.title]));

  // Ризик-індикатори рахуються з даних, як автоматичні правила DOZORRO
  function computeFlags(){
    const flags = {};
    D.tenders.forEach(t => flags[t.id] = new Set());
    D.tenders.forEach(t => {
      if (isCompetitive(t) && t.bidders === 1) flags[t.id].add('single');
      if ((finalSum(t) - t.contract) / t.contract > 0.1) flags[t.id].add('price');
      if ((t.rejected || []).some(r => r.price < t.contract)) flags[t.id].add('disq');
      // Дроблення: кілька прямих договорів одного замовника з тим самим CPV і постачальником за 30 днів, разом понад поріг
      if (t.procedure === 'direct'){
        const group = D.tenders.filter(x => x.procedure === 'direct' && x.customer === t.customer && x.cpv === t.cpv &&
          x.winner === t.winner && daysBetween(x.date, t.date) <= 30);
        if (group.length > 1 && group.reduce((s, x) => s + x.contract, 0) >= D.thresholds.simplified) flags[t.id].add('split');
      }
      // Ціна за одиницю понад 30% вища за мінімальну для того самого CPV
      if (t.qty){
        const peers = D.tenders.filter(x => x.cpv === t.cpv && x.qty);
        const minUnit = Math.min(...peers.map(x => x.contract / x.qty));
        if (peers.length > 1 && t.contract / t.qty > minUnit * 1.3) flags[t.id].add('overprice');
      }
      const company = D.companies.find(c => c.name === t.winner);
      if (company){
        if (daysBetween(company.registered, t.date) < 365 && new Date(company.registered) < new Date(t.date)) flags[t.id].add('young');
        const linked = company.owners.some(o => D.declarations.some(d => d.family.some(f => f.includes(o.name))));
        if (linked) flags[t.id].add('related');
      }
    });
    return flags;
  }
  const FLAGS = computeFlags();

  // Фільтри
  const customers = [...new Set(D.tenders.map(t => t.customer))].sort((a, b) => a.localeCompare(b, 'uk'));
  $('#f-customer').innerHTML += customers.map(c => `<option>${esc(c)}</option>`).join('');
  let sortKey = 'date', sortDir = 1, selectedId = null, groupBy = 'winner';

  function filtered(){
    const q = $('#f-q').value.trim().toLowerCase();
    const cust = $('#f-customer').value;
    const proc = $('#f-proc').value;
    const onlyFlags = $('#f-flags').checked;
    return D.tenders.filter(t =>
      (!q || (t.title + t.winner + t.cpv + t.cpvName + t.id).toLowerCase().includes(q)) &&
      (!cust || t.customer === cust) &&
      (!proc || (proc === 'competitive' ? isCompetitive(t) : t.procedure === proc)) &&
      (!onlyFlags || FLAGS[t.id].size > 0));
  }

  function renderKpis(){
    const all = D.tenders;
    const total = all.reduce((s, t) => s + finalSum(t), 0);
    const comp = all.filter(isCompetitive);
    const single = comp.filter(t => t.bidders === 1).length;
    const avgB = comp.reduce((s, t) => s + t.bidders, 0) / comp.length;
    const savings = comp.reduce((s, t) => s + (t.expected - t.contract), 0) / comp.reduce((s, t) => s + t.expected, 0);
    const flagged = all.filter(t => FLAGS[t.id].size).length;
    $('#kpis').innerHTML = [
      ['Сума договорів', (total / 1e6).toFixed(1).replace('.', ',') + ' млн грн', `${all.length} закупівель`],
      ['Сер. учасників', avgB.toFixed(1).replace('.', ','), 'у конкурентних процедурах'],
      ['Один учасник', `${Math.round(100 * single / comp.length)}%`, 'конкурентних закупівель', single ? 'warn' : ''],
      ['Економія', `${(100 * savings).toFixed(1).replace('.', ',')}%`, 'від очікуваної вартості'],
      ['З прапорцями', String(flagged), 'закупівель з ризиками', 'warn']
    ].map(([l, v, s, c]) => `<div class="kpi ${c || ''}"><span class="k-label">${l}</span><span class="k-val">${v}</span><span class="k-sub">${s}</span></div>`).join('');
  }

  function renderTable(){
    const showRisk = $('#f-risk').checked || $('#f-flags').checked;
    const rows = filtered().sort((a, b) => {
      const va = sortKey === 'final' ? finalSum(a) : sortKey === 'bidders' ? (a.bidders ?? -1) : a[sortKey];
      const vb = sortKey === 'final' ? finalSum(b) : sortKey === 'bidders' ? (b.bidders ?? -1) : b[sortKey];
      return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'uk')) * sortDir;
    });
    $('#t-body').innerHTML = rows.map(t => {
      const fs = finalSum(t);
      const pills = showRisk && FLAGS[t.id].size ? `<div class="pills">${[...FLAGS[t.id]].map(f => `<span class="pill">${esc(FLAG_LABEL[f])}</span>`).join('')}</div>` : '';
      return `<tr data-id="${t.id}" class="${t.id === selectedId ? 'sel' : ''}" tabindex="0">
        <td class="date">${t.date}</td>
        <td>${esc(t.customer)}</td>
        <td>${esc(t.title)}${pills}</td>
        <td><span class="proc ${t.procedure}">${PROC[t.procedure]}</span></td>
        <td class="num">${t.bidders ?? '—'}</td>
        <td>${esc(t.winner)}</td>
        <td class="num">${fmt(fs)}${fs !== t.contract ? `<span class="changed">було ${fmt(t.contract)}</span>` : ''}</td>
      </tr>`;
    }).join('');
    $('#t-count').textContent = `Показано ${rows.length} з ${D.tenders.length} закупівель · сума ${fmt(rows.reduce((s, t) => s + finalSum(t), 0))} грн`;
    $$('#t-body tr').forEach(tr => {
      tr.addEventListener('click', () => selectTender(tr.dataset.id));
      tr.addEventListener('keydown', e => { if (e.key === 'Enter') selectTender(tr.dataset.id); });
    });
    $$('#t-table th').forEach(th => {
      if (th.dataset.sort === sortKey) th.setAttribute('aria-sort', sortDir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
    renderChart(rows);
  }

  function renderChart(rows){
    const groups = {};
    rows.forEach(t => {
      const k = t[groupBy];
      groups[k] = groups[k] || { sum: 0, flag: false, n: 0 };
      groups[k].sum += finalSum(t); groups[k].n++;
      if (FLAGS[t.id].size) groups[k].flag = true;
    });
    const list = Object.entries(groups).sort((a, b) => b[1].sum - a[1].sum).slice(0, 8);
    const max = list.length ? list[0][1].sum : 1;
    const showRisk = $('#f-risk').checked || $('#f-flags').checked;
    $('#chart').innerHTML = list.length ? list.map(([name, g]) => `<div class="bar-row">
        <div class="bar-label"><span>${esc(name)} <span class="small">(${g.n})</span></span><span>${(g.sum / 1e6).toFixed(2).replace('.', ',')} млн</span></div>
        <div class="bar-track"><div class="bar-fill ${showRisk && g.flag ? 'flag' : ''}" style="width:${(100 * g.sum / max).toFixed(1)}%"></div></div>
      </div>`).join('') + (showRisk ? '<p class="small">Червоні смуги — є закупівлі з ризик-індикаторами.</p>' : '')
      : '<p class="small">Немає даних для обраних фільтрів.</p>';
  }

  function selectTender(id){
    selectedId = id;
    const t = D.tenders.find(x => x.id === id);
    const fs = finalSum(t);
    const company = D.companies.find(c => c.name === t.winner);
    const timeline = [
      `<li><span class="d">${t.date}</span><br>Оголошено · очікувана вартість ${fmt(t.expected)} грн</li>`,
      `<li><span class="d">договір</span><br>Переможець ${esc(t.winner)} · ${fmt(t.contract)} грн${t.expected ? ` (економія ${(100 * (t.expected - t.contract) / t.expected).toFixed(1).replace('.', ',')}%)` : ''}</li>`,
      ...(t.changes || []).map(c => `<li class="up"><span class="d">${c.date}</span><br>Допугода: +${fmt(c.delta)} грн · ${esc(c.reason)}</li>`)
    ].join('');
    $('#t-detail').innerHTML = `<span class="tid">${t.id}</span>
      <h4>${esc(t.title)}</h4>
      <dl class="meta-grid">
        <dt>Замовник</dt><dd>${esc(t.customer)}</dd>
        <dt>CPV</dt><dd>${t.cpv} · ${esc(t.cpvName)}</dd>
        <dt>Процедура</dt><dd>${PROC[t.procedure]}</dd>
        <dt>Учасники</dt><dd>${t.bidders ?? 'не застосовується'}</dd>
        <dt>Сума зараз</dt><dd><b>${fmt(fs)} грн</b>${fs !== t.contract ? ` (+${(100 * (fs - t.contract) / t.contract).toFixed(1).replace('.', ',')}%)` : ''}</dd>
        ${t.qty ? `<dt>За одиницю</dt><dd>${fmt(t.contract / t.qty)} грн × ${t.qty} ${t.unit}</dd>` : ''}
      </dl>
      <ul class="timeline">${timeline}</ul>
      ${t.rejected ? `<div class="alert"><b>Відхилені пропозиції</b>${t.rejected.map(r => `<span>${esc(r.name)} — ${fmt(r.price)} грн: ${esc(r.reason)}</span>`).join('')}</div>` : ''}
      ${FLAGS[t.id].size ? `<div class="pills">${[...FLAGS[t.id]].map(f => `<span class="pill">${esc(FLAG_LABEL[f])}</span>`).join('')}</div>` : '<p class="small">Автоматичних ризик-індикаторів не виявлено.</p>'}
      ${company ? `<button type="button" class="link-btn" data-check="${esc(company.name)}">Перевірити ${esc(company.name)} у реєстрах →</button>` : ''}`;
    const chk = $('#t-detail [data-check]');
    if (chk) chk.addEventListener('click', () => {
      go('registries');
      $('#reg-q').value = company.name.replace(/ТОВ «|»/g, '');
      renderRegistry();
      $('#reg-q').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $$('#t-body tr').forEach(tr => tr.classList.toggle('sel', tr.dataset.id === id));
  }

  $$('#t-table th').forEach(th => th.addEventListener('click', () => {
    if (sortKey === th.dataset.sort) sortDir *= -1; else { sortKey = th.dataset.sort; sortDir = th.dataset.sort === 'final' || th.dataset.sort === 'bidders' ? -1 : 1; }
    renderTable();
  }));
  ['#f-q', '#f-customer', '#f-proc', '#f-flags', '#f-risk'].forEach(s => $(s).addEventListener(s === '#f-q' ? 'input' : 'change', renderTable));
  $$('.chart-head .seg button').forEach(b => b.addEventListener('click', () => {
    groupBy = b.dataset.group;
    $$('.chart-head .seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderTable();
  }));

  // Завдання слідства
  D.tasks.forEach((t, i) => {
    const num = '5.' + (i + 1);
    if (t.type === 'choice') choiceQA($('#inv-tasks'), { ...t, num });
    else numberQA($('#inv-tasks'), { ...t, num });
  });

  // ====== Звіт ======
  $('#rep-flags').innerHTML += D.redFlags.map(f => `<label><input type="checkbox" value="${f.id}" id="rf-${f.id}"> ${esc(f.title)}</label>`).join('');
  const draft = state.draft || {};
  if (draft.team) $('#rep-team').value = draft.team;
  if (draft.text) $('#rep-text').value = draft.text;
  if (draft.to) $('#rep-to').value = draft.to;
  (draft.flags || []).forEach(id => { const cb = $(`#rf-${id}`); if (cb) cb.checked = true; });

  function reportText(){
    const picked = $$('#rep-flags input:checked').map(cb => cb.value);
    const examples = picked.map(id => {
      const ts = D.tenders.filter(t => FLAGS[t.id].has(id));
      const list = ts.length ? ts.map(t => `   – ${t.id}: ${t.title} (${t.customer}), ${fmt(finalSum(t))} грн`).join('\n') : '   – у вибірці не знайдено автоматично';
      return `• ${FLAG_LABEL[id]}\n${list}`;
    }).join('\n');
    const solved = D.tasks.filter(t => state.done[t.id]).length;
    return `ЗВІТ МІНІРОЗСЛІДУВАННЯ
Закупівлі закладів освіти м. Зорянськ, 2025 (навчальні дані)
Автори: ${$('#rep-team').value.trim() || '—'}
Розв'язано завдань слідства: ${solved} з ${D.tasks.length}

1. ВИЯВЛЕНІ ОЗНАКИ РИЗИКУ
${examples || '• (оберіть ознаки зліва)'}

2. ВИСНОВОК
${$('#rep-text').value.trim() || '(напишіть висновок)'}

3. РЕКОМЕНДАЦІЯ
Звернутися: ${$('#rep-to').value}

4. ДЖЕРЕЛА
ProZorro / BI ProZorro (закупівлі), ЄДР та агрегатори (власники компаній),
реєстр декларацій НАЗК, Державний реєстр речових прав.

Примітка: виявлені ознаки не є доказом правопорушення
і потребують перевірки уповноваженими органами.`;
  }
  function renderReport(){
    $('#rep-preview').textContent = reportText();
    state.draft = { team: $('#rep-team').value, text: $('#rep-text').value, to: $('#rep-to').value,
      flags: $$('#rep-flags input:checked').map(cb => cb.value) };
    save();
  }
  ['#rep-team', '#rep-text'].forEach(s => $(s).addEventListener('input', renderReport));
  $('#rep-to').addEventListener('change', renderReport);
  $('#rep-flags').addEventListener('change', renderReport);
  $('#rep-copy').addEventListener('click', () => {
    const text = reportText();
    const fb = $('#rep-feedback');
    const ready = $$('#rep-flags input:checked').length > 0 && $('#rep-text').value.trim().length >= 40;
    const done = () => {
      fb.textContent = ready ? 'Звіт скопійовано. Вставте його в повідомлення вчителю.' : 'Скопійовано. Щоб зарахувати завдання, оберіть ознаки й напишіть висновок (від 40 символів).';
      fb.className = 'feedback ' + (ready ? 'ok' : 'no');
      if (ready) markDone('report');
    };
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents($('#rep-preview'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      fb.textContent = 'Текст виділено — натисніть Ctrl+C (або «Копіювати» на телефоні).'; fb.className = 'feedback';
      if (ready) markDone('report');
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch(e){ fallback(); }
  });

  // ====== Тест ======
  function renderQuiz(){
    $('#quiz').innerHTML = D.quiz.map((q, i) => `<fieldset data-i="${i}"><legend>${i + 1}. ${esc(q.q)}</legend>
      ${q.options.map((o, j) => `<label><input type="radio" name="q${i}" id="q${i}-${j}" value="${j}"> ${esc(o)}</label>`).join('')}
      <span class="right-answer" hidden></span></fieldset>`).join('');
    $('#final').hidden = true;
    $('#quiz-feedback').textContent = '';
  }
  $('#quiz-submit').addEventListener('click', () => {
    let score = 0, answered = 0;
    D.quiz.forEach((q, i) => {
      const fs = $(`#quiz fieldset[data-i="${i}"]`);
      const pick = $(`input[name="q${i}"]:checked`);
      if (pick) answered++;
      const ok = pick && +pick.value === q.a;
      if (ok) score++;
      fs.classList.toggle('ok', !!ok); fs.classList.toggle('no', !ok);
      const ra = $('.right-answer', fs);
      ra.hidden = !!ok; ra.textContent = 'Правильна відповідь: ' + q.options[q.a];
    });
    const fb = $('#quiz-feedback');
    if (answered < D.quiz.length){ fb.textContent = `Ви відповіли на ${answered} з ${D.quiz.length} питань.`; fb.className = 'feedback no'; }
    else fb.textContent = '';
    const grade = Math.max(1, Math.round(12 * score / D.quiz.length));
    if (score >= 7) markDone('quiz');
    const solved = TASK_IDS.filter(id => state.done[id]).length;
    const badges = [];
    if (state.done.stars) badges.push('Знавець відкритих даних');
    if (['p1','p2','p3'].every(id => state.done[id])) badges.push('Навігатор порталу');
    if (['f1','f2','f3'].every(id => state.done[id])) badges.push('Мисливець на прапорці');
    if (state.done.tools) badges.push('Майстер реєстрів');
    if (D.tasks.every(t => state.done[t.id])) badges.push('Слідчий ProZorro');
    if (state.done.report) badges.push('Автор звіту');
    const f = $('#final');
    f.hidden = false;
    f.innerHTML = `<h3>${score} з ${D.quiz.length} · ${grade} балів із 12</h3>
      <p>Виконано завдань уроку: ${solved} з ${TASK_IDS.length}. ${score >= 7 ? 'Тест зараховано.' : 'Для зарахування потрібно щонайменше 7 правильних відповідей.'}</p>
      ${badges.length ? `<div class="badges">${badges.map(b => `<span>${b}</span>`).join('')}</div>` : ''}`;
    f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('#quiz-reset').addEventListener('click', renderQuiz);

  // ====== Скидання прогресу (з підтвердженням на сторінці) ======
  let resetArmed = false;
  $('#reset-all').addEventListener('click', () => {
    const fb = $('#reset-feedback');
    if (!resetArmed){
      resetArmed = true; fb.textContent = 'Натисніть ще раз, щоб стерти весь прогрес.'; fb.className = 'feedback no';
      setTimeout(() => { resetArmed = false; fb.textContent = ''; }, 4000);
      return;
    }
    try { localStorage.removeItem(STORAGE_KEY); } catch(e){ /* немає сховища */ }
    location.reload();
  });

  // ====== Ініціалізація ======
  renderStars();
  renderPortal();
  renderEco();
  renderCalc();
  renderSteps();
  renderRegistry();
  renderKpis();
  renderTable();
  renderReport();
  renderQuiz();
  renderProgress();
  go(location.hash.slice(1), false);
})();
