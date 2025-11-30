<?php $bodyClass = 'body-dashboard'; include 'includes/header.php'; ?>

<div class="dashboard-shell">
    <?php include 'includes/sidebar.php'; ?>

    <main class="dashboard-main personal-main">
        <header class="dashboard-header">
            <div>
                <p class="eyebrow">Focus list</p>
                <h1>Personal tasks</h1>
                <p>Manage the work only you can see. Update, regroup, and mark things done.</p>
            </div>
            <div class="dashboard-actions">
                <button class="primary-button primary-button--icon" type="button" id="openPersonalTaskModalTrigger">
                    <span>+</span> Add task
                </button>
            </div>
        </header>

        <section class="personal-board" id="personalTaskBoard" aria-live="polite"></section>
        <p class="helper-text helper-text--center" id="personalTaskMessage" hidden>No personal tasks yet. Use the Add task button to capture your first one.</p>

        <div class="modal" id="personalTaskModal" hidden>
            <div class="modal__overlay" data-modal-dismiss></div>
            <div class="modal__content">
                <header class="modal__header">
                    <div>
                        <p class="eyebrow">Personal task</p>
                        <h2 id="personalTaskModalTitle" data-create-text="Create personal task" data-edit-text="Edit personal task">Edit personal task</h2>
                        <p class="helper-text" id="personalTaskModalSubtitle" data-create-text="Personal tasks stay private to your account." data-edit-text="Adjust the details, set deadlines, or switch status.">Adjust the details, set deadlines, or switch status.</p>
                    </div>
                </header>
                <form class="modal__form" id="personalTaskForm" data-mode="edit">
                    <label>
                        <span>Title</span>
                        <input type="text" name="title" id="personalTaskTitle" required />
                    </label>
                    <label>
                        <span>Description</span>
                        <textarea name="description" id="personalTaskDescription" rows="3"></textarea>
                    </label>
                    <div class="modal__form-grid">
                        <label>
                            <span>Priority</span>
                            <select name="priority" id="personalTaskPriority">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </label>
                        <label>
                            <span>Status</span>
                            <select name="status" id="personalTaskStatus">
                                <option value="to_do">To do</option>
                                <option value="in_progress">In progress</option>
                                <option value="done">Done</option>
                            </select>
                        </label>
                        <label>
                            <span>Start date</span>
                            <input type="datetime-local" name="start_date" id="personalTaskStartDate" />
                        </label>
                        <label>
                            <span>Due date</span>
                            <input type="datetime-local" name="due_date" id="personalTaskDueDate" />
                        </label>
                    </div>
                    <p class="helper-text" id="personalTaskFormMessage"></p>
                    <div class="modal__actions">
                        <button class="ghost-button" type="button" id="cancelPersonalTaskModal">Cancel</button>
                        <button class="primary-button" type="submit" id="personalTaskSubmit">Save changes</button>
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
