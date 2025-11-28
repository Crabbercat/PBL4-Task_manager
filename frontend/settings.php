 <?php $bodyClass = 'body-dashboard'; include 'includes/header.php'; ?>

<div class="dashboard-shell">
    <?php include 'includes/sidebar.php'; ?>

    <main class="dashboard-main settings-main">
        <section class="settings-card">
            <header>
                <p class="eyebrow">Profile</p>
                <h1>Workspace identity</h1>
                <p>Update how teammates see you across dashboards and assignments.</p>
            </header>

            <form id="profileForm" class="settings-form">
                <label>
                    <span>Username</span>
                    <input type="text" id="settingsUsername" name="username" readonly />
                </label>

                <label>
                    <span>Display name</span>
                    <input type="text" id="settingsDisplayName" name="display_name" placeholder="How should we show your name?" />
                </label>

                <label>
                    <span>Email</span>
                    <input type="email" id="settingsEmail" name="email" placeholder="name@company.com" required />
                </label>

                <label>
                    <span>Team / org</span>
                    <select id="settingsTeam" name="team_id">
                        <option value="0">No team</option>
                    </select>
                </label>

                <button type="submit" class="primary-button" id="settingsSaveBtn">Save changes</button>
                <p class="helper-text" id="settingsMessage" role="status"></p>
            </form>
        </section>

        <section id="adminPanel" class="settings-card" hidden>
            <header>
                <p class="eyebrow">Admin tool</p>
                <h1>Workspace controls</h1>
                <p>Only the built-in admin account can manage contributor roles and maintain the team directory.</p>
            </header>
            <p class="helper-text" id="adminMessage" role="status"></p>

            <div class="admin-tool__grid">
                <article class="admin-tool__card">
                    <header>
                        <h2>Role management</h2>
                        <p>Review every workspace member and switch their contributor role.</p>
                    </header>
                    <div id="userRoleList" class="settings-role-list"></div>
                </article>

                <article class="admin-tool__card">
                    <header>
                        <h2>Team management</h2>
                        <p>Create new teams or update existing names and descriptions.</p>
                    </header>
                    <div class="settings-card__actions">
                        <button type="button" class="primary-button" id="openTeamModalBtn">Create new team</button>
                    </div>
                    <div id="teamList" class="team-list"></div>
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
                            <input type="text" id="memberSearch" placeholder="Search users..." class="member-search-input">
                            <div id="memberList" class="member-list">
                                <!-- Member items will be injected here -->
                            </div>
                        </div>
                        <p class="helper-text">Selected members: <span id="selectedMemberCount">0</span></p>
                    </div>

                    <p class="helper-text" id="teamModalMessage"></p>
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
