<?php $bodyClass = 'body-dashboard'; include 'includes/header.php'; ?>

<div class="dashboard-shell board-hidden">
    <?php include 'includes/sidebar.php'; ?>

    <main class="dashboard-main">
        <header class="dashboard-header">
            <div>
                <p class="eyebrow">Active sprint</p>
                <h1>My Tasks</h1>
                <p>Keep blockers visible and cycle time tight.</p>
            </div>
        </header>

        <section class="stat-grid" aria-label="Team overview">
            <article class="stat-card">
                <p>Total projects</p>
                <strong id="totalProjectsStat">0</strong>
                <span>You are collaborating on</span>
            </article>
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

        <section class="chart-row" aria-label="Task distribution">
            <div class="chart-grid">
                <article class="chart-card" aria-label="Personal task status">
                    <header class="chart-card__header">
                        <div>
                            <p class="eyebrow">Personal tasks</p>
                            <h2>Private reminders</h2>
                        </div>
                        <p class="helper-text">Live chart of your personal tasks.</p>
                    </header>
                    <div class="chart-card__body">
                        <div class="chart-card__visual" role="img" aria-label="Personal task status chart">
                            <canvas id="personalStatusChart" aria-hidden="true"></canvas>
                        </div>
                        <ul class="chart-legend" id="personalStatusLegend" aria-live="polite">
                            <li><span class="legend-dot legend-dot--todo"></span>To do: <strong id="personalLegendTodo">0</strong></li>
                            <li><span class="legend-dot legend-dot--progress"></span>In progress: <strong id="personalLegendProgress">0</strong></li>
                            <li><span class="legend-dot legend-dot--done"></span>Done: <strong id="personalLegendDone">0</strong></li>
                        </ul>
                        <p class="chart-card__empty helper-text" id="personalChartEmpty" hidden>
                            You haven't logged any personal tasks yet. Capture a reminder to populate this chart.
                        </p>
                    </div>
                </article>

                <article class="chart-card" aria-label="Project task status">
                    <header class="chart-card__header">
                        <div>
                            <p class="eyebrow">Project tasks</p>
                            <h2>Assigned work</h2>
                        </div>
                        <p class="helper-text">Live chart of your project tasks.</p>
                    </header>
                    <div class="chart-card__body">
                        <div class="chart-card__visual" role="img" aria-label="Project task status chart">
                            <canvas id="projectStatusChart" aria-hidden="true"></canvas>
                        </div>
                        <ul class="chart-legend" id="projectStatusLegend" aria-live="polite">
                            <li><span class="legend-dot legend-dot--todo"></span>To do: <strong id="projectLegendTodo">0</strong></li>
                            <li><span class="legend-dot legend-dot--progress"></span>In progress: <strong id="projectLegendProgress">0</strong></li>
                            <li><span class="legend-dot legend-dot--done"></span>Done: <strong id="projectLegendDone">0</strong></li>
                        </ul>
                        <p class="chart-card__empty helper-text" id="projectChartEmpty" hidden>
                            No assigned project work yet. As soon as you're added to a project, progress will appear here.
                        </p>
                    </div>
                </article>
            </div>
        </section>

        <section class="board-toolbar">
            <button class="ghost-button" type="button" id="toggleTaskVisibilityBtn" data-state="hidden">Show tasks</button>
        </section>

        <section class="kanban" aria-label="Task board" id="dashboardBoard">
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

        <div class="modal" id="taskModal" hidden>
            <div class="modal__overlay" data-modal-dismiss></div>
            <div class="modal__content">
                <header class="modal__header">
                    <div>
                        <p class="eyebrow">Quick capture</p>
                        <h2
                            id="taskModalTitle"
                            data-create-text="Create personal task"
                            data-edit-text="Edit task"
                        >Create personal task</h2>
                        <p
                            class="helper-text"
                            id="taskModalSubtitle"
                            data-create-text="Personal tasks stay private to your account."
                            data-edit-text="Update task details. Status changes happen from the board."
                        >Personal tasks stay private to your account.</p>
                    </div>
                </header>
                <form class="modal__form" id="taskForm" data-mode="create">
                    <label>
                        <span>Title</span>
                        <input type="text" id="taskTitle" name="title" required placeholder="e.g. Prep sprint demo" />
                    </label>
                    <label>
                        <span>Description</span>
                        <textarea id="taskDescription" name="description" rows="3" placeholder="Optional details"></textarea>
                    </label>
                    <div class="modal__form-grid">
                        <label>
                            <span>Priority</span>
                            <select id="taskPriority" name="priority">
                                <option value="low">Low</option>
                                <option value="medium" selected>Medium</option>
                                <option value="high">High</option>
                            </select>
                        </label>
                        <label>
                            <span>Start date</span>
                            <input type="datetime-local" id="taskStartDate" name="start_date" required />
                        </label>
                        <label class="modal__due-field">
                            <span>Due date</span>
                            <div class="modal__due-inputs">
                                <input type="date" id="taskDueDate" name="due_date_date" />
                                <div class="modal__time-selects" role="group" aria-label="Due time">
                                    <div>
                                        <span>Hour</span>
                                        <select id="taskDueHour" name="due_hour" disabled></select>
                                    </div>
                                    <div>
                                        <span>Minute</span>
                                        <select id="taskDueMinute" name="due_minute" disabled></select>
                                    </div>
                                    <div>
                                        <span>Second</span>
                                        <select id="taskDueSecond" name="due_second" disabled></select>
                                    </div>
                                </div>
                            </div>
                            <small class="helper-text">Set date + time or leave blank if the task has no deadline.</small>
                        </label>
                    </div>
                    <p class="helper-text" id="taskFormMessage"></p>
                    <div class="modal__actions">
                        <button class="ghost-button" type="button" id="taskCancelBtn">Cancel</button>
                        <button class="primary-button" type="submit" id="taskSubmitBtn">Create task</button>
                    </div>
                </form>
            </div>
        </div>
    </main>
</div>

<script>
    const token = localStorage.getItem("tm_access_token");
    if (!token) {
        window.location.href = "login.php";
    }
</script>

<?php include 'includes/footer.php'; ?>
