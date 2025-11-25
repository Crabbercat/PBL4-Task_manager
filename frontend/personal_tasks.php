<?php $bodyClass = 'body-dashboard'; include 'includes/header.php'; ?>

<div class="dashboard-shell">
    <?php include 'includes/sidebar.php'; ?>

    <main class="dashboard-main personal-main">
        <header class="dashboard-header">
            <div>
                <p class="eyebrow">Focus list</p>
                <h1>Personal tasks</h1>
                <p>Everything you're tracking privately in one view.</p>
            </div>
            <div class="personal-actions">
                <label class="personal-filter">
                    <span>Status</span>
                    <select id="personalTaskFilter">
                        <option value="all">All</option>
                        <option value="to_do">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                    </select>
                </label>
            </div>
        </header>

        <section class="personal-task-list" id="personalTaskList" aria-live="polite">
            <!-- Filled by JS -->
        </section>
        <p class="helper-text helper-text--center" id="personalTaskMessage" hidden>No personal tasks yet. Capture one from the dashboard.</p>
    </main>
</div>

<script>
    const token = localStorage.getItem("tm_access_token");
    if (!token) {
        window.location.href = "login.php";
    }
</script>

<?php include 'includes/footer.php'; ?>
