const PROJECT_DEBOUNCE_MS = 250;
let projectsState = {
    filter: "all",
    query: "",
    projects: [],
    userRole: "user",
    debounceTimer: null
};

function initProjectsPage() {
    const page = document.getElementById("projectListPage");
    if (!page) {
        return;
    }

    fetchCurrentUser().then(user => {
        projectsState.userRole = user?.role || "user";
        applyRoleVisibility(projectsState.userRole);
    }).catch(() => {
        applyRoleVisibility("user");
    }).finally(fetchAndRenderProjects);

    document.getElementById("openProjectModal")?.addEventListener("click", () => toggleProjectModal(true));
    document.getElementById("projectModal")?.addEventListener("click", event => {
        if (event.target?.dataset?.modalDismiss !== undefined) {
            toggleProjectModal(false);
        }
    });
    document.querySelectorAll('[data-modal-dismiss]')?.forEach(btn => btn.addEventListener("click", () => toggleProjectModal(false)));
    document.getElementById("projectForm")?.addEventListener("submit", handleProjectFormSubmit);

    const searchInput = document.getElementById("projectSearch");
    searchInput?.addEventListener("input", event => {
        const value = event.target.value.trim();
        projectsState.query = value;
        clearTimeout(projectsState.debounceTimer);
        projectsState.debounceTimer = setTimeout(fetchAndRenderProjects, PROJECT_DEBOUNCE_MS);
    });

    const tabs = document.querySelectorAll(".project-filter-tab");
    tabs.forEach(tab => tab.addEventListener("click", () => {
        tabs.forEach(btn => btn.classList.remove("active"));
        tab.classList.add("active");
        projectsState.filter = tab.dataset.filter || "all";
        fetchAndRenderProjects();
    }));
}

async function fetchAndRenderProjects() {
    try {
        const params = new URLSearchParams();
        if (projectsState.filter === "active") {
            params.set("archived", "false");
        } else if (projectsState.filter === "archived") {
            params.set("archived", "true");
        }
        if (projectsState.query) {
            params.set("search", projectsState.query);
        }
        const queryString = params.toString() ? `?${params.toString()}` : "";
        const response = await authedFetch(`/projects/${queryString}`);
        if (!response.ok) {
            throw new Error("Unable to load projects");
        }
        const projects = await response.json();
        projectsState.projects = Array.isArray(projects) ? projects : [];
        renderProjectGrid();
    } catch (error) {
        setProjectEmptyState(error.message || "Unable to fetch projects");
    }
}

function renderProjectGrid() {
    const grid = document.getElementById("projectGrid");
    const emptyState = document.getElementById("projectEmptyState");
    if (!grid) {
        return;
    }

    if (!projectsState.projects.length) {
        grid.innerHTML = "";
        setElementState(emptyState, false, getEmptyProjectsMessage());
        return;
    }

    const cards = projectsState.projects.map(project => {
        const memberCount = project.member_count ?? project.memberships?.length ?? 0;
        const ownerName = project.owner?.display_name || project.owner?.username || "Unknown";
        const taskCount = project.task_count ?? 0;
        const badge = project.archived ? '<span class="badge" style="background: var(--border); color: var(--text-muted);">Archived</span>' : '';
        const pillStyle = project.color ? `style="background:${project.color}"` : "";
        return `
            <article class="project-card" data-project-id="${project.id}">
                <div class="project-card__header">
                    <h3 class="project-card__title">${project.name}</h3>
                    ${badge}
                </div>
                <p class="helper-text">Owner · ${ownerName}</p>
                <div class="project-card__meta">
                    <span>${memberCount} members</span>
                    <span>${taskCount} tasks</span>
                </div>
                <div class="project-pill" ${pillStyle}></div>
            </article>
        `;
    }).join("");

    grid.innerHTML = cards;
    setElementState(emptyState, true);
    grid.querySelectorAll(".project-card").forEach(card => {
        card.addEventListener("click", () => {
            const projectId = card.dataset.projectId;
            if (projectId) {
                window.location.href = `project_detail.php?id=${projectId}`;
            }
        });
    });
}

function setProjectEmptyState(message) {
    const emptyState = document.getElementById("projectEmptyState");
    setElementState(emptyState, false, message);
}

function getEmptyProjectsMessage() {
    if (projectsState.filter === "all" && !projectsState.query && projectsState.userRole === "user") {
        return "No project found. Wait for the admin or a manager to add you in.";
    }
    if (projectsState.query) {
        return `No projects found for "${projectsState.query}".`;
    }
    return "No projects match your filters.";
}

function setElementState(element, hidden, text = "") {
    if (!element) {
        return;
    }
    element.hidden = hidden;
    if (text) {
        element.textContent = text;
    }
}

function toggleProjectModal(show) {
    const modal = document.getElementById("projectModal");
    if (!modal) {
        return;
    }
    if (show) {
        modal.removeAttribute("hidden");
        modal.querySelector("input[name='name']")?.focus();
    } else {
        modal.setAttribute("hidden", "true");
        document.getElementById("projectForm")?.reset();
        setElementState(document.getElementById("projectFormMessage"), true, "");
    }
}

async function handleProjectFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const payload = {
        name: form.name.value.trim(),
        description: form.description.value.trim() || null,
        color: form.color.value || null,
        member_ids: []
    };

    if (!payload.name) {
        setElementState(document.getElementById("projectFormMessage"), false, "Name is required");
        return;
    }

    setButtonLoading(document.getElementById("projectSubmitBtn"), true, "Creating...");

    try {
        const response = await authedFetch("/projects/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const project = await response.json();
        if (!response.ok) {
            throw new Error(project.detail || "Unable to create project");
        }
        toggleProjectModal(false);
        notify("Project created", { type: "success", description: project.name });
        setTimeout(() => {
            window.location.href = `project_detail.php?id=${project.id}`;
        }, 650);
    } catch (error) {
        setElementState(document.getElementById("projectFormMessage"), false, error.message);
        notify("Create project failed", { type: "error", description: error.message });
    } finally {
        setButtonLoading(document.getElementById("projectSubmitBtn"), false, "Create project");
    }
}

function setButtonLoading(button, isLoading, label) {
    if (!button) {
        return;
    }
    button.disabled = isLoading;
    button.textContent = label;
}

function applyRoleVisibility(role) {
    document.querySelectorAll('[data-requires-role]')?.forEach(button => {
        const minimum = button.dataset.requiresRole;
        if (!minimum) {
            return;
        }
        const allowed = hasProjectAuthoringRole(role, minimum);
        button.hidden = !allowed;
    });
}

function hasProjectAuthoringRole(role, requirement) {
    const hierarchy = ["user", "manager", "admin"];
    const value = requirement === "owner" ? "manager" : requirement; // owner handled runtime per project
    return hierarchy.indexOf(role) >= hierarchy.indexOf(value);
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.body.classList.contains("body-projects")) {
        initProjectsPage();
    }
});

function notify(message, options) {
    if (typeof window.showToast === "function") {
        window.showToast(message, options);
    }
}
