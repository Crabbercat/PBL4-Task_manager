let personalTaskState = null;

document.addEventListener("DOMContentLoaded", initPersonalTasks);

function initPersonalTasks() {
    const list = document.getElementById("personalTaskList");
    if (!list) {
        return;
    }

    personalTaskState = {
        list,
        filter: document.getElementById("personalTaskFilter"),
        message: document.getElementById("personalTaskMessage"),
        tasks: []
    };

    personalTaskState.filter?.addEventListener("change", renderPersonalTasks);
    fetchPersonalTasks();
}

async function fetchPersonalTasks() {
    togglePersonalMessage(false, "");
    personalTaskState.list.innerHTML = '<p class="helper-text">Loading personal tasks...</p>';

    try {
        const response = await authedFetch("/tasks/personal/");
        const payload = await response.json().catch(() => []);

        if (!response.ok) {
            const detail = payload && payload.detail ? payload.detail : "Unable to load personal tasks";
            throw new Error(detail);
        }

        personalTaskState.tasks = Array.isArray(payload) ? payload : [];
        renderPersonalTasks();
    } catch (error) {
        personalTaskState.list.innerHTML = '';
        togglePersonalMessage(true, error.message || "Unable to load personal tasks");
    }
}

function renderPersonalTasks() {
    if (!personalTaskState) return;
    const filter = personalTaskState.filter?.value || "all";
    const tasks = personalTaskState.tasks.filter(task => {
        if (filter === "all") {
            return true;
        }
        return (task.status || "").toLowerCase() === filter;
    });

    if (!tasks.length) {
        personalTaskState.list.innerHTML = '';
        togglePersonalMessage(true, "No personal tasks match this filter.");
        return;
    }

    togglePersonalMessage(false, "");
    personalTaskState.list.innerHTML = tasks.map(renderPersonalTaskCard).join("");
}

function renderPersonalTaskCard(task) {
    const safeTitle = escapeHtml(task.title);
    const safeDesc = escapeHtml(task.description || "No description");
    const status = humanize(task.status);
    const priority = (task.priority || '').toUpperCase();
    const due = formatDate(task.due_date);

    return `
        <article class="personal-task-card">
            <div>
                <p class="personal-task-card__status">${status}</p>
                <h3>${safeTitle}</h3>
                <p class="helper-text">${safeDesc}</p>
            </div>
            <div class="personal-task-card__meta">
                <span>Priority: <strong>${priority || 'N/A'}</strong></span>
                <span>Due: <strong>${due}</strong></span>
            </div>
        </article>
    `;
}

function togglePersonalMessage(visible, text) {
    if (!personalTaskState?.message) return;
    personalTaskState.message.hidden = !visible;
    personalTaskState.message.textContent = text;
}
