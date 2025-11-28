const PERSONAL_SECTIONS = [
    { key: "to_do", label: "Backlog", subtitle: "Queued up next" },
    { key: "in_progress", label: "In progress", subtitle: "Currently moving" },
    { key: "done", label: "Done", subtitle: "Shipped and validated" }
];

let personalTaskState = null;

document.addEventListener("DOMContentLoaded", initPersonalTasks);

function initPersonalTasks() {
    const board = document.getElementById("personalTaskBoard");
    if (!board) {
        return;
    }

    personalTaskState = {
        board,
        message: document.getElementById("personalTaskMessage"),
        modal: document.getElementById("personalTaskModal"),
        form: document.getElementById("personalTaskForm"),
        formMessage: document.getElementById("personalTaskFormMessage"),
        submitBtn: document.getElementById("personalTaskSubmit"),
        cancelBtn: document.getElementById("cancelPersonalTaskModal"),
        tasks: [],
        editingTaskId: null,
        originalPayload: null
    };

    personalTaskState.board.addEventListener("click", handleBoardClick);
    personalTaskState.board.addEventListener("change", handleBoardChange);
    setupPersonalModal();
    fetchPersonalTasks().then(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const highlightTaskId = urlParams.get("highlight_task_id");
        console.log("Highlight Task ID:", highlightTaskId);

        if (highlightTaskId) {
            const taskCard = document.querySelector(`.personal-task-card[data-task-id="${highlightTaskId}"]`);
            console.log("Task Card Found:", taskCard);

            if (taskCard) {
                taskCard.scrollIntoView({ behavior: "smooth", block: "center" });

                console.log("Adding pulse class");
                taskCard.classList.add("card-highlight-pulse");
                // Remove animation after 3 seconds (2 cycles)
                setTimeout(() => {
                    taskCard.classList.remove("card-highlight-pulse");
                }, 3000);

                // Clean up URL
                const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({ path: newUrl }, "", newUrl);
            }
        }
    });
}

async function fetchPersonalTasks() {
    if (!personalTaskState) return;
    togglePersonalMessage(false, "");
    personalTaskState.board.innerHTML = '<p class="helper-text">Loading personal tasks...</p>';

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
        personalTaskState.board.innerHTML = '';
        togglePersonalMessage(true, error.message || "Unable to load personal tasks");
    }
}

function renderPersonalTasks() {
    if (!personalTaskState) return;
    const grouped = groupTasksByStatus(personalTaskState.tasks);

    if (!personalTaskState.tasks.length) {
        personalTaskState.board.innerHTML = '';
        togglePersonalMessage(true, "No personal tasks yet. Capture one from the dashboard.");
        return;
    }

    togglePersonalMessage(false, "");
    personalTaskState.board.innerHTML = PERSONAL_SECTIONS
        .map(section => renderPersonalSection(section, grouped[section.key] || []))
        .join("");
}

function groupTasksByStatus(tasks) {
    return tasks.reduce((acc, task) => {
        const key = (task.status || "to_do").toLowerCase();
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(task);
        return acc;
    }, {});
}

function renderPersonalSection(section, tasks) {
    const content = tasks.length
        ? tasks.map(renderPersonalTaskCard).join("")
        : `<p class="personal-section__empty">No ${section.label.toLowerCase()} tasks yet.</p>`;

    return `
        <article class="personal-section">
            <header class="personal-section__header">
                <div>
                    <p>${section.subtitle}</p>
                    <h3>${section.label}</h3>
                </div>
                <span class="personal-section__count">${tasks.length}</span>
            </header>
            <div class="personal-section__list">${content}</div>
        </article>
    `;
}

function renderPersonalTaskCard(task) {
    const safeTitle = escapeHtml(task.title);
    const safeDesc = escapeHtml(task.description || "No description");
    const priority = (task.priority || '').toUpperCase();
    const due = formatDate(task.due_date);

    return `
        <article class="personal-task-card" data-task-id="${task.id}">
            <div class="personal-task-card__main">
                <label class="task-complete-toggle">
                    <input type="checkbox" data-complete-toggle="${task.id}" ${task.completed ? "checked" : ""} aria-label="Mark task complete" />
                    <span></span>
                </label>
                <div>
                    <p class="personal-task-card__status">${humanize(task.status)}</p>
                    <h3>${safeTitle}</h3>
                    <p class="helper-text">${safeDesc}</p>
                </div>
            </div>
            <div class="personal-task-card__meta">
                <span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M12 2l4 4M12 2 8 6M12 22l4-4M12 22l-4-4"/></svg>
                    <strong>${priority || 'N/A'}</strong>
                </span>
                <span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <strong>${due}</strong>
                </span>
            </div>
            <div class="personal-task-card__actions">
                <button class="ghost-button" type="button" data-edit-task="${task.id}">Edit</button>
            </div>
        </article>
    `;
}

function handleBoardClick(event) {
    const editBtn = event.target.closest('[data-edit-task]');
    if (!editBtn) {
        return;
    }
    const taskId = Number(editBtn.getAttribute('data-edit-task'));
    const task = findPersonalTask(taskId);
    if (task) {
        openPersonalTaskModal(task);
    }
}

function handleBoardChange(event) {
    const toggle = event.target.closest('input[data-complete-toggle]');
    if (!toggle) {
        return;
    }
    const taskId = Number(toggle.getAttribute('data-complete-toggle'));
    toggleTaskCompletion(taskId, toggle.checked, toggle);
}

async function toggleTaskCompletion(taskId, completed, checkbox) {
    checkbox.disabled = true;
    const payload = { completed };
    if (completed) {
        payload.status = "done";
    }

    try {
        const response = await authedFetch(`/tasks/${taskId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.detail || "Unable to update task");
        }
        await fetchPersonalTasks();
    } catch (error) {
        alert(error.message || "Unable to update task");
        checkbox.checked = !completed;
    } finally {
        checkbox.disabled = false;
    }
}

function setupPersonalModal() {
    if (!personalTaskState?.modal) return;

    personalTaskState.form?.addEventListener("submit", handlePersonalTaskFormSubmit);
    personalTaskState.cancelBtn?.addEventListener("click", closePersonalTaskModal);
    personalTaskState.modal?.addEventListener("click", event => {
        if (event.target?.dataset?.modalDismiss !== undefined) {
            closePersonalTaskModal();
        }
    });
}

function openPersonalTaskModal(task) {
    personalTaskState.editingTaskId = task.id;
    personalTaskState.modal?.removeAttribute("hidden");
    fillPersonalTaskForm(task);
    rememberPersonalTaskBaseline(task);
}

function closePersonalTaskModal() {
    personalTaskState.editingTaskId = null;
    personalTaskState.originalPayload = null;
    personalTaskState.form?.reset();
    setPersonalFormMessage("");
    personalTaskState.modal?.setAttribute("hidden", "true");
}

function fillPersonalTaskForm(task) {
    if (!personalTaskState?.form) return;
    personalTaskState.form.title.value = task.title || "";
    personalTaskState.form.description.value = task.description || "";
    personalTaskState.form.priority.value = (task.priority || "medium").toLowerCase();
    personalTaskState.form.status.value = (task.status || "to_do").toLowerCase();
    personalTaskState.form.start_date.value = task.start_date ? toLocalDateTime(task.start_date) : "";
    personalTaskState.form.due_date.value = task.due_date ? toLocalDateTime(task.due_date) : "";
}

function toLocalDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function handlePersonalTaskFormSubmit(event) {
    event.preventDefault();
    if (!personalTaskState?.editingTaskId) {
        setPersonalFormMessage("Unable to identify the task.", "error");
        return;
    }

    const payload = buildPersonalTaskPayload(event.target);
    if (!payload) {
        return;
    }

    if (!hasPersonalTaskChanges(payload)) {
        setPersonalFormMessage("Make a change before saving.", "error");
        return;
    }

    await submitPersonalTaskUpdate(personalTaskState.editingTaskId, payload);
}

function buildPersonalTaskPayload(form) {
    const title = form.title.value.trim();
    if (!title) {
        setPersonalFormMessage("Title is required", "error");
        return null;
    }

    const payload = {
        title,
        description: form.description.value.trim() || null,
        priority: form.priority.value,
        status: form.status.value
    };

    const start = form.start_date.value;
    if (start) {
        const startDate = new Date(start);
        if (Number.isNaN(startDate.getTime())) {
            setPersonalFormMessage("Invalid start date", "error");
            return null;
        }
        payload.start_date = startDate.toISOString();
    } else {
        payload.start_date = null;
    }

    const due = form.due_date.value;
    if (due) {
        const dueDate = new Date(due);
        if (Number.isNaN(dueDate.getTime())) {
            setPersonalFormMessage("Invalid due date", "error");
            return null;
        }
        payload.due_date = dueDate.toISOString();
    } else {
        payload.due_date = null;
    }

    payload.completed = payload.status === "done";
    return payload;
}

function rememberPersonalTaskBaseline(task) {
    if (!personalTaskState) return;
    if (!task) {
        personalTaskState.originalPayload = null;
        return;
    }
    personalTaskState.originalPayload = normalizePersonalPayload({
        title: task.title || "",
        description: task.description || null,
        priority: (task.priority || "medium").toLowerCase(),
        status: (task.status || "to_do").toLowerCase(),
        start_date: safeIsoString(task.start_date),
        due_date: safeIsoString(task.due_date),
        completed: Boolean(task.completed)
    });
}

function normalizePersonalPayload(payload) {
    return {
        title: payload.title || "",
        description: payload.description || null,
        priority: (payload.priority || "medium").toLowerCase(),
        status: (payload.status || "to_do").toLowerCase(),
        start_date: payload.start_date || null,
        due_date: payload.due_date || null,
        completed: Boolean(payload.completed)
    };
}

function hasPersonalTaskChanges(payload) {
    if (!personalTaskState?.originalPayload) {
        return true;
    }

    const current = normalizePersonalPayload(payload);
    const original = personalTaskState.originalPayload;
    return Object.keys({ ...original, ...current }).some(key => original[key] !== current[key]);
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

async function submitPersonalTaskUpdate(taskId, payload) {
    setPersonalFormMessage("", "");
    setLoading(personalTaskState.submitBtn, true, "Saving...");

    try {
        const response = await authedFetch(`/tasks/${taskId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.detail || "Unable to update task");
        }

        setPersonalFormMessage("Task updated!", "success");
        await fetchPersonalTasks();
        setTimeout(() => closePersonalTaskModal(), 600);
    } catch (error) {
        setPersonalFormMessage(error.message || "Unable to update task", "error");
    } finally {
        setLoading(personalTaskState.submitBtn, false, "Save changes");
    }
}

function findPersonalTask(taskId) {
    return personalTaskState?.tasks?.find(task => task.id === taskId);
}

function togglePersonalMessage(visible, text) {
    if (!personalTaskState?.message) return;
    personalTaskState.message.hidden = !visible;
    personalTaskState.message.textContent = text;
}

function setPersonalFormMessage(text, state) {
    const el = personalTaskState?.formMessage;
    if (!el) return;
    el.textContent = text;
    el.className = "helper-text";
    if (state) {
        el.classList.add(state);
    }
}

function setLoading(button, loading, text) {
    if (!button) return;
    if (loading) {
        button.disabled = true;
        button.dataset.originalText = button.dataset.originalText || button.textContent;
        button.textContent = text || button.textContent;
    } else {
        button.disabled = false;
        button.textContent = text || button.dataset.originalText || "Save changes";
    }
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

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
