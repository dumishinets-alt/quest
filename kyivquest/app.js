/* KyivQuest — основна логіка */
(function(){
  // ====== Глобальні змінні стану ======
  const elMap = document.getElementById('map');
  const elMissionList = document.getElementById('mission-list');
  const elMissionDetail = document.getElementById('mission-detail');
  const elMissionTitle = document.getElementById('mission-title');
  const elMissionDesc = document.getElementById('mission-desc');
  const elMissionArea = document.getElementById('mission-area');
  const elMissionDistance = document.getElementById('mission-distance');
  const elGeoStatus = document.getElementById('geo-status');

  const btnMissions = document.getElementById('btn-missions');
  const btnAchievements = document.getElementById('btn-achievements');
  const btnHelp = document.getElementById('btn-help');

  const panelMissions = document.getElementById('panel-missions');
  const panelAchievements = document.getElementById('panel-achievements');
  const panelHelp = document.getElementById('panel-help');

  const btnStartQuiz = document.getElementById('btn-start-quiz');
  const btnNavigate = document.getElementById('btn-navigate');

  const quizModal = document.getElementById('quiz-modal');
  const quizTitle = document.getElementById('quiz-title');
  const quizQuestion = document.getElementById('quiz-question');
  const quizForm = document.getElementById('quiz-form');
  const quizNext = document.getElementById('quiz-next');
  const quizExit = document.getElementById('quiz-exit');

  const achList = document.getElementById('achievements-list');
  const statMissions = document.getElementById('stat-missions');
  const statTotal = document.getElementById('stat-total');
  const statStreak = document.getElementById('stat-streak');
  const btnReset = document.getElementById('btn-reset');

  const MISSIONS = window.KYIVQUEST_DATA || [];
  statTotal.textContent = MISSIONS.length.toString();

  const STORAGE_KEY = 'kyivquest.progress.v1';
  const PROGRESS = loadProgress(); // { done:[id], badges:Set, streak:number }

  let map, userMarker, missionMarkers = {};
  let selectedMission = null;
  let currentPosition = null;

  // ====== Ініціалізація мапи ======
  initMap();

  // Додати місії на мапу та у список
  renderMissionList();
  addMissionMarkers();

  // ====== Геолокація ======
  if ("geolocation" in navigator) {
    elGeoStatus.textContent = "🔎 Шукаємо ваше місцезнаходження…";
    navigator.geolocation.watchPosition(onGeoSuccess, onGeoError, {
      enableHighAccuracy: true, maximumAge: 5000, timeout: 20000
    });
  } else {
    elGeoStatus.textContent = "❌ Ваш браузер не підтримує геолокацію";
  }

  function onGeoSuccess(pos){
    const { latitude, longitude } = pos.coords;
    currentPosition = [latitude, longitude];
    elGeoStatus.textContent = "✅ Геолокація активна";
    if (!userMarker) {
      userMarker = L.marker(currentPosition, { title: "Ви тут" }).addTo(map);
      map.setView(currentPosition, 15);
    } else {
      userMarker.setLatLng(currentPosition);
    }
    updateDistancesAndLock();
  }
  function onGeoError(err){
    elGeoStatus.textContent = "⚠️ Не вдалося отримати геопозицію: " + (err?.message || "Невідома помилка");
  }

  // ====== Панелі ======
  function activateTab(btn){
    [btnMissions, btnAchievements, btnHelp].forEach(b=>b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed','true');
    panelMissions.hidden = panelAchievements.hidden = panelHelp.hidden = true;
    panelMissions.classList.remove('is-active');
    panelAchievements.classList.remove('is-active');
    panelHelp.classList.remove('is-active');

    if(btn===btnMissions){ panelMissions.hidden=false; panelMissions.classList.add('is-active'); }
    if(btn===btnAchievements){ panelAchievements.hidden=false; panelAchievements.classList.add('is-active'); renderAchievements(); }
    if(btn===btnHelp){ panelHelp.hidden=false; panelHelp.classList.add('is-active'); }
  }
  btnMissions.addEventListener('click', ()=>activateTab(btnMissions));
  btnAchievements.addEventListener('click', ()=>activateTab(btnAchievements));
  btnHelp.addEventListener('click', ()=>activateTab(btnHelp));

  // ====== Місії (список + події) ======
  function renderMissionList(){
    const nearerFirst = [...MISSIONS].sort((a,b)=> {
      const da = distanceToMission(a);
      const db = distanceToMission(b);
      return da - db;
    });

    elMissionList.innerHTML = '';
    nearerFirst.forEach(m=>{
      const li = document.createElement('li');
      li.className = 'mission-item';
      li.setAttribute('tabindex','0');
      li.innerHTML = `
        <div>
          <div class="title">${m.title}</div>
          <div class="meta">${m.area}</div>
        </div>
        <div class="meta" data-id="${m.id}">— м</div>
      `;
      li.addEventListener('click', ()=>selectMission(m.id));
      li.addEventListener('keypress', (e)=>{ if(e.key==='Enter') selectMission(m.id); });
      elMissionList.appendChild(li);
    });
    // одразу порахуємо відстані якщо позиція вже є
    updateListDistances();
  }

  function selectMission(id){
    selectedMission = MISSIONS.find(x=>x.id===id);
    if(!selectedMission) return;
    elMissionDetail.hidden = false;
    elMissionTitle.textContent = selectedMission.title;
    elMissionDesc.textContent = selectedMission.description;
    elMissionArea.textContent = selectedMission.area;
    const d = distanceToMission(selectedMission);
    elMissionDistance.textContent = Number.isFinite(d) ? `${Math.round(d)} м` : "—";
    btnStartQuiz.disabled = !canStartQuiz(selectedMission);
    // центр карти
    map.setView([selectedMission.lat, selectedMission.lon], 16, { animate:true });
  }

  btnNavigate.addEventListener('click', ()=>{
    if(!selectedMission) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedMission.lat},${selectedMission.lon}`;
    window.open(url, '_blank');
  });

  btnStartQuiz.addEventListener('click', ()=> startQuiz(selectedMission));

  // ====== Мапа та маркери ======
  function initMap(){
    map = L.map(elMap,{ zoomControl:true, attributionControl:true }).setView([50.4501, 30.5234], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19, attribution:'© OpenStreetMap'
    }).addTo(map);
  }

  function addMissionMarkers(){
    MISSIONS.forEach(m=>{
      const marker = L.circleMarker([m.lat, m.lon], {
        radius: 8, color:'#2d8fdd', weight:2, fill:true, fillOpacity:.5
      }).addTo(map);
      marker.bindPopup(`<strong>${m.title}</strong><br><small>${m.area}</small>`);
      marker.on('click', ()=> selectMission(m.id));
      // коло радіуса
      L.circle([m.lat, m.lon], { radius: m.radiusMeters, color:'#2d8fdd', opacity:.25, fillOpacity:0 }).addTo(map);
      missionMarkers[m.id] = marker;
    });
  }

  // ====== Відстані, розблокування вікторини ======
  function updateDistancesAndLock(){
    updateListDistances();
    if(selectedMission){
      const d = distanceToMission(selectedMission);
      elMissionDistance.textContent = Number.isFinite(d) ? `${Math.round(d)} м` : "—";
      btnStartQuiz.disabled = !canStartQuiz(selectedMission);
    }
  }
  function updateListDistances(){
    Array.from(elMissionList.querySelectorAll('[data-id]')).forEach(el=>{
      const m = MISSIONS.find(x=>x.id===el.getAttribute('data-id'));
      const d = distanceToMission(m);
      el.textContent = Number.isFinite(d) ? `${Math.round(d)} м` : '— м';
    });
  }
  function distanceToMission(m){
    if(!currentPosition) return Infinity;
    return haversine(currentPosition[0], currentPosition[1], m.lat, m.lon);
  }
  function canStartQuiz(m){
    if(!currentPosition) return false;
    return distanceToMission(m) <= m.radiusMeters;
  }

  // Haversine (в метрах)
  function haversine(lat1, lon1, lat2, lon2){
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2-lat1);
    const dLon = toRad(lon2-lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R*c;
  }

  // ====== Вікторина ======
  let quizState = null; // { missionId, index, score }
  function startQuiz(m){
    if(!m) return;
    quizState = { missionId: m.id, index: 0, score: 0, total: m.quiz.length };
    quizTitle.textContent = `Вікторина: ${m.title}`;
    quizModal.hidden = false;
    renderQuizQuestion();
  }
  function renderQuizQuestion(){
    const m = MISSIONS.find(x=>x.id===quizState.missionId);
    const item = m.quiz[quizState.index];
    quizQuestion.textContent = `Питання ${quizState.index+1} із ${quizState.total}: ${item.q}`;
    quizForm.innerHTML = '';
    item.options.forEach((opt, i)=>{
      const id = `opt-${quizState.index}-${i}`;
      const wrap = document.createElement('label');
      wrap.className = 'quiz-option';
      wrap.setAttribute('for', id);
      wrap.innerHTML = `
        <input type="radio" name="quiz-opt" id="${id}" value="${i}">
        <span>${opt}</span>
      `;
      quizForm.appendChild(wrap);
    });
    quizNext.disabled = true;
  }
  quizForm.addEventListener('change', ()=> {
    quizNext.disabled = false;
  });

  quizNext.addEventListener('click', ()=>{
    const selected = quizForm.querySelector('input[name="quiz-opt"]:checked');
    if(!selected) return;
    const m = MISSIONS.find(x=>x.id===quizState.missionId);
    const item = m.quiz[quizState.index];
    const chosen = Number(selected.value);
    const correct = chosen === item.correctIndex;

    // показати фідбек
    selected.parentElement.style.borderColor = correct ? 'var(--good)' : 'var(--danger)';
    selected.parentElement.style.outline = `2px solid ${correct ? 'var(--good)' : 'var(--danger)'}`;
    if(!correct){
      // підсвітити правильний
      const correctInput = quizForm.querySelector(`input[value="${item.correctIndex}"]`);
      if(correctInput) correctInput.parentElement.style.borderColor = 'var(--good)';
    }

    quizState.score += correct ? 1 : 0;

    // невелика пауза та перехід далі
    setTimeout(()=>{
      quizState.index++;
      if(quizState.index < quizState.total){
        renderQuizQuestion();
      } else {
        finishQuiz();
      }
    }, 600);
  });

  function finishQuiz(){
    const m = MISSIONS.find(x=>x.id===quizState.missionId);
    const score = quizState.score;
    const total = quizState.total;
    quizModal.hidden = true;

    const success = score === total || score >= Math.ceil(total*0.7);
    if(success){
      unlockAchievement('mission-complete-' + m.id, `Місія «${m.title}»`, `Успішно пройдено вікторину (${score}/${total}).`);
      PROGRESS.done.add(m.id);
      PROGRESS.streak = (PROGRESS.streak || 0) + 1;
    } else {
      PROGRESS.streak = 0;
    }
    // базові бейджі
    const doneCount = PROGRESS.done.size;
    if(doneCount >= 1) unlockAchievement('badge-starter', 'Перший крок', 'Перша місія завершена!');
    if(doneCount >= 3) unlockAchievement('badge-explorer', 'Міський дослідник', 'Пройдено 3 місії.');
    if(PROGRESS.streak >= 3) unlockAchievement('badge-streak-3', 'Серія 3', '3 місії поспіль без провалів!');

    saveProgress();
    renderAchievements();
    renderMissionList();
    if(selectedMission) selectMission(selectedMission.id); // оновити деталь
    alert(`Результат: ${score}/${total}. ${success ? 'Ви впоралися! 🏆' : 'Спробуйте ще.'}`);
  }

  quizExit.addEventListener('click', ()=> { quizModal.hidden = true; });

  // ====== Досягнення та прогрес ======
  function loadProgress(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { done: new Set(), badges: new Set(), streak: 0 };
    try{
      const obj = JSON.parse(raw);
      return {
        done: new Set(obj.done || []),
        badges: new Set(obj.badges || []),
        streak: obj.streak || 0
      };
    } catch{
      return { done: new Set(), badges: new Set(), streak: 0 };
    }
  }
  function saveProgress(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      done: Array.from(PROGRESS.done),
      badges: Array.from(PROGRESS.badges),
      streak: PROGRESS.streak
    }));
  }
  function unlockAchievement(id, title, desc){
    if(PROGRESS.badges.has(id)) return;
    PROGRESS.badges.add(id);
    toast(`🎖️ Досягнення: ${title}`);
    saveProgress();
  }
  function renderAchievements(){
    achList.innerHTML = '';
    const badges = [
      ...Array.from(PROGRESS.done).map(id=>{
        const m = MISSIONS.find(x=>x.id===id);
        return { id:'mission-'+id, title: `Місія: ${m?.title || id}`, desc: 'Пройдено місію' };
      }),
      ...Array.from(PROGRESS.badges).map(id=>{
        const meta = BADGE_META[id] || { title:id, desc:'' };
        return { id, ...meta };
      })
    ];
    if(!badges.length){
      achList.innerHTML = `<li class="badge"><div class="title">Поки що порожньо</div><div class="desc">Завершуйте місії — значки зʼявляться тут.</div></li>`;
    } else {
      badges.forEach(b=>{
        const li = document.createElement('li');
        li.className = 'badge';
        li.innerHTML = `<div class="title">🎖️ ${b.title}</div><div class="desc">${b.desc}</div>`;
        achList.appendChild(li);
      });
    }
    statMissions.textContent = PROGRESS.done.size.toString();
    statStreak.textContent = PROGRESS.streak.toString();
  }
  const BADGE_META = {
    'badge-starter': { title: 'Перший крок', desc: 'Перша завершена місія' },
    'badge-explorer': { title: 'Міський дослідник', desc: '3 завершені місії' },
    'badge-streak-3': { title: 'Серія 3', desc: '3 місії поспіль' }
  };

  btnReset.addEventListener('click', ()=>{
    if(confirm('Скинути локальний прогрес?')) {
      localStorage.removeItem(STORAGE_KEY);
      PROGRESS.done = new Set();
      PROGRESS.badges = new Set();
      PROGRESS.streak = 0;
      renderAchievements();
      renderMissionList();
      toast('🔄 Прогрес скинуто');
    }
  });

  // ====== UX: тости ======
  let toastTimer = null;
  function toast(text){
    let el = document.getElementById('toast');
    if(!el){
      el = document.createElement('div');
      el.id = 'toast';
      Object.assign(el.style,{
        position:'fixed', left:'50%', bottom:'20px', transform:'translateX(-50%)',
        background:'rgba(0,0,0,.7)', color:'#fff', padding:'10px 14px',
        borderRadius:'10px', border:'1px solid rgba(255,255,255,.2)', zIndex:9999
      });
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{ el.style.opacity='0'; }, 1800);
  }

})();