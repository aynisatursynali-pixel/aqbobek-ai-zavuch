const DAYS = ["Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі"];
const EXPECTED_CLASSES = ["7A", "7B", "7C", "8A", "8B", "8C", "8D", "9A", "9B", "10A", "10B", "11A", "11B"];

const state = {
  aiStatus: null,
  attendance: [],
  attendanceSummary: null,
  incidents: [],
  tasks: [],
  substitutions: [],
  teachers: [],
  staff: [],
  people: [],
  schedule: [],
  scheduleInsights: [],
  scheduleConflicts: [],
  staffPlans: [],
  regulations: [],
  notifications: [],
  audit: [],
  latestAiResult: null,
  latestDocumentResult: null,
  filters: {
    day: DAYS[0],
    className: "",
    teacher: "",
    room: "",
  },
};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function badgeTone(value) {
  const normalized = String(value || "").toLowerCase();
  if (["available", "done", "approved", "resolved", "good", "normal"].includes(normalized)) return "good";
  if (["proposed", "new", "busy", "warn", "high"].includes(normalized)) return "warn";
  if (["unresolved", "rejected", "critical", "bad", "hot"].includes(normalized)) return "bad";
  return "neutral";
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

async function refreshCore() {
  const [
    aiStatus,
    attendance,
    attendanceSummary,
    incidents,
    tasks,
    substitutions,
    teachers,
    staff,
    people,
    regulations,
    notifications,
    audit,
  ] = await Promise.all([
    api("/api/ai/status"),
    api("/api/attendance"),
    api("/api/attendance/summary"),
    api("/api/incidents"),
    api("/api/tasks"),
    api("/api/substitutions"),
    api("/api/teachers"),
    api("/api/staff"),
    api("/api/people"),
    api("/api/regulations"),
    api("/api/notifications?limit=12"),
    api("/api/audit?limit=12"),
  ]);

  Object.assign(state, {
    aiStatus,
    attendance,
    attendanceSummary,
    incidents,
    tasks,
    substitutions,
    teachers,
    staff,
    people,
    regulations,
    notifications,
    audit,
  });

  await refreshScheduleData();
  renderAll();
}

async function refreshScheduleData() {
  const query = new URLSearchParams();
  if (state.filters.day) query.set("day", state.filters.day);
  if (state.filters.className) query.set("class", state.filters.className);
  if (state.filters.teacher) query.set("teacher", state.filters.teacher);
  if (state.filters.room) query.set("room", state.filters.room);

  const [schedule, scheduleInsights, staffPlans, scheduleConflicts] = await Promise.all([
    api(`/api/schedule?${query.toString()}`),
    api(`/api/schedule/insights?day=${encodeURIComponent(state.filters.day)}`),
    api(`/api/staff/plans?day=${encodeURIComponent(state.filters.day)}`),
    api(`/api/schedule/conflicts?day=${encodeURIComponent(state.filters.day)}`),
  ]);

  state.schedule = schedule;
  state.scheduleInsights = scheduleInsights;
  state.staffPlans = staffPlans;
  state.scheduleConflicts = scheduleConflicts;
}

function renderAll() {
  renderChrome();
  renderOverview();
  renderAttendance();
  renderOperations();
  renderSchedule();
  renderDocuments();
}

function renderChrome() {
  const now = new Date();
  $("todayLabel").textContent = now.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const aiBadge = $("aiStatusBadge");
  const aiText = $("aiStatusText");
  const heroAiModel = $("heroAiModel");
  const activeModel = state.aiStatus?.active_model || "fallback";
  heroAiModel.textContent = activeModel;

  if (state.aiStatus?.available) {
    aiBadge.className = "pill good";
    aiBadge.textContent = `Gemini active: ${activeModel}`;
    aiText.textContent = "Structured output доступен и используется для intake и документного модуля.";
  } else if (state.aiStatus?.configured) {
    aiBadge.className = "pill warn";
    aiBadge.textContent = "Gemini fallback mode";
    aiText.textContent = state.aiStatus?.last_error || "AI ключ есть, но сейчас работаем на локальном fallback.";
  } else {
    aiBadge.className = "pill neutral";
    aiBadge.textContent = "Gemini not configured";
    aiText.textContent = "Приложение работает в rule-based режиме до подключения ключа.";
  }

  const missingCount = state.attendanceSummary?.missing_classes?.length || 0;
  const unresolvedSubs = state.substitutions.filter(item => item.status === "unresolved").length;
  const quickSignals = [
    {
      title: "Missing reports",
      copy: missingCount ? `${missingCount} классов еще не сдали attendance.` : "Все классы уже отчитались.",
      tone: missingCount ? "warn" : "good",
    },
    {
      title: "Substitution pressure",
      copy: unresolvedSubs ? `${unresolvedSubs} замены пока без решения.` : "Все замены обработаны.",
      tone: unresolvedSubs ? "bad" : "good",
    },
    {
      title: "Open incidents",
      copy: `${state.incidents.filter(item => !["done", "resolved"].includes(item.status)).length} инцидентов в работе.`,
      tone: state.incidents.length ? "warn" : "neutral",
    },
  ];

  $("quickSignals").innerHTML = quickSignals.map(signalCard).join("");
}

function signalCard(item) {
  return `
    <article class="signal-card">
      <div class="badge ${badgeTone(item.tone)}">${escapeHtml(item.title)}</div>
      <p>${escapeHtml(item.copy)}</p>
    </article>
  `;
}

function renderOverview() {
  const summary = state.attendanceSummary || { present: 0, absent: 0, meals: 0, missing_classes: [] };
  const openTasks = state.tasks.filter(item => item.status !== "done").length;
  const openIncidents = state.incidents.filter(item => !["done", "resolved"].includes(item.status)).length;
  const proposedSubs = state.substitutions.filter(item => item.status === "proposed").length;

  $("overviewMetrics").innerHTML = [
    {
      label: "Present now",
      value: summary.present || 0,
      copy: "Автоматически собранные attendance-отчеты.",
    },
    {
      label: "Dining portions",
      value: summary.meals || 0,
      copy: "Готовая заявка в столовую без ручного свода.",
    },
    {
      label: "Open tasks",
      value: openTasks,
      copy: "Поручения, которые требуют исполнения.",
    },
    {
      label: "Active issues",
      value: openIncidents + proposedSubs,
      copy: "Инциденты и замены, которые сейчас в фокусе.",
    },
  ].map(metricCard).join("");

  $("diningSummary").innerHTML = `
    <p><strong>Присутствуют:</strong> ${summary.present || 0}</p>
    <p><strong>Отсутствуют:</strong> ${summary.absent || 0}</p>
    <p><strong>Порции для столовой:</strong> ${summary.meals || 0}</p>
    <p><strong>Не отчитались:</strong> ${
      summary.missing_classes?.length ? escapeHtml(summary.missing_classes.join(", ")) : "все классы закрыты"
    }</p>
  `;

  const attentionItems = [];
  if (summary.missing_classes?.length) {
    attentionItems.push({
      title: "Attendance gaps",
      copy: `Нет отчетов по классам: ${summary.missing_classes.join(", ")}.`,
      tone: "warn",
    });
  }
  if (state.substitutions.some(item => item.status === "unresolved")) {
    attentionItems.push({
      title: "Unresolved substitutions",
      copy: "Есть замены без найденного свободного педагога.",
      tone: "bad",
    });
  }
  if (openIncidents) {
    attentionItems.push({
      title: "Incident queue",
      copy: `${openIncidents} инцидентов еще не закрыты.`,
      tone: "warn",
    });
  }
  if (!attentionItems.length) {
    attentionItems.push({
      title: "Calm state",
      copy: "Система не видит срочных пробелов или конфликтов.",
      tone: "good",
    });
  }
  $("attentionQueue").innerHTML = attentionItems.map(signalCard).join("");

  $("heatmapList").innerHTML = renderHeatmapItems(state.scheduleInsights.slice(0, 6));
  $("staffPreview").innerHTML = renderStaffPlanCards(state.staffPlans.slice(0, 4), true);
  $("notificationsList").innerHTML = renderNotifications(state.notifications.slice(0, 6));
}

function metricCard(item) {
  return `
    <article class="metric-card">
      <div class="metric-label">${escapeHtml(item.label)}</div>
      <div class="metric-value">${escapeHtml(item.value)}</div>
      <div class="metric-copy">${escapeHtml(item.copy)}</div>
    </article>
  `;
}

function renderAttendance() {
  const summary = state.attendanceSummary || { present: 0, absent: 0, meals: 0, missing_classes: [] };
  $("attendanceSummaryCard").innerHTML = `
    <p><strong>Всего присутствуют:</strong> ${summary.present || 0}</p>
    <p><strong>Всего отсутствуют:</strong> ${summary.absent || 0}</p>
    <p><strong>Рекомендуемые порции:</strong> ${summary.meals || 0}</p>
    <p><strong>Expected classes:</strong> ${EXPECTED_CLASSES.length}</p>
  `;

  $("missingReportsCard").innerHTML = summary.missing_classes?.length
    ? summary.missing_classes.map(className => `
        <article class="task-card">
          <strong>${escapeHtml(className)}</strong>
          <p>Attendance еще не пришел. Можно напомнить куратору до 09:00.</p>
          <div class="meta-row"><span class="badge warn">missing</span></div>
        </article>
      `).join("")
    : `<div class="empty-note">Все классы уже закрыли attendance.</div>`;

  const presentMap = new Map(state.attendance.map(item => [item.class, item]));
  $("attendanceList").innerHTML = EXPECTED_CLASSES.map(className => {
    const report = presentMap.get(className);
    if (!report) {
      return `
        <article class="task-card">
          <strong>${escapeHtml(className)}</strong>
          <p>Отчет еще не поступил.</p>
          <div class="meta-row"><span class="badge bad">missing</span></div>
        </article>
      `;
    }

    return `
      <article class="task-card">
        <strong>${escapeHtml(className)}</strong>
        <p>Присутствуют: ${escapeHtml(report.present)}<br>Отсутствуют: ${escapeHtml(report.absent)}</p>
        <div class="meta-row">
          <span class="badge good">reported</span>
          <span class="badge neutral">${escapeHtml(report.updated_at || "без времени")}</span>
        </div>
      </article>
    `;
  }).join("");
}

function renderOperations() {
  $("incidentsList").innerHTML = state.incidents.length
    ? state.incidents.map((item, index) => `
        <article class="task-card">
          <strong>${escapeHtml(item.text)}</strong>
          <p>Тип: ${escapeHtml(item.type)}<br>Ответственный: ${escapeHtml(item.assigned_to || "-")}</p>
          <div class="meta-row">
            <span class="badge ${badgeTone(item.status)}">${escapeHtml(item.status)}</span>
            <button class="status-btn" data-action="incident-progress" data-index="${index}">In progress</button>
            <button class="status-btn" data-action="incident-done" data-index="${index}">Done</button>
          </div>
        </article>
      `).join("")
    : `<div class="empty-note">Инцидентов пока нет.</div>`;

  $("tasksList").innerHTML = state.tasks.length
    ? state.tasks.map((task, index) => `
        <article class="task-card">
          <strong>${escapeHtml(task.title)}</strong>
          <p>Исполнитель: ${escapeHtml(task.assignee)}<br>Срок: ${escapeHtml(task.deadline)}</p>
          <div class="meta-row">
            <span class="badge ${badgeTone(task.status)}">${escapeHtml(task.status)}</span>
            <button class="status-btn" data-action="task-next" data-index="${index}">Next status</button>
          </div>
        </article>
      `).join("")
    : `<div class="empty-note">Задач пока нет.</div>`;

  $("substitutionsList").innerHTML = state.substitutions.length
    ? state.substitutions.map((item, index) => `
        <article class="task-card">
          <strong>${escapeHtml(item.class)} · ${escapeHtml(item.lesson)} урок</strong>
          <p>${escapeHtml(item.subject)}<br>Отсутствует: ${escapeHtml(item.absent_teacher)}<br>Замена: ${escapeHtml(item.substitute_teacher || "не найдена")}</p>
          <div class="meta-row">
            <span class="badge ${badgeTone(item.status)}">${escapeHtml(item.status)}</span>
            <button class="status-btn" data-action="sub-approve" data-index="${index}">Approve</button>
            <button class="status-btn" data-action="sub-reject" data-index="${index}">Reject</button>
          </div>
        </article>
      `).join("")
    : `<div class="empty-note">Замен пока нет.</div>`;

  renderAiResult();
  $("auditList").innerHTML = renderAudit(state.audit.slice(0, 8));
}

function renderAiResult() {
  if (!state.latestAiResult) {
    return;
  }

  const analysis = state.latestAiResult.analysis || {};
  $("aiResult").classList.remove("empty-state");
  $("aiResult").innerHTML = `
    <div class="result-item">
      <div class="result-title">Intent</div>
      <div>${escapeHtml(analysis.intent || "-")}</div>
    </div>
    <div class="result-item">
      <div class="result-title">Summary</div>
      <div>${escapeHtml(state.latestAiResult.summary || analysis.summary || "-")}</div>
    </div>
    <div class="result-item">
      <div class="result-title">Created</div>
      <div>${escapeHtml(JSON.stringify(state.latestAiResult.created || {}, null, 2))}</div>
    </div>
    <div class="result-item">
      <div class="result-title">Structured analysis</div>
      <pre>${escapeHtml(JSON.stringify(analysis, null, 2))}</pre>
    </div>
  `;
}

function renderSchedule() {
  fillScheduleFilters();
  $("scheduleInsights").innerHTML = renderHeatmapItems(state.scheduleInsights);
  $("staffPlans").innerHTML = renderStaffPlanCards(state.staffPlans);
  $("scheduleConflicts").innerHTML = renderConflicts(state.scheduleConflicts);

  $("scheduleTableBody").innerHTML = state.schedule.length
    ? state.schedule.map(row => `
        <tr>
          <td>${escapeHtml(row.day)}</td>
          <td>${escapeHtml(row.lesson)}</td>
          <td>${escapeHtml(row.time)}</td>
          <td>${escapeHtml(row.class)}</td>
          <td>${escapeHtml(row.subject_teacher)}</td>
          <td>${escapeHtml(row.room)}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="6" class="empty-note">По текущим фильтрам данных нет.</td></tr>`;
}

function renderNotifications(items) {
  if (!items.length) {
    return `<div class="empty-note">Уведомлений пока нет.</div>`;
  }

  return items.map(item => `
    <article class="task-card">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.message)}<br>${escapeHtml(item.created_at || "-")}</p>
      <div class="meta-row">
        <span class="badge ${badgeTone(item.tone)}">${escapeHtml(item.audience || "director")}</span>
      </div>
    </article>
  `).join("");
}

function renderAudit(items) {
  if (!items.length) {
    return `<div class="empty-note">История изменений пока пуста.</div>`;
  }

  return items.map(item => `
    <article class="task-card">
      <strong>${escapeHtml(item.summary)}</strong>
      <p>${escapeHtml(item.event_type)} · ${escapeHtml(item.entity_type)}<br>${escapeHtml(item.created_at || "-")}</p>
    </article>
  `).join("");
}

function renderConflicts(items) {
  if (!items.length) {
    return `<div class="empty-note">Явных конфликтов по выбранному дню не найдено.</div>`;
  }

  return items.map(item => `
    <article class="task-card">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.day)} · ${escapeHtml(item.lesson)} урок<br>Ресурс: ${escapeHtml(item.resource)}</p>
      <div class="meta-row"><span class="badge bad">${escapeHtml(item.type)}</span></div>
    </article>
  `).join("");
}

function fillScheduleFilters() {
  const teacherOptions = ["", ...new Set(state.teachers.map(item => item.teacher_name).filter(Boolean))].sort();
  fillSelect($("dayFilter"), DAYS, state.filters.day, value => value);
  fillSelect($("classFilter"), ["", ...EXPECTED_CLASSES], state.filters.className, value => value || "Все классы");
  fillSelect($("teacherFilter"), teacherOptions, state.filters.teacher, value => value || "Все учителя");
  $("roomFilter").value = state.filters.room;
}

function fillSelect(element, values, selected, labelFn = value => value) {
  element.innerHTML = values.map(value => `
    <option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(labelFn(value))}</option>
  `).join("");
}

function renderHeatmapItems(items) {
  if (!items.length) {
    return `<div class="empty-note">Пока нет данных для тепловой карты.</div>`;
  }

  return items.map(item => {
    const score = Math.min(100, (item.max_daily_lessons || 0) * 14 + (item.longest_streak || 0) * 8);
    const meterColor = item.status === "hot" ? "#b24b4b" : item.status === "busy" ? "#c9801f" : "#1e7a6f";
    return `
      <article class="heat-item">
        <div>
          <strong>${escapeHtml(item.teacher_name)}</strong>
          <p>Макс. уроков в день: ${escapeHtml(item.max_daily_lessons)}<br>Самая длинная серия без окна: ${escapeHtml(item.longest_streak)}</p>
          <div class="meta-row"><span class="badge ${badgeTone(item.status)}">${escapeHtml(item.status)}</span></div>
        </div>
        <div>
          <div class="heat-meter"><span style="width:${score}%;background:${meterColor};"></span></div>
        </div>
      </article>
    `;
  }).join("");
}

function renderStaffPlanCards(items, shortMode = false) {
  if (!items.length) {
    return `<div class="empty-note">Нет персональных планов на выбранный день.</div>`;
  }

  return items.map(item => `
    <article class="timeline-card">
      <strong>${escapeHtml(item.name)} · ${escapeHtml(item.role)}</strong>
      <p>${escapeHtml(item.department || "-")}</p>
      <div class="meta-row">
        <span class="badge neutral">${escapeHtml((item.plan || []).length)} blocks</span>
      </div>
      ${shortMode ? "" : `
        <div class="source-list">
          ${(item.plan || []).map(block => `<span>${escapeHtml(block.time)} — ${escapeHtml(block.title)}</span>`).join("") || "<span>Пока пусто.</span>"}
        </div>
      `}
    </article>
  `).join("");
}

function renderDocuments() {
  const options = ["", ...state.regulations.map(item => String(item.code))];
  fillSelect($("regulationSelect"), options, $("regulationSelect").value || "", value => {
    if (!value) return "Auto select";
    const found = state.regulations.find(item => String(item.code) === value);
    return found ? `${found.code} — ${found.title}` : value;
  });

  $("regulationCards").innerHTML = state.regulations.map(item => `
    <article class="task-card">
      <strong>${escapeHtml(item.code)} — ${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.summary)}</p>
      <div class="meta-row"><span class="badge neutral">RAG-lite pack</span></div>
    </article>
  `).join("");

  if (!state.latestDocumentResult) {
    return;
  }

  const result = state.latestDocumentResult;
  $("documentResult").classList.remove("empty-state");
  $("documentResult").innerHTML = `
    <div class="result-item">
      <div class="result-title">Document title</div>
      <div>${escapeHtml(result.document_title || "-")}</div>
    </div>
    <div class="result-item">
      <div class="result-title">Plain summary</div>
      <div>${escapeHtml(result.plain_summary || "-")}</div>
    </div>
    <div class="result-item">
      <div class="result-title">Teacher-friendly explanation</div>
      <div>${escapeHtml(result.teacher_friendly_explanation || "-")}</div>
    </div>
    <div class="result-item">
      <div class="result-title">Missing information</div>
      <div>${(result.missing_information || []).map(item => `• ${escapeHtml(item)}`).join("<br>") || "Нет"}</div>
    </div>
    <div class="result-item">
      <div class="result-title">Action checklist</div>
      <div>${(result.action_checklist || []).map(item => `• ${escapeHtml(item)}`).join("<br>") || "Нет"}</div>
    </div>
    <div class="result-item">
      <div class="result-title">Draft</div>
      <pre>${escapeHtml(result.draft_text || "-")}</pre>
    </div>
    <div class="result-item">
      <div class="result-title">Sources</div>
      <div class="source-list">${
        (result.sources || []).map(source => `
          <a href="${escapeHtml(source.source_url || "#")}" target="_blank" rel="noreferrer">
            ${escapeHtml(source.code || "-")} — ${escapeHtml(source.title || "-")}
          </a>
        `).join("") || "Нет источников"
      }</div>
    </div>
  `;
}

async function handleAiProcess() {
  const text = $("aiInput").value.trim();
  if (!text) {
    alert("Введите сообщение для AI intake.");
    return;
  }

  const result = await api("/api/ai/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source: "dashboard_ai", persist: true }),
  });
  state.latestAiResult = result;
  await refreshCore();
}

async function handleDocumentGenerate() {
  const query = $("docPrompt").value.trim();
  const documentCode = $("regulationSelect").value;
  if (!query) {
    alert("Опишите, какой приказ или отчет нужно подготовить.");
    return;
  }

  const result = await api("/api/regulations/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, document_code: documentCode || null }),
  });
  state.latestDocumentResult = result.result;
  renderDocuments();
}

async function createManualTask() {
  const title = $("taskTitle").value.trim();
  const assignee = $("taskAssignee").value.trim();
  const deadline = $("taskDeadline").value.trim();

  if (!title || !assignee || !deadline) {
    alert("Заполните все поля задачи.");
    return;
  }

  await api("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      assignee,
      deadline,
      status: "new",
      source: "dashboard_manual",
    }),
  });

  $("taskTitle").value = "";
  $("taskAssignee").value = "";
  $("taskDeadline").value = "";

  await refreshCore();
}

async function updateTaskStatus(index) {
  const task = state.tasks[index];
  const next = task.status === "new" ? "in_progress" : "done";
  await api(`/api/tasks/${index}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: next }),
  });
  await refreshCore();
}

async function updateIncidentStatus(index, status) {
  await api(`/api/incidents/${index}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  await refreshCore();
}

async function updateSubstitutionStatus(index, status) {
  await api(`/api/substitutions/${index}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  await refreshCore();
}

function setupNavigation() {
  document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach(item => item.classList.remove("active"));
      document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
      button.classList.add("active");
      $(button.dataset.page).classList.add("active");
    });
  });
}

function setupActions() {
  $("refreshDiningBtn").addEventListener("click", () => renderOverview());
  $("aiProcessBtn").addEventListener("click", handleAiProcess);
  $("generateDocBtn").addEventListener("click", handleDocumentGenerate);
  $("createTaskBtn").addEventListener("click", createManualTask);
  $("applyScheduleFilters").addEventListener("click", async () => {
    state.filters.day = $("dayFilter").value;
    state.filters.className = $("classFilter").value;
    state.filters.teacher = $("teacherFilter").value;
    state.filters.room = $("roomFilter").value.trim();
    await refreshScheduleData();
    renderSchedule();
    renderOverview();
  });

  document.addEventListener("click", async event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches(".ai-chip")) {
      $("aiInput").value = target.dataset.prompt || "";
    }

    const action = target.dataset.action;
    const index = Number(target.dataset.index);
    if (!action || Number.isNaN(index)) return;

    if (action === "task-next") await updateTaskStatus(index);
    if (action === "incident-progress") await updateIncidentStatus(index, "in_progress");
    if (action === "incident-done") await updateIncidentStatus(index, "done");
    if (action === "sub-approve") await updateSubstitutionStatus(index, "approved");
    if (action === "sub-reject") await updateSubstitutionStatus(index, "rejected");
  });

  $("voiceBtn").addEventListener("click", () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("В этом браузере voice input недоступен.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      $("aiInput").value = event.results[0][0].transcript;
    };
    recognition.start();
  });
}

async function init() {
  setupNavigation();
  setupActions();
  await refreshCore();
  setInterval(refreshCore, 12000);
}

init().catch(error => {
  console.error(error);
  alert(`Не удалось загрузить dashboard: ${error.message}`);
});
