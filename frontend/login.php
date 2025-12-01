<?php $bodyClass = 'body-auth'; include 'includes/header.php'; ?>

<main class="auth-layout" aria-labelledby="login-heading">
    <section class="auth-showcase">
        <p class="eyebrow">TaskOS Platform</p>
        <h1>Operational excellence for every team.</h1>
        <p class="subtext">
            Orchestrate projects, surface blockers, and deliver predictable outcomes with a workspace designed for modern execution.
        </p>

        <ul class="selling-points">
            <li>Portfolio-level visibility with live health indicators</li>
            <li>Granular access, approvals, and activity history</li>
            <li>Secure-by-default experience across devices</li>
        </ul>

        <div class="mini-metrics">
            <article>
                <span class="metric-value">+42%</span>
                <span class="metric-label">Cycle time improvement</span>
            </article>
            <article>
                <span class="metric-value">98%</span>
                <span class="metric-label">Weekly engagement</span>
            </article>
        </div>
    </section>

    <section class="auth-card" aria-live="polite">
        <header class="auth-card__header">
            <p class="eyebrow">Welcome back</p>
            <h2 id="login-heading">Sign in to continue</h2>
            <p>Authenticate to open your command center, respond to updates, and keep execution on schedule.</p>
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
