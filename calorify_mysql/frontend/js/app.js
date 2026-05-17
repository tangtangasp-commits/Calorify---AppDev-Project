/* ============================================================
   CALORIFY! — frontend logic
   ============================================================ */

const API_BASE = "http://localhost:5000/api";

let state = {
  user:            null,
  targets:         {},
  meals:           [],
  weekData:        [],
  historyDays:     [],
  historyDate:     null,
  historyMeals:    [],
  recommendations: { tips: [], plan: [], top_foods: [] },
  weeklySummary:   null,
  monthlySummary:  null,
  selectedFood:    null,
  currentMetric:   "calories",
  currentMealType: "Breakfast",
  manualMealType:  "Breakfast",
  searchTimer:     null,
  logMode:         "search",
  summaryView:     "weekly",
  logDate:         null,   // date being logged for (YYYY-MM-DD), null = today
};

const $ = id => document.getElementById(id);

// Always returns the LOCAL date string (YYYY-MM-DD), not UTC
function getLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDateLabel(dateStr) {
  const today = getLocalDate();
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return getLocalDateFrom(d); })();
  if (dateStr === today)     return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en", { weekday:"short", month:"short", day:"numeric" });
}

function getLocalDateFrom(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function api(path, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(API_BASE + path, opts);
    if (!res.ok) { const e = await res.json().catch(()=>({})); return { error: e.error || `Error ${res.status}` }; }
    return res.json();
  } catch (e) {
    return { error: "Cannot reach server. Is the backend running?" };
  }
}

function showScreen(name) {
  ["auth-screen","app-screen"].forEach(s => { $(s).classList.add("hidden"); $(s).classList.remove("active"); });
  $(name).classList.remove("hidden"); $(name).classList.add("active");
}

// ─── Auth ─────────────────────────────────────────────────
function showTab(tab) {
  $("login-form").classList.toggle("hidden", tab !== "login");
  $("register-form").classList.toggle("hidden", tab !== "register");
  document.querySelectorAll(".tab-btn").forEach((b,i) => b.classList.toggle("active",(i===0)===(tab==="login")));
}
function selectGoal(btn) {
  document.querySelectorAll(".goal-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}
function getSelectedGoal() { return document.querySelector(".goal-btn.active")?.dataset.goal || "maintain"; }

async function register() {
  const payload = {
    name:$("reg-name").value.trim(), email:$("reg-email").value.trim(), password:$("reg-password").value,
    age:+$("reg-age").value, weight_kg:+$("reg-weight").value, height_cm:+$("reg-height").value,
    sex:$("reg-sex").value, activity:$("reg-activity").value, goal:getSelectedGoal(),
  };
  const data = await api("/register","POST",payload);
  if (data.error) { showAuthError(data.error); return; }
  $("login-email").value = payload.email; $("login-password").value = payload.password;
  await login();
}

async function login() {
  const data = await api("/login","POST",{ email:$("login-email").value.trim(), password:$("login-password").value });
  if (data.error) { showAuthError(data.error); return; }
  state.user = data.user;
  const tData = await api(`/targets/${state.user.id}`);
  state.targets = tData || {};
  await refreshAllData();
  renderDashboard(); renderProfile();
  showScreen("app-screen");
}

function logout() {
  state = { user:null, targets:{}, meals:[], weekData:[], historyDays:[], historyDate:null,
    historyMeals:[], recommendations:{tips:[],plan:[],top_foods:[]}, weeklySummary:null, monthlySummary:null,
    selectedFood:null, currentMetric:"calories", currentMealType:"Breakfast", manualMealType:"Breakfast",
    searchTimer:null, logMode:"search", summaryView:"weekly" };
  showScreen("auth-screen");
}

function showAuthError(msg) { const el=$("auth-error"); el.textContent=msg; el.classList.remove("hidden"); }

// ─── Navigation ───────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll(".page").forEach(p => { p.classList.remove("active"); p.classList.add("hidden"); });
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  $(`page-${page}`).classList.remove("hidden"); $(`page-${page}`).classList.add("active");
  const pages = ["dashboard","log","history","analytics","profile"];
  document.querySelectorAll(".nav-btn")[pages.indexOf(page)]?.classList.add("active");
  if (page === "history")   renderHistoryPage();
  if (page === "analytics") renderAnalyticsPage();
  if (page === "log")       initLogDate();
}

function setLogMode(mode) {
  state.logMode = mode;
  $("log-mode-search").classList.toggle("hidden", mode !== "search");
  $("log-mode-manual").classList.toggle("hidden", mode !== "manual");
  $("mode-search-btn").classList.toggle("active", mode === "search");
  $("mode-manual-btn").classList.toggle("active", mode === "manual");
}

// ─── Log Date ─────────────────────────────────────────────
function initLogDate() {
  const today = getLocalDate();
  state.logDate = today;
  $("log-date-picker").max   = today;
  $("log-date-picker").value = today;
  updateLogDateDisplay();
}

function updateLogDateDisplay() {
  const today = getLocalDate();
  const d     = state.logDate || today;
  $("log-date-picker").value  = d;
  $("log-date-display").textContent = fmtDateLabel(d);
  // Dim the "Today" button when already on today
  const btn = document.querySelector(".log-date-today");
  if (btn) btn.style.opacity = d === today ? "0.4" : "1";
}

function onLogDateChange(val) {
  if (!val) return;
  state.logDate = val;
  updateLogDateDisplay();
}

function shiftLogDate(delta) {
  const d    = new Date((state.logDate || getLocalDate()) + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const next = getLocalDateFrom(d);
  if (next > getLocalDate()) return;   // can't log into the future
  state.logDate = next;
  $("log-date-picker").value = next;
  updateLogDateDisplay();
}

function resetLogDateToToday() {
  state.logDate = getLocalDate();
  $("log-date-picker").value = state.logDate;
  updateLogDateDisplay();
}

// ─── Data ─────────────────────────────────────────────────
async function refreshAllData() {
  const today = getLocalDate();
  const [meals, week, hist, weekly, monthly] = await Promise.all([
    api(`/meals/user/${state.user.id}?date=${today}`),
    api(`/analytics/${state.user.id}`),
    api(`/history/${state.user.id}`),
    api(`/summary/weekly/${state.user.id}`),
    api(`/summary/monthly/${state.user.id}`),
  ]);
  state.meals          = Array.isArray(meals) ? meals : [];
  state.weekData       = Array.isArray(week)  ? week  : [];
  state.historyDays    = Array.isArray(hist)  ? hist  : [];
  state.weeklySummary  = weekly.stats  ? weekly  : null;
  state.monthlySummary = monthly.stats ? monthly : null;
  // Recommendations load separately so they don't delay the dashboard
  loadRecommendations();
}

async function loadRecommendations() {
  try {
    const recs = await api(`/recommendations/${state.user.id}`);
    state.recommendations = (recs && recs.tips) ? recs : { tips: [], plan: [], top_foods: [] };
  } catch (e) {
    state.recommendations = { tips: [], plan: [], top_foods: [] };
  }
  renderRecommendations();
}

// ─── Dashboard ────────────────────────────────────────────
function renderDashboard() {
  $("dash-name").textContent = state.user?.name || "—";
  const t = state.targets;

  const totals = state.meals.reduce((a,m) => ({
    cal:   a.cal   + +m.calories,
    pro:   a.pro   + +m.protein_g,
    carbs: a.carbs + +(m.carbs_g  || 0),
    fat:   a.fat   + +(m.fat_g    || 0),
    fib:   a.fib   + +m.fiber_g,
  }), { cal:0, pro:0, carbs:0, fat:0, fib:0 });

  const calMin = t.cal_min || 1800, calMax = t.cal_max || 2200;
  const pct    = Math.min(100, Math.round(totals.cal / calMax * 100));

  const circle = $("ring-circle");
  circle.style.strokeDashoffset = 301.6 - (pct / 100) * 301.6;
  // Color ring: green in range, yellow under min, red over max
  circle.style.stroke = totals.cal > calMax ? "var(--red)" : totals.cal >= calMin ? "var(--green)" : "var(--yellow)";
  $("ring-pct").textContent = pct + "%";
  $("dash-cal-consumed").textContent  = Math.round(totals.cal);
  $("dash-cal-range").textContent     = `${calMin}–${calMax} kcal target`;
  $("dash-cal-remaining").textContent = totals.cal > calMax
    ? `${Math.round(totals.cal - calMax)} kcal over limit`
    : totals.cal < calMin
    ? `${Math.round(calMin - totals.cal)} kcal below minimum`
    : `${Math.round(calMax - totals.cal)} kcal remaining`;

  // Progress bars: show min line + fill
  renderMacroBar("prog-cal",   totals.cal,   t.cal_min||0,   t.cal_max||2200,  "accent-fill",  `${Math.round(totals.cal)} kcal`,   `${t.cal_min||0}–${t.cal_max||2200} kcal`,  "prog-cal-label");
  renderMacroBar("prog-pro",   totals.pro,   t.protein_min_g||0, t.protein_max_g||150, "green-fill",  `${Math.round(totals.pro)}g`,  `${t.protein_min_g||0}–${t.protein_max_g||150}g`, "prog-pro-label");
  renderMacroBar("prog-carbs", totals.carbs, t.carbs_min_g||0,   t.carbs_max_g||300,   "yellow-fill", `${Math.round(totals.carbs)}g`, `${t.carbs_min_g||0}–${t.carbs_max_g||300}g`,   "prog-carbs-label");
  renderMacroBar("prog-fat",   totals.fat,   t.fat_min_g||0,     t.fat_max_g||100,     "orange-fill", `${Math.round(totals.fat)}g`,  `${t.fat_min_g||0}–${t.fat_max_g||100}g`,     "prog-fat-label");
  renderMacroBar("prog-fib",   totals.fib,   t.fiber_min_g||25,  t.fiber_max_g||40,    "purple-fill", `${Math.round(totals.fib)}g`,  `${t.fiber_min_g||25}–${t.fiber_max_g||40}g`,  "prog-fib-label");

  renderRecommendations();
}

function renderMacroBar(barId, value, min, max, colorClass, valueText, rangeText, labelId) {
  const el  = $(barId);
  const pct = Math.min(100, Math.round(value / (max || 1) * 100));
  el.style.width = pct + "%";
  // Red if over max, yellow if under min, normal color if in range
  el.className = "progress-fill " + (value > max ? "red-fill" : value < min && value > 0 ? "yellow-fill" : colorClass);
  // Min marker position
  const minEl = $(`${barId}-min`);
  if (minEl) minEl.style.left = Math.round(min / (max || 1) * 100) + "%";
  if ($(labelId)) $(labelId).innerHTML = `<span>${valueText}</span><span class="muted">${rangeText}</span>`;
}

function renderRecommendations() {
  const { tips, plan, top_foods } = state.recommendations;
  const colorMap = { success:"var(--green)", warning:"var(--yellow)", danger:"var(--red)", info:"var(--accent)" };
  let html = `<div class="section-label">Smart Recommendations</div>`;

  if (!tips.length && !plan.length) {
    html += `<div class="rec-loading">
      <div class="rec-spinner"></div>
      <span class="muted small">Analysing your profile…</span>
    </div>`;
  } else {
    html += tips.map(tip => {
      const c = colorMap[tip.type] || "var(--accent)";
      return `<div class="rec-item" style="background:${c}18;border:1px solid ${c}40;color:${c}"><span>${tip.icon}</span><span>${tip.text}</span></div>`;
    }).join("");
  }

  if (plan.length) {
    html += `<div class="section-label" style="margin-top:16px">🍽️ Today's Meal Plan</div>`;
    plan.forEach(p => {
      html += `
        <div class="rec-meal-card">
          <div class="rec-meal-title">${p.meal}</div>
          <div class="rec-meal-items">
            ${p.items.map(i => `
              <div class="rec-meal-item">
                <span class="rec-meal-dot">▸</span>
                <span>${i}</span>
              </div>`).join("")}
          </div>
          ${p.note ? `<div class="rec-meal-note">${p.note}</div>` : ""}
        </div>`;
    });
  }

  if (top_foods.length) {
    html += `<div class="section-label" style="margin-top:16px">🔁 Most Eaten This Week</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">
        ${top_foods.map(f=>`<span class="top-food-chip">${f.food_name} <span class="muted">×${f.freq}</span></span>`).join("")}
      </div>`;
  }

  $("recommendations").innerHTML = html;
}

// ─── Food Search ──────────────────────────────────────────
function onFoodSearch(val) {
  clearTimeout(state.searchTimer);
  $("food-results").classList.add("hidden"); $("food-results").innerHTML = "";
  if (val.length < 2) { $("search-status").textContent = ""; return; }
  $("search-status").textContent = "Searching...";
  state.searchTimer = setTimeout(async () => {
    const foods = await api(`/foods/search?q=${encodeURIComponent(val)}`);
    if (!Array.isArray(foods) || !foods.length) { $("search-status").textContent = "No results — try entering manually."; return; }
    $("search-status").textContent = "";
    $("food-results").innerHTML = foods.map((f,i) => `
      <div class="food-result-item" onclick="selectFood(${i})">
        <span>${f.name}</span>
        <span class="accent" style="font-weight:600">${f.calories_per100} kcal<span class="muted" style="font-weight:400"> /100g</span></span>
      </div>`).join("");
    $("food-results").classList.remove("hidden");
    state._searchResults = foods;
  }, 500);
}

function selectFood(i) {
  state.selectedFood = state._searchResults[i];
  $("food-results").classList.add("hidden"); $("food-selected").classList.remove("hidden");
  $("selected-name").textContent = state.selectedFood.name;
  $("portion-grams").value = 100; updateCalc();
}

function clearSelection() {
  state.selectedFood = null; $("food-selected").classList.add("hidden");
  $("food-search").value = ""; $("search-status").textContent = "";
}

function updateCalc() {
  const f = state.selectedFood; if (!f) return;
  const g = +$("portion-grams").value || 0;
  $("calc-cal").textContent   = Math.round(f.calories_per100 * g / 100);
  $("calc-pro").textContent   = (f.protein_per100 * g / 100).toFixed(1);
  $("calc-carbs").textContent = ((f.carbs_per100 || 0) * g / 100).toFixed(1);
  $("calc-fat").textContent   = ((f.fat_per100   || 0) * g / 100).toFixed(1);
  $("calc-fib").textContent   = (f.fiber_per100  * g / 100).toFixed(1);
}

async function logMeal() {
  const f = state.selectedFood; if (!f) { alert("Select a food first."); return; }
  const g = +$("portion-grams").value;
  if (!g || g <= 0) { alert("Enter a valid portion size."); return; }
  const logDate = state.logDate || getLocalDate();
  const res = await api("/meals","POST",{
    user_id:state.user.id, food_name:f.name, meal_type:state.currentMealType, grams:g,
    log_date: logDate,
    calories: Math.round(f.calories_per100 * g / 100),
    protein:  +(f.protein_per100 * g / 100).toFixed(1),
    carbs:    +((f.carbs_per100||0) * g / 100).toFixed(1),
    fat:      +((f.fat_per100||0)   * g / 100).toFixed(1),
    fiber:    +(f.fiber_per100  * g / 100).toFixed(1),
  });
  if (res.error) { alert("Failed: " + res.error); return; }
  await refreshAllData(); renderDashboard(); clearSelection();
  // Switch history to the logged date so user sees it immediately
  state.historyDate = logDate;
  navigate("history");
}

async function logMealManual() {
  const name = $("manual-name").value.trim(); const grams = +$("manual-grams").value;
  const errEl = $("manual-error"); errEl.classList.add("hidden");
  if (!name)  { errEl.textContent = "Enter a food name."; errEl.classList.remove("hidden"); return; }
  if (!grams || grams <= 0) { errEl.textContent = "Enter a valid portion size."; errEl.classList.remove("hidden"); return; }
  const logDate = state.logDate || getLocalDate();
  const res = await api("/meals","POST",{
    user_id:state.user.id, food_name:name, meal_type:state.manualMealType, grams,
    log_date: logDate,
    calories:+$("manual-cal").value||0, protein:+$("manual-pro").value||0,
    carbs:+$("manual-carbs").value||0, fat:+$("manual-fat").value||0, fiber:+$("manual-fib").value||0,
  });
  if (res.error) { errEl.textContent = "Failed: " + res.error; errEl.classList.remove("hidden"); return; }
  ["manual-name","manual-grams","manual-cal","manual-pro","manual-carbs","manual-fat","manual-fib"].forEach(id => $(id).value = "");
  await refreshAllData(); renderDashboard();
  state.historyDate = logDate;
  navigate("history");
}

// ─── History ──────────────────────────────────────────────
async function renderHistoryPage() {
  // Always sync today fresh on every visit
  const today = getLocalDate();
  const freshMeals = await api(`/meals/user/${state.user.id}?date=${today}`);
  state.meals = Array.isArray(freshMeals) ? freshMeals : [];
  // Also refresh history days list
  const hist = await api(`/history/${state.user.id}`);
  state.historyDays = Array.isArray(hist) ? hist : [];
  // Default to today
  if (!state.historyDate) state.historyDate = today;
  if (state.historyDate === today) state.historyMeals = state.meals;
  renderHistoryDateList(); renderHistoryMealList();
}

function renderHistoryDateList() {
  const today = getLocalDate();
  if (!state.customDates) state.customDates = [];
  const allDates = [...new Set([today, ...state.historyDays.map(d => d.day), ...state.customDates])];
  allDates.sort((a, b) => b.localeCompare(a));

  const items = allDates.map(day => {
    const info   = state.historyDays.find(d => d.day === day);
    const label  = day === today ? "Today" : new Date(day+"T00:00:00").toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"});
    const active = day === state.historyDate ? "history-date-active" : "";
    return `<div class="history-date-item ${active}" onclick="switchHistoryDate('${day}')">
      <span style="font-weight:600">${label}</span>
      ${info ? `<span class="muted small">${Math.round(info.calories)} kcal · ${info.meal_count} meals</span>` : `<span class="muted small">No meals</span>`}
    </div>`;
  }).join("");

  $("history-date-list").innerHTML = items + `
    <div style="display:flex;gap:8px;margin-top:10px;align-items:center">
      <input type="date" id="custom-date-picker" max="${today}"
        style="flex:1;background:var(--input-bg);border:1px solid #334155;border-radius:8px;padding:7px 10px;color:var(--text);font-size:13px;outline:none" />
      <button onclick="addCustomDate()"
        style="padding:7px 16px;border-radius:8px;border:none;background:var(--accent);color:var(--bg);font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">
        Browse →
      </button>
    </div>`;
}

function addCustomDate() {
  const val = $("custom-date-picker")?.value;
  if (!val) return;
  if (!state.customDates) state.customDates = [];
  if (!state.customDates.includes(val)) state.customDates.push(val);
  switchHistoryDate(val);
}

async function switchHistoryDate(date) {
  const today = getLocalDate();
  state.historyDate  = date;
  if (date === today) {
    // Re-fetch today fresh
    const fresh = await api(`/meals/user/${state.user.id}?date=${today}`);
    state.meals = Array.isArray(fresh) ? fresh : [];
    state.historyMeals = state.meals;
  } else {
    const data = await api(`/meals/user/${state.user.id}?date=${date}`);
    state.historyMeals = Array.isArray(data) ? data : [];
  }
  renderHistoryDateList(); renderHistoryMealList();
}

function renderHistoryMealList() {
  const meals = state.historyMeals;
  const list  = $("meal-history-list"); const totalsBar = $("meal-totals");
  const isToday = state.historyDate === getLocalDate();
  const dateLabel = isToday ? "Today" : new Date(state.historyDate+"T00:00:00").toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric"});
  $("history-date-label").textContent = dateLabel;

  if (!meals.length) { list.innerHTML = `<p class="muted centered" style="padding:24px">No meals logged for this day.</p>`; totalsBar.classList.add("hidden"); return; }

  const ICONS = { Breakfast:"🌅", Lunch:"☀️", Dinner:"🌙", Snack:"🍎" };
  const grouped = {};
  meals.forEach(m => { if (!grouped[m.meal_type]) grouped[m.meal_type]=[]; grouped[m.meal_type].push(m); });

  list.innerHTML = Object.entries(grouped).map(([type, items]) => `
    <div class="meal-section-label">${ICONS[type]||"🍽"} ${type}</div>
    ${items.map(m => `
      <div class="meal-entry">
        <div>
          <div class="meal-entry-name">${m.food_name} (${m.grams}g)</div>
          <div class="meal-entry-macros">
            <span class="accent">${Math.round(m.calories)} kcal</span> ·
            <span class="green">${m.protein_g}g pro</span> ·
            <span class="yellow">${m.carbs_g||0}g carbs</span> ·
            <span class="orange">${m.fat_g||0}g fat</span> ·
            <span class="purple">${m.fiber_g}g fiber</span>
          </div>
        </div>
        <div class="meal-entry-right">
          ${isToday ? `<button class="delete-btn" onclick="deleteMeal(${m.id})">×</button>` : ""}
        </div>
      </div>`).join("")}
    <div class="muted small" style="text-align:right;margin-bottom:8px">Subtotal: ${items.reduce((a,x)=>a+ +x.calories,0).toFixed(0)} kcal</div>
  `).join("");

  const totals = meals.reduce((a,m) => ({
    cal:a.cal+ +m.calories, pro:a.pro+ +m.protein_g, carbs:a.carbs+ +(m.carbs_g||0),
    fat:a.fat+ +(m.fat_g||0), fib:a.fib+ +m.fiber_g
  }), {cal:0,pro:0,carbs:0,fat:0,fib:0});

  totalsBar.classList.remove("hidden");
  totalsBar.innerHTML = `
    <span style="font-weight:700">Total</span>
    <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:13px">
      <span class="accent" style="font-weight:700">${Math.round(totals.cal)} kcal</span>
      <span class="green">${totals.pro.toFixed(1)}g pro</span>
      <span class="yellow">${totals.carbs.toFixed(1)}g carbs</span>
      <span class="orange">${totals.fat.toFixed(1)}g fat</span>
      <span class="purple">${totals.fib.toFixed(1)}g fiber</span>
    </div>`;
}

async function deleteMeal(id) {
  await api(`/meals/${id}`,"DELETE");
  await refreshAllData(); renderDashboard();
  state.historyMeals = state.meals; renderHistoryMealList(); renderHistoryDateList();
}

// ─── Analytics & Summaries ────────────────────────────────
function renderAnalyticsPage() {
  renderAnalytics();
  renderSummary(state.summaryView);
}

function renderAnalytics() {
  const data = state.weekData;
  if (!data.length) {
    $("bar-chart").innerHTML = `<p class="muted centered" style="padding:32px;width:100%">No data yet. Log some meals!</p>`;
    $("avg-cal").textContent = "—"; $("avg-pro").textContent = "—"; return;
  }
  const metric = state.currentMetric;
  const COLORS = { calories:"var(--accent)", protein:"var(--green)", carbs:"var(--yellow)", fat:"var(--orange,#fb923c)", fiber:"var(--purple,#a78bfa)" };
  const max    = Math.max(...data.map(d => +d[metric]||0)) || 1;
  $("bar-chart").innerHTML = data.map(d => {
    const val = Math.round(+d[metric]||0);
    const h   = Math.round((val/max)*120);
    const day = d.day ? new Date(d.day+"T00:00:00").toLocaleDateString("en",{weekday:"short"}) : "—";
    return `<div class="bar-col">
      <div class="bar-val">${val}</div>
      <div class="bar" style="height:${h}px;background:${COLORS[metric]}"></div>
      <div class="bar-label">${day}</div>
    </div>`;
  }).join("");
  $("avg-cal").textContent = Math.round(data.reduce((a,d)=>a+ +d.calories,0)/data.length);
  $("avg-pro").textContent = Math.round(data.reduce((a,d)=>a+ +d.protein,0)/data.length)+"g";
}

function switchMetric(metric, btn) {
  state.currentMetric = metric;
  document.querySelectorAll(".metric-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active"); renderAnalytics();
}

function setSummaryView(view, btn) {
  state.summaryView = view;
  document.querySelectorAll(".summary-tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active"); renderSummary(view);
}

function renderSummary(view) {
  const summary = view === "weekly" ? state.weeklySummary : state.monthlySummary;
  const el = $("summary-content");
  if (!summary || !summary.stats) {
    el.innerHTML = `<p class="muted centered" style="padding:24px">No ${view} data yet. Keep logging meals!</p>`;
    return;
  }
  const s  = summary.stats;
  const t  = state.targets;

  const trendColor = s.trend === "improving" ? "var(--green)" : s.trend === "stable" ? "var(--accent)" : "var(--yellow)";
  const hitColor   = s.hit_rate >= 70 ? "var(--green)" : s.hit_rate >= 40 ? "var(--yellow)" : "var(--red)";

  el.innerHTML = `
    <!-- Key stats row -->
    <div class="summary-stats-grid">
      <div class="summary-stat">
        <div class="summary-stat-val" style="color:${hitColor}">${s.hit_rate}%</div>
        <div class="summary-stat-label">Goal Hit Rate</div>
        <div class="muted small">${s.hit_days} / ${s.logged_days} days on target</div>
      </div>
      <div class="summary-stat">
        <div class="summary-stat-val accent">${s.avg_cal}</div>
        <div class="summary-stat-label">Avg Calories/Day</div>
        <div class="muted small">Target: ${s.cal_target} kcal</div>
      </div>
      <div class="summary-stat">
        <div class="summary-stat-val" style="color:${trendColor}">${s.trend}</div>
        <div class="summary-stat-label">Trend</div>
        <div class="muted small">vs first half of period</div>
      </div>
    </div>

    <!-- Macro averages -->
    <div class="section-label" style="margin-top:16px">Daily Averages</div>
    <div class="summary-macros">
      <div class="summary-macro-item"><span class="accent" style="font-weight:700">${s.avg_cal} kcal</span><small>Calories</small></div>
      <div class="summary-macro-item"><span class="green"  style="font-weight:700">${s.avg_protein}g</span><small>Protein</small></div>
      <div class="summary-macro-item"><span class="yellow" style="font-weight:700">${s.avg_carbs}g</span><small>Carbs</small></div>
      <div class="summary-macro-item"><span style="color:var(--orange,#fb923c);font-weight:700">${s.avg_fat}g</span><small>Fat</small></div>
      <div class="summary-macro-item"><span style="color:var(--purple,#a78bfa);font-weight:700">${s.avg_fiber}g</span><small>Fiber</small></div>
    </div>

    <!-- Day breakdown -->
    <div class="section-label" style="margin-top:16px">Day Breakdown</div>
    <div class="summary-day-breakdown">
      <div class="summary-day-item" style="border-color:var(--green)40;background:var(--green)10">
        <div style="font-size:22px;font-weight:800;color:var(--green)">${s.hit_days}</div>
        <div class="muted small">On target days</div>
      </div>
      <div class="summary-day-item" style="border-color:var(--red)40;background:var(--red)10">
        <div style="font-size:22px;font-weight:800;color:var(--red)">${s.over_days}</div>
        <div class="muted small">Over limit days</div>
      </div>
      <div class="summary-day-item" style="border-color:var(--yellow)40;background:var(--yellow)10">
        <div style="font-size:22px;font-weight:800;color:var(--yellow)">${s.under_days}</div>
        <div class="muted small">Under minimum days</div>
      </div>
      <div class="summary-day-item" style="border-color:var(--border)">
        <div style="font-size:22px;font-weight:800">${s.logged_days}</div>
        <div class="muted small">Total logged days</div>
      </div>
    </div>

    <!-- Best / Worst -->
    <div class="section-label" style="margin-top:16px">Highlights</div>
    <div class="grid-2">
      <div style="background:var(--green)10;border:1px solid var(--green)30;border-radius:10px;padding:12px">
        <div class="muted small">🏆 Best day</div>
        <div style="font-weight:700">${new Date(s.best_day.day+"T00:00:00").toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"})}</div>
        <div class="green" style="font-weight:600">${s.best_day.calories} kcal</div>
      </div>
      <div style="background:var(--yellow)10;border:1px solid var(--yellow)30;border-radius:10px;padding:12px">
        <div class="muted small">⚠️ Lowest day</div>
        <div style="font-weight:700">${new Date(s.worst_day.day+"T00:00:00").toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"})}</div>
        <div class="yellow" style="font-weight:600">${s.worst_day.calories} kcal</div>
      </div>
    </div>

    <!-- Protein target hit rate -->
    <div class="section-label" style="margin-top:16px">Protein Target</div>
    <div class="rec-item" style="background:var(--green)15;border:1px solid var(--green)40;color:var(--green)">
      <span>💪</span>Daily protein target: ${s.protein_target} — avg ${s.avg_protein}g/day
    </div>
  `;
}

// ─── Profile ──────────────────────────────────────────────
function renderProfile() {
  const u = state.user, t = state.targets;
  if (!u) return;
  $("profile-details").innerHTML = [
    ["Name",u.name],["Age",u.age+" years"],["Weight",u.weight_kg+" kg"],
    ["Height",u.height_cm+" cm"],["Sex",u.sex],["Activity",u.activity],["Goal",u.goal]
  ].map(([k,v])=>`<div class="profile-row"><span class="muted">${k}</span><span style="font-weight:600;text-transform:capitalize">${v}</span></div>`).join("");

  $("target-details").innerHTML = [
    ["🔥 Calories", `${t.cal_min||"—"}–${t.cal_max||"—"} kcal`, "accent"],
    ["💪 Protein",  `${t.protein_min_g||"—"}–${t.protein_max_g||"—"} g`, "green"],
    ["🌾 Carbs",    `${t.carbs_min_g||"—"}–${t.carbs_max_g||"—"} g`, "yellow"],
    ["🥑 Fat",      `${t.fat_min_g||"—"}–${t.fat_max_g||"—"} g`, "orange"],
    ["🌿 Fiber",    `${t.fiber_min_g||"—"}–${t.fiber_max_g||"—"} g`, "purple"],
  ].map(([l,v,c])=>`<div class="profile-row">
    <span class="muted">${l}</span>
    <span class="${c}" style="font-weight:700">${v}</span>
  </div>`).join("");
}

// ─── Init ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".meal-type-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".meal-type-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active"); state.currentMealType = btn.dataset.type;
    });
  });
  document.querySelectorAll(".meal-type-btn-m").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".meal-type-btn-m").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active"); state.manualMealType = btn.dataset.type;
    });
  });
});
