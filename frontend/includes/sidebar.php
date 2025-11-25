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
        <a class="sidebar__link <?php echo $currentPage === 'dashboard.php' ? 'active' : ''; ?>" href="dashboard.php">📊 Dashboard</a>
        <a class="sidebar__link <?php echo $currentPage === 'personal_tasks.php' ? 'active' : ''; ?>" href="personal_tasks.php">🗒️ Personal tasks</a>
        <a class="sidebar__link <?php echo $currentPage === 'settings.php' ? 'active' : ''; ?>" href="settings.php">⚙️ Settings</a>
        <a class="sidebar__link" href="#">✅ Completed</a>
        <a class="sidebar__link" href="#">⏳ Pending</a>
        <a class="sidebar__link" href="#">🚀 Launches</a>
    </nav>

    <button class="ghost-button ghost-button--full" type="button" onclick="logout()">
        Logout
    </button>
</aside>
