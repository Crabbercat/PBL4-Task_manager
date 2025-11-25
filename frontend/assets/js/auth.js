const API_BASE_URL = "/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener("submit", handleRegister);
        populateTeamSelect();
    }
});

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
        const response = await fetch(`${API_BASE_URL}/login/`, {
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
        const response = await fetch(`${API_BASE_URL}/register/`, {
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
        const response = await fetch(`${API_BASE_URL}/teams/public/`);
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
