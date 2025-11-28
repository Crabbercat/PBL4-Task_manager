<?php $bodyClass = 'body-auth'; include 'includes/header.php'; ?>

<main class="auth-layout auth-layout--reverse" aria-labelledby="signup-heading">
    <section class="auth-card" aria-live="polite">
        <header class="auth-card__header">
            <p class="eyebrow">Create account</p>
            <h2 id="signup-heading">Join the workspace</h2>
            <p>Spin up project hubs, invite teammates, and keep every milestone visible from day one.</p>
        </header>

        <form id="registerForm" class="auth-form signup-form">
            <div class="form-grid">
                <label>
                    <span>Username</span>
                    <input name="username" type="text" placeholder="Enter username" autoComplete="username" required />
                </label>
                <label>
                    <span>Work email</span>
                    <input name="email" type="email" placeholder="Enter email" required autoComplete="email" />
                </label>
            </div>

            <div class="form-grid">
                <label>
                    <span>Team / org</span>
                    <select name="team_id" id="teamSelect">
                        <option value="">Select a team</option>
                    </select>
                    <small class="helper-text" id="teamSelectMessage">You can skip this step and add or change your team later in the settings.</small>
                </label>
                <label>
                    <span>Display name</span>
                    <input name="display_name" type="text" placeholder="How should we call you?" />
                </label>
            </div>

            <div class="form-grid">
                <label>
                    <span>Password</span>
                    <input name="password" type="password" placeholder="Create a password" required autoComplete="new-password" />
                </label>
                <label>
                    <span>Confirm password</span>
                    <input name="confirmPassword" type="password" placeholder="Repeat password" required autoComplete="new-password" />
                </label>
            </div>

            <label class="checkbox">
                <input type="checkbox" name="terms" required />
                I agree to the collaborative workspace guidelines.
            </label>

            <button type="submit" class="primary-button" id="registerBtn">
                Create account
            </button>

            <p id="registerMessage" class="helper-text" role="status"></p>

            <p class="helper-text">
                Already registered? <a href="login.php">Sign in</a>
            </p>
        </form>
    </section>

    <section class="auth-showcase auth-showcase--accent">
        <p class="eyebrow">Workspace highlights</p>
        <h1>Launch aligned, deliver together.</h1>
        <p class="subtext">
            Curate rituals, automate reminders, and keep every track owned with crystal-clear accountability.
        </p>

        <div class="progress-list">
            <article>
                <div>
                    <h3>Team rituals</h3>
                    <p>Custom ceremonies, async check-ins, and broadcast-ready changelogs.</p>
                </div>
                <span>On track</span>
            </article>
            <article>
                <div>
                    <h3>Approvals</h3>
                    <p>One-click reviews keep design, eng, and ops fully aligned.</p>
                </div>
                <span>3 pending</span>
            </article>
            <article>
                <div>
                    <h3>Velocity</h3>
                    <p>Forecast sprints with confidence using automations and insights.</p>
                </div>
                <span>+18%</span>
            </article>
        </div>
    </section>
</main>

<?php include 'includes/footer.php'; ?>
