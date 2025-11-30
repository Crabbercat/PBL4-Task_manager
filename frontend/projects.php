<?php $bodyClass = 'body-projects'; include 'includes/header.php'; ?>

<div class="dashboard-shell">
    <?php include 'includes/sidebar.php'; ?>

    <main class="dashboard-main" id="projectListPage">
        <header class="dashboard-header">
            <div>
                <p class="eyebrow">Teamwork</p>
                <h1>Projects</h1>
                <p>Track every initiative your studio is running.</p>
            </div>
            <div class="dashboard-actions">
                <button class="ghost-button" type="button" id="toggleArchivedFilter" data-mode="active">Show archived</button>
                <button class="primary-button primary-button--icon" type="button" id="openProjectModal" data-requires-role="manager">
                    <span>+</span> Create project
                </button>
            </div>
        </header>

        <section class="project-controls" aria-label="Project filters">
            <label class="project-search">
                <span class="sr-only">Search projects</span>
                <input type="search" id="projectSearch" placeholder="Search project name" autocomplete="off">
            </label>
            <div class="project-filter-tabs" role="tablist">
                <button class="project-filter-tab active" data-filter="all" type="button">All</button>
                <button class="project-filter-tab" data-filter="active" type="button">Active</button>
                <button class="project-filter-tab" data-filter="archived" type="button">Archived</button>
            </div>
        </section>

        <section class="project-grid" id="projectGrid" aria-live="polite"></section>
        <p class="helper-text helper-text--center" id="projectEmptyState" hidden>No projects yet. Create one to get started.</p>
    </main>
</div>

<div class="modal" id="projectModal" hidden>
    <div class="modal__overlay" data-modal-dismiss></div>
    <div class="modal__content">
        <header class="modal__header">
            <p class="eyebrow">New initiative</p>
            <h2>Create project</h2>
            <p class="helper-text">Projects keep tasks, members, and context together.</p>
        </header>
        <form class="modal__form" id="projectForm">
            <label>
                <span>Project name</span>
                <input type="text" id="projectName" name="name" required placeholder="e.g. Studio website overhaul">
            </label>
            <label>
                <span>Description</span>
                <textarea id="projectDescription" name="description" rows="3" placeholder="Optional summary"></textarea>
            </label>
            <label>
                <span>Accent color</span>
                <input type="color" id="projectColor" name="color" value="#5b21b6">
            </label>
            <p class="helper-text" id="projectFormMessage"></p>
            <div class="modal__actions">
                <button class="ghost-button" type="button" data-modal-dismiss>Cancel</button>
                <button class="primary-button" type="submit" id="projectSubmitBtn">Create project</button>
            </div>
        </form>
    </div>
</div>

<?php include 'includes/footer.php'; ?>
