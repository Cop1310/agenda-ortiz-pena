/* ====================================================================
   AGENDA ORTIZ PEÑA — motor de la app
   ==================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyD1KZsNvfEk_B0MyfRKIFMYAzFWAfcFTos",
  authDomain: "calendario-ortiz-pena.firebaseapp.com",
  databaseURL: "https://calendario-ortiz-pena-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "calendario-ortiz-pena",
  storageBucket: "calendario-ortiz-pena.firebasestorage.app",
  messagingSenderId: "601160984277",
  appId: "1:601160984277:web:bc416abebb29a37b29e45c"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

db.ref('.info/connected').on('value', (snap) => {
  const el = document.getElementById('syncDot');
  if (el) el.classList.toggle('offline', snap.val() !== true);
});

/* ============== FESTIVOS MADRID CAPITAL 2026 ============== */
const FESTIVOS_MADRID_2026 = [
  '2026-01-01', // Año Nuevo
  '2026-01-06', // Epifanía
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Fiesta del Trabajo
  '2026-05-15', // San Isidro (local Madrid)
  '2026-08-15', // Asunción
  '2026-10-12', // Fiesta Nacional
  '2026-11-02', // Traslado Todos los Santos
  '2026-11-09', // La Almudena (local Madrid)
  '2026-12-07', // Traslado Constitución
  '2026-12-08', // Inmaculada
  '2026-12-25'  // Navidad
];

function isHoliday(dateStr) {
  return FESTIVOS_MADRID_2026.includes(dateStr);
}

/* ============== CONSTANTS ============== */
const PEOPLE = ['cesar', 'yoli', 'gonzalo', 'adrian'];
const PEOPLE_LABELS = { cesar: 'César', yoli: 'Yoli', gonzalo: 'Gonzalo', adrian: 'Adrián' };
const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_LABELS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/* ============== STATE ============== */
let allEvents = {}; // { firebaseId: eventObj }
let activeFilters = new Set(['todos']);
let currentCalendarDate = new Date();
let selectedDayStr = formatDateStr(new Date());

let formState = {
  editingId: null,
  selectedPeople: new Set(),
  isFamilia: false,
  recurrenceType: 'single',
  multiDates: [],
  selectedWeekdays: new Set(),
  skipHolidays: true,
  reminderMins: 30
};

function formatDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/* ============== INIT ============== */
function initApp() {
  listenEvents();
  renderCalendar();
}
initApp();

function listenEvents() {
  db.ref('eventos').on('value', (snap) => {
    allEvents = snap.val() || {};
    renderCalendar();
    renderDayEvents();
  });
}

/* ============== NAVIGATION ============== */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function goHome() {
  showScreen('screen-home');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

/* ============== FILTERS ============== */
function toggleFilter(person) {
  if (person === 'todos') {
    activeFilters = new Set(['todos']);
  } else {
    activeFilters.delete('todos');
    if (activeFilters.has(person)) {
      activeFilters.delete(person);
      if (activeFilters.size === 0) activeFilters.add('todos');
    } else {
      activeFilters.add(person);
    }
  }
  document.querySelectorAll('.person-circle').forEach(chip => {
    chip.classList.toggle('active', activeFilters.has(chip.dataset.person));
  });
  renderCalendar();
  renderDayEvents();
}

function eventMatchesFilter(ev) {
  if (activeFilters.has('todos')) return true;
  if (ev.familia && activeFilters.has('familia')) return true;
  if (ev.people) return ev.people.some(p => activeFilters.has(p));
  return false;
}

/* ============== CALENDAR RENDER ============== */
function changeMonth(delta) {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
  renderCalendar();
}

function getEventsForDate(dateStr) {
  return Object.entries(allEvents)
    .map(([id, ev]) => ({ id, ...ev }))
    .filter(ev => ev.date === dateStr && eventMatchesFilter(ev))
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
}

function getAllEventDatesInMonth(year, month) {
  const result = {};
  Object.entries(allEvents).forEach(([id, ev]) => {
    if (!eventMatchesFilter(ev)) return;
    const d = parseDateStr(ev.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      if (!result[ev.date]) result[ev.date] = [];
      result[ev.date].push(ev);
    }
  });
  return result;
}

function renderCalendar() {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  document.getElementById('monthLabel').textContent = `${MONTH_LABELS[month]} ${year}`;

  const weekdaysContainer = document.getElementById('calendarWeekdays');
  weekdaysContainer.innerHTML = ['L','M','X','J','V','S','D'].map(d => `<div class="cal-weekday">${d}</div>`).join('');

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startOffset = firstDay.getDay() - 1; // Monday = 0
  if (startOffset < 0) startOffset = 6;

  const eventsInMonth = getAllEventDatesInMonth(year, month);
  const todayStr = formatDateStr(new Date());

  const daysContainer = document.getElementById('calendarDays');
  let html = '';

  for (let i = 0; i < startOffset; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateObj = new Date(year, month, day);
    const dateStr = formatDateStr(dateObj);
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDayStr;
    const isFestivo = isHoliday(dateStr);
    const dayEvents = eventsInMonth[dateStr] || [];

    let allDots = [];
    dayEvents.forEach(ev => {
      if (ev.familia) {
        allDots.push('familia');
      } else if (ev.people && ev.people.length) {
        ev.people.forEach(p => allDots.push(p));
      }
    });
    const dotsHtml = allDots.slice(0, 4).map(colorClass => `<span class="mini-dot dot ${colorClass}"></span>`).join('');

    html += `
      <div class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isFestivo ? 'festivo' : ''}" onclick="selectDay('${dateStr}')">
        <span class="cal-day-num">${day}</span>
        <div class="cal-day-dots">${dotsHtml}</div>
      </div>
    `;
  }

  daysContainer.innerHTML = html;
  renderDayEvents();
}

function selectDay(dateStr) {
  selectedDayStr = dateStr;
  renderCalendar();
}

function renderDayEvents() {
  const titleEl = document.getElementById('dayEventsTitle');
  const dateObj = parseDateStr(selectedDayStr);
  const todayStr = formatDateStr(new Date());
  const weekdayName = WEEKDAY_LABELS[dateObj.getDay()];
  const dayLabel = `${weekdayName} ${dateObj.getDate()} de ${MONTH_LABELS[dateObj.getMonth()].toLowerCase()}`;
  titleEl.textContent = selectedDayStr === todayStr ? `Hoy — ${dayLabel}` : dayLabel;

  const events = getEventsForDate(selectedDayStr);
  const listEl = document.getElementById('dayEventsList');

  if (events.length === 0) {
    listEl.innerHTML = `<div class="empty-day-msg">No hay nada agendado este día.</div>`;
    return;
  }

  listEl.innerHTML = events.map(ev => renderEventCard(ev)).join('');
}

function renderEventCard(ev) {
  const borderColor = ev.familia ? 'var(--familia)' : `var(--${(ev.people && ev.people[0]) || 'familia'})`;
  const peopleTags = ev.familia
    ? `<span class="ec-person-tag"><span class="mini-dot dot familia"></span>Familia</span>`
    : (ev.people || []).map(p => `<span class="ec-person-tag"><span class="mini-dot dot ${p}"></span>${PEOPLE_LABELS[p]}</span>`).join('');

  const timeLabel = ev.startTime ? `${ev.startTime}${ev.endTime ? ' - ' + ev.endTime : ''}` : '';
  const noteHtml = ev.note ? `<div class="ec-title">${escapeHtmlAg(ev.note)}</div>` : '';

  return `
    <div class="event-card" style="border-left-color:${borderColor};" onclick="showEventDetail('${ev.id}')">
      <div class="ec-time">${timeLabel}</div>
      <div class="ec-body">
        <div class="ec-title">${escapeHtmlAg(ev.title)}</div>
        ${noteHtml}
        <div class="ec-people">${peopleTags}</div>
      </div>
    </div>
  `;
}

function escapeHtmlAg(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ============== EVENT DETAIL MODAL ============== */
/* ============== EXPORTAR .ICS (varios eventos de golpe) ============== */
function openIcsExportModal() {
  const modal = document.getElementById('icsExportContent');
  modal.innerHTML = `
    <h3>📅 Añadir mis eventos al calendario</h3>
    <p style="color:var(--ink-soft); font-size:0.85rem; margin-bottom:18px;">
      Elige de quién quieres descargar los próximos eventos. Se descargará un archivo que, al abrirlo, los añade todos de golpe a tu calendario del móvil (Google Calendar, Calendario de iPhone, etc.).
    </p>
    <div class="person-select-grid" style="margin-bottom:10px;">
      <div class="person-select-card" data-person="cesar" onclick="toggleIcsPerson('cesar', this)"><span class="dot cesar"></span>César</div>
      <div class="person-select-card" data-person="yoli" onclick="toggleIcsPerson('yoli', this)"><span class="dot yoli"></span>Yoli</div>
      <div class="person-select-card" data-person="gonzalo" onclick="toggleIcsPerson('gonzalo', this)"><span class="dot gonzalo"></span>Gonzalo</div>
      <div class="person-select-card" data-person="adrian" onclick="toggleIcsPerson('adrian', this)"><span class="dot adrian"></span>Adrián</div>
    </div>
    <div class="familia-toggle" id="icsFamiliaToggle" onclick="toggleIcsTodos()" style="margin-bottom:18px;">
      <span class="dot familia"></span><span>Todos los eventos de la agenda</span>
    </div>
    <button class="primary-action" onclick="downloadIcsFile()">Descargar archivo</button>
    <button class="modal-close-btn" onclick="closeIcsExportModal()">Cancelar</button>
  `;
  icsSelectedPeople = new Set();
  icsSelectTodos = false;
  document.getElementById('icsExportModal').classList.add('visible');
}

let icsSelectedPeople = new Set();
let icsSelectTodos = false;

function toggleIcsPerson(person, el) {
  icsSelectTodos = false;
  document.getElementById('icsFamiliaToggle').classList.remove('selected');
  if (icsSelectedPeople.has(person)) {
    icsSelectedPeople.delete(person);
    el.classList.remove('selected');
  } else {
    icsSelectedPeople.add(person);
    el.classList.add('selected');
  }
}

function toggleIcsTodos() {
  icsSelectTodos = !icsSelectTodos;
  icsSelectedPeople.clear();
  document.querySelectorAll('#icsExportContent .person-select-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('icsFamiliaToggle').classList.toggle('selected', icsSelectTodos);
}

function closeIcsExportModal() {
  document.getElementById('icsExportModal').classList.remove('visible');
}

function getRelevantEventsForIcs() {
  const todayStr = formatDateStr(new Date());
  return Object.values(allEvents).filter(ev => {
    if (ev.date < todayStr) return false; // only upcoming
    if (icsSelectTodos) return true;
    if (icsSelectedPeople.size === 0) return false;
    if (ev.familia) return true;
    return ev.people && ev.people.some(p => icsSelectedPeople.has(p));
  });
}

function icsEscape(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function buildIcsContent(events) {
  const toIcsDate = (dateStr, timeStr) => {
    const d = parseDateStr(dateStr);
    const [h, m] = (timeStr || '09:00').split(':').map(Number);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(h)}${pad(m)}00`;
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agenda Ortiz Pena//ES',
    'CALSCALE:GREGORIAN'
  ];

  events.forEach(ev => {
    const start = toIcsDate(ev.date, ev.startTime);
    const end = ev.endTime ? toIcsDate(ev.date, ev.endTime) : toIcsDate(ev.date, ev.startTime);
    const who = ev.familia ? 'Familia' : (ev.people || []).map(p => PEOPLE_LABELS[p]).join(', ');
    const description = [ev.note, `Para: ${who}`].filter(Boolean).join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@agenda-ortiz-pena`,
      `DTSTAMP:${toIcsDate(formatDateStr(new Date()), '00:00')}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${icsEscape(ev.title)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function downloadIcsFile() {
  const events = getRelevantEventsForIcs();
  if (events.length === 0) {
    showToast('⚠️ Elige al menos una persona, o no hay eventos próximos');
    return;
  }

  const icsContent = buildIcsContent(events);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'agenda-ortiz-pena.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`✅ ${events.length} evento(s) descargados — ábrelos para añadirlos al calendario`);
  closeIcsExportModal();
}

function buildGoogleCalendarUrl(ev) {
  const dateObj = parseDateStr(ev.date);
  const [startH, startM] = (ev.startTime || '09:00').split(':').map(Number);
  const startDate = new Date(dateObj);
  startDate.setHours(startH, startM, 0, 0);

  let endDate;
  if (ev.endTime) {
    const [endH, endM] = ev.endTime.split(':').map(Number);
    endDate = new Date(dateObj);
    endDate.setHours(endH, endM, 0, 0);
  } else {
    endDate = new Date(startDate.getTime() + 60 * 60000); // default 1h
  }

  const toGCalFormat = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  const who = ev.familia ? 'Familia' : (ev.people || []).map(p => PEOPLE_LABELS[p]).join(', ');
  const details = [ev.note, `Para: ${who}`].filter(Boolean).join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${toGCalFormat(startDate)}/${toGCalFormat(endDate)}`,
    details: details
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function showEventDetail(id) {
  const ev = allEvents[id];
  if (!ev) return;

  const modal = document.getElementById('eventDetailContent');
  const peopleTags = ev.familia
    ? `<span class="ec-person-tag"><span class="mini-dot dot familia"></span>Toda la familia</span>`
    : (ev.people || []).map(p => `<span class="ec-person-tag"><span class="mini-dot dot ${p}"></span>${PEOPLE_LABELS[p]}</span>`).join('');

  const dateObj = parseDateStr(ev.date);
  const dayLabel = `${WEEKDAY_LABELS[dateObj.getDay()]} ${dateObj.getDate()} de ${MONTH_LABELS[dateObj.getMonth()].toLowerCase()} de ${dateObj.getFullYear()}`;
  const noteHtml = ev.note ? `<h3 style="margin-top:-6px;">${escapeHtmlAg(ev.note)}</h3>` : '';
  const gcalUrl = buildGoogleCalendarUrl(ev);

  modal.innerHTML = `
    <h3>${escapeHtmlAg(ev.title)}</h3>
    ${noteHtml}
    <p style="margin-bottom:10px; color:var(--ink-soft);">${dayLabel}</p>
    <p style="margin-bottom:14px; font-weight:700;">${ev.startTime || ''}${ev.endTime ? ' - ' + ev.endTime : ''}</p>
    <div class="ec-people" style="margin-bottom:18px;">${peopleTags}</div>
    ${ev.seriesId ? `<p style="font-size:0.78rem; color:var(--ink-soft); margin-bottom:14px; font-style:italic;">Este evento forma parte de una serie repetida.</p>` : ''}
    <a href="${gcalUrl}" target="_blank" rel="noopener" class="primary-action" style="display:block; text-align:center; text-decoration:none;">📅 Añadir a Google Calendar</a>
    <button class="secondary-action" onclick="closeEventDetail(); editEvent('${id}')">✏️ Editar</button>
    <button class="danger-action" onclick="confirmDeleteFromDetail('${id}')">🗑️ Borrar</button>
    <button class="modal-close-btn" onclick="closeEventDetail()">Cerrar</button>
  `;
  document.getElementById('eventDetailModal').classList.add('visible');
}

function closeEventDetail() {
  document.getElementById('eventDetailModal').classList.remove('visible');
}

function confirmDeleteFromDetail(id) {
  if (!confirm('¿Borrar este evento?')) return;
  db.ref('eventos/' + id).remove();
  closeEventDetail();
  showToast('🗑️ Evento borrado');
}

/* ============== ADD / EDIT EVENT FORM ============== */
function goToAddEvent() {
  resetFormState();
  document.getElementById('eventFormTitle').textContent = 'Nuevo evento';
  document.getElementById('deleteEventBtn').style.display = 'none';
  document.getElementById('eventTitleInput').value = '';
  document.getElementById('eventNoteInput').value = '';
  document.getElementById('singleDateInput').value = selectedDayStr;
  document.getElementById('eventStartTime').value = '';
  document.getElementById('eventEndTime').value = '';
  showScreen('screen-event-form');
}

function editEvent(id) {
  const ev = allEvents[id];
  if (!ev) return;
  resetFormState();
  formState.editingId = id;

  document.getElementById('eventFormTitle').textContent = 'Editar evento';
  document.getElementById('deleteEventBtn').style.display = 'block';
  document.getElementById('eventTitleInput').value = ev.title;
  document.getElementById('eventNoteInput').value = ev.note || '';
  document.getElementById('eventStartTime').value = ev.startTime || '';
  document.getElementById('eventEndTime').value = ev.endTime || '';
  document.getElementById('singleDateInput').value = ev.date;

  if (ev.familia) {
    formState.isFamilia = true;
  } else {
    formState.selectedPeople = new Set(ev.people || []);
  }

  formState.reminderMins = ev.reminderMins != null ? ev.reminderMins : 30;
  formState.recurrenceType = 'single'; // editing always edits as single occurrence

  syncFormUI();
  showScreen('screen-event-form');
}

function resetFormState() {
  formState = {
    editingId: null,
    selectedPeople: new Set(),
    isFamilia: false,
    recurrenceType: 'single',
    multiDates: [],
    selectedWeekdays: new Set(),
    skipHolidays: true,
    reminderMins: 30
  };
  syncFormUI();
}

function syncFormUI() {
  document.querySelectorAll('.person-select-card').forEach(card => {
    card.classList.toggle('selected', formState.selectedPeople.has(card.dataset.person));
  });
  document.getElementById('familiaToggle').classList.toggle('selected', formState.isFamilia);

  document.querySelectorAll('.recurrence-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.type === formState.recurrenceType);
  });
  document.getElementById('singleDateBlock').style.display = formState.recurrenceType === 'single' ? 'block' : 'none';
  document.getElementById('multiDateBlock').style.display = formState.recurrenceType === 'multi' ? 'block' : 'none';
  document.getElementById('weeklyBlock').style.display = formState.recurrenceType === 'weekly' ? 'block' : 'none';

  renderMultiDateList();

  document.querySelectorAll('.weekday-btn').forEach(btn => {
    btn.classList.toggle('selected', formState.selectedWeekdays.has(Number(btn.dataset.day)));
  });

  document.getElementById('skipHolidaysSwitch').classList.toggle('on', formState.skipHolidays);

  document.querySelectorAll('.reminder-chip').forEach(chip => {
    chip.classList.toggle('selected', Number(chip.dataset.mins) === formState.reminderMins);
  });

  updateWeeklyPreview();
}

function togglePersonSelect(person) {
  formState.isFamilia = false;
  if (formState.selectedPeople.has(person)) {
    formState.selectedPeople.delete(person);
  } else {
    formState.selectedPeople.add(person);
  }
  syncFormUI();
}

function toggleFamiliaSelect() {
  formState.isFamilia = !formState.isFamilia;
  if (formState.isFamilia) formState.selectedPeople.clear();
  syncFormUI();
}

function selectRecurrenceType(type) {
  formState.recurrenceType = type;
  syncFormUI();
}

function addMultiDate() {
  const input = document.getElementById('multiDateInput');
  if (!input.value) return;
  if (!formState.multiDates.includes(input.value)) {
    formState.multiDates.push(input.value);
    formState.multiDates.sort();
  }
  input.value = '';
  renderMultiDateList();
}

function removeMultiDate(dateStr) {
  formState.multiDates = formState.multiDates.filter(d => d !== dateStr);
  renderMultiDateList();
}

function renderMultiDateList() {
  const container = document.getElementById('multiDateList');
  container.innerHTML = formState.multiDates.map(d => {
    const dObj = parseDateStr(d);
    const label = `${dObj.getDate()}/${dObj.getMonth() + 1}`;
    return `<span class="multi-date-chip">${label}<span class="remove-x" onclick="removeMultiDate('${d}')">✕</span></span>`;
  }).join('');
}

function toggleWeekday(day) {
  if (formState.selectedWeekdays.has(day)) formState.selectedWeekdays.delete(day);
  else formState.selectedWeekdays.add(day);
  syncFormUI();
}

function toggleSkipHolidays() {
  formState.skipHolidays = !formState.skipHolidays;
  syncFormUI();
}

function selectReminder(mins) {
  formState.reminderMins = mins;
  syncFormUI();
}

function generateWeeklyDates() {
  const fromVal = document.getElementById('weeklyFromInput').value;
  const toVal = document.getElementById('weeklyToInput').value;
  if (!fromVal || !toVal || formState.selectedWeekdays.size === 0) return [];

  const dates = [];
  let cursor = parseDateStr(fromVal);
  const end = parseDateStr(toVal);

  while (cursor <= end) {
    const dow = cursor.getDay();
    const dateStr = formatDateStr(cursor);
    if (formState.selectedWeekdays.has(dow)) {
      if (!(formState.skipHolidays && isHoliday(dateStr))) {
        dates.push(dateStr);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function updateWeeklyPreview() {
  if (formState.recurrenceType !== 'weekly') return;
  const box = document.getElementById('weeklyPreviewBox');
  const dates = generateWeeklyDates();
  if (dates.length === 0) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  box.innerHTML = `<strong>${dates.length} fechas generadas:</strong><br>` +
    dates.slice(0, 12).map(d => {
      const dObj = parseDateStr(d);
      return `${dObj.getDate()}/${dObj.getMonth() + 1}`;
    }).join(', ') + (dates.length > 12 ? '…' : '');
}

// Recompute weekly preview when date inputs change
// (script loads at end of body, so DOM is already parsed — attach directly)
['weeklyFromInput', 'weeklyToInput'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', updateWeeklyPreview);
});

/* ============== VOICE INPUT (dictado) ============== */
function startVoiceInput(inputId, btnEl) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('⚠️ Este navegador no permite dictar por voz');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  btnEl.classList.add('listening');

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const input = document.getElementById(inputId);
    // Append if there's already text, otherwise just set it
    input.value = input.value ? (input.value + ' ' + transcript) : transcript;
  };

  recognition.onerror = () => {
    showToast('⚠️ No se ha entendido, inténtalo otra vez');
  };

  recognition.onend = () => {
    btnEl.classList.remove('listening');
  };

  recognition.start();
}

/* ============== SAVE EVENT ============== */
async function saveEvent() {
  const title = document.getElementById('eventTitleInput').value.trim();
  if (!title) { showToast('⚠️ Escribe qué es el evento'); return; }

  if (!formState.isFamilia && formState.selectedPeople.size === 0) {
    showToast('⚠️ Elige para quién es el evento');
    return;
  }

  const startTime = document.getElementById('eventStartTime').value;
  const endTime = document.getElementById('eventEndTime').value;
  const note = document.getElementById('eventNoteInput').value.trim();

  const baseEvent = {
    title,
    note,
    familia: formState.isFamilia,
    people: formState.isFamilia ? [] : Array.from(formState.selectedPeople),
    startTime, endTime,
    reminderMins: formState.reminderMins
  };

  // Editing an existing single event
  if (formState.editingId) {
    const date = document.getElementById('singleDateInput').value;
    if (!date) { showToast('⚠️ Elige una fecha'); return; }
    await db.ref('eventos/' + formState.editingId).update({ ...baseEvent, date });
    showToast('✅ Evento actualizado');
    goHome();
    return;
  }

  let dates = [];
  if (formState.recurrenceType === 'single') {
    const date = document.getElementById('singleDateInput').value;
    if (!date) { showToast('⚠️ Elige una fecha'); return; }
    dates = [date];
  } else if (formState.recurrenceType === 'multi') {
    if (formState.multiDates.length === 0) { showToast('⚠️ Añade al menos una fecha'); return; }
    dates = formState.multiDates.slice();
  } else if (formState.recurrenceType === 'weekly') {
    dates = generateWeeklyDates();
    if (dates.length === 0) { showToast('⚠️ Revisa los días de la semana y el rango de fechas'); return; }
  }

  const seriesId = dates.length > 1 ? ('series_' + Date.now()) : null;
  const updates = {};
  dates.forEach(date => {
    const id = db.ref('eventos').push().key;
    updates['eventos/' + id] = { ...baseEvent, date, seriesId };
  });

  try {
    await db.ref().update(updates);
    showToast(dates.length > 1 ? `✅ ${dates.length} eventos creados` : '✅ Evento creado');
    goHome();
  } catch (e) {
    console.error(e);
    showToast('⚠️ Error al guardar');
  }
}

function deleteCurrentEvent() {
  if (!formState.editingId) return;
  if (!confirm('¿Borrar este evento?')) return;
  db.ref('eventos/' + formState.editingId).remove();
  showToast('🗑️ Evento borrado');
  goHome();
}

/* ====================================================================
   NOTIFICACIONES LOCALES
   La app revisa los eventos próximos mientras está abierta (o recién
   en segundo plano) y dispara una notificación a través del Service
   Worker, que es más fiable en móvil que las notificaciones directas.
   Sigue necesitando que la app esté instalada y no completamente
   cerrada por el sistema, pero es la opción más robusta sin servidor.
   ==================================================================== */

const NOTIFIED_KEY = 'agenda_notified_ids';
let swRegistration = null;

function getNotifiedSet() {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) { return new Set(); }
}

function saveNotifiedSet(set) {
  try {
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(arr));
  } catch (e) { /* ignore */ }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.error('Error registrando service worker', e);
    return null;
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function fireNotification(title, options) {
  if (swRegistration && swRegistration.showNotification) {
    swRegistration.showNotification(title, options);
  } else {
    try { new Notification(title, options); } catch (e) { /* ignore */ }
  }
}

function checkUpcomingEvents() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notified = getNotifiedSet();
  const now = new Date();

  Object.entries(allEvents).forEach(([id, ev]) => {
    if (ev.reminderMins == null || ev.reminderMins <= 0) return;
    if (!ev.startTime) return;
    if (notified.has(id)) return;

    const [h, m] = ev.startTime.split(':').map(Number);
    const eventDateTime = parseDateStr(ev.date);
    eventDateTime.setHours(h, m, 0, 0);

    const notifyAt = new Date(eventDateTime.getTime() - ev.reminderMins * 60000);

    const diff = now - notifyAt;
    if (diff >= 0 && diff < 90000) {
      const who = ev.familia ? 'Familia' : (ev.people || []).map(p => PEOPLE_LABELS[p]).join(', ');
      fireNotification('📅 ' + ev.title, {
        body: `${who} — ${ev.startTime}${ev.endTime ? ' a ' + ev.endTime : ''}${ev.note ? '\n' + ev.note : ''}`,
        tag: id
      });
      notified.add(id);
      saveNotifiedSet(notified);
    }
  });
}

async function setupNotifications() {
  swRegistration = await registerServiceWorker();
  updateNotifButtonState();
}

async function enableNotificationsClick() {
  const granted = await requestNotificationPermission();
  updateNotifButtonState();
  if (granted) {
    showToast('🔔 Avisos activados en este dispositivo');
    checkUpcomingEvents();
  } else if (Notification.permission === 'denied') {
    showToast('⚠️ Bloqueado. Actívalo en los ajustes del navegador para este sitio');
  } else {
    showToast('⚠️ No se ha activado el permiso');
  }
}

function updateNotifButtonState() {
  const btn = document.getElementById('notifToggleBtn');
  if (!btn) return;
  if (!('Notification' in window)) {
    btn.style.display = 'none';
    return;
  }
  if (Notification.permission === 'granted') {
    btn.textContent = '🔔 Avisos activados';
    btn.classList.add('notif-active');
  } else {
    btn.textContent = '🔕 Activar avisos en este móvil';
    btn.classList.remove('notif-active');
  }
}

setupNotifications();

// Check every 30 seconds while the app is open/visible
setInterval(checkUpcomingEvents, 30000);
setTimeout(checkUpcomingEvents, 3000);
