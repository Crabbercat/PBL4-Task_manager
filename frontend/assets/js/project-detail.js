const PROJECT_TASK_SECTIONS = [
    { key: "to_do", label: "To do", subtitle: "Queued up next" },
    { key: "in_progress", label: "In progress", subtitle: "Currently moving" },
    { key: "done", label: "Done", subtitle: "Shipped and validated" }
];

const PROJECT_PRIORITY_META = {
    low: {
        label: "Low",
        className: "personal-task-card__priority personal-task-card__priority--low",
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>'
    },
    medium: {
        label: "Medium",
        className: "personal-task-card__priority personal-task-card__priority--medium",
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>'
    },
    high: {
        label: "High",
        className: "personal-task-card__priority personal-task-card__priority--high",
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>'
    }
};

let projectDetailState = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!document.body.classList.contains("body-project-detail")) {
        return;
    }
    initProjectDetailPage();
});

function initProjectDetailPage() {
    const shell = document.querySelector(".dashboard-shell[data-project-id]");
    const projectId = Number(shell?.dataset?.projectId);
    if (!projectId) {
        return;
    }

    projectDetailState = {
        projectId,
        project: null,
        tasks: { to_do: [], in_progress: [], done: [] },
        flatTasks: [],
        currentUser: null,
        projectRole: "member",
        memberSearchDebounce: null,
        refs: {
            title: document.getElementById("projectTitle"),
            description: document.getElementById("projectDescriptionText"),
            ownerLabel: document.getElementById("projectOwnerLabel"),
            colorBadge: document.getElementById("projectColorBadge"),
            titleAccent: document.getElementById("projectTitleAccent"),
            archivedLabel: document.getElementById("projectArchivedLabel"),
            updatedAt: document.getElementById("projectUpdatedAt"),
            overviewStats: {
                total: document.getElementById("overviewTotalTasks"),
                progress: document.getElementById("overviewInProgress"),
                done: document.getElementById("overviewDone"),
                members: document.getElementById("overviewMembers")
            },
            memberTableBody: document.getElementById("projectMemberTableBody"),
            memberEmptyState: document.getElementById("memberEmptyState"),
            board: document.getElementById("projectTaskBoard"),
            boardMessage: document.getElementById("projectTaskMessage"),
            statusFilter: document.getElementById("taskStatusFilter"),
            assigneeFilter: document.getElementById("taskAssigneeFilter"),
            taskModal: document.getElementById("projectTaskModal"),
            taskForm: document.getElementById("projectTaskForm"),
            taskMessage: document.getElementById("projectTaskFormMessage"),
            taskSubmitBtn: document.getElementById("projectTaskSubmitBtn"),
            taskModalTitle: document.querySelector("#projectTaskModal h2"),
            taskModalTrigger: document.getElementById("openProjectTaskModal"),
            taskAssigneeSelect: document.getElementById("taskAssigneeSelect"),
            addMemberBtn: document.getElementById("addMemberBtn"),
            openMemberBtn: document.getElementById("openMemberModal"),
            memberModal: document.getElementById("memberModal"),
            memberSearchInput: document.getElementById("memberSearchInput"),
            memberSearchResults: document.getElementById("memberSearchResults"),
            memberSearchMessage: document.getElementById("memberSearchMessage"),
            projectSettingsModal: document.getElementById("projectSettingsModal"),
            projectSettingsForm: document.getElementById("projectSettingsForm"),
            projectSettingsBtn: document.getElementById("projectSettingsBtn"),
            projectSettingsMessage: document.getElementById("projectSettingsMessage"),
            projectSettingsSubmitBtn: document.getElementById("projectSettingsSubmitBtn"),
            archiveProjectBtn: document.getElementById("archiveProjectBtn"),
            deleteProjectBtn: document.getElementById("deleteProjectBtn")
        },
        pendingEditTaskId: null
    };

    const urlParams = new URLSearchParams(window.location.search);
    const requestedEditTaskId = Number(urlParams.get("edit_task_id"));
    if (Number.isFinite(requestedEditTaskId) && requestedEditTaskId > 0) {
        projectDetailState.pendingEditTaskId = requestedEditTaskId;
    }

    setupTabNavigation();
    setProjectTab(projectDetailState.pendingEditTaskId ? "tasks" : "overview");
    setupTaskFilters();
    setupTaskBoardInteractions();
    setupTaskModal();
    setupProjectActions();
    loadProjectDetailData();
}

async function loadProjectDetailData() {
    setProjectLoadingState(true);
    try {
        const user = await fetchCurrentUser().catch(() => null);
        projectDetailState.currentUser = user;
        await fetchProjectOverview();
        await fetchProjectTasks();
    } catch (error) {
        setProjectLoadingError(error?.message || "Unable to load project data");
    } finally {
        setProjectLoadingState(false);
    }
}

function setProjectLoadingState(isLoading) {
    const { title, description } = projectDetailState.refs;
    if (!title || !description) {
        return;
    }
    if (isLoading) {
        title.textContent = "Loading project…";
        description.textContent = "Sit tight while we fetch the latest updates.";
    }
}

function setProjectLoadingError(message) {
    const { description } = projectDetailState.refs;
    if (description) {
        description.textContent = message;
    }
}

async function fetchProjectOverview() {
    const response = await authedFetch(`/projects/${projectDetailState.projectId}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.detail || "Unable to load project");
    }
    projectDetailState.project = payload;
    applyProjectRole(payload);
    renderProjectOverview(payload);
    renderProjectMembers(payload);
    populateAssigneeInputs(payload);
}

async function fetchProjectTasks() {
    const params = new URLSearchParams();
    const { statusFilter, assigneeFilter } = projectDetailState.refs;
    if (statusFilter?.value) {
        params.set("status", statusFilter.value);
    }
    if (assigneeFilter?.value) {
        params.set("assignee_id", assigneeFilter.value);
    }
    const query = params.toString();
    const response = await authedFetch(`/projects/${projectDetailState.projectId}/tasks${query ? `?${query}` : ""}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.detail || "Unable to load project tasks");
    }
    projectDetailState.tasks = normalizeGroupedTasks(payload);
    projectDetailState.flatTasks = flattenTaskGroups(projectDetailState.tasks);
    renderTaskBoard();
    maybeOpenPendingTaskEdit();
}

function normalizeGroupedTasks(data) {
    return {
        to_do: Array.isArray(data?.to_do) ? data.to_do : data?.to_do || data?.toDo || [],
        in_progress: Array.isArray(data?.in_progress) ? data.in_progress : data?.inProgress || [],
        done: Array.isArray(data?.done) ? data.done : data?.completed || []
    };
}

function flattenTaskGroups(grouped) {
    return [...grouped.to_do, ...grouped.in_progress, ...grouped.done];
}

function renderProjectOverview(project) {
    const {
        title,
        description,
        ownerLabel,
        colorBadge,
        titleAccent,
        archivedLabel,
        updatedAt,
        overviewStats,
        archiveProjectBtn,
        taskModalTrigger
    } = projectDetailState.refs;
    title.textContent = project.name;
    description.textContent = project.description || "This project does not have a description yet.";
    ownerLabel.textContent = `Owner · ${formatDisplayName(project.owner)}`;
    const color = project.color || "var(--border)";
    colorBadge.style.background = color;
    titleAccent.style.background = color;
    archivedLabel.textContent = project.archived ? "Archived" : "Active";
    updatedAt.textContent = formatDisplayDate(project.updated_at);
    overviewStats.members.textContent = project.member_count ?? project.memberships?.length ?? 0;
    overviewStats.total.textContent = project.task_count ?? 0;
    overviewStats.progress.textContent = "0";
        if (taskModalTrigger) {
            const isArchived = Boolean(project.archived);
            taskModalTrigger.dataset.archived = isArchived ? "true" : "false";
            if (isArchived) {
                taskModalTrigger.setAttribute("aria-disabled", "true");
                taskModalTrigger.title = "Archived projects cannot accept new tasks";
            } else {
                taskModalTrigger.removeAttribute("aria-disabled");
                taskModalTrigger.removeAttribute("title");
            }
        }
    overviewStats.done.textContent = "0";

    if (archiveProjectBtn) {
        const canArchive = canManageProjectSettings();
        archiveProjectBtn.hidden = !canArchive;
        archiveProjectBtn.textContent = project.archived ? "Restore" : "Archive";
    }
}

function renderProjectMembers(project) {
    const memberships = project.memberships || [];
    const { memberTableBody, memberEmptyState, overviewStats } = projectDetailState.refs;
    if (!memberTableBody) {
        return;
    }

    if (!memberships.length) {
        memberTableBody.innerHTML = "";
        toggleElement(memberEmptyState, false, "No members yet.");
        overviewStats.members.textContent = "0";
        return;
    }
    const canManage = canManageMembers();
    const ownerId = project.owner?.id;

    const rows = memberships
        .map(member => {
            const memberName = formatDisplayName(member.user);
            const userId = member.user?.id;
            const isOwner = ownerId === userId;
            const actionButton = canManage && !isOwner
                ? `<button class="ghost-button ghost-button--danger project-member-remove" type="button" data-member-remove="${userId}" data-member-name="${escapeHtml(memberName)}">Remove</button>`
                : "";
            return `
                <tr>
                    <td>
                        <strong>${escapeHtml(memberName)}</strong>
                        <p class="helper-text">@${escapeHtml(member.user.username)}</p>
                    </td>
                    <td>${humanize(member.role)}</td>
                    <td>${formatDisplayDate(member.joined_at)}</td>
                    <td>${actionButton}</td>
                </tr>
            `;
        })
        .join("");

    memberTableBody.innerHTML = rows;
    toggleElement(memberEmptyState, true);
    overviewStats.members.textContent = String(memberships.length);
}

function populateAssigneeInputs(project) {
    const memberships = project.memberships || [];
    const { assigneeFilter, taskAssigneeSelect } = projectDetailState.refs;

    const options = memberships
        .map(member => `<option value="${member.user.id}">${escapeHtml(formatDisplayName(member.user))}</option>`)
        .join("");

    if (assigneeFilter) {
        assigneeFilter.innerHTML = `<option value="">Everyone</option>${options}`;
    }
    if (taskAssigneeSelect) {
        taskAssigneeSelect.innerHTML = `<option value="">Unassigned</option>${options}`;
    }
}

function renderTaskBoard() {
    const totalTasks = projectDetailState.flatTasks.length;
    const { board, boardMessage, overviewStats } = projectDetailState.refs;
    if (!board) {
        return;
    }

    if (!totalTasks) {
        board.innerHTML = "";
        toggleElement(boardMessage, false, "No tasks yet. Add one to start the flow.");
    } else {
        const sections = PROJECT_TASK_SECTIONS.map(section =>
            renderProjectTaskSection(section, projectDetailState.tasks[section.key] || [])
        ).join("");
        board.innerHTML = sections;
        toggleElement(boardMessage, true);
    }

    overviewStats.total.textContent = String(totalTasks);
    overviewStats.progress.textContent = String(projectDetailState.tasks.in_progress.length);
    overviewStats.done.textContent = String(projectDetailState.tasks.done.length);
}

function renderProjectTaskSection(section, tasks) {
    const content = tasks.length
        ? tasks.map(renderTaskCard).join("")
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

function renderTaskCard(task) {
    const priorityMeta = PROJECT_PRIORITY_META[task.priority] || PROJECT_PRIORITY_META.medium;
    const assignee = task.assignee ? formatDisplayName(task.assignee) : "Unassigned";
    const dueDate = formatDisplayDate(task.due_date, "No due date");
    const canEdit = canEditTask(task);
    const canDelete = canDeleteProjectTask();
    const statusControl = renderTaskStatusControl(task);
    const tagsMarkup = renderTaskTags(task.tags);
    const actionButtons = [];
    if (canEdit) {
        actionButtons.push(`<button class="ghost-button" type="button" data-edit-task="${task.id}">Edit</button>`);
    }
    if (canDelete) {
        actionButtons.push(`<button class="ghost-button ghost-button--danger" type="button" data-delete-task="${task.id}">Delete</button>`);
    }
    const actionsMarkup = actionButtons.length
        ? `<div class="personal-task-card__actions">${actionButtons.join("")}</div>`
        : "";

    return `
        <article class="personal-task-card project-task-card" data-task-id="${task.id}">
            <div class="personal-task-card__main">
                <label class="task-complete-toggle">
                    <input type="checkbox" data-task-complete="${task.id}" ${task.completed ? "checked" : ""} aria-label="Mark task complete" />
                    <span></span>
                </label>
                <div>
                    ${statusControl}
                    <h3>${escapeHtml(task.title)}</h3>
                    <p class="helper-text">${escapeHtml(task.description || "No description yet.")}</p>
                </div>
            </div>
            <div class="personal-task-card__meta">
                <span class="${priorityMeta.className}">${priorityMeta.icon}<strong>${priorityMeta.label}</strong></span>
                <span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <strong>${dueDate}</strong>
                </span>
                <span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-3-3.87"></path><path d="M4 21v-2a4 4 0 0 1 3-3.87"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <strong>${escapeHtml(assignee)}</strong>
                </span>
            </div>
            ${tagsMarkup}
            ${actionsMarkup}
        </article>
    `;
}

function renderTaskTags(rawTags) {
    if (!rawTags) {
        return "";
    }
    const tags = rawTags
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);
    if (!tags.length) {
        return "";
    }
    const items = tags
        .map(tag => `<span class="personal-task-card__tag">${escapeHtml(tag)}</span>`)
        .join("");
    return `<div class="personal-task-card__tags">${items}</div>`;
}

function renderTaskStatusControl(task) {
    if (!canUpdateTaskStatus(task)) {
        return `<p class="personal-task-card__status">${humanize(task.status)}</p>`;
    }
    const options = PROJECT_TASK_SECTIONS
        .map(section => `<option value="${section.key}" ${section.key === task.status ? "selected" : ""}>${section.label}</option>`)
        .join("");
    return `
        <div class="personal-task-card__status personal-task-card__status--select">
            <select data-task-status="${task.id}" aria-label="Update status">
                ${options}
            </select>
        </div>
    `;
}

function setupTaskBoardInteractions() {
    const { board } = projectDetailState.refs;
    board?.addEventListener("click", handleTaskBoardClick);
    board?.addEventListener("change", handleTaskBoardChange);
}

function handleTaskBoardClick(event) {
    const deleteButton = event.target.closest("[data-delete-task]");
    if (deleteButton) {
        const taskId = Number(deleteButton.dataset.deleteTask);
        if (Number.isFinite(taskId)) {
            deleteProjectTask(taskId, deleteButton);
        }
        return;
    }
    const editButton = event.target.closest("[data-edit-task]");
    if (!editButton) {
        return;
    }
    const taskId = Number(editButton.dataset.editTask);
    const task = findProjectTask(taskId);
    if (task) {
        openProjectTaskModal(task);
    }
}

function handleTaskBoardChange(event) {
    const toggle = event.target.closest("input[data-task-complete]");
    if (!toggle) {
        const statusSelect = event.target.closest("select[data-task-status]");
        if (!statusSelect) {
            return;
        }
        const taskId = Number(statusSelect.dataset.taskStatus);
        updateProjectTaskStatus(taskId, statusSelect.value, statusSelect).catch(error => {
            notify?.("Unable to update task", { type: "error", description: error.message });
            statusSelect.value = findProjectTask(taskId)?.status || statusSelect.value;
        });
        return;
    }
    const taskId = Number(toggle.dataset.taskComplete);
    toggleProjectTaskCompletion(taskId, toggle.checked).catch(error => {
        toggle.checked = !toggle.checked;
        notify?.("Unable to update task", { type: "error", description: error.message });
    });
}

async function toggleProjectTaskCompletion(taskId, completed) {
    await authedFetch(`/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed })
    }).then(async response => {
        if (!response.ok) {
            const detail = await response.json().catch(() => ({}));
            throw new Error(detail?.detail || "Unable to update task");
        }
        await fetchProjectTasks();
    });
}

async function updateProjectTaskStatus(taskId, status, selectEl) {
    if (!Number.isFinite(taskId)) {
        throw new Error("Missing task id");
    }
    selectEl.disabled = true;
    try {
        const response = await authedFetch(`/tasks/${taskId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
        });
        if (!response.ok) {
            const detail = await response.json().catch(() => ({}));
            throw new Error(detail?.detail || "Unable to update task status");
        }
        await fetchProjectTasks();
    } finally {
        selectEl.disabled = false;
    }
}

async function deleteProjectTask(taskId, trigger) {
    if (!canDeleteProjectTask()) {
        notify?.("Only project managers or admins can delete tasks", { type: "error" });
        return;
    }
    const confirmed = await window.showConfirmDialog({
        title: "Delete project task",
        message: "Delete this task? This cannot be undone.",
        confirmText: "Delete",
        cancelText: "Cancel",
        tone: "danger"
    });
    if (!confirmed) {
        return;
    }
    const original = trigger.textContent;
    trigger.disabled = true;
    trigger.textContent = "Deleting…";
    try {
        const response = await authedFetch(`/tasks/${taskId}`, { method: "DELETE" });
        if (!response.ok) {
            const detail = await response.json().catch(() => ({}));
            throw new Error(detail?.detail || "Unable to delete task");
        }
        notify?.("Task deleted", { type: "success" });
        await fetchProjectTasks();
    } catch (error) {
        notify?.("Delete failed", { type: "error", description: error.message });
    } finally {
        trigger.disabled = false;
        trigger.textContent = original;
    }
}

function setupTaskFilters() {
    const { statusFilter, assigneeFilter } = projectDetailState.refs;
    statusFilter?.addEventListener("change", () => fetchProjectTasks().catch(handleTaskError));
    assigneeFilter?.addEventListener("change", () => fetchProjectTasks().catch(handleTaskError));
}

function handleTaskError(error) {
    const { board, boardMessage } = projectDetailState.refs;
    if (board) {
        board.innerHTML = "";
    }
    toggleElement(boardMessage, false, error?.message || "Unable to load project tasks");
}

function setupTabNavigation() {
    const tabs = document.querySelectorAll(".project-tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.dataset.tab || "overview";
            setProjectTab(targetTab);
        });
    });
}

function setProjectTab(tabName = "overview") {
    const normalized = tabName.toLowerCase();
    document.querySelectorAll(".project-tab").forEach(tab => {
        const tabKey = (tab.dataset.tab || "overview").toLowerCase();
        tab.classList.toggle("active", tabKey === normalized);
    });
    document.querySelectorAll(".project-tab-panel").forEach(panel => {
        const panelKey = panel.id?.replace("projectTab", "").toLowerCase();
        panel.classList.toggle("active", panelKey === normalized);
    });
    projectDetailState.activeTab = normalized;
}

function setupTaskModal() {
    const { taskModal, taskForm, taskMessage, taskSubmitBtn, taskModalTrigger } = projectDetailState.refs;
    taskModalTrigger?.addEventListener("click", () => openProjectTaskModal());
    taskModal?.addEventListener("click", event => {
        if (event.target?.dataset?.modalDismiss !== undefined) {
            closeProjectTaskModal();
        }
    });
    taskForm?.addEventListener("submit", handleProjectTaskFormSubmit);
    document.querySelectorAll("#projectTaskModal [data-modal-dismiss]")?.forEach(btn => btn.addEventListener("click", closeProjectTaskModal));
    if (taskMessage) {
        taskMessage.textContent = "";
    }
    setButtonLoadingState(taskSubmitBtn, false, "Create task");
}

function setupProjectActions() {
    const {
        addMemberBtn,
        openMemberBtn,
        memberModal,
        memberSearchInput,
        memberSearchResults,
        memberTableBody,
        projectSettingsBtn,
        projectSettingsModal,
        projectSettingsForm,
        archiveProjectBtn
    } = projectDetailState.refs;

    [addMemberBtn, openMemberBtn]
        .filter(Boolean)
        .forEach(button => button.addEventListener("click", () => openMemberModal()));

    memberModal?.addEventListener("click", event => {
        if (event.target?.dataset?.modalDismiss !== undefined) {
            closeMemberModal();
        }
    });
    document.querySelectorAll("#memberModal [data-modal-dismiss]")?.forEach(btn => btn.addEventListener("click", closeMemberModal));
    memberSearchInput?.addEventListener("input", handleMemberSearchInput);
    memberSearchResults?.addEventListener("click", handleMemberResultClick);
    memberTableBody?.addEventListener("click", handleMemberTableClick);

    projectSettingsBtn?.addEventListener("click", openProjectSettingsModal);
    projectSettingsModal?.addEventListener("click", event => {
        if (event.target?.dataset?.modalDismiss !== undefined) {
            closeProjectSettingsModal();
        }
    });
    document.querySelectorAll("#projectSettingsModal [data-modal-dismiss]")?.forEach(btn => btn.addEventListener("click", closeProjectSettingsModal));
    projectSettingsForm?.addEventListener("submit", handleProjectSettingsSubmit);

    archiveProjectBtn?.addEventListener("click", handleArchiveToggle);
    deleteProjectBtn?.addEventListener("click", handleDeleteProject);
}

function openProjectTaskModal(task = null) {
    const { taskModal, taskForm, taskModalTitle, taskSubmitBtn, taskMessage } = projectDetailState.refs;
    if (!taskModal || !taskForm) {
        return;
    }
    if (!task && projectDetailState.project?.archived) {
        notify?.("Archived projects cannot accept new tasks", { type: "error" });
        return;
    }

    const isEdit = Boolean(task);
    taskForm.dataset.mode = isEdit ? "edit" : "create";
    taskForm.dataset.taskId = isEdit ? task.id : "";
    taskModalTitle.textContent = isEdit ? "Edit task" : "Create task";
    taskSubmitBtn.textContent = isEdit ? "Save changes" : "Create task";
    taskMessage.textContent = "";

    taskForm.title.value = task?.title || "";
    taskForm.description.value = task?.description || "";
    taskForm.priority.value = task?.priority || "medium";
    taskForm.due_date.value = task?.due_date ? formatDateTimeForInput(task.due_date) : "";
    taskForm.assignee_id.value = task?.assignee?.id || "";
    taskForm.tags.value = task?.tags || "";

    taskModal.removeAttribute("hidden");
    taskForm.title.focus();
}

function closeProjectTaskModal() {
    const { taskModal, taskForm, taskMessage } = projectDetailState.refs;
    if (!taskModal || !taskForm) {
        return;
    }
    taskModal.setAttribute("hidden", "true");
    taskForm.reset();
    taskForm.dataset.mode = "create";
    taskForm.dataset.taskId = "";
    if (taskMessage) {
        taskMessage.textContent = "";
        taskMessage.classList.remove("error", "success");
    }
}

function openMemberModal() {
    if (!canManageMembers()) {
        notify?.("Only project managers can add members", { type: "error" });
        return;
    }
    const { memberModal, memberSearchInput, memberSearchResults, memberSearchMessage } = projectDetailState.refs;
    if (!memberModal) {
        return;
    }
    memberModal.removeAttribute("hidden");
    if (memberSearchInput) {
        memberSearchInput.value = "";
        memberSearchInput.focus();
    }
    if (memberSearchResults) {
        memberSearchResults.innerHTML = "";
    }
    toggleElement(memberSearchMessage, false, "Start typing to search for teammates");
    performMemberSearch("");
}

function closeMemberModal() {
    const { memberModal, memberSearchMessage } = projectDetailState.refs;
    memberModal?.setAttribute("hidden", "true");
    toggleElement(memberSearchMessage, true, "");
}

function handleMemberSearchInput(event) {
    const query = event.target.value.trim();
    clearTimeout(projectDetailState.memberSearchDebounce);
    projectDetailState.memberSearchDebounce = setTimeout(() => performMemberSearch(query), 250);
}

async function performMemberSearch(query) {
    const { memberSearchResults, memberSearchMessage } = projectDetailState.refs;
    if (!memberSearchResults) {
        return;
    }
    memberSearchResults.innerHTML = "";
    toggleElement(memberSearchMessage, false, query ? "Searching…" : "Suggested collaborators");

    try {
        const params = new URLSearchParams();
        if (query) {
            params.set("q", query);
        }
        const response = await authedFetch(`/users/search/${params.toString() ? `?${params.toString()}` : ""}`);
        const users = await response.json().catch(() => []);
        if (!response.ok) {
            throw new Error(users?.detail || "Unable to search users");
        }
        renderMemberSearchResults(users);
    } catch (error) {
        toggleElement(memberSearchMessage, false, error.message || "Unable to search users");
    }
}

function renderMemberSearchResults(users) {
    const { memberSearchResults, memberSearchMessage } = projectDetailState.refs;
    if (!users.length) {
        toggleElement(memberSearchMessage, false, "No people found");
        return;
    }
    const items = users
        .map(user => {
            const alreadyMember = isProjectMember(user.id);
            return `
                <li>
                    <div class="member-result__info">
                        <strong>${escapeHtml(formatDisplayName(user))}</strong>
                        <p class="helper-text">@${escapeHtml(user.username)}</p>
                    </div>
                    ${alreadyMember
                        ? '<span class="badge" aria-label="Already in project">Member</span>'
                        : `<button class="ghost-button" type="button" data-member-invite="${user.id}">Add</button>`}
                </li>
            `;
        })
        .join("");
    memberSearchResults.innerHTML = items;
    toggleElement(memberSearchMessage, true);
}

function isProjectMember(userId) {
    const project = projectDetailState.project;
    if (!project) {
        return false;
    }
    return Boolean(project.memberships?.some(member => member.user?.id === userId));
}

function handleMemberResultClick(event) {
    const button = event.target.closest("[data-member-invite]");
    if (!button) {
        return;
    }
    const userId = Number(button.dataset.memberInvite);
    if (!Number.isFinite(userId)) {
        return;
    }
    inviteUserToProject(userId, button);
}

async function inviteUserToProject(userId, button) {
    if (!canManageMembers()) {
        notify?.("You do not have permission to add members", { type: "error" });
        return;
    }
    const originalLabel = button.textContent;
    setButtonLoadingState(button, true, "Adding…");
    try {
        const response = await authedFetch(`/projects/${projectDetailState.projectId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, role: "member" })
        });
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
            throw new Error(payload?.detail || "Unable to add member");
        }
        notify?.("Member added", { type: "success" });
        await fetchProjectOverview();
        performMemberSearch(projectDetailState.refs.memberSearchInput?.value.trim() || "");
    } catch (error) {
        notify?.("Add member failed", { type: "error", description: error.message });
    } finally {
        setButtonLoadingState(button, false, originalLabel);
    }
}

async function handleMemberTableClick(event) {
    const button = event.target.closest("[data-member-remove]");
    if (!button) {
        return;
    }
    const userId = Number(button.dataset.memberRemove);
    const memberName = button.dataset.memberName || "this member";
    if (!Number.isFinite(userId)) {
        return;
    }
    const confirmed = await window.showConfirmDialog({
        title: "Remove member",
        message: `Remove ${memberName} from this project?`,
        confirmText: "Remove",
        cancelText: "Cancel",
        tone: "danger"
    });
    if (!confirmed) {
        return;
    }
    removeMemberFromProject(userId, button);
}

async function removeMemberFromProject(userId, button) {
    const originalLabel = button.textContent;
    setButtonLoadingState(button, true, "Removing…");
    try {
        const response = await authedFetch(`/projects/${projectDetailState.projectId}/members/${userId}`, {
            method: "DELETE"
        });
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
            throw new Error(payload?.detail || "Unable to remove member");
        }
        notify?.("Member removed", { type: "success" });
        await Promise.all([
            fetchProjectOverview(),
            fetchProjectTasks()
        ]);
    } catch (error) {
        notify?.("Remove member failed", { type: "error", description: error.message });
    } finally {
        setButtonLoadingState(button, false, originalLabel);
    }
}

function canManageMembers() {
    const current = projectDetailState.currentUser;
    if (!current) {
        return false;
    }
    if (current.role === "admin") {
        return true;
    }
    return ["owner", "manager"].includes(projectDetailState.projectRole);
}

function openProjectSettingsModal() {
    if (!canManageProjectSettings()) {
        notify?.("Only the project owner can update settings", { type: "error" });
        return;
    }
    const { project } = projectDetailState;
    const { projectSettingsModal, projectSettingsForm, projectSettingsMessage } = projectDetailState.refs;
    if (!projectSettingsModal || !projectSettingsForm || !project) {
        return;
    }
    prefillProjectSettingsForm(project);
    toggleFormMessage(projectSettingsMessage, "", true);
    projectSettingsModal.removeAttribute("hidden");
    projectSettingsForm.name.focus();
}

function prefillProjectSettingsForm(project) {
    const { projectSettingsForm } = projectDetailState.refs;
    if (!projectSettingsForm) {
        return;
    }
    projectSettingsForm.name.value = project.name || "";
    projectSettingsForm.description.value = project.description || "";
    projectSettingsForm.color.value = project.color || "#7757ff";
    projectSettingsForm.settingsArchived.checked = Boolean(project.archived);
}

function closeProjectSettingsModal() {
    const { projectSettingsModal, projectSettingsForm, projectSettingsMessage } = projectDetailState.refs;
    projectSettingsModal?.setAttribute("hidden", "true");
    projectSettingsForm?.reset();
    toggleFormMessage(projectSettingsMessage, "", true);
}

async function handleProjectSettingsSubmit(event) {
    event.preventDefault();
    const { projectSettingsForm, projectSettingsMessage, projectSettingsSubmitBtn } = projectDetailState.refs;
    if (!projectSettingsForm) {
        return;
    }
    const payload = collectProjectSettingsPayload(projectSettingsForm);
    if (!payload) {
        return;
    }
    setButtonLoadingState(projectSettingsSubmitBtn, true, "Saving…");
    toggleFormMessage(projectSettingsMessage, "", true);
    try {
        const response = await authedFetch(`/projects/${projectDetailState.projectId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.detail || "Unable to update project");
        }
        notify?.("Project updated", { type: "success" });
        closeProjectSettingsModal();
        await fetchProjectOverview();
    } catch (error) {
        toggleFormMessage(projectSettingsMessage, error.message, false, "error");
    } finally {
        setButtonLoadingState(projectSettingsSubmitBtn, false, "Save changes");
    }
}

function collectProjectSettingsPayload(form) {
    const name = form.name.value.trim();
    if (!name) {
        toggleFormMessage(projectDetailState.refs.projectSettingsMessage, "Name is required", false, "error");
        return null;
    }
    return {
        name,
        description: form.description.value.trim() || null,
        color: form.color.value || null,
        archived: form.settingsArchived.checked
    };
}

async function handleArchiveToggle() {
    if (!canManageProjectSettings()) {
        notify?.("Only the owner can archive this project", { type: "error" });
        return;
    }
    const button = projectDetailState.refs.archiveProjectBtn;
    const project = projectDetailState.project;
    if (!button || !project) {
        return;
    }
    const loadingLabel = project.archived ? "Restoring…" : "Archiving…";
    setButtonLoadingState(button, true, loadingLabel);
    const action = project.archived ? "restore" : "archive";
    try {
        const response = await authedFetch(`/projects/${projectDetailState.projectId}/${action}`, {
            method: "POST"
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.detail || `Unable to ${action} project`);
        }
        notify?.(`Project ${project.archived ? "restored" : "archived"}`, { type: "success" });
        await fetchProjectOverview();
    } catch (error) {
        notify?.("Update project state failed", { type: "error", description: error.message });
    } finally {
        const latest = projectDetailState.project;
        const nextLabel = latest?.archived ? "Restore" : "Archive";
        setButtonLoadingState(button, false, nextLabel || (project.archived ? "Restore" : "Archive"));
    }
}

function canManageProjectSettings() {
    const current = projectDetailState.currentUser;
    if (!current) {
        return false;
    }
    if (current.role === "admin") {
        return true;
    }
    return projectDetailState.projectRole === "owner";
}

async function handleDeleteProject() {
    if (!canManageProjectSettings()) {
        notify?.("Only the owner or an admin can delete this project", { type: "error" });
        return;
    }
    const button = projectDetailState.refs.deleteProjectBtn;
    if (!button) {
        return;
    }
    const confirmed = await window.showConfirmDialog({
        title: "Delete project",
        message: "Delete this project? All related tasks will be removed permanently.",
        confirmText: "Delete",
        cancelText: "Cancel",
        tone: "danger"
    });
    if (!confirmed) {
        return;
    }
    setButtonLoadingState(button, true, "Deleting…");
    try {
        const response = await authedFetch(`/projects/${projectDetailState.projectId}`, { method: "DELETE" });
        if (!response.ok) {
            const detail = await response.json().catch(() => ({}));
            throw new Error(detail?.detail || "Unable to delete project");
        }
        notify?.("Project deleted", { type: "success" });
        window.location.href = "projects.php";
    } catch (error) {
        notify?.("Delete failed", { type: "error", description: error.message });
        setButtonLoadingState(button, false, "Delete project");
    }
}

async function handleProjectTaskFormSubmit(event) {
    event.preventDefault();
    const { taskForm, taskMessage, taskSubmitBtn } = projectDetailState.refs;
    const mode = taskForm.dataset.mode || "create";
    const payload = buildTaskPayload(taskForm);
    if (!payload) {
        return;
    }

    setButtonLoadingState(taskSubmitBtn, true, mode === "edit" ? "Saving..." : "Creating...");
    toggleFormMessage(taskMessage, "", true);

    try {
        if (mode === "edit") {
            const taskId = Number(taskForm.dataset.taskId);
            await updateProjectTask(taskId, payload);
        } else {
            await createProjectTask(payload);
        }
        toggleFormMessage(taskMessage, mode === "edit" ? "Task updated" : "Task created", false, "success");
        closeProjectTaskModal();
        await fetchProjectTasks();
    } catch (error) {
        toggleFormMessage(taskMessage, error.message, false, "error");
    } finally {
        setButtonLoadingState(taskSubmitBtn, false, mode === "edit" ? "Save changes" : "Create task");
    }
}

function buildTaskPayload(form) {
    const title = form.title.value.trim();
    if (!title) {
        toggleFormMessage(projectDetailState.refs.taskMessage, "Title is required", false, "error");
        return null;
    }
    const payload = {
        title,
        description: form.description.value.trim() || null,
        priority: form.priority.value || "medium",
        due_date: form.due_date.value ? new Date(form.due_date.value).toISOString() : null,
        tags: form.tags.value.trim() || null,
        assignee_id: form.assignee_id.value ? Number(form.assignee_id.value) : null
    };
    return payload;
}

async function createProjectTask(payload) {
    if (projectDetailState.project?.archived) {
        throw new Error("Archived projects cannot accept new tasks");
    }
    const response = await authedFetch(`/projects/${projectDetailState.projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.detail || "Unable to create task");
    }
}

async function updateProjectTask(taskId, payload) {
    const response = await authedFetch(`/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.detail || "Unable to update task");
    }
}

function findProjectTask(taskId) {
    return projectDetailState.flatTasks.find(task => task.id === taskId);
}

function canEditTask(task) {
    const state = projectDetailState;
    if (!state.currentUser) {
        return false;
    }
    if (state.currentUser.role === "admin" || state.projectRole === "owner" || state.projectRole === "manager") {
        return true;
    }
    return task.creator?.id === state.currentUser.id;
}

function canDeleteProjectTask() {
    const state = projectDetailState;
    if (!state?.currentUser) {
        return false;
    }
    if (state.currentUser.role === "admin") {
        return true;
    }
    return ["owner", "manager"].includes(state.projectRole);
}

function canUpdateTaskStatus(task) {
    if (!projectDetailState?.currentUser) {
        return false;
    }
    if (canEditTask(task)) {
        return true;
    }
    const assigneeId = task.assignee?.id;
    return assigneeId && assigneeId === projectDetailState.currentUser.id;
}

function applyProjectRole(project) {
    const currentUser = projectDetailState.currentUser;
    let role = "member";
    if (!currentUser) {
        role = "member";
    } else if (currentUser.role === "admin" || project.owner?.id === currentUser.id) {
        role = "owner";
    } else {
        const membership = project.memberships?.find(member => member.user?.id === currentUser.id);
        role = membership?.role || "member";
    }
    projectDetailState.projectRole = role;
    applyProjectRoleVisibility(role);
}

function applyProjectRoleVisibility(role) {
    const hierarchy = { member: 0, manager: 1, owner: 2, admin: 3 };
    let effectiveRole = role;
    if (projectDetailState.currentUser?.role === "admin") {
        effectiveRole = "admin";
    }
    document.querySelectorAll("[data-requires-role]").forEach(element => {
        const required = element.dataset.requiresRole;
        if (!required) {
            return;
        }
        const requiredValue = hierarchy[required] ?? 0;
        const currentValue = hierarchy[effectiveRole] ?? 0;
        element.hidden = currentValue < requiredValue;
    });
}

function toggleElement(element, hidden, text = "") {
    if (!element) {
        return;
    }
    element.hidden = hidden;
    if (text) {
        element.textContent = text;
    }
}

function toggleFormMessage(element, message, hide = false, type = "") {
    if (!element) {
        return;
    }
    element.hidden = hide;
    element.textContent = message;
    element.classList.remove("error", "success");
    if (type) {
        element.classList.add(type);
        if (type === "success" || type === "error") {
            const resolved = message || (type === "success" ? "Action completed" : "Something went wrong");
            window.showToast?.(resolved, { type });
        }
    }
}

function formatDisplayName(user) {
    if (!user) {
        return "Unknown";
    }
    return user.display_name || user.username || "Unknown";
}

function formatDisplayDate(value, fallback = "—") {
    if (!value) {
        return fallback;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return fallback;
    }
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTimeForInput(value) {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    const tzAdjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return tzAdjusted.toISOString().slice(0, 16);
}

function maybeOpenPendingTaskEdit() {
    const pendingId = projectDetailState?.pendingEditTaskId;
    if (!pendingId) {
        return;
    }

    const targetTask = projectDetailState.flatTasks.find(task => task.id === pendingId);
    if (!targetTask) {
        return;
    }

    projectDetailState.pendingEditTaskId = null;
    clearPendingEditQueryParam();
    setProjectTab("tasks");
    openProjectTaskModal(targetTask);
    requestAnimationFrame(() => {
        const card = document.querySelector(`[data-task-id="${pendingId}"]`);
        if (!card) {
            return;
        }
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("card-highlight-pulse");
        setTimeout(() => card.classList.remove("card-highlight-pulse"), 3000);
    });
}

function clearPendingEditQueryParam() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("edit_task_id")) {
        return;
    }
    url.searchParams.delete("edit_task_id");
    window.history.replaceState({}, "", url);
}

function setButtonLoadingState(button, isLoading, label) {
    if (!button) {
        return;
    }
    button.disabled = isLoading;
    button.textContent = label;
}

function escapeHtml(text) {
    if (text == null) {
        return "";
    }
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function humanize(value) {
    if (!value) {
        return "";
    }
    return value.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}
