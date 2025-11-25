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
        userChip: document.getElementById("userNameDisplay")
    };

    fetchTasks();
    fetchUserProfile();
}

async function fetchUserProfile() {
    const token = localStorage.getItem("tm_access_token");
    if (!token || !dashboardRefs?.userChip) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/me/`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to fetch profile");
        }

        const user = await response.json();
        dashboardRefs.userChip.textContent = user.display_name || user.username || "Welcome!";
    } catch (error) {
        dashboardRefs.userChip.textContent = "Welcome!";
    }
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
