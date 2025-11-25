const DASHBOARD_DATE_LOOKAHEAD_DAYS = 7;
let dashboardRefs = null;

document.addEventListener("DOMContentLoaded", () => {
    if (document.body.classList.contains("body-dashboard")) {
        initDashboard();
    }
});

function initDashboard() {
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
            upcoming: document.getElementById("upcomingTasksStat")
        },
        boardMessage: document.getElementById("emptyBoardMessage"),
        taskModal: document.getElementById("taskModal"),
        taskForm: document.getElementById("taskForm"),
        taskMessage: document.getElementById("taskFormMessage"),
        taskSubmitBtn: document.getElementById("taskSubmitBtn"),
        taskCancelBtn: document.getElementById("taskCancelBtn"),
        openTaskBtn: document.getElementById("openTaskModal"),
        closeTaskBtn: document.getElementById("closeTaskModal"),
        taskModalTitle: document.getElementById("taskModalTitle"),
        taskModalSubtitle: document.getElementById("taskModalSubtitle"),
        latestTasks: []
    };

    fetchTasks();

    setupTaskModal();
}

async function fetchTasks() {
    const token = localStorage.getItem("tm_access_token");
    if (!token || !dashboardRefs) return;

    try {
        const response = await authedFetch("/tasks/");
        const tasks = await response.json();
        renderDashboard(tasks);

    } catch (error) {
        setBoardMessage(`Failed to load tasks: ${error.message}`);
    }
}

function renderDashboard(tasks) {
    if (!dashboardRefs) return;

    const taskList = Array.isArray(tasks) ? tasks : [];
    dashboardRefs.latestTasks = taskList;
    const grouped = { to_do: [], in_progress: [], done: [] };

    taskList.forEach(task => {
        const key = (task.status || '').toLowerCase();
        if (grouped[key]) {
            grouped[key].push(task);
        } else {
            grouped.to_do.push(task);
        }
    });

    Object.entries(grouped).forEach(([key, list]) => {
        const column = dashboardRefs.columns[key];
        if (!column) return;
        column.innerHTML = list.length
            ? list.map(task => createTaskCard(task)).join("")
            : '<p class="empty-state">No tasks yet.</p>';

        if (dashboardRefs.counts[key]) {
            dashboardRefs.counts[key].textContent = list.length;
        }
    });

    const upcoming = taskList.filter(task => isUpcoming(task.due_date)).length;

    dashboardRefs.stats.total.textContent = taskList.length;
    dashboardRefs.stats.progress.textContent = grouped.in_progress.length;
    dashboardRefs.stats.completed.textContent = grouped.done.length;
    dashboardRefs.stats.upcoming.textContent = upcoming;

    if (dashboardRefs.boardMessage) {
        dashboardRefs.boardMessage.hidden = tasks.length !== 0;
    }
}

function setBoardMessage(message) {
    if (!dashboardRefs?.boardMessage) return;
    dashboardRefs.boardMessage.hidden = false;
    dashboardRefs.boardMessage.textContent = message;
}

function setupTaskModal() {
    if (!dashboardRefs?.taskModal) {
        return;
    }
    dashboardRefs.openTaskBtn?.addEventListener("click", () => openTaskModal());
    dashboardRefs.closeTaskBtn?.addEventListener("click", closeTaskModal);
    dashboardRefs.taskCancelBtn?.addEventListener("click", closeTaskModal);
    dashboardRefs.taskModal.addEventListener("click", event => {
        if (event.target?.dataset?.modalDismiss !== undefined) {
            closeTaskModal();
        }
    });
    dashboardRefs.taskForm?.addEventListener("submit", handleTaskFormSubmit);
    populateDueTimeSelects();
    setTaskFormMode("create");
    dashboardRefs.columns?.to_do?.addEventListener("click", handleTaskActionClick);
    dashboardRefs.columns?.in_progress?.addEventListener("click", handleTaskActionClick);
    dashboardRefs.columns?.done?.addEventListener("click", handleTaskActionClick);
}

function handleTaskActionClick(event) {
    const editBtn = event.target.closest("[data-edit-task]");
    if (editBtn) {
        const taskId = Number(editBtn.getAttribute("data-edit-task"));
        const task = findTaskById(taskId);
        if (task) {
            openTaskModal(task);
        }
        return;
    }

    const select = event.target.closest("select[data-status-select]");
    if (select) {
        const taskId = Number(select.getAttribute("data-status-select"));
        const task = findTaskById(taskId);
        if (!task) {
            return;
        }

        const newStatus = select.value;
        if (newStatus === task.status) {
            return;
        }

        const confirmChange = window.confirm(`Update status to ${humanize(newStatus)}?`);
        if (!confirmChange) {
            select.value = task.status;
            return;
        }

        updateTaskStatus(taskId, newStatus, select);
    }
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
    if (!dashboardRefs?.taskModal) {
        return;
    }
    setTaskFormMode(task ? "edit" : "create", task || null);
    dashboardRefs.taskModal.removeAttribute("hidden");
    dashboardRefs.taskModal?.querySelector("input[name='title']")?.focus();
}

function closeTaskModal() {
    if (!dashboardRefs?.taskModal) {
        return;
    }
    dashboardRefs.taskModal.setAttribute("hidden", "true");
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
    setLoading(dashboardRefs.taskSubmitBtn, true, "Creating...");

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
        setLoading(dashboardRefs.taskSubmitBtn, false, "Create task");
    }
}

async function submitTaskUpdate(taskId, payload, form) {
    setTaskFormMessage("", "");
    setLoading(dashboardRefs.taskSubmitBtn, true, "Saving...");

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
        setLoading(dashboardRefs.taskSubmitBtn, false, label);
    }
}

function setTaskFormMode(mode = "create", task = null) {
    const form = dashboardRefs?.taskForm;
    if (!form) {
        return;
    }

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
        if (dashboardRefs.taskSubmitBtn) {
            dashboardRefs.taskSubmitBtn.textContent = "Save changes";
        }
    } else {
        delete form.dataset.taskId;
        setDefaultStartDate();
        setDueDateFields(null);
        setModalCopy("create");
        if (dashboardRefs.taskSubmitBtn) {
            dashboardRefs.taskSubmitBtn.textContent = "Create task";
        }
    }
}

function setModalCopy(mode) {
    const titleEl = dashboardRefs?.taskModalTitle;
    const subtitleEl = dashboardRefs?.taskModalSubtitle;
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
            alert("This task is past its due date. Adjust the due date before marking it done.");
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
        alert(error.message);
        select.value = task.status;
    } finally {
        select.disabled = false;
    }
}

function setTaskFormMessage(text, state) {
    const el = dashboardRefs?.taskMessage;
    if (!el) return;
    el.textContent = text;
    el.className = "helper-text";
    if (state) {
        el.classList.add(state);
    }
}

function createTaskCard(task) {
    const safeTitle = escapeHtml(task.title);
    const safeDescription = escapeHtml(task.description || "No description yet");
    const statusClass = getStatusClass(task.status);
    const priority = (task.priority || '').toUpperCase();
    const due = formatDate(task.due_date);
    const priorityLower = (task.priority || 'medium').toLowerCase();

    return `
        <article class="task-card" data-task-id="${task.id}" data-priority="${priorityLower}">
            <div class="task-card__top">
                <div class="task-header">
                    <h3>${safeTitle}</h3>
                    <span class="status-badge ${statusClass}">
                        ${humanize(task.status)}
                    </span>
                </div>
                <span class="priority-chip priority-chip--${priorityLower}">${priority || 'N/A'}</span>
            </div>
            <p>${safeDescription}</p>
            <div class="task-meta">
                <span>Due: ${due}</span>
                <span>Start: ${formatDate(task.start_date)}</span>
            </div>
            <div class="task-card__actions">
                <label class="task-status-control">
                    <span>Status</span>
                    <select data-status-select="${task.id}">
                        ${renderStatusSelectOptions(task.status)}
                    </select>
                </label>
                <button class="ghost-button" type="button" data-edit-task="${task.id}">Edit details</button>
            </div>
        </article>
    `;
}

function renderStatusSelectOptions(currentStatus) {
    const normalized = (currentStatus || "").toLowerCase();
    const statuses = ["to_do", "in_progress", "done"];
    return statuses
        .map(status => `<option value="${status}" ${status === normalized ? "selected" : ""}>${humanize(status)}</option>`)
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

function formatDate(dateString) {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'No date';
    return date.toLocaleDateString();
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
