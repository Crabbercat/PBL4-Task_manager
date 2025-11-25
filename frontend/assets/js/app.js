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
        closeTaskBtn: document.getElementById("closeTaskModal")
    };

    fetchTasks();

    setupTaskModal();
}

async function fetchTasks() {
    const token = localStorage.getItem("tm_access_token");
    if (!token || !dashboardRefs) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/tasks/`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const tasks = await response.json();
        renderDashboard(tasks);

    } catch (error) {
        setBoardMessage(`Failed to load tasks: ${error.message}`);
    }
}

function renderDashboard(tasks) {
    if (!dashboardRefs) return;

    const grouped = { to_do: [], in_progress: [], done: [] };

    tasks.forEach(task => {
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
            ? list.map(createTaskCard).join("")
            : '<p class="empty-state">No tasks yet.</p>';

        if (dashboardRefs.counts[key]) {
            dashboardRefs.counts[key].textContent = list.length;
        }
    });

    const upcoming = tasks.filter(task => isUpcoming(task.due_date)).length;

    dashboardRefs.stats.total.textContent = tasks.length;
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
    dashboardRefs.openTaskBtn?.addEventListener("click", openTaskModal);
    dashboardRefs.closeTaskBtn?.addEventListener("click", closeTaskModal);
    dashboardRefs.taskCancelBtn?.addEventListener("click", closeTaskModal);
    dashboardRefs.taskModal.addEventListener("click", event => {
        if (event.target?.dataset?.modalDismiss !== undefined) {
            closeTaskModal();
        }
    });
    dashboardRefs.taskForm?.addEventListener("submit", handlePersonalTaskSubmit);
    populateDueTimeSelects();
    setDefaultStartDate();
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

function openTaskModal() {
    dashboardRefs.taskModal?.removeAttribute("hidden");
    setDefaultStartDate();
    toggleDueTimeSelects(false, true);
    dashboardRefs.taskModal?.querySelector("input[name='title']")?.focus();
}

function closeTaskModal() {
    if (!dashboardRefs?.taskModal) {
        return;
    }
    dashboardRefs.taskModal.setAttribute("hidden", "true");
    dashboardRefs.taskForm?.reset();
    setDefaultStartDate();
    toggleDueTimeSelects(false, true);
    setTaskFormMessage("", "");
}

async function handlePersonalTaskSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const title = form.title.value.trim();
    if (!title) {
        setTaskFormMessage("Title is required", "error");
        return;
    }

    const startDateValue = form.start_date.value;
    if (!startDateValue) {
        setTaskFormMessage("Start date is required", "error");
        return;
    }

    const token = localStorage.getItem("tm_access_token");
    if (!token) {
        logout();
        return;
    }

    const dueDate = form.due_date_date.value;
    let dueDateIso = null;
    if (dueDate) {
        const hour = form.due_hour.value || "00";
        const minute = form.due_minute.value || "00";
        const second = form.due_second.value || "00";
        dueDateIso = new Date(`${dueDate}T${hour}:${minute}:${second}`).toISOString();
    }

    const payload = {
        title,
        description: form.description.value.trim() || null,
        priority: form.priority.value,
        start_date: new Date(startDateValue).toISOString(),
        due_date: dueDateIso,
        is_personal: true
    };

    setTaskFormMessage("", "");
    setLoading(dashboardRefs.taskSubmitBtn, true, "Creating...");

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/tasks/`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.detail || "Unable to create task");
        }

        setTaskFormMessage("Personal task created! Redirecting...", "success");
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

    return `
        <article class="task-card">
            <div class="task-header">
                <h3>${safeTitle}</h3>
                <span class="status-badge ${statusClass}">
                    ${humanize(task.status)}
                </span>
            </div>
            <p>${safeDescription}</p>
            <div class="task-meta">
                <span>Priority: ${priority || 'N/A'}</span>
                <span>Due: ${due}</span>
            </div>
        </article>
    `;
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

function setDefaultStartDate() {
    const input = document.getElementById("taskStartDate");
    if (!input) {
        return;
    }
    input.value = formatDateTimeLocal(new Date());
}

function formatDateTimeLocal(date) {
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
