<?php
$projectId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($projectId <= 0) {
    header('Location: projects.php');
    exit();
}
$bodyClass = 'body-project-detail';
include 'includes/header.php';
?>

<div class="dashboard-shell" data-project-id="<?php echo htmlspecialchars((string) $projectId, ENT_QUOTES, 'UTF-8'); ?>">
    <?php include 'includes/sidebar.php'; ?>

    <main class="dashboard-main" id="projectDetailPage">
        <header class="project-detail-header">
            <div class="project-heading">
                <a class="ghost-button project-back-link" href="projects.php">
                    <span aria-hidden="true">&#8592;</span>
                    <span>Back to Projects</span>
                </a>
                <div class="project-heading__meta">
                    <div class="project-color-chip" id="projectColorBadge" aria-hidden="true"></div>
                    <div class="project-heading__text">
                        <p class="eyebrow" id="projectOwnerLabel"></p>
                        <div class="project-title-stack">
                            <h1 id="projectTitle">Loading project…</h1>
                            <div class="project-title-accent" id="projectTitleAccent" aria-hidden="true"></div>
                        </div>
                        <p id="projectDescriptionText">Sit tight while we fetch the latest updates.</p>
                    </div>
                </div>
            </div>
            <div class="project-header-aside">
                <div class="dashboard-actions">
                    <button class="ghost-button" type="button" id="archiveProjectBtn" hidden>Archive</button>
                    <button class="ghost-button" type="button" id="addMemberBtn" data-requires-role="manager" hidden>Add member</button>
                    <button class="primary-button" type="button" id="projectSettingsBtn" data-requires-role="owner" hidden>Project settings</button>
                </div>
                <div class="project-overview-meta" aria-live="polite">
                    <div>
                        <p class="eyebrow">Status</p>
                        <strong id="projectArchivedLabel">Active</strong>
                    </div>
                    <div>
                        <p class="eyebrow">Last updated</p>
                        <strong id="projectUpdatedAt">—</strong>
                    </div>
                </div>
            </div>
        </header>

        <nav class="project-tabs" role="tablist">
            <button class="project-tab active" data-tab="overview" type="button">Overview</button>
            <button class="project-tab" data-tab="tasks" type="button">Task list</button>
            <button class="project-tab" data-tab="members" type="button">Members</button>
        </nav>

        <section class="project-tab-panel active" id="projectTabOverview" role="tabpanel">
            <div class="stat-grid">
                <article class="stat-card">
                    <p>Total tasks</p>
                    <strong id="overviewTotalTasks">0</strong>
                    <span>All statuses</span>
                </article>
                <article class="stat-card">
                    <p>In progress</p>
                    <strong id="overviewInProgress">0</strong>
                    <span>Currently owned</span>
                </article>
                <article class="stat-card">
                    <p>Completed</p>
                    <strong id="overviewDone">0</strong>
                    <span>Validated and archived</span>
                </article>
                <article class="stat-card">
                    <p>Members</p>
                    <strong id="overviewMembers">0</strong>
                    <span>Collaborators in this space</span>
                </article>
            </div>
            <section class="chart-row" aria-label="Project task distribution">
                <div class="chart-grid">
                    <article class="chart-card" aria-label="Project status chart">
                        <header class="chart-card__header">
                            <div>
                                <p class="eyebrow">Task breakdown</p>
                                <h2>Current status</h2>
                            </div>
                            <p class="helper-text">Live distribution of this project's tasks.</p>
                        </header>
                        <div class="chart-card__body">
                            <div class="chart-card__visual" role="img" aria-label="Project task status chart">
                                <canvas id="projectOverviewStatusChart" aria-hidden="true"></canvas>
                            </div>
                            <ul class="chart-legend" id="projectOverviewStatusLegend" aria-live="polite">
                                <li><span class="legend-dot legend-dot--todo"></span>To do: <strong id="projectOverviewLegendTodo">0</strong></li>
                                <li><span class="legend-dot legend-dot--progress"></span>In progress: <strong id="projectOverviewLegendProgress">0</strong></li>
                                <li><span class="legend-dot legend-dot--done"></span>Done: <strong id="projectOverviewLegendDone">0</strong></li>
                            </ul>
                            <p class="chart-card__empty helper-text" id="projectOverviewChartEmpty" hidden>
                                Task data will appear once this project has activity.
                            </p>
                        </div>
                    </article>
                </div>
            </section>
        </section>

        <section class="project-tab-panel" id="projectTabTasks" role="tabpanel">
            <div class="project-task-controls">
                <div class="project-task-filter">
                    <label>
                        <span>Status</span>
                        <select id="taskStatusFilter">
                            <option value="">All</option>
                            <option value="to_do">To do</option>
                            <option value="in_progress">In progress</option>
                            <option value="done">Done</option>
                        </select>
                    </label>
                    <label>
                        <span>Assignee</span>
                        <select id="taskAssigneeFilter">
                            <option value="">Everyone</option>
                        </select>
                    </label>
                </div>
                <button class="primary-button project-task-add" type="button" id="openProjectTaskModal" data-requires-role="manager" hidden>
                    <span>+</span> Add task
                </button>
            </div>
            <section class="personal-board project-task-board" id="projectTaskBoard" aria-live="polite"></section>
            <p class="helper-text helper-text--center" id="projectTaskMessage" hidden>No tasks yet. Add one to start the flow.</p>
        </section>

        <section class="project-tab-panel" id="projectTabMembers" role="tabpanel">
            <div class="project-members-header">
                <h2>Members</h2>
                <button class="ghost-button" type="button" id="openMemberModal" data-requires-role="manager" hidden>Add member</button>
            </div>
            <table class="project-member-table" aria-live="polite">
                <thead>
                    <tr>
                        <th>Member</th>
                        <th>Role</th>
                        <th>Joined</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="projectMemberTableBody"></tbody>
            </table>
            <p class="helper-text helper-text--center" id="memberEmptyState" hidden>No members yet.</p>
        </section>
    </main>
</div>

<div class="modal" id="memberModal" hidden>
    <div class="modal__overlay" data-modal-dismiss></div>
    <div class="modal__content">
        <header class="modal__header">
            <p class="eyebrow">Collaborator</p>
            <h2>Add member</h2>
            <p class="helper-text">Search the workspace directory to invite collaborators.</p>
        </header>
        <button class="modal__close" type="button" data-modal-dismiss aria-label="Close">&times;</button>
        <div class="modal__form">
            <label>
                <span>Search</span>
                <input type="search" id="memberSearchInput" placeholder="Search by name, username, or email">
            </label>
            <ul class="member-search-results" id="memberSearchResults"></ul>
            <p class="helper-text" id="memberSearchMessage"></p>
        </div>
    </div>
</div>

<div class="modal" id="projectTaskModal" hidden>
    <div class="modal__overlay" data-modal-dismiss></div>
    <div class="modal__content">
        <header class="modal__header">
            <p class="eyebrow">Project task</p>
            <h2>Create task</h2>
        </header>
        <form class="modal__form" id="projectTaskForm">
            <label>
                <span>Title</span>
                <input type="text" name="title" required>
            </label>
            <label>
                <span>Description</span>
                <textarea name="description" rows="3"></textarea>
            </label>
            <div class="modal__form-grid">
                <label>
                    <span>Priority</span>
                    <select name="priority">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                    </select>
                </label>
                <label>
                    <span>Due date & time</span>
                    <input type="datetime-local" name="due_date">
                </label>
                <label>
                    <span>Assignee</span>
                    <select name="assignee_id" id="taskAssigneeSelect">
                        <option value="">Unassigned</option>
                    </select>
                </label>
            </div>
            <label>
                <span>Tags</span>
                <input type="text" name="tags" placeholder="comma,separated">
            </label>
            <p class="helper-text" id="projectTaskFormMessage"></p>
            <div class="modal__actions">
                <button class="ghost-button" type="button" data-modal-dismiss>Cancel</button>
                <button class="primary-button" type="submit" id="projectTaskSubmitBtn">Create task</button>
            </div>
        </form>
    </div>
</div>

<div class="modal" id="projectSettingsModal" hidden>
    <div class="modal__overlay" data-modal-dismiss></div>
    <div class="modal__content">
        <header class="modal__header">
            <p class="eyebrow">Project settings</p>
            <h2>Update project</h2>
        </header>
        <form class="modal__form" id="projectSettingsForm">
            <label>
                <span>Name</span>
                <input type="text" name="name" id="settingsName" required>
            </label>
            <label>
                <span>Description</span>
                <textarea name="description" id="settingsDescription" rows="3"></textarea>
            </label>
            <label>
                <span>Color</span>
                <input type="color" name="color" id="settingsColor">
            </label>
            <p class="helper-text">Need a clean slate?</p>
            <div class="project-settings__danger-row" role="group" aria-label="Project danger zone">
                <button class="ghost-button project-settings__action" type="button" id="modalArchiveProjectBtn" data-requires-role="owner" hidden>Archive project</button>
                <button class="ghost-button ghost-button--danger project-settings__action project-settings__action--icon project-settings__action--danger"
                    type="button"
                    id="deleteProjectBtn"
                    data-requires-role="owner"
                    hidden
                    aria-label="Delete project"
                    title="Delete project">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    <span class="sr-only" data-button-label>Delete project</span>
                </button>
            </div>
            <p class="helper-text" id="projectSettingsMessage"></p>
            <div class="modal__actions">
                <button class="ghost-button" type="button" data-modal-dismiss>Cancel</button>
                <button class="primary-button" type="submit" id="projectSettingsSubmitBtn">Save changes</button>
            </div>
        </form>
    </div>
</div>

<?php include 'includes/footer.php'; ?>
