<?php $currentPage = basename($_SERVER['PHP_SELF']); ?>
<aside class="sidebar dashboard-sidebar">
    <div class="sidebar__brand">
        <div class="sidebar__avatar">TM</div>
        <div>
            <p>Task Manager</p>
            <small>Flow Suite</small>
        </div>
    </div>

    <nav class="sidebar__nav" aria-label="Primary">
        <p class="sidebar__label">Overview</p>
        <a class="sidebar__link <?php echo $currentPage === 'dashboard.php' ? 'active' : ''; ?>" href="dashboard.php">📊 Dashboard</a>
        <a class="sidebar__link <?php echo $currentPage === 'settings.php' ? 'active' : ''; ?>" href="settings.php">⚙️ Settings</a>
        <a class="sidebar__link" href="#">✅ Completed</a>
        <a class="sidebar__link" href="#">⏳ Pending</a>
        <a class="sidebar__link" href="#">🚀 Launches</a>
    </nav>

    <button class="ghost-button ghost-button--full" type="button" onclick="logout()">
        Logout
    </button>
</aside>
