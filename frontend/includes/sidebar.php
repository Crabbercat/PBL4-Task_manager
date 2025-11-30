<?php $currentPage = basename($_SERVER['PHP_SELF']); ?>
<aside class="sidebar dashboard-sidebar">
    <?php
    $displayName = $_SESSION['display_name'] ?? '';
    $role = $_SESSION['role_name'] ?? '';

    function getInitials(string $name): string {
        $name = trim($name);
        if ($name === '') {
            return '';
        }

        $parts = preg_split('/\s+/', $name);
        if (count($parts) === 1) {
            return mb_strtoupper(mb_substr($parts[0], 0, 1));
        }

        return mb_strtoupper(
            mb_substr($parts[0], 0, 1) .
            mb_substr($parts[1], 0, 1)
        );
    }

    $initials = getInitials($displayName);
    ?>
    <div class="sidebar__brand">
        <div class="sidebar__avatar" id="sidebarAvatar">
            <?php echo htmlspecialchars($initials, ENT_QUOTES, 'UTF-8'); ?>
        </div>
        <div class="sidebar__identity">
            <p class="sidebar__identity-name" id="sidebarDisplayName">
                <?php echo htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8'); ?>
            </p>
            <small class="sidebar__identity-role" id="sidebarRole">
                <?php echo htmlspecialchars($role, ENT_QUOTES, 'UTF-8'); ?>
            </small>
        </div>
    </div>

    <nav class="sidebar__nav" aria-label="Primary">
        <p class="sidebar__label">Overview</p>
        <a class="sidebar__link <?php echo $currentPage === 'dashboard.php' ? 'active' : ''; ?>" href="dashboard.php">
            <img class="sidebar__icon" src="assets/images/icons/dashboard.png" alt="Dashboard" loading="lazy">
            <span>Dashboard</span>
        </a>
        <a class="sidebar__link <?php echo in_array($currentPage, ['projects.php', 'project_detail.php'], true) ? 'active' : ''; ?>" href="projects.php">
            <img class="sidebar__icon" src="assets/images/icons/projects.png" alt="Projects" loading="lazy">
            <span>Projects</span>
        </a>
        <a class="sidebar__link <?php echo $currentPage === 'personal_tasks.php' ? 'active' : ''; ?>" href="personal_tasks.php">
            <img class="sidebar__icon" src="assets/images/icons/tasks.png" alt="Personal tasks" loading="lazy">
            <span>Personal tasks</span>
        </a>
        <a class="sidebar__link <?php echo $currentPage === 'settings.php' ? 'active' : ''; ?>" href="settings.php">
            <img class="sidebar__icon" src="assets/images/icons/setting.png" alt="Settings" loading="lazy">
            <span>Settings</span>
        </a>
        <a class="sidebar__link" href="#">
            <img class="sidebar__icon" src="assets/images/icons/completed.png" alt="Completed" loading="lazy">
            <span>Completed</span>
        </a>
        <a class="sidebar__link" href="#">
            <img class="sidebar__icon" src="assets/images/icons/pending.png" alt="Pending" loading="lazy">
            <span>Pending</span>
        </a>
        <a class="sidebar__link" href="#">
            <img class="sidebar__icon" src="assets/images/icons/launches.png" alt="Launches" loading="lazy">
            <span>Launches</span>
        </a>
    </nav>

    <div class="sidebar__footer">
        <button class="ghost-button ghost-button--full" type="button" id="themeToggleBtn" title="Toggle theme">
            <span class="theme-icon">☀️</span> Theme
        </button>
        <button class="ghost-button ghost-button--full" type="button" onclick="logout()">
            Logout
        </button>
    </div>
</aside>
<script src="assets/js/theme.js"></script>
