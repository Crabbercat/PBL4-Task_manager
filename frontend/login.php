<?php $bodyClass = 'body-auth'; include 'includes/header.php'; ?>

<main class="auth-layout" aria-labelledby="login-heading">
    <section class="auth-showcase">
        <p class="eyebrow">TaskOS Platform</p>
        <h1>Bring clarity to every sprint.</h1>
        <p class="subtext">
            Track cross-functional initiatives, surface risks early, and keep everyone aligned on what ships next.
        </p>

        <ul class="selling-points">
            <li>Live task insights &amp; workload heatmaps</li>
            <li>Roles, permissions, and handoff timelines</li>
            <li>Real-time updates across mobile &amp; web</li>
        </ul>

        <div class="mini-metrics">
            <article>
                <span class="metric-value">+42%</span>
                <span class="metric-label">Faster cycle time</span>
            </article>
            <article>
                <span class="metric-value">98%</span>
                <span class="metric-label">Weekly adoption</span>
            </article>
        </div>
    </section>

    <section class="auth-card" aria-live="polite">
        <header class="auth-card__header">
            <p class="eyebrow">Welcome back</p>
            <h2 id="login-heading">Sign in to continue</h2>
            <p>Access your boards, answer blockers, and keep every milestone visible.</p>
        </header>

        <form id="loginForm" class="auth-form">
            <label>
                <span>Username</span>
                <input name="username" type="text" placeholder="Enter your username" required autoComplete="username" />
            </label>

            <label>
                <span>Password</span>
                <input name="password" type="password" placeholder="Enter your password" required autoComplete="current-password" />
            </label>

            <div class="form-row">
                <label class="checkbox">
                    <input type="checkbox" name="remember"/>
                    Remember me
                </label>
                <button type="button" class="link-button" aria-label="Forgot password">
                    Forgot password?
                </button>
            </div>

            <button type="submit" class="primary-button" id="loginBtn">
                Sign in
            </button>

            <p id="loginMessage" class="helper-text" role="status"></p>

            <p class="helper-text">
                New here? <a href="register.php">Create an account</a>
            </p>
        </form>
    </section>
</main>

<?php include 'includes/footer.php'; ?>
