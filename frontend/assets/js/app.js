const DASHBOARD_DATE_LOOKAHEAD_DAYS = 7;
const CHART_LABELS = ["To do", "In progress", "Done"];
const CHART_COLORS = ["#fbbf24", "#38bdf8", "#22c55e"];
const DOUGHNUT_VALUE_PLUGIN_ID = "doughnutValueLabels";
let dashboardRefs = null;
let currentDashboardUser = null;
let userProjectsCache = null;
let chartValuePluginRegistered = false;
let dashboardScrollLockListenerAttached = false;

document.addEventListener("DOMContentLoaded", () => {
    setupBackToTopButton();
    if (document.body.classList.contains("body-dashboard")) {
        initDashboard();
    }
});

function registerDashboardChartPlugin() {
    if (chartValuePluginRegistered || typeof Chart === "undefined") {
        return;
    }
    Chart.register({
        id: DOUGHNUT_VALUE_PLUGIN_ID,
        afterDatasetsDraw(chart) {
            const options = chart.options?.plugins?.[DOUGHNUT_VALUE_PLUGIN_ID] || {};
            const color = options.color || "#0f172a";
            const fontSize = options.fontSize || 13;
            const fontFamily = options.fontFamily || "Inter, system-ui, sans-serif";
            const fontWeight = options.fontWeight || "600";

            const datasets = chart.data?.datasets || [];
            const ctx = chart.ctx;
            ctx.save();
            datasets.forEach((dataset, datasetIndex) => {
                const meta = chart.getDatasetMeta(datasetIndex);
                meta.data.forEach((arc, index) => {
                    const value = dataset.data[index];
                    if (!value) {
                        return;
                    }
                    const { x, y } = arc.tooltipPosition();
                    ctx.fillStyle = color;
                    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(value, x, y);
                });
            });
            ctx.restore();
        }
    });
    chartValuePluginRegistered = true;
}

function initDashboard() {
    registerDashboardChartPlugin();
    dashboardRefs = {
        columns: {
            to_do: document.getElementById("todoColumn"),
            in_progress: document.getElementById("progressColumn"),
            done: document.getElementById("doneColumn")
        },
        counts: {
            to_do: document.getElementById("todoCount"),
            in_progress: document.getElementById("progressCount"),
            done: document.getElementById("doneCount")
        },
        stats: {
            total: document.getElementById("totalTasksStat"),
            progress: document.getElementById("inProgressTasksStat"),
            completed: document.getElementById("completedTasksStat"),
            upcoming: document.getElementById("upcomingTasksStat"),
            projects: document.getElementById("totalProjectsStat")
        },
        board: document.getElementById("dashboardBoard"),
        boardToolbar: document.querySelector(".board-toolbar"),
        boardMessage: document.getElementById("emptyBoardMessage"),
        taskModal: document.getElementById("taskModal"),
        taskForm: document.getElementById("taskForm"),
        taskMessage: document.getElementById("taskFormMessage"),
        taskSubmitBtn: document.getElementById("taskSubmitBtn"),
        taskCancelBtn: document.getElementById("taskCancelBtn"),
        openTaskBtn: document.getElementById("openTaskModal"),
        newProjectBtn: document.getElementById("goToProjectsBtn"),
        taskModalTitle: document.getElementById("taskModalTitle"),
        taskModalSubtitle: document.getElementById("taskModalSubtitle"),
        latestTasks: [],
        chart: {
            project: createChartRefs("project"),
            personal: createChartRefs("personal")
        }
    };

    fetchCurrentUser()
        .then(user => {
            currentDashboardUser = user;
            return Promise.all([fetchTasks(), fetchUserProjects()]);
        })
        .catch(error => {
            console.error(error);
            setBoardMessage("Unable to load your tasks. Please refresh.");
        });

    setupTaskModal();
    setupBoardVisibilityToggle();
    ensureDashboardScrollLockListener();
    syncDashboardScrollLock();
    setupDashboardShortcuts();
    ensureDashboardButtonFallbacks();
}

function createChartRefs(prefix) {
    const canvas = document.getElementById(`${prefix}StatusChart`);
    const legendWrapper = document.getElementById(`${prefix}StatusLegend`);
    return {
        canvas,
        visual: canvas?.closest(".chart-card__visual") || null,
        legend: {
            todo: document.getElementById(`${prefix}LegendTodo`),
            progress: document.getElementById(`${prefix}LegendProgress`),
            done: document.getElementById(`${prefix}LegendDone`),
            wrapper: legendWrapper
        },
        empty: document.getElementById(`${prefix}ChartEmpty`),
        instance: null
    };
}

async function fetchTasks() {
    const token = localStorage.getItem("tm_access_token");
    if (!token || !dashboardRefs) return;
    if (!currentDashboardUser) {
        try {
            currentDashboardUser = await fetchCurrentUser(true);
        } catch (error) {
            setBoardMessage("Unable to load your profile");
            return;
        }
    }

    try {
        const response = await authedFetch("/tasks/");
        const tasks = await response.json();
        renderDashboard(tasks);

    } catch (error) {
        setBoardMessage(`Failed to load tasks: ${error.message}`);
    }
}

async function fetchUserProjects() {
    try {
        const response = await authedFetch("/projects/");
        const projects = await response.json();
        if (!Array.isArray(projects)) {
            throw new Error("Unexpected response");
        }
        userProjectsCache = projects.filter(project => isMemberOfProject(project, currentDashboardUser?.id));
        updateProjectStat();
    } catch (error) {
        console.error("Unable to load project list", error);
    }
}

function isMemberOfProject(project, userId) {
    if (!project || !userId) {
        return false;
    }
    if (project.owner?.id === userId || project.owner_id === userId) {
        return true;
    }
    const memberships = project.memberships || [];
    return memberships.some(member => member.user?.id === userId || member.user_id === userId);
}

function renderDashboard(tasks) {
    if (!dashboardRefs) return;

    const taskList = Array.isArray(tasks) ? tasks : [];
    const filteredTasks = filterTasksForCurrentUser(taskList);
    dashboardRefs.latestTasks = filteredTasks;

    const groupedAll = ensureGroupedObject(groupTasksByStatus(filteredTasks));
    const projectTasks = filteredTasks.filter(task => !task.is_personal);
    const personalTasks = filteredTasks.filter(task => task.is_personal);
    const groupedProject = ensureGroupedObject(groupTasksByStatus(projectTasks));
    const groupedPersonal = ensureGroupedObject(groupTasksByStatus(personalTasks));

    Object.entries(groupedAll).forEach(([key, value]) => {
        const list = Array.isArray(value) ? value : [];
        const column = dashboardRefs.columns[key];
        if (!column) return;
        column.innerHTML = list.length
            ? list.map(task => createTaskCard(task)).join("")
            : '<p class="empty-state">No tasks yet.</p>';

        if (dashboardRefs.counts[key]) {
            dashboardRefs.counts[key].textContent = list.length;
        }
    });

    const upcoming = filteredTasks.filter(task => isUpcoming(task.due_date)).length;

    dashboardRefs.stats.total.textContent = filteredTasks.length;
    dashboardRefs.stats.progress.textContent = groupedAll.in_progress.length;
    dashboardRefs.stats.completed.textContent = groupedAll.done.length;
    dashboardRefs.stats.upcoming.textContent = upcoming;
    updateStatusChart("project", groupedProject);
    updateStatusChart("personal", groupedPersonal);
    updateProjectStat();
    updateEmptyStateVisibility(filteredTasks.length);
    syncDashboardScrollLock();
}

function updateEmptyStateVisibility(taskCount) {
    if (!dashboardRefs?.boardMessage) {
        return;
    }
    const shell = document.querySelector(".dashboard-shell");
    const boardHidden = shell?.classList.contains("board-hidden");
    if (boardHidden) {
        dashboardRefs.boardMessage.hidden = true;
        return;
    }
    const hasTasks = taskCount > 0;
    dashboardRefs.boardMessage.dataset.hasTasks = hasTasks ? "true" : "false";
    dashboardRefs.boardMessage.hidden = hasTasks;
}

function groupTasksByStatus(taskList) {
    const grouped = { to_do: [], in_progress: [], done: [] };
    (taskList || []).forEach(task => {
        const key = (task.status || "").toLowerCase();
        if (grouped[key]) {
            grouped[key].push(task);
        } else {
            grouped.to_do.push(task);
        }
    });
    return grouped;
}

function ensureGroupedObject(grouped) {
    return {
        to_do: grouped?.to_do ?? [],
        in_progress: grouped?.in_progress ?? [],
        done: grouped?.done ?? []
    };
}

function filterTasksForCurrentUser(taskList) {
    if (!currentDashboardUser) {
        return taskList;
    }
    const userId = currentDashboardUser.id;
    return taskList.filter(task => {
        const creatorId = task.creator?.id ?? task.creator_id;
        if (task.is_personal) {
            return creatorId === userId;
        }
        const assigneeId = task.assignee?.id ?? task.assignee_id;
        return assigneeId === userId;
    });
}

function updateProjectStat() {
    if (!dashboardRefs?.stats?.projects) {
        return;
    }
    if (!userProjectsCache) {
        dashboardRefs.stats.projects.textContent = "0";
        return;
    }
    dashboardRefs.stats.projects.textContent = userProjectsCache.length;
}

function updateStatusChart(chartKey, grouped) {
    const chartRefs = dashboardRefs?.chart?.[chartKey];
    if (!chartRefs) {
        return;
    }

    const buckets = ensureGroupedObject(grouped);
    const dataset = [
        buckets.to_do.length,
        buckets.in_progress.length,
        buckets.done.length
    ];
    const total = dataset.reduce((sum, value) => sum + value, 0);

    updateStatusLegend(chartKey, dataset);
    toggleChartEmptyState(chartKey, total === 0);

    if (typeof Chart === "undefined" || !chartRefs.canvas) {
        return;
    }

    if (total === 0) {
        if (chartRefs.instance) {
            chartRefs.instance.destroy();
            chartRefs.instance = null;
        }
        return;
    }

    if (!chartRefs.instance) {
        const ctx = chartRefs.canvas.getContext("2d");
        chartRefs.instance = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: CHART_LABELS,
                datasets: [{
                    data: dataset,
                    backgroundColor: CHART_COLORS,
                    borderColor: "transparent",
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "65%",
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                const value = context.raw ?? 0;
                                return `${context.label}: ${value}`;
                            }
                        }
                    },
                    [DOUGHNUT_VALUE_PLUGIN_ID]: {
                        color: "#020617",
                        fontSize: 14
                    }
                }
            }
        });
    } else {
        chartRefs.instance.data.datasets[0].data = dataset;
        chartRefs.instance.update();
    }
}

function updateStatusLegend(chartKey, [todoCount, progressCount, doneCount]) {
    const legend = dashboardRefs?.chart?.[chartKey]?.legend;
    if (!legend) {
        return;
    }
    if (legend.todo) {
        legend.todo.textContent = todoCount;
    }
    if (legend.progress) {
        legend.progress.textContent = progressCount;
    }
    if (legend.done) {
        legend.done.textContent = doneCount;
    }
}

function toggleChartEmptyState(chartKey, isEmpty) {
    const chartRefs = dashboardRefs?.chart?.[chartKey];
    if (!chartRefs) {
        return;
    }
    if (chartRefs.visual) {
        chartRefs.visual.hidden = isEmpty;
    }
    if (chartRefs.legend?.wrapper) {
        chartRefs.legend.wrapper.hidden = isEmpty;
    }
    if (chartRefs.empty) {
        chartRefs.empty.hidden = !isEmpty;
    }
}

function setupBoardVisibilityToggle() {
    const btn = document.getElementById("toggleTaskVisibilityBtn");
    const shell = document.querySelector(".dashboard-shell");
    if (!btn || !shell) {
        return;
    }

    applyVisibilityButtonState(btn, shell.classList.contains("board-hidden"));
    if (btn.dataset.dashboardBound === "true") {
        return;
    }

    btn.addEventListener("click", () => {
        toggleDashboardBoardVisibility(shell, btn);
    });
    btn.dataset.dashboardBound = "true";
}

function setupDashboardShortcuts() {
    if (!dashboardRefs) {
        return;
    }
    if (dashboardRefs.newProjectBtn && dashboardRefs.newProjectBtn.dataset.dashboardBound !== "true") {
        dashboardRefs.newProjectBtn.addEventListener("click", handleNewProjectShortcut);
        dashboardRefs.newProjectBtn.dataset.dashboardBound = "true";
    }
    if (dashboardRefs.openTaskBtn && dashboardRefs.openTaskBtn.dataset.dashboardBound !== "true") {
        dashboardRefs.openTaskBtn.addEventListener("click", handleAddTaskShortcut);
        dashboardRefs.openTaskBtn.dataset.dashboardBound = "true";
    }
}

function handleNewProjectShortcut() {
    window.location.href = "projects.php";
}

function handleAddTaskShortcut(event) {
    event?.preventDefault?.();
    openTaskModal();
}

function applyVisibilityButtonState(button, isHidden) {
    if (!button) {
        return;
    }
    button.dataset.state = isHidden ? "hidden" : "visible";
    button.textContent = isHidden ? "Show tasks" : "Hide tasks";
}

function toggleDashboardBoardVisibility(shellRef, buttonRef) {
    const shell = shellRef || document.querySelector(".dashboard-shell");
    const button = buttonRef || document.getElementById("toggleTaskVisibilityBtn");
    if (!shell || !button) {
        return false;
    }
    const isHidden = shell.classList.toggle("board-hidden");
    applyVisibilityButtonState(button, isHidden);
    updateEmptyStateVisibility(dashboardRefs?.latestTasks?.length || 0);
    if (!isHidden) {
        scrollBoardIntoView();
    } else {
        scrollPageToTop();
    }
    syncDashboardScrollLock();
    return true;
}

function ensureDashboardScrollLockListener() {
    if (dashboardScrollLockListenerAttached) {
        return;
    }
    window.addEventListener("resize", syncDashboardScrollLock, { passive: true });
    dashboardScrollLockListenerAttached = true;
}

function syncDashboardScrollLock() {
    const body = document.body;
    const shell = document.querySelector(".dashboard-shell");
    if (!body || !shell) {
        if (body) {
            body.classList.remove("dashboard-scroll-locked");
        }
        return;
    }
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const pageHeight = document.documentElement.scrollHeight;
    const boardHidden = shell.classList.contains("board-hidden");
    const shouldLock = boardHidden && pageHeight <= viewportHeight + 1;
    body.classList.toggle("dashboard-scroll-locked", shouldLock);
}

function scrollBoardIntoView() {
    const target = dashboardRefs?.boardToolbar || dashboardRefs?.board || document.getElementById("dashboardBoard");
    if (!target) {
        return;
    }
    requestAnimationFrame(() => {
        const offset = target.getBoundingClientRect().top + window.scrollY - 32;
        window.scrollTo({
            top: Math.max(offset, 0),
            behavior: "smooth"
        });
    });
}

function scrollPageToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupBackToTopButton() {
    const button = document.querySelector(".back-to-top");
    if (!button) {
        return;
    }

    const toggleVisibility = () => {
        if (window.scrollY > 240) {
            button.classList.add("back-to-top--visible");
        } else {
            button.classList.remove("back-to-top--visible");
        }
    };

    button.addEventListener("click", event => {
        event.preventDefault();
        scrollPageToTop();
    });

    window.addEventListener("scroll", toggleVisibility, { passive: true });
    toggleVisibility();
}

function setBoardMessage(message) {
    if (!dashboardRefs?.boardMessage) return;
    dashboardRefs.boardMessage.hidden = false;
    dashboardRefs.boardMessage.textContent = message;
    dashboardRefs.boardMessage.dataset.hasTasks = "false";
}

function setupTaskModal() {
    if (!dashboardRefs?.taskModal) {
        return;
    }
    if (dashboardRefs.taskCancelBtn && dashboardRefs.taskCancelBtn.dataset.dashboardBound !== "true") {
        dashboardRefs.taskCancelBtn.addEventListener("click", closeTaskModal);
        dashboardRefs.taskCancelBtn.dataset.dashboardBound = "true";
    }
    if (dashboardRefs.taskModal && dashboardRefs.taskModal.dataset.dashboardBound !== "true") {
        dashboardRefs.taskModal.addEventListener("click", event => {
        if (event.target?.dataset?.modalDismiss !== undefined) {
            closeTaskModal();
        }
        });
        dashboardRefs.taskModal.dataset.dashboardBound = "true";
    }
    dashboardRefs.taskForm?.addEventListener("submit", handleTaskFormSubmit);
    populateDueTimeSelects();
    setTaskFormMode("create");
    dashboardRefs.columns?.to_do?.addEventListener("click", handleTaskActionClick);
    dashboardRefs.columns?.in_progress?.addEventListener("click", handleTaskActionClick);
    dashboardRefs.columns?.done?.addEventListener("click", handleTaskActionClick);
}

function handleTaskActionClick(event) {
    // No longer handling edit clicks or status changes here
}

function findTaskById(taskId) {
    return dashboardRefs?.latestTasks?.find(task => task.id === taskId);
}

function populateDueTimeSelects() {
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
    const minutesSeconds = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

    const hourSelect = document.getElementById("taskDueHour");
    const minuteSelect = document.getElementById("taskDueMinute");
    const secondSelect = document.getElementById("taskDueSecond");

    if (hourSelect && hourSelect.options.length === 0) {
        hourSelect.innerHTML = hours.map(value => `<option value="${value}">${value}</option>`).join("");
    }
    if (minuteSelect && minuteSelect.options.length === 0) {
        minuteSelect.innerHTML = minutesSeconds.map(value => `<option value="${value}">${value}</option>`).join("");
    }
    if (secondSelect && secondSelect.options.length === 0) {
        secondSelect.innerHTML = minutesSeconds.map(value => `<option value="${value}">${value}</option>`).join("");
    }

    const dueDateInput = document.getElementById("taskDueDate");
    dueDateInput?.addEventListener("change", event => {
        const enabled = Boolean(event.target.value);
        toggleDueTimeSelects(enabled);
    });

    toggleDueTimeSelects(false, true);
}

function openTaskModal(task = null) {
    const modal = dashboardRefs?.taskModal || document.getElementById("taskModal");
    const form = dashboardRefs?.taskForm || modal?.querySelector("form");
    if (!modal || !form) {
        return;
    }
    if (dashboardRefs?.taskModal !== modal) {
        // dashboardRefs not initialized; ensure baseline state
        modal.setAttribute("data-fallback", "true");
    }
    setTaskFormMode(task ? "edit" : "create", task || null);
    modal.removeAttribute("hidden");
    modal.querySelector("input[name='title']")?.focus();
}

function closeTaskModal() {
    const modal = dashboardRefs?.taskModal || document.getElementById("taskModal");
    if (!modal) {
        return;
    }
    modal.setAttribute("hidden", "true");
    setTaskFormMode("create");
}

async function handleTaskFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const mode = form.dataset.mode || "create";
    const payload = buildTaskPayload(form);
    if (!payload) {
        return;
    }

    if (mode === "edit") {
        const taskId = Number(form.dataset.taskId);
        if (!taskId) {
            setTaskFormMessage("Unable to determine which task to update.", "error");
            return;
        }
        if (!hasTaskFormChanges(form, payload)) {
            setTaskFormMessage("Make a change before saving.", "error");
            return;
        }
        await submitTaskUpdate(taskId, payload, form);
    } else {
        await submitPersonalTask(payload, form);
    }
}

function buildTaskPayload(form) {
    const title = form.title.value.trim();
    if (!title) {
        setTaskFormMessage("Title is required", "error");
        return null;
    }

    const startDateValue = form.start_date.value;
    if (!startDateValue) {
        setTaskFormMessage("Start date is required", "error");
        return null;
    }

    const startDate = new Date(startDateValue);
    if (Number.isNaN(startDate.getTime())) {
        setTaskFormMessage("Invalid start date", "error");
        return null;
    }

    const dueDate = form.due_date_date.value;
    let dueDateIso = null;
    if (dueDate) {
        const hour = form.due_hour.value || "00";
        const minute = form.due_minute.value || "00";
        const second = form.due_second.value || "00";
        const due = new Date(`${dueDate}T${hour}:${minute}:${second}`);
        if (Number.isNaN(due.getTime())) {
            setTaskFormMessage("Invalid due date", "error");
            return null;
        }
        dueDateIso = due.toISOString();
    }

    return {
        title,
        description: form.description.value.trim() || null,
        priority: form.priority.value,
        start_date: startDate.toISOString(),
        due_date: dueDateIso
    };
}

async function submitPersonalTask(basePayload, form) {
    const payload = { ...basePayload, is_personal: true };
    setTaskFormMessage("", "");
    setLoading(getTaskSubmitButton(), true, "Creating...");

    try {
        const response = await authedFetch("/tasks/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.detail || "Unable to create task");
        }

        setTaskFormMessage("Personal task created! Redirecting to Personal tasks page...", "success");
        form.reset();

        setTimeout(() => {
            window.location.href = "http://localhost/task_management/personal_tasks.php";
        }, 800);
    } catch (error) {
        setTaskFormMessage(error.message, "error");
    } finally {
        setLoading(getTaskSubmitButton(), false, "Create task");
    }
}

async function submitTaskUpdate(taskId, payload, form) {
    setTaskFormMessage("", "");
    setLoading(getTaskSubmitButton(), true, "Saving...");

    try {
        const response = await authedFetch(`/tasks/${taskId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.detail || "Unable to update task");
        }

        setTaskFormMessage("Task updated!", "success");
        await fetchTasks();

        setTimeout(() => {
            closeTaskModal();
        }, 800);
    } catch (error) {
        setTaskFormMessage(error.message, "error");
    } finally {
        const label = form.dataset.mode === "edit" ? "Save changes" : "Create task";
        setLoading(getTaskSubmitButton(), false, label);
    }
}

function setTaskFormMode(mode = "create", task = null) {
    const form = dashboardRefs?.taskForm || document.getElementById("taskForm");
    if (!form) {
        return;
    }
    const submitBtn = getTaskSubmitButton();

    form.reset();
    setTaskFormMessage("", "");

    const isEdit = mode === "edit" && Boolean(task);
    form.dataset.mode = isEdit ? "edit" : "create";

    if (isEdit && task) {
        form.dataset.taskId = String(task.id);
        form.title.value = task.title || "";
        form.description.value = task.description || "";
        form.priority.value = (task.priority || "medium").toLowerCase();
        setDefaultStartDate(task.start_date || new Date());
        setDueDateFields(task.due_date);
        setModalCopy("edit");
        rememberTaskFormBaseline(task);
        if (submitBtn) {
            submitBtn.textContent = "Save changes";
        }
    } else {
        delete form.dataset.taskId;
        setDefaultStartDate();
        setDueDateFields(null);
        setModalCopy("create");
        rememberTaskFormBaseline(null);
        if (submitBtn) {
            submitBtn.textContent = "Create task";
        }
    }
}

function rememberTaskFormBaseline(task) {
    const form = dashboardRefs?.taskForm || document.getElementById("taskForm");
    if (!form) {
        return;
    }

    if (!task) {
        delete form.dataset.originalPayload;
        return;
    }

    const baseline = normalizeTaskPayload({
        title: task.title || "",
        description: task.description || null,
        priority: (task.priority || "medium").toLowerCase(),
        start_date: safeIsoString(task.start_date || task.created_at),
        due_date: safeIsoString(task.due_date)
    });
    form.dataset.originalPayload = JSON.stringify(baseline);
}

function normalizeTaskPayload(payload) {
    return {
        title: payload.title || "",
        description: payload.description || null,
        priority: (payload.priority || "medium").toLowerCase(),
        start_date: payload.start_date || null,
        due_date: payload.due_date || null
    };
}

function hasTaskFormChanges(form, payload) {
    if (!form?.dataset?.originalPayload) {
        return true;
    }

    try {
        const original = JSON.parse(form.dataset.originalPayload);
        const current = normalizeTaskPayload(payload);
        return Object.keys({ ...original, ...current }).some(key => original[key] !== current[key]);
    } catch (error) {
        console.error("Unable to compare task payload", error);
        return true;
    }
}

function safeIsoString(value) {
    if (!value) {
        return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toISOString();
}

function setModalCopy(mode) {
    const titleEl = dashboardRefs?.taskModalTitle || document.getElementById("taskModalTitle");
    const subtitleEl = dashboardRefs?.taskModalSubtitle || document.getElementById("taskModalSubtitle");
    const key = mode === "edit" ? "editText" : "createText";
    if (titleEl && titleEl.dataset?.[key]) {
        titleEl.textContent = titleEl.dataset[key];
    }
    if (subtitleEl && subtitleEl.dataset?.[key]) {
        subtitleEl.textContent = subtitleEl.dataset[key];
    }
}

function setDueDateFields(dateString) {
    const dateInput = document.getElementById("taskDueDate");
    const hourSelect = document.getElementById("taskDueHour");
    const minuteSelect = document.getElementById("taskDueMinute");
    const secondSelect = document.getElementById("taskDueSecond");

    if (!dateInput) {
        return;
    }

    if (!dateString) {
        dateInput.value = "";
        toggleDueTimeSelects(false, true);
        return;
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        dateInput.value = "";
        toggleDueTimeSelects(false, true);
        return;
    }

    const local = formatDateTimeLocal(date);
    dateInput.value = local ? local.slice(0, 10) : "";
    toggleDueTimeSelects(true, false);

    if (hourSelect) {
        hourSelect.value = padTimeUnit(date.getHours());
    }
    if (minuteSelect) {
        minuteSelect.value = padTimeUnit(date.getMinutes());
    }
    if (secondSelect) {
        secondSelect.value = padTimeUnit(date.getSeconds());
    }
}

function padTimeUnit(value) {
    return String(value).padStart(2, "0");
}

async function updateTaskStatus(taskId, newStatus, select) {
    const task = findTaskById(taskId);
    if (!task) {
        return;
    }

    if (newStatus === "done" && task.due_date) {
        const now = new Date();
        const dueDate = new Date(task.due_date);
        if (now > dueDate) {
            window.showToast?.("Task cannot be completed", {
                type: "error",
                description: "Adjust the due date before marking it done."
            });
            select.value = task.status;
            return;
        }
    }

    select.disabled = true;
    try {
        const response = await authedFetch(`/tasks/${taskId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.detail || "Unable to update status");
        }

        task.status = newStatus;
        await fetchTasks();
    } catch (error) {
        window.showToast?.("Unable to update status", { type: "error", description: error.message });
        select.value = task.status;
    } finally {
        select.disabled = false;
    }
}

function setTaskFormMessage(text, state) {
    const el = dashboardRefs?.taskMessage || document.getElementById("taskFormMessage");
    if (!el) return;
    el.textContent = text;
    el.className = "helper-text";
    if (state) {
        el.classList.add(state);
        const toastType = state === "success" ? "success" : state === "error" ? "error" : null;
        if (toastType) {
            const resolved = text || (toastType === "success" ? "Action completed" : "Something went wrong");
            window.showToast?.(resolved, { type: toastType });
        }
    }
}

function createTaskCard(task) {
    const safeTitle = escapeHtml(task.title);
    const safeDescription = escapeHtml(task.description || "No description yet");
    const statusClass = getStatusClass(task.status);
    const priority = (task.priority || '').toUpperCase();
    const due = formatDate(task.due_date);
    const priorityLower = (task.priority || 'medium').toLowerCase();
    const isPersonalTask = Boolean(task.is_personal);
    const projectBadge = !isPersonalTask && (task.project || task.project_id)
        ? `<span class="task-card__badge" title="${escapeHtml(task.project?.name || "Project task")}">Project task</span>`
        : "";
    const editHref = isPersonalTask
        ? `personal_tasks.php?highlight_task_id=${task.id}`
        : buildProjectTaskEditLink(task);

    return `
        <article class="task-card" data-task-id="${task.id}" data-priority="${priorityLower}">
            <div class="task-card__top">
                <div class="task-header">
                    <h3>${safeTitle}</h3>
                    <span class="status-badge ${statusClass}">
                        ${formatStatusLabel(task.status)}
                    </span>
                </div>
                <div class="task-card__labels">
                    ${projectBadge}
                    <span class="priority-chip priority-chip--${priorityLower}">${priority || 'N/A'}</span>
                </div>
            </div>
            <p>${safeDescription}</p>
            <div class="task-meta">
                <span>Due: ${due}</span>
                <span>Start: ${formatDate(task.start_date)}</span>
            </div>
            <div class="task-card__actions">
                <a href="${editHref}" class="ghost-button">Edit details</a>
            </div>
        </article>
    `;
}

function renderStatusSelectOptions(currentStatus) {
    const normalized = (currentStatus || "").toLowerCase();
    const statuses = ["to_do", "in_progress", "done"];
    return statuses
        .map(status => `<option value="${status}" ${status === normalized ? "selected" : ""}>${formatStatusLabel(status)}</option>`)
        .join("");
}

function getStatusClass(status) {
    if (!status) return 'status-todo';
    const normalized = status.toLowerCase().replace('_', '');
    return `status-${normalized}`;
}

function humanize(value) {
    if (!value) return '';
    return value
        .toLowerCase()
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatStatusLabel(value) {
    const label = humanize(value);
    return label.replace(/\s+/g, "\u00A0");
}

function formatDate(dateString) {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'No date';
    return date.toLocaleDateString();
}

function buildProjectTaskEditLink(task) {
    if (!task) {
        return "projects.php";
    }
    const projectId = task.project?.id ?? task.project_id;
    if (!projectId) {
        return "projects.php";
    }
    const base = `project_detail.php?id=${projectId}`;
    return task.id ? `${base}&edit_task_id=${task.id}` : base;
}

function isUpcoming(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    const diff = (date - now) / (1000 * 60 * 60 * 24);
    // Treat anything due within the next week as upcoming.
    return diff >= 0 && diff <= DASHBOARD_DATE_LOOKAHEAD_DAYS;
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setDefaultStartDate(value) {
    const input = document.getElementById("taskStartDate");
    if (!input) {
        return;
    }
    const date = value ? new Date(value) : new Date();
    let formatted = formatDateTimeLocal(date);
    if (!formatted) {
        formatted = formatDateTimeLocal(new Date());
    }
    input.value = formatted || "";
}

function formatDateTimeLocal(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString();
    return localISOTime.slice(0, 16);
}

function toggleDueTimeSelects(enabled, resetValue = false) {
    const selects = [
        document.getElementById("taskDueHour"),
        document.getElementById("taskDueMinute"),
        document.getElementById("taskDueSecond")
    ];

    selects.forEach(select => {
        if (!select) {
            return;
        }
        select.disabled = !enabled;
        if (resetValue || !enabled) {
            select.selectedIndex = 0;
        }
    });
}

function getTaskSubmitButton() {
    return dashboardRefs?.taskSubmitBtn || document.getElementById("taskSubmitBtn");
}

function setLoading(button, isLoading, label) {
    const target = button || getTaskSubmitButton();
    if (!target) {
        return;
    }
    target.disabled = Boolean(isLoading);
    if (label) {
        target.textContent = label;
    }
}

function ensureDashboardButtonFallbacks() {
    const addTaskBtn = document.getElementById("openTaskModal");
    if (addTaskBtn && addTaskBtn.dataset.dashboardBound !== "true") {
        addTaskBtn.addEventListener("click", handleAddTaskShortcut);
        addTaskBtn.dataset.dashboardBound = "true";
    }

    const newProjectBtn = document.getElementById("goToProjectsBtn");
    if (newProjectBtn && newProjectBtn.dataset.dashboardBound !== "true") {
        newProjectBtn.addEventListener("click", handleNewProjectShortcut);
        newProjectBtn.dataset.dashboardBound = "true";
    }

    const toggleBtn = document.getElementById("toggleTaskVisibilityBtn");
    const shell = document.querySelector(".dashboard-shell");
    if (toggleBtn && shell && toggleBtn.dataset.dashboardBound !== "true") {
        applyVisibilityButtonState(toggleBtn, shell.classList.contains("board-hidden"));
        toggleBtn.addEventListener("click", () => {
            toggleDashboardBoardVisibility(shell, toggleBtn);
        });
        toggleBtn.dataset.dashboardBound = "true";
    }

    ensureTaskModalFallbacks();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureDashboardButtonFallbacks);
} else {
    ensureDashboardButtonFallbacks();
}

function ensureTaskModalFallbacks() {
    const cancelBtn = document.getElementById("taskCancelBtn");
    if (cancelBtn && cancelBtn.dataset.dashboardBound !== "true") {
        cancelBtn.addEventListener("click", closeTaskModal);
        cancelBtn.dataset.dashboardBound = "true";
    }

    const modal = document.getElementById("taskModal");
    if (modal && modal.dataset.dashboardBound !== "true") {
        modal.addEventListener("click", event => {
            if (event.target?.dataset?.modalDismiss !== undefined) {
                closeTaskModal();
            }
        });
        modal.dataset.dashboardBound = "true";
    }
}
