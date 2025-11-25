const API_BASE_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", initAuthScripts);
if (document.readyState === "interactive" || document.readyState === "complete") {
    initAuthScripts();
}

let authScriptsInitialized = false;

function initAuthScripts() {
    if (authScriptsInitialized) {
        return;
    }
    authScriptsInitialized = true;

    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener("submit", handleRegister);
        populateTeamSelect();
    }

    hydrateSidebarIdentity();
}

async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const messageEl = document.getElementById("loginMessage");
    const btn = document.getElementById("loginBtn");

    setLoading(btn, true, "Signing in...");
    messageEl.textContent = "";
    messageEl.className = "helper-text";

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/login/`, {
            method: "POST",
            body: new URLSearchParams(formData), // FastAPI expects form-urlencoded for OAuth2
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Login failed");
        }

        // Save token
        localStorage.setItem("tm_access_token", data.access_token);

        messageEl.textContent = "Login successful! Redirecting...";
        messageEl.classList.add("success");

        setTimeout(() => {
            window.location.href = "dashboard.php";
        }, 1000);

    } catch (error) {
        messageEl.textContent = error.message;
        messageEl.classList.add("error");
    } finally {
        setLoading(btn, false, "Sign in");
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const messageEl = document.getElementById("registerMessage");
    const btn = document.getElementById("registerBtn");

    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (password !== confirmPassword) {
        messageEl.textContent = "Passwords do not match";
        messageEl.classList.add("error");
        return;
    }

    setLoading(btn, true, "Creating account...");
    messageEl.textContent = "";
    messageEl.className = "helper-text";

    const payload = Object.fromEntries(formData.entries());
    delete payload.confirmPassword;
    delete payload.terms;
    if (!payload.team_id || payload.team_id === "") {
        delete payload.team_id;
    } else {
        payload.team_id = Number(payload.team_id);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/register/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Registration failed");
        }

        messageEl.textContent = "Account created! Redirecting to login...";
        messageEl.classList.add("success");

        setTimeout(() => {
            window.location.href = "login.php";
        }, 1500);

    } catch (error) {
        messageEl.textContent = error.message;
        messageEl.classList.add("error");
    } finally {
        setLoading(btn, false, "Create account");
    }
}

function setLoading(btn, isLoading, text) {
    if (isLoading) {
        btn.disabled = true;
        btn.textContent = text;
    } else {
        btn.disabled = false;
        btn.textContent = text;
    }
}

function logout() {
    localStorage.removeItem("tm_access_token");
    window.location.href = "login.php";
}

async function hydrateSidebarIdentity(prefetchedUser) {
    const avatarEl = document.getElementById("sidebarAvatar");
    const nameEl = document.getElementById("sidebarDisplayName");
    const roleEl = document.getElementById("sidebarRole");

    if (!avatarEl || !nameEl || !roleEl) {
        return;
    }

    if (prefetchedUser) {
        applySidebarIdentity(prefetchedUser, avatarEl, nameEl, roleEl);
        return;
    }

    const token = localStorage.getItem("tm_access_token");
    if (!token) {
        applySidebarFallback(avatarEl, nameEl, roleEl);
        return;
    }

    nameEl.textContent = "Loading...";
    roleEl.textContent = "";

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/me/`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to fetch profile");
        }

        const user = await response.json();
        applySidebarIdentity(user, avatarEl, nameEl, roleEl);
    } catch (error) {
        applySidebarFallback(avatarEl, nameEl, roleEl);
    }
}

function applySidebarIdentity(user, avatarEl, nameEl, roleEl) {
    const displayName = user?.display_name || user?.username;
    avatarEl.textContent = getInitials(displayName);
    nameEl.textContent = displayName;
    roleEl.textContent = formatRoleLabel(user?.role);
}

function applySidebarFallback(avatarEl, nameEl, roleEl) {
    avatarEl.textContent = "TM";
    nameEl.textContent = "Task Manager";
    roleEl.textContent = "Flow Suite";
}

function getInitials(name) {
    if (!name) {
        return "";
    }
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0][0].toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatRoleLabel(role) {
    if (!role) {
        return "Member";
    }
    const map = {
        admin: "Administrator",
        manager: "Manager",
        user: "Member"
    };
    const normalized = role.toLowerCase();
    if (map[normalized]) {
        return map[normalized];
    }
    return normalized
        .split(/[_\s]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

async function populateTeamSelect() {
    const select = document.getElementById("teamSelect");
    const helper = document.getElementById("teamSelectMessage");
    if (!select) {
        return;
    }

    let keepDisabled = false;
    select.disabled = true;
    helper && (helper.textContent = "Loading teams...");

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/teams/public/`);
        const teams = await response.json();

        if (!response.ok) {
            throw new Error(teams.detail || "Unable to load teams");
        }

        if (!Array.isArray(teams) || teams.length === 0) {
            select.innerHTML = '<option value="">No teams available</option>';
            helper && (helper.textContent = "Ask the admin to create a team before signing up.");
            keepDisabled = true;
            return;
        }

        select.innerHTML = [
            '<option value="">Select a team</option>',
            ...teams.map(team => `<option value="${team.id}">${team.name}</option>`)
        ].join("");
        helper && (helper.textContent = "Ask the admin to create your team if it is missing.");
    } catch (error) {
        helper && (helper.textContent = error.message);
        keepDisabled = true;
    } finally {
        if (!keepDisabled) {
            select.disabled = false;
        }
    }
}

function buildApiUrl(path = "") {
    if (!path) {
        return API_BASE_URL;
    }
    if (/^https?:/i.test(path)) {
        return path;
    }
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
}

async function authedFetch(path, options = {}) {
    const token = localStorage.getItem("tm_access_token");
    if (!token) {
        logout();
        throw new Error("Authentication required");
    }

    const headers = {
        ...(options.headers || {}),
        "Authorization": `Bearer ${token}`
    };

    const response = await fetch(buildApiUrl(path), {
        ...options,
        headers
    });

    if (response.status === 401) {
        logout();
        throw new Error("Session expired");
    }

    return response;
}
