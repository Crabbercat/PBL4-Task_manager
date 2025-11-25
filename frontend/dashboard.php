<?php $bodyClass = 'body-dashboard'; include 'includes/header.php'; ?>

<div class="dashboard-shell">
    <?php include 'includes/sidebar.php'; ?>

    <main class="dashboard-main">
        <header class="dashboard-header">
            <div>
                <p class="eyebrow">Active sprint</p>
                <h1>My Tasks</h1>
                <p>Keep blockers visible and cycle time tight.</p>
            </div>
            <div class="dashboard-actions">
                <button class="ghost-button" type="button">New project</button>
                <button class="primary-button primary-button--icon" type="button">
                    <span>+</span> Add task
                </button>
            </div>
        </header>

        <section class="stat-grid" aria-label="Team overview">
            <article class="stat-card">
                <p>Total tasks</p>
                <strong id="totalTasksStat">0</strong>
                <span>Across all projects</span>
            </article>
            <article class="stat-card">
                <p>In progress</p>
                <strong id="inProgressTasksStat">0</strong>
                <span>Actively being worked on</span>
            </article>
            <article class="stat-card">
                <p>Completed</p>
                <strong id="completedTasksStat">0</strong>
                <span>Validated and shipped</span>
            </article>
            <article class="stat-card">
                <p>Upcoming</p>
                <strong id="upcomingTasksStat">0</strong>
                <span>Due this week</span>
            </article>
        </section>

        <section class="kanban" aria-label="Task board">
            <article class="kanban-column" aria-live="polite">
                <header>
                    <div>
                        <p>To do</p>
                        <span id="todoCount">0</span>
                    </div>
                    <button class="ghost-button ghost-button--tiny" type="button">…</button>
                </header>
                <div class="kanban-column__body" id="todoColumn"></div>
            </article>
            <article class="kanban-column" aria-live="polite">
                <header>
                    <div>
                        <p>In progress</p>
                        <span id="progressCount">0</span>
                    </div>
                    <button class="ghost-button ghost-button--tiny" type="button">…</button>
                </header>
                <div class="kanban-column__body" id="progressColumn"></div>
            </article>
            <article class="kanban-column" aria-live="polite">
                <header>
                    <div>
                        <p>Done</p>
                        <span id="doneCount">0</span>
                    </div>
                    <button class="ghost-button ghost-button--tiny" type="button">…</button>
                </header>
                <div class="kanban-column__body" id="doneColumn"></div>
            </article>
        </section>

        <p id="emptyBoardMessage" class="helper-text helper-text--center" hidden>
            No tasks yet. Create one to kick off your sprint!
        </p>
    </main>
</div>

<script>
    const token = localStorage.getItem("tm_access_token");
    if (!token) {
        window.location.href = "login.php";
    }
</script>

<?php include 'includes/footer.php'; ?>
