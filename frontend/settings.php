<?php
$bodyClass = 'body-dashboard';
include 'includes/header.php';

$sessionUsername = $_SESSION['username'] ?? 'you';
$sessionDisplayName = $_SESSION['display_name'] ?? $sessionUsername;
$sessionEmail = $_SESSION['email'] ?? 'name@company.com';
$sessionRole = $_SESSION['role_name'] ?? 'Member';
$sessionTeam = $_SESSION['team_name'] ?? 'No team';

function esc($value) {
    return htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8');
}
?>

<div class="dashboard-shell">
    <?php include 'includes/sidebar.php'; ?>

    <main class="dashboard-main settings-main">
        <header class="settings-hero">
            <div>
                <p class="eyebrow">Control center</p>
                <h1>Settings & preferences</h1>
                <p>Keep your personal details, workspace identity, and teams perfectly in sync.</p>
            </div>
            <div class="settings-hero__stats">
                <div class="settings-pill">
                    <small>Current role</small>
                    <strong id="settingsSnapshotRole"><?php echo esc($sessionRole); ?></strong>
                </div>
                <!-- <div class="settings-pill">
                    <small>Signed in as you.</small>
                    <strong><?php echo esc($sessionDisplayName); ?></strong>
                </div> -->
            </div>
        </header>

        <div class="settings-grid">
            <section class="settings-card settings-card--profile">
                <header class="settings-card__header">
                    <p class="eyebrow">Profile</p>
                    <h2>Workspace identity</h2>
                    <p>Update how teammates see you across dashboards and assignments.</p>
                </header>

                <form id="profileForm" class="settings-form">
                    <div class="settings-form__group">
                        <p class="settings-form__group-title">Account basics</p>
                        <div class="settings-form__grid">
                            <label>
                                <span>Username</span>
                                <input type="text" id="settingsUsername" name="username" placeholder="Pick a unique handle" />
                            </label>

                            <label>
                                <span>Display name</span>
                                <input type="text" id="settingsDisplayName" name="display_name" placeholder="How should we show your name?" />
                            </label>

                            <label>
                                <span>Email</span>
                                <input type="email" id="settingsEmail" name="email" placeholder="name@company.com" required />
                            </label>
                        </div>
                    </div>

                    <div class="settings-form__group">
                        <p class="settings-form__group-title">Workspace placement</p>
                        <div class="settings-team-row">
                            <label class="settings-team-row__field">
                                <span>Team / org</span>
                                <select id="settingsTeam" name="team_id">
                                    <option value="0">No team</option>
                                </select>
                            </label>
                            <div class="settings-team-row__actions">
                                <button type="submit" class="primary-button" id="settingsSaveBtn">Save changes</button>
                            </div>
                        </div>
                    </div>
                </form>
            </section>

            <section class="settings-card settings-card--snapshot">
                <header class="settings-card__header">
                    <p class="eyebrow">Snapshot</p>
                    <h2>Current profile</h2>
                    <p>Quick glance at how your workspace card looks to teammates.</p>
                </header>
                <dl class="settings-snapshot">
                    <div class="settings-snapshot__item">
                        <dt>Display name</dt>
                        <dd id="settingsSnapshotName"><?php echo esc($sessionDisplayName); ?></dd>
                    </div>
                    <div class="settings-snapshot__item">
                        <dt>Email</dt>
                        <dd id="settingsSnapshotEmail"><?php echo esc($sessionEmail); ?></dd>
                    </div>
                    <div class="settings-snapshot__item">
                        <dt>Team</dt>
                        <dd id="settingsSnapshotTeam"><?php echo esc($sessionTeam); ?></dd>
                    </div>
                </dl>
            </section>
        </div>

        <section class="settings-card settings-card--security">
            <header class="settings-card__header">
                <p class="eyebrow">Security</p>
                <h2>Password controls</h2>
                <p>Keep your account protected by rotating your password regularly.</p>
            </header>
            <form id="passwordForm" class="settings-form settings-form--inline">
                <div class="settings-form__grid">
                    <label>
                        <span>Current password</span>
                        <input type="password" id="currentPassword" name="current_password" placeholder="Enter current password" required />
                    </label>
                    <label>
                        <span>New password</span>
                        <input type="password" id="newPassword" name="new_password" placeholder="Don't use your old password" required />
                    </label>
                    <label>
                        <span>Confirm password</span>
                        <input type="password" id="confirmPassword" name="confirm_password" placeholder="Repeat new password" required />
                    </label>
                    <button type="submit" class="primary-button" id="passwordSubmitBtn">Update password</button>
                </div>
            </form>
        </section>

        <section id="adminPanel" class="settings-card" hidden>
            <header>
                <p class="eyebrow">Admin tool</p>
                <h1>Workspace controls</h1>
                <p>Only the built-in admin account can manage contributor roles and maintain the team directory.</p>
            </header>
            <div class="admin-tool__grid">
                <article class="admin-tool__card">
                    <header>
                        <h2>Role management</h2>
                        <p>Review every workspace member and switch their contributor role.</p>
                    </header>
                    <div class="settings-role-search">
                        <input type="text" id="roleSearchInput" placeholder="Search by name, username, or email" aria-label="Search members" />
                    </div>
                    <div class="admin-scroll" aria-live="polite">
                        <div id="userRoleList" class="settings-role-list"></div>
                    </div>
                </article>

                <article class="admin-tool__card">
                    <header>
                        <h2>Team management</h2>
                        <p>Create new teams or update existing names and descriptions.</p>
                    </header>
                    <div class="settings-card__actions">
                        <button type="button" class="primary-button" id="openTeamModalBtn">Create new team</button>
                    </div>
                    <div class="admin-scroll" aria-live="polite">
                        <div id="teamList" class="team-list"></div>
                    </div>
                </article>
            </div>
        </section>

        <div class="modal" id="teamModal" hidden>
            <div class="modal__overlay" data-modal-dismiss></div>
            <div class="modal__content">
                <header class="modal__header">
                    <div>
                        <p class="eyebrow">Team Management</p>
                        <h2>Create New Team</h2>
                        <p class="helper-text">Organize members into a new team.</p>
                    </div>
                </header>
                <form class="modal__form" id="teamModalForm">
                    <label>
                        <span>Team name</span>
                        <input type="text" id="modalTeamName" name="name" placeholder="e.g. Platform" required />
                    </label>
                    <label>
                        <span>Description</span>
                        <input type="text" id="modalTeamDescription" name="description" placeholder="Optional summary" />
                    </label>
                    
                    <div class="form-section">
                        <label><span>Add Members</span></label>
                        <div class="member-selector">
                            <input type="text" id="memberSearch" placeholder="Search by name, username, or email" class="member-search-input">
                            <div id="memberList" class="member-list">
                                <!-- Member items will be injected here -->
                            </div>
                        </div>
                        <p class="helper-text">Selected members: <span id="selectedMemberCount">0</span></p>
                    </div>

                    <div class="modal__actions">
                        <button class="ghost-button" type="button" data-modal-dismiss>Cancel</button>
                        <button class="primary-button" type="submit" id="teamModalSubmitBtn">Create Team</button>
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
