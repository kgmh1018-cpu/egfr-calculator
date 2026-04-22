// ═══════════════════════════════════════════════════════════
// § STATE
// ═══════════════════════════════════════════════════════════

const state = {
  gender:    'male',
  age:       40,
  scr:       1.00,
  gfr:       90,
  activeCat: 'all',
  showSafe:  true,
  showImp:   false,
  updating:  false,
  catOpen:   {},
  drugOpen:  {},
};

CATS.forEach(c => { state.catOpen[c] = false; });

// ═══════════════════════════════════════════════════════════
// § CALC  (pure functions — no DOM access)
// ═══════════════════════════════════════════════════════════

function calcGFR(scr, age, gender) {
  const kappa   = gender === 'female' ? 0.7    : 0.9;
  const alpha   = gender === 'female' ? -0.241 : -0.302;
  const sexMult = gender === 'female' ? 1.012  : 1.0;
  const ratio   = scr / kappa;
  return 142 * Math.min(ratio, 1) ** alpha * Math.max(ratio, 1) ** (-1.2) * (0.9938 ** age) * sexMult;
}

function invertGFR(gfr, age, gender) {
  const kappa   = gender === 'female' ? 0.7    : 0.9;
  const alpha   = gender === 'female' ? -0.241 : -0.302;
  const sexMult = gender === 'female' ? 1.012  : 1.0;
  const C = gfr / (142 * (0.9938 ** age) * sexMult);
  const scr1 = kappa * Math.pow(C, 1 / alpha);
  const scr2 = kappa * Math.pow(C, -1 / 1.2);
  if (scr1 <= kappa && scr1 > 0) return scr1;
  if (scr2 > kappa  && scr2 > 0) return scr2;
  return scr1 > 0 ? scr1 : scr2;
}

function clampGFR(v) { return Math.min(130, Math.max(5,   v)); }
function clampSCR(v) { return Math.min(15.0, Math.max(0.3, v)); }

function getStage(gfr) {
  return STAGES.find(s => gfr >= s.min && gfr <= s.max) || STAGES[5];
}

function getRisk(drug, gfr) {
  if (drug.ci_at > 0 && gfr <= drug.ci_at) return 'ci';
  if (drug.ca_at > 0 && gfr <= drug.ca_at) return 'ca';
  return 'safe';
}

function getVisibleDrugs(cat, gfr) {
  return DRUGS.filter(d => {
    if (d.cat !== cat) return false;
    if (state.showImp && !d.imp) return false;
    if (!state.showSafe && getRisk(d, gfr) === 'safe') return false;
    return true;
  });
}

// ═══════════════════════════════════════════════════════════
// § SYNC  (state mutation + slider UI sync)
//   슬라이더 3개가 서로 연동되는 로직을 한 곳에서 관리
// ═══════════════════════════════════════════════════════════

function syncFromSCR(scr) {
  state.scr = clampSCR(+parseFloat(scr).toFixed(2));
  state.gfr = clampGFR(calcGFR(state.scr, state.age, state.gender));
  state.updating = true;
  document.getElementById('scr-val').textContent   = state.scr.toFixed(2);
  document.getElementById('egfr-slider').value     = Math.round(state.gfr);
  document.getElementById('egfr-val').textContent  = state.gfr.toFixed(1);
  state.updating = false;
}

function syncFromGFR(gfr) {
  state.gfr = clampGFR(+gfr);
  state.scr = clampSCR(+invertGFR(state.gfr, state.age, state.gender).toFixed(2));
  state.updating = true;
  document.getElementById('egfr-val').textContent  = state.gfr.toFixed(1);
  document.getElementById('scr-slider').value      = state.scr;
  document.getElementById('scr-val').textContent   = state.scr.toFixed(2);
  state.updating = false;
}

function syncFromAge(age) {
  state.age = +age;
  document.getElementById('age-val').textContent = state.age;
  state.gfr = clampGFR(calcGFR(state.scr, state.age, state.gender));
  state.updating = true;
  document.getElementById('egfr-slider').value    = Math.round(state.gfr);
  document.getElementById('egfr-val').textContent = state.gfr.toFixed(1);
  state.updating = false;
}

function syncFromStage(stage) {
  state.gfr = stage.rep;
  state.scr = clampSCR(+invertGFR(stage.rep, state.age, state.gender).toFixed(2));
  state.updating = true;
  document.getElementById('egfr-slider').value    = stage.rep;
  document.getElementById('egfr-val').textContent = state.gfr.toFixed(1);
  document.getElementById('scr-slider').value     = state.scr;
  document.getElementById('scr-val').textContent  = state.scr.toFixed(2);
  state.updating = false;
}

// ═══════════════════════════════════════════════════════════
// § DOM BUILDERS  (return Element, no side-effects)
// ═══════════════════════════════════════════════════════════

function buildDrugCard(drug, gfr) {
  const risk      = getRisk(drug, gfr);
  const riskLabel = risk === 'ci' ? '🔴 금기' : risk === 'ca' ? '🟡 주의' : '🟢 안전';
  const riskClass = risk === 'ci' ? 'risk-ci'  : risk === 'ca' ? 'risk-ca'  : 'risk-safe';
  const altsHtml  = drug.alts?.length
    ? `<div class="alt-drugs">
         <span class="alt-label">대체약물</span>
         ${drug.alts.map(a => `<span class="alt-tag">${a}</span>`).join('')}
       </div>`
    : '';

  const card = document.createElement('div');
  card.className = 'drug-card' + (state.drugOpen[drug.name] ? ' open' : '');
  card.innerHTML = `
    <div class="drug-card-header">
      <span class="risk-badge ${riskClass}">${riskLabel}</span>
      <span class="drug-name">${drug.name}</span>
      <span class="drug-threshold">${drug.threshold.replace(/\n/g, '<br>')}</span>
      <span class="drug-chevron">▼</span>
    </div>
    <div class="drug-card-body">
      <div class="drug-reason">${drug.reason}</div>
      ${altsHtml}
    </div>`;

  card.querySelector('.drug-card-header').addEventListener('click', () => {
    state.drugOpen[drug.name] = !state.drugOpen[drug.name];
    card.classList.toggle('open', state.drugOpen[drug.name]);
  });

  return card;
}

function buildCatAccordion(cat, gfr) {
  const visible = getVisibleDrugs(cat, gfr);
  if (visible.length === 0) return null;

  const allInCat = DRUGS.filter(d => d.cat === cat);
  const ciCount  = allInCat.filter(d => getRisk(d, gfr) === 'ci').length;
  const caCount  = allInCat.filter(d => getRisk(d, gfr) === 'ca').length;

  const acc = document.createElement('div');
  acc.className = 'cat-accordion' + (state.catOpen[cat] ? ' open' : '');

  const header = document.createElement('div');
  header.className = 'cat-header';
  header.innerHTML = `
    <span class="cat-name">${cat}</span>
    <span class="cat-counts">
      ${ciCount > 0 ? `<span class="cat-count-badge cat-count-ci">금기 ${ciCount}</span>` : ''}
      ${caCount > 0 ? `<span class="cat-count-badge cat-count-ca">주의 ${caCount}</span>` : ''}
    </span>
    <span class="cat-chevron">▼</span>`;
  header.addEventListener('click', () => {
    state.catOpen[cat] = !state.catOpen[cat];
    acc.classList.toggle('open', state.catOpen[cat]);
  });

  const body = document.createElement('div');
  body.className = 'cat-body';
  visible.forEach(drug => body.appendChild(buildDrugCard(drug, gfr)));

  acc.appendChild(header);
  acc.appendChild(body);
  return acc;
}

// ═══════════════════════════════════════════════════════════
// § RENDER  (read state → update DOM)
// ═══════════════════════════════════════════════════════════

function renderStageChips() {
  const container = document.getElementById('stage-chips');
  container.innerHTML = '';
  const current = getStage(state.gfr);
  STAGES.forEach(s => {
    const chip = document.createElement('button');
    chip.className = 'stage-chip' + (s.id === current.id ? ' active' : '');
    chip.innerHTML = `<span class="chip-label">${s.label}</span><span class="chip-range">${s.range}</span>`;
    if (s.id === current.id) {
      chip.style.background = s.color + '22';
      chip.style.color = s.color;
    }
    chip.addEventListener('click', () => { syncFromStage(s); render(); });
    container.appendChild(chip);
  });
}

function renderResult() {
  const stage = getStage(state.gfr);
  document.getElementById('result-gfr').textContent  = state.gfr.toFixed(1);
  document.getElementById('result-gfr').style.color  = stage.color;
  document.getElementById('result-desc').textContent = stage.desc;
  const badge = document.getElementById('result-badge');
  badge.textContent       = 'CKD ' + stage.id;
  badge.style.background  = stage.color + '18';
  badge.style.color       = stage.color;
  badge.style.border      = 'none';
  const box = document.getElementById('result-box');
  box.style.borderColor   = 'transparent';
  box.style.background    = stage.color + '12';
  document.getElementById('dialysis-warning').style.display = state.gfr < 15 ? 'block' : 'none';
}

function renderBadges() {
  let total = 0;
  CATS.forEach(cat => {
    const count = DRUGS
      .filter(d => d.cat === cat && (!state.showImp || d.imp))
      .filter(d => { const r = getRisk(d, state.gfr); return r === 'ci' || r === 'ca'; })
      .length;
    const el = document.getElementById('badge-' + cat);
    if (el) { el.textContent = count; el.className = 'tab-badge' + (count === 0 ? ' zero' : ''); }
    total += count;
  });
  const allBadge = document.getElementById('badge-all');
  if (allBadge) { allBadge.textContent = total; allBadge.className = 'tab-badge' + (total === 0 ? ' zero' : ''); }
}

const SWIPE_CATS = ['all', ...CATS];

function renderDrugList() {
  const container = document.getElementById('drug-list');
  container.innerHTML = '';

  if (isMobileOrTablet()) {
    container.classList.add('swipe-mode');
    SWIPE_CATS.forEach(cat => {
      const slide = document.createElement('div');
      slide.className = 'drug-slide';
      slide.dataset.cat = cat;
      if (cat === 'all') {
        CATS.forEach(c => {
          const acc = buildCatAccordion(c, state.gfr);
          if (acc) slide.appendChild(acc);
        });
      } else {
        state.catOpen[cat] = true;
        const acc = buildCatAccordion(cat, state.gfr);
        if (acc) slide.appendChild(acc);
      }
      if (slide.children.length === 0) {
        slide.innerHTML = '<div class="empty-state">현재 GFR에서 해당 계열 약물 위험 없음</div>';
      }
      container.appendChild(slide);
    });
    const idx = Math.max(0, SWIPE_CATS.indexOf(state.activeCat));
    requestAnimationFrame(() => { container.scrollLeft = idx * container.clientWidth; });
    setupSwipeSync(container);
  } else {
    container.classList.remove('swipe-mode');
    const catsToShow = state.activeCat === 'all' ? CATS : [state.activeCat];
    catsToShow.forEach(cat => {
      const acc = buildCatAccordion(cat, state.gfr);
      if (acc) container.appendChild(acc);
    });
    if (container.children.length === 0) {
      container.innerHTML = '<div class="empty-state">현재 GFR에서 해당 계열 약물 위험 없음</div>';
    }
  }
}

function updateTabIndicator(cat) {
  const indicator = document.getElementById('tab-indicator');
  const activeTab = document.querySelector(`.filter-tab[data-cat="${cat}"]`);
  if (!indicator || !activeTab) return;
  indicator.style.width     = activeTab.offsetWidth + 'px';
  indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
}

function setupSwipeSync(container) {
  if (container._swipeObserver) container._swipeObserver.disconnect();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.intersectionRatio < 0.5) return;
      const cat = entry.target.dataset.cat;
      if (cat === state.activeCat) return;
      state.activeCat = cat;
      document.querySelectorAll('.filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.cat === cat);
      });
      updateTabIndicator(cat);
      const activeTab = document.querySelector(`.filter-tab[data-cat="${cat}"]`);
      if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
  }, { root: container, threshold: 0.5 });
  container._swipeObserver = observer;
  container.querySelectorAll('.drug-slide').forEach(s => observer.observe(s));
}

function render() {
  renderStageChips();
  renderResult();
  renderBadges();
  renderDrugList();
  renderMobileChips();
  updateDrugAlert();
  updateTabIndicator(state.activeCat);
}

// ═══════════════════════════════════════════════════════════
// § MOBILE
// ═══════════════════════════════════════════════════════════

function isMobile() { return window.innerWidth <= 640; }
function isMobileOrTablet() { return window.innerWidth <= 1024; }

function repositionControls() {
  const tc  = document.getElementById('topbar-controls');
  const fb  = document.getElementById('filter-bar');
  const ids = ['expand-all-btn', 'show-imp-wrap', 'show-safe-wrap'];
  const dest = isMobileOrTablet() && !isMobile() ? tc : fb;
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement !== dest) dest.appendChild(el);
  });
  tc.style.display = (isMobileOrTablet() && !isMobile()) ? 'flex' : 'none';
}

function switchTab(tab) {
  const left     = document.getElementById('left-panel');
  const right    = document.getElementById('right-panel');
  const btnInput = document.getElementById('mob-tab-input');
  const btnDrugs = document.getElementById('mob-tab-drugs');
  const isInput  = tab === 'input';
  left.classList.toggle('mob-active',  isInput);
  right.classList.toggle('mob-active', !isInput);
  btnInput.classList.toggle('active',  isInput);
  btnDrugs.classList.toggle('active',  !isInput);
  document.body.classList.toggle('mob-drugs', !isInput);
  (isInput ? left : right).scrollTop = 0;
}

function renderMobileChips() {
  const container = document.getElementById('mobile-stage-chips');
  if (!container || !isMobile()) { if (container) container.innerHTML = ''; return; }
  container.innerHTML = '';
  const current = getStage(state.gfr);
  STAGES.forEach(s => {
    const chip = document.createElement('button');
    chip.className = 'stage-chip-sm' + (s.id === current.id ? ' active' : '');
    chip.textContent = s.label + ' ' + s.range;
    if (s.id === current.id) {
      chip.style.borderColor = s.color;
      chip.style.background  = s.color + '22';
      chip.style.color       = s.color;
    }
    chip.addEventListener('click', () => { syncFromStage(s); render(); });
    container.appendChild(chip);
  });
}

function updateDrugAlert() {
  const hasDanger = DRUGS.some(d => { const r = getRisk(d, state.gfr); return r === 'ci' || r === 'ca'; });
  const indicator = document.getElementById('mob-drug-indicator');
  const btn       = document.getElementById('mob-tab-drugs');
  if (indicator) indicator.style.display = hasDanger ? 'block' : 'none';
  if (btn) btn.classList.toggle('has-alert', hasDanger);
}

// ═══════════════════════════════════════════════════════════
// § EVENTS
// ═══════════════════════════════════════════════════════════

document.getElementById('age-slider').addEventListener('input', e => {
  if (state.updating) return;
  syncFromAge(e.target.value);
  render();
});

document.getElementById('scr-slider').addEventListener('input', e => {
  if (state.updating) return;
  syncFromSCR(e.target.value);
  render();
});

document.getElementById('egfr-slider').addEventListener('input', e => {
  if (state.updating) return;
  syncFromGFR(e.target.value);
  render();
});

document.querySelectorAll('.gender-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.gender = btn.dataset.g;
    document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.gfr = clampGFR(calcGFR(state.scr, state.age, state.gender));
    state.updating = true;
    document.getElementById('egfr-slider').value    = Math.round(state.gfr);
    document.getElementById('egfr-val').textContent = state.gfr.toFixed(1);
    state.updating = false;
    render();
  });
});

document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    state.activeCat = tab.dataset.cat;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const container = document.getElementById('drug-list');
    if (isMobileOrTablet() && container.classList.contains('swipe-mode')) {
      const idx = Math.max(0, SWIPE_CATS.indexOf(state.activeCat));
      container.scrollTo({ left: idx * container.clientWidth, behavior: 'smooth' });
      updateTabIndicator(state.activeCat);
    } else {
      renderDrugList();
    }
  });
});

document.getElementById('show-safe-wrap').addEventListener('click', () => {
  state.showSafe = !state.showSafe;
  document.getElementById('show-safe-wrap').classList.toggle('active', state.showSafe);
  renderDrugList();
});

document.getElementById('show-imp-wrap').addEventListener('click', () => {
  state.showImp = !state.showImp;
  document.getElementById('show-imp-wrap').classList.toggle('active', state.showImp);
  renderBadges();
  renderDrugList();
});

const expandBtn = document.getElementById('expand-all-btn');
let allExpanded = false;
expandBtn.addEventListener('click', () => {
  allExpanded = !allExpanded;
  CATS.forEach(c  => { state.catOpen[c]    = allExpanded; });
  DRUGS.forEach(d => { state.drugOpen[d.name] = allExpanded; });
  expandBtn.textContent = allExpanded ? '접기 ▲' : '펼치기 ▼';
  renderDrugList();
});

let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    const left  = document.getElementById('left-panel');
    const right = document.getElementById('right-panel');
    if (!isMobile()) {
      left.classList.remove('mob-active');
      right.classList.remove('mob-active');
    } else if (!left.classList.contains('mob-active') && !right.classList.contains('mob-active')) {
      switchTab('input');
    }
    repositionControls();
    renderMobileChips();
    renderDrugList();
  }, 150);
});

// ═══════════════════════════════════════════════════════════
// § INIT
// ═══════════════════════════════════════════════════════════

state.gfr = clampGFR(calcGFR(state.scr, state.age, state.gender));
document.getElementById('egfr-slider').value    = Math.round(state.gfr);
document.getElementById('egfr-val').textContent = state.gfr.toFixed(1);
document.getElementById('scr-val').textContent  = state.scr.toFixed(2);

if (isMobile()) switchTab('input');
repositionControls();

render();
updateTabIndicator(state.activeCat);