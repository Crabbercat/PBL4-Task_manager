document.addEventListener("DOMContentLoaded", () => {
    const settingsMain = document.querySelector(".settings-main");
    if (!settingsMain) {
        return;
    }

    const token = localStorage.getItem("tm_access_token");
    if (!token) {
        window.location.href = "login.php";
        return;
    }

    initSettingsPage(token);
});

function initSettingsPage(token) {
    const profileForm = document.getElementById("profileForm");
    const adminPanel = document.getElementById("adminPanel");
    const messageEl = document.getElementById("settingsMessage");
    const saveBtn = document.getElementById("settingsSaveBtn");
    const userRoleList = document.getElementById("userRoleList");
    const adminMessage = document.getElementById("adminMessage");
    const teamSelect = document.getElementById("settingsTeam");
    const teamList = document.getElementById("teamList");

    // Modal Elements
    const teamModal = document.getElementById("teamModal");
    const openTeamModalBtn = document.getElementById("openTeamModalBtn");
    const teamModalForm = document.getElementById("teamModalForm");
    const teamModalSubmitBtn = document.getElementById("teamModalSubmitBtn");
    const teamModalMessage = document.getElementById("teamModalMessage");
    const memberSearch = document.getElementById("memberSearch");
    const memberList = document.getElementById("memberList");
    const selectedMemberCount = document.getElementById("selectedMemberCount");

    let teamRefreshTimer;
    let cachedTeams = [];
    let profileBaseline = null;
    let allUsers = [];
    let selectedMemberIds = new Set();

    const teamsPromise = loadPublicTeams();

    // --- Modal Event Listeners ---
    if (openTeamModalBtn) {
        openTeamModalBtn.addEventListener("click", () => {
            openModal(teamModal);
            loadUsersForModal();
        });
    }

    if (teamModal) {
        teamModal.addEventListener("click", (e) => {
            if (e.target.hasAttribute("data-modal-dismiss") || e.target.classList.contains("modal__overlay")) {
                closeModal(teamModal);
            }
        });
    }

    if (memberSearch) {
        memberSearch.addEventListener("input", (e) => {
            renderMemberList(e.target.value);
        });
    }

    function openModal(modal) {
        modal.hidden = false;
        document.body.style.overflow = "hidden";
    }

    function closeModal(modal) {
        modal.hidden = true;
        document.body.style.overflow = "";
        if (teamModalForm) teamModalForm.reset();
        selectedMemberIds.clear();
        updateSelectedCount();
        if (teamModalMessage) teamModalMessage.textContent = "";
        // Reset member list UI
        if (memberList) memberList.innerHTML = "";
    }

    async function loadUsersForModal() {
        if (!memberList) return;
        memberList.innerHTML = '<p class="helper-text">Loading users...</p>';
        try {
            const response = await fetch(`${API_BASE_URL}/users/`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Unable to load users");
            allUsers = await response.json();
            renderMemberList();
        } catch (error) {
            memberList.innerHTML = `<p class="helper-text error">${error.message}</p>`;
        }
    }

    function renderMemberList(filter = "") {
        if (!memberList) return;

        const term = filter.toLowerCase();
        const filtered = allUsers.filter(u =>
            u.username.toLowerCase().includes(term) ||
            (u.display_name && u.display_name.toLowerCase().includes(term))
        );

        if (filtered.length === 0) {
            memberList.innerHTML = '<p class="helper-text">No users found.</p>';
            return;
        }

        memberList.innerHTML = filtered.map(user => {
            const isSelected = selectedMemberIds.has(user.id);
            const hasTeam = user.team_id !== null;
            const teamName = user.team ? user.team.name : "";

            return `
                <div class="member-item ${isSelected ? 'selected' : ''}" data-user-id="${user.id}" data-has-team="${hasTeam}">
                    <div class="member-info">
                        <strong>${escapeHtml(user.display_name || user.username)}</strong>
                        <small>${escapeHtml(user.email)}</small>
                        ${hasTeam ? `<span class="badge badge--warning">In team: ${escapeHtml(teamName)}</span>` : ''}
                    </div>
                    <div class="member-action">
                        ${isSelected ? '✓' : '+'}
                    </div>
                </div>
            `;
        }).join("");

        // Re-attach listeners
        memberList.querySelectorAll(".member-item").forEach(item => {
            item.addEventListener("click", () => toggleMemberSelection(item));
        });
    }

    function toggleMemberSelection(item) {
        const userId = Number(item.getAttribute("data-user-id"));
        const hasTeam = item.getAttribute("data-has-team") === "true";

        if (selectedMemberIds.has(userId)) {
            selectedMemberIds.delete(userId);
        } else {
            if (hasTeam) {
                if (!confirm("This user is already in a team. Do you want to move them to the new team?")) {
                    return;
                }
            }
            selectedMemberIds.add(userId);
        }

        updateSelectedCount();
        renderMemberList(memberSearch.value);
    }

    function updateSelectedCount() {
        if (selectedMemberCount) {
            selectedMemberCount.textContent = selectedMemberIds.size;
        }
    }

    async function handleTeamCreate(event) {
        event.preventDefault();
        if (!teamModalSubmitBtn) return;

        setSettingsMessage(teamModalMessage, "", "");
        setLoading(teamModalSubmitBtn, true, "Creating...");

        const payload = {
            name: document.getElementById("modalTeamName").value.trim(),
            description: document.getElementById("modalTeamDescription").value.trim()
        };

        try {
            // 1. Create Team
            const response = await fetch(`${API_BASE_URL}/teams/`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (response.status === 401) { logout(); return; }
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Unable to create team");

            // 2. Assign Members if any
            if (selectedMemberIds.size > 0) {
                const membersResponse = await fetch(`${API_BASE_URL}/teams/${data.id}/members/`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(Array.from(selectedMemberIds))
                });

                if (!membersResponse.ok) {
                    const errData = await membersResponse.json();
                    throw new Error(errData.detail || "Team created but failed to assign members");
                }
            }

            showAdminMessage(`Team ${data.name} created with ${selectedMemberIds.size} members.`, "success");
            autoClearMessage(adminMessage || messageEl, 3000, true);

            closeModal(teamModal);
            await Promise.all([
                loadPublicTeams(data.id),
                loadAdminTeams(),
                loadUsersForAdmin() // Refresh user list to show new teams
            ]);
        } catch (error) {
            setSettingsMessage(teamModalMessage, error.message, "error");
        } finally {
            setLoading(teamModalSubmitBtn, false, "Create Team");
        }
    }

    // --- Existing Logic ---

    async function fetchProfile() {
        await teamsPromise;
        try {
            const response = await fetch(`${API_BASE_URL}/me/`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error("Unable to load profile");
            }

            const data = await response.json();
            document.getElementById("settingsUsername").value = data.username || "";
            document.getElementById("settingsDisplayName").value = data.display_name || "";
            document.getElementById("settingsEmail").value = data.email || "";
            if (teamSelect) {
                teamSelect.value = String(data.team_id ?? 0);
            }

            const isAdmin = data.username === "admin";
            adminPanel.hidden = !isAdmin;

            if (isAdmin) {
                loadUsersForAdmin();
                loadAdminTeams();
            }

            profileBaseline = getCurrentProfilePayload();
        } catch (error) {
            setSettingsMessage(messageEl, error.message, "error");
        }
    }

    function getCurrentProfilePayload() {
        const emailInput = document.getElementById("settingsEmail");
        const displayNameInput = document.getElementById("settingsDisplayName");
        return {
            email: (emailInput?.value || "").trim(),
            display_name: (displayNameInput?.value || "").trim(),
            team_id: teamSelect ? Number(teamSelect.value) : undefined
        };
    }

    function hasProfileChanges(currentPayload) {
        if (!profileBaseline) {
            return true;
        }
        return Object.keys({ ...profileBaseline, ...currentPayload }).some(key => {
            const baselineValue = profileBaseline[key] ?? null;
            const currentValue = currentPayload[key] ?? null;
            return baselineValue !== currentValue;
        });
    }

    async function handleProfileSave(event) {
        event.preventDefault();
        if (!saveBtn) {
            return;
        }

        const payload = getCurrentProfilePayload();
        if (!hasProfileChanges(payload)) {
            setSettingsMessage(messageEl, "No changes to update.", "error");
            autoClearMessage(messageEl);
            return;
        }

        setSettingsMessage(messageEl, "", "");
        setLoading(saveBtn, true, "Saving...");

        try {
            const response = await fetch(`${API_BASE_URL}/me/`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (response.status === 401) {
                logout();
                return;
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || "Unable to update profile");
            }

            setSettingsMessage(messageEl, "Profile updated.", "success");
            autoClearMessage(messageEl, 3000, true);
            document.getElementById("settingsDisplayName").value = data.display_name || "";
            document.getElementById("settingsEmail").value = data.email || "";
            if (teamSelect) {
                teamSelect.value = String(data.team_id ?? 0);
            }
            profileBaseline = getCurrentProfilePayload();
        } catch (error) {
            setSettingsMessage(messageEl, error.message, "error");
            autoClearMessage(messageEl);
        } finally {
            setLoading(saveBtn, false, "Save changes");
        }
    }

    async function loadUsersForAdmin() {
        try {
            const response = await fetch(`${API_BASE_URL}/users/`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error("Unable to load users");
            }

            const users = await response.json();
            renderUserRoleList(users);
        } catch (error) {
            userRoleList.innerHTML = `<p class="helper-text error">${error.message}</p>`;
        }
    }

    function renderUserRoleList(users) {
        if (!Array.isArray(users) || users.length === 0) {
            userRoleList.innerHTML = '<p class="helper-text">No users found.</p>';
            return;
        }

        userRoleList.innerHTML = users.map(user => {
            const isAdminUser = user.username === "admin";
            const teamLabel = (user.team && user.team.name) || "No team";
            const roleControls = isAdminUser
                ? '<div class="role-row__actions"><span class="role-pill">Workspace Admin</span></div>'
                : `
                    <div class="role-row__actions">
                        <select data-role-select>
                            <option value="user" ${user.role === "user" ? "selected" : ""}>Member</option>
                            <option value="manager" ${user.role === "manager" ? "selected" : ""}>Manager</option>
                        </select>
                        <button type="button" class="ghost-button role-save-btn">Update</button>
                    </div>
                `;

            return `
                <div class="role-row" data-user-id="${user.id}" data-current-role="${user.role}">
                    <div>
                        <strong>${escapeHtml(user.display_name || user.username)}</strong>
                        <p class="helper-text">Username: ${escapeHtml(user.username)}</p>
                        <p class="helper-text">Email: ${escapeHtml(user.email)}</p>
                        <p class="helper-text">Team: ${escapeHtml(teamLabel)}</p>
                    </div>
                    <div class="role-row__controls">
                        ${roleControls}
                        <p class="helper-text role-row__message" data-role-message></p>
                    </div>
                </div>
            `;
        }).join("");
    }

    userRoleList?.addEventListener("click", event => {
        const target = event.target;
        if (!target.classList.contains("role-save-btn") || target.disabled) {
            return;
        }

        const row = target.closest(".role-row");
        if (!row) {
            return;
        }

        const userId = row.getAttribute("data-user-id");
        const select = row.querySelector("[data-role-select]");
        if (!userId || !select) {
            return;
        }

        const currentRole = row.getAttribute("data-current-role") || "";
        if (select.value === currentRole) {
            const rowMessage = row.querySelector("[data-role-message]");
            if (rowMessage) {
                setSettingsMessage(rowMessage, "No changes to update.", "error");
                autoClearMessage(rowMessage);
            }
            return;
        }

        updateUserRole(userId, select.value, target, row);
    });

    async function updateUserRole(userId, role, buttonEl, row) {
        const rowMessage = row?.querySelector("[data-role-message]");
        if (rowMessage) {
            setSettingsMessage(rowMessage, "", "");
        }
        setLoading(buttonEl, true, "Updating...");
        try {
            const response = await fetch(`${API_BASE_URL}/users/${userId}/role/`, {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ role })
            });

            if (response.status === 401) {
                logout();
                return;
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || "Unable to update role");
            }

            const successText = `${data.display_name || data.username} updated to ${data.role}.`;
            if (rowMessage) {
                setSettingsMessage(rowMessage, successText, "success");
                autoClearMessage(rowMessage, 3000, true);
            } else {
                showAdminMessage(successText, "success");
                autoClearMessage(adminMessage || messageEl, 3000, true);
            }
            row?.setAttribute("data-current-role", data.role);
        } catch (error) {
            if (rowMessage) {
                setSettingsMessage(rowMessage, error.message, "error");
                autoClearMessage(rowMessage);
            } else {
                showAdminMessage(error.message, "error");
            }
        } finally {
            setLoading(buttonEl, false, "Update");
        }
    }

    profileForm?.addEventListener("submit", handleProfileSave);
    teamModalForm?.addEventListener("submit", handleTeamCreate);
    fetchProfile();

    async function loadPublicTeams(selectedIdOrOptions) {
        let selectedId;
        let preserveSelection = false;
        if (typeof selectedIdOrOptions === "object" && selectedIdOrOptions !== null) {
            selectedId = selectedIdOrOptions.selectedId;
            preserveSelection = Boolean(selectedIdOrOptions.preserveSelection);
        } else {
            selectedId = selectedIdOrOptions;
        }

        const preservedValue = preserveSelection && teamSelect ? teamSelect.value : undefined;
        if (teamSelect) {
            setTeamSelectLoading(true);
        }
        try {
            const response = await fetch(`${API_BASE_URL}/teams/public/`);
            const teams = await response.json();

            if (!response.ok) {
                throw new Error(teams.detail || "Unable to load teams");
            }

            cachedTeams = Array.isArray(teams) ? teams : [];
            const valueToSelect = selectedId !== undefined ? selectedId : preservedValue;
            populateTeamSelect(valueToSelect);
        } catch (error) {
            populateTeamSelect();
            showAdminMessage(error.message, "error");
        } finally {
            if (teamSelect) {
                setTeamSelectLoading(false);
            }
        }
    }

    function populateTeamSelect(selectedId) {
        if (!teamSelect) {
            return;
        }

        const options = ['<option value="0">No team</option>'];
        cachedTeams.forEach(team => {
            options.push(`<option value="${team.id}">${team.name}</option>`);
        });
        teamSelect.innerHTML = options.join("");

        if (selectedId !== undefined) {
            teamSelect.value = String(selectedId ?? 0);
        }
    }

    async function loadAdminTeams() {
        if (!teamList) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/teams/`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error("Unable to load admin team list");
            }

            const teams = await response.json();
            renderAdminTeamList(teams);
        } catch (error) {
            teamList.innerHTML = `<p class="helper-text error">${escapeHtml(error.message)}</p>`;
        }
    }

    function renderAdminTeamList(teams) {
        if (!teamList) {
            return;
        }

        if (!Array.isArray(teams) || teams.length === 0) {
            teamList.innerHTML = '<p class="helper-text">No teams available.</p>';
            return;
        }

        teamList.innerHTML = teams.map(team => `
            <div class="team-row" data-team-id="${team.id}" data-initial-name="${encodeURIComponent(team.name || "")}" data-initial-description="${encodeURIComponent(team.description || "")}">
                <div class="team-row__fields">
                    <label class="team-row__label-group">
                        <span class="team-row__label">Team name</span>
                        <input type="text" data-team-name value="${escapeHtml(team.name)}" />
                    </label>
                    <label class="team-row__label-group">
                        <span class="team-row__label">Description</span>
                        <input type="text" data-team-description value="${escapeHtml(team.description || "")}" placeholder="Description" />
                    </label>
                </div>
                <div class="team-row__actions">
                    <button type="button" class="ghost-button" data-team-action="save">Save</button>
                    <button type="button" class="ghost-button ghost-button--danger" data-team-action="delete">Delete</button>
                </div>
                <p class="helper-text team-row__message" data-team-message></p>
            </div>
        `).join("");
    }

    teamList?.addEventListener("click", event => {
        const button = event.target.closest("[data-team-action]");
        if (!button) {
            return;
        }

        const row = button.closest(".team-row");
        if (!row) {
            return;
        }

        const teamId = row.getAttribute("data-team-id");
        if (!teamId) {
            return;
        }

        if (button.getAttribute("data-team-action") === "save") {
            handleTeamUpdate(teamId, row, button);
        } else {
            handleTeamDelete(teamId, button);
        }
    });

    async function handleTeamUpdate(teamId, row, button) {
        const nameInput = row.querySelector("[data-team-name]");
        const descInput = row.querySelector("[data-team-description]");
        if (!nameInput || !descInput) {
            return;
        }

        const payload = {
            name: nameInput.value.trim(),
            description: descInput.value.trim()
        };

        const rowMessage = row.querySelector("[data-team-message]");
        if (rowMessage) {
            setSettingsMessage(rowMessage, "", "");
        }
        const initialName = decodeAttribute(row.getAttribute("data-initial-name"));
        const initialDescription = decodeAttribute(row.getAttribute("data-initial-description"));
        if (payload.name === initialName && payload.description === initialDescription) {
            if (rowMessage) {
                setSettingsMessage(rowMessage, "No changes to save.", "error");
                autoClearMessage(rowMessage);
            }
            return;
        }
        setLoading(button, true, "Saving...");
        try {
            const response = await fetch(`${API_BASE_URL}/teams/${teamId}/`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (response.status === 401) {
                logout();
                return;
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || "Unable to update team");
            }

            if (rowMessage) {
                setSettingsMessage(rowMessage, `Team ${data.name} updated.`, "success");
                autoClearMessage(rowMessage, 3000, true);
            } else {
                showAdminMessage(`Team ${data.name} updated.`, "success");
                autoClearMessage(adminMessage || messageEl, 3000, true);
            }
            row.setAttribute("data-initial-name", encodeURIComponent(data.name || payload.name || ""));
            row.setAttribute("data-initial-description", encodeURIComponent(data.description || payload.description || ""));
            scheduleTeamRefresh();
        } catch (error) {
            if (rowMessage) {
                setSettingsMessage(rowMessage, error.message, "error");
                autoClearMessage(rowMessage, 3000);
            } else {
                showAdminMessage(error.message, "error");
            }
        } finally {
            setLoading(button, false, "Save");
        }
    }

    async function handleTeamDelete(teamId, button) {
        if (!confirm("Delete this team? Members assigned to it will be cleared.")) {
            return;
        }

        const row = button.closest(".team-row");
        const rowMessage = row?.querySelector("[data-team-message]");
        if (rowMessage) {
            setSettingsMessage(rowMessage, "", "");
        }
        setLoading(button, true, "Deleting...");
        try {
            const response = await fetch(`${API_BASE_URL}/teams/${teamId}/`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok && response.status !== 204) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || "Unable to delete team");
            }

            if (rowMessage) {
                setSettingsMessage(rowMessage, "Team removed.", "success");
                autoClearMessage(rowMessage, 3000, true);
            } else {
                showAdminMessage("Team removed.", "success");
                autoClearMessage(adminMessage || messageEl, 3000, true);
            }
            scheduleTeamRefresh();
        } catch (error) {
            if (rowMessage) {
                setSettingsMessage(rowMessage, error.message, "error");
                autoClearMessage(rowMessage, 3000);
            } else {
                showAdminMessage(error.message, "error");
            }
        } finally {
            setLoading(button, false, "Delete");
        }
    }

    function decodeAttribute(value) {
        if (!value) {
            return "";
        }
        try {
            return decodeURIComponent(value);
        } catch (error) {
            console.warn("Unable to decode attribute", error);
            return value;
        }
    }

    function showAdminMessage(text, state) {
        if (adminMessage) {
            setSettingsMessage(adminMessage, text, state);
        } else {
            setSettingsMessage(messageEl, text, state);
        }
    }

    function setTeamSelectLoading(isLoading) {
        if (!teamSelect) {
            return;
        }
        if (isLoading) {
            teamSelect.disabled = true;
            teamSelect.innerHTML = '<option value="0">Loading teams...</option>';
        } else {
            teamSelect.disabled = false;
        }
    }

    function autoClearMessage(element, timeout = 3000, refreshAfter = false) {
        if (!element) {
            return;
        }
        const existing = Number(element.getAttribute("data-timer-id"));
        if (existing) {
            clearTimeout(existing);
        }
        const id = window.setTimeout(() => {
            element.textContent = "";
            element.className = "helper-text";
            element.removeAttribute("data-timer-id");
            if (refreshAfter) {
                window.location.reload();
            }
        }, timeout);
        element.setAttribute("data-timer-id", String(id));
    }

    function scheduleTeamRefresh(delay = 3000) {
        if (teamRefreshTimer) {
            clearTimeout(teamRefreshTimer);
        }
        teamRefreshTimer = window.setTimeout(() => {
            loadAdminTeams();
            loadPublicTeams({ preserveSelection: true });
            loadUsersForAdmin();
            teamRefreshTimer = null;
        }, delay);
    }
}

function setSettingsMessage(element, text, state) {
    if (!element) {
        return;
    }
    element.textContent = text;
    element.className = "helper-text";
    if (state) {
        element.classList.add(state);
    }
}

function escapeHtml(value) {
    if (!value) {
        return "";
    }
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}