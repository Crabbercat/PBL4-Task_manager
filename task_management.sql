-- Task Manager MySQL schema
-- Import this file using phpMyAdmin or the MySQL CLI after updating credentials.
DROP DATABASE IF EXISTS task_manager;
CREATE DATABASE IF NOT EXISTS task_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE task_manager;

CREATE TABLE IF NOT EXISTS team (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    created_by VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_team_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NULL,
    team_id INT UNSIGNED NULL,
    hashed_password VARCHAR(128) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_username (username),
    UNIQUE KEY uq_user_email (email),
    KEY idx_user_team (team_id),
    CONSTRAINT fk_user_team FOREIGN KEY (team_id)
        REFERENCES team (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO team (id, name, description, created_by)
VALUES
    (1, 'Core Team', 'Default administrative team', 'admin'),
    (2, 'Product', 'Product management group', 'admin'),
    (3, 'Engineering', 'Engineering delivery team', 'admin'),
    (4, 'Design', 'UI/UX design team', 'admin'),
    (5, 'Marketing', 'Marketing and outreach team', 'admin'),
    (6, 'Sales', 'Sales and customer relations team', 'admin'),
    (7, 'Support', 'Customer support team', 'admin'),
    (8, 'HR', 'Human resources team', 'admin'),
    (9, 'Finance', 'Finance and accounting team', 'admin'),
    (10, 'Operations', 'Operations and logistics team', 'admin')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO user (username, email, display_name, team_id, hashed_password, role)
VALUES (
    'admin',
    'admin@example.com',
    'Administrator',
    1,
    '$2b$12$qpdNg4ZMuuvMaxyMArDnRePGREI/g6z2Mo/Q98s9tviQZHxegq.Kq',
    'admin'
)
ON DUPLICATE KEY UPDATE username = username;

CREATE TABLE IF NOT EXISTS project (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    color VARCHAR(20) NULL,
    owner_id INT UNSIGNED NOT NULL,
    archived TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_project_owner (owner_id),
    CONSTRAINT fk_project_owner FOREIGN KEY (owner_id)
        REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS task (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(1000) NULL,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'to_do',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    start_date DATETIME NULL,
    end_date DATETIME NULL,
    due_date DATETIME NULL,
    tags VARCHAR(200) NULL,
    creator_id INT UNSIGNED NOT NULL,
    assignee_id INT UNSIGNED NULL,
    project_id INT UNSIGNED NULL,
    is_personal TINYINT(1) NOT NULL DEFAULT 0,
    parent_task_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_task_title (title),
    KEY idx_task_project (project_id),
    KEY idx_task_creator (creator_id),
    KEY idx_task_assignee (assignee_id),
    KEY idx_task_parent (parent_task_id),
    CONSTRAINT fk_task_project FOREIGN KEY (project_id)
        REFERENCES project (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_creator FOREIGN KEY (creator_id)
        REFERENCES user (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_assignee FOREIGN KEY (assignee_id)
        REFERENCES user (id) ON DELETE SET NULL,
    CONSTRAINT fk_task_parent FOREIGN KEY (parent_task_id)
        REFERENCES task (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS project_member (
    project_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    role ENUM('owner','manager','member') NOT NULL DEFAULT 'member',
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id),
    KEY idx_project_member_user (user_id),
    CONSTRAINT fk_project_member_project FOREIGN KEY (project_id)
        REFERENCES project (id) ON DELETE CASCADE,
    CONSTRAINT fk_project_member_user FOREIGN KEY (user_id)
        REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add default users
INSERT INTO user (username, email, display_name, team_id, hashed_password, role)
VALUES
    ('member', 'member@example.com', 'Member User', 2, '$2b$12$SAGv.kKn0lYpVvsa0HBe2edjj5djO5cRkFM3sOzBaZakNAZpIkOp.', 'user'),
    ('manager', 'manager@example.com', 'Manager User', 1, '$2b$12$uUvtZDaHRm2V1cBwS4sO5OoHc1ZULRFu1JNNa16b2KXKBgOkVK9S6', 'manager')
ON DUPLICATE KEY UPDATE username = username;

-- Add sample tasks for member
INSERT INTO task (title, description, status, priority, creator_id, assignee_id, is_personal, created_at, due_date)
SELECT 'Complete Onboarding', 'Finish the onboarding checklist', 'to_do', 'high', id, id, 1, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY)
FROM user WHERE username = 'member';

INSERT INTO task (title, description, status, priority, creator_id, assignee_id, is_personal, created_at, due_date)
SELECT 'Update Profile', 'Add avatar and bio', 'in_progress', 'medium', id, id, 1, NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY)
FROM user WHERE username = 'member';

INSERT INTO task (title, description, status, priority, creator_id, assignee_id, is_personal, created_at, due_date, completed, end_date)
SELECT 'Read Documentation', 'Read the project docs', 'done', 'low', id, id, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY), 1, NOW()
FROM user WHERE username = 'member';

-- Add sample tasks for manager
INSERT INTO task (title, description, status, priority, creator_id, assignee_id, is_personal, created_at, due_date)
SELECT 'Review Q3 Goals', 'Analyze the performance metrics', 'to_do', 'high', id, id, 1, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY)
FROM user WHERE username = 'manager';

INSERT INTO task (title, description, status, priority, creator_id, assignee_id, is_personal, created_at, due_date)
SELECT 'Team Meeting', 'Weekly sync with the team', 'in_progress', 'medium', id, id, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY)
FROM user WHERE username = 'manager';

INSERT INTO task (title, description, status, priority, creator_id, assignee_id, is_personal, created_at, due_date, completed, end_date)
SELECT 'Approve Budget', 'Sign off on the new budget', 'done', 'low', id, id, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY), 1, NOW()
FROM user WHERE username = 'manager';

INSERT INTO task (title, description, status, priority, creator_id, assignee_id, is_personal, created_at, due_date)
SELECT 'System Maintenance', 'Check server logs and update packages', 'to_do', 'high', id, id, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY)
FROM user WHERE username = 'admin';

-- Sample collaborative project with seeded tasks
INSERT INTO project (name, description, color, owner_id, archived)
SELECT 'Customer Portal Rollout', 'Coordinated launch of the refreshed customer portal', '#2563eb', u.id, 0
FROM user u
WHERE u.username = 'admin'
    AND NOT EXISTS (
            SELECT 1 FROM project WHERE name = 'Customer Portal Rollout'
    );

INSERT INTO project_member (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'manager', NOW()
FROM project p
JOIN user u ON u.username = 'manager'
WHERE p.name = 'Customer Portal Rollout'
    AND NOT EXISTS (
            SELECT 1 FROM project_member pm WHERE pm.project_id = p.id AND pm.user_id = u.id
    );

INSERT INTO project_member (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'member', NOW()
FROM project p
JOIN user u ON u.username = 'member'
WHERE p.name = 'Customer Portal Rollout'
    AND NOT EXISTS (
            SELECT 1 FROM project_member pm WHERE pm.project_id = p.id AND pm.user_id = u.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'Sprint Planning Workshop', 'Outline scope and backlog for the first deployment sprint.', 'to_do', 'high', NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 0, NULL,
             admin_user.id, manager_user.id, p.id, 0, 'planning,sprint'
FROM project p
JOIN user admin_user ON admin_user.username = 'admin'
JOIN user manager_user ON manager_user.username = 'manager'
WHERE p.name = 'Customer Portal Rollout'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'Sprint Planning Workshop' AND t.project_id = p.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'Mobile UI Polish', 'Tighten spacing and colors for the new mobile flows.', 'in_progress', 'medium', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 4 DAY), 0, NULL,
             manager_user.id, member_user.id, p.id, 0, 'design,mobile'
FROM project p
JOIN user manager_user ON manager_user.username = 'manager'
JOIN user member_user ON member_user.username = 'member'
WHERE p.name = 'Customer Portal Rollout'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'Mobile UI Polish' AND t.project_id = p.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'API Contract Sign-off', 'Finalize and distribute the v2 API contract.', 'done', 'high', DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), 1, NOW(),
             manager_user.id, manager_user.id, p.id, 0, 'api,backend'
FROM project p
JOIN user manager_user ON manager_user.username = 'manager'
WHERE p.name = 'Customer Portal Rollout'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'API Contract Sign-off' AND t.project_id = p.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'Stakeholder Demo Prep', 'Compile demo data set and talking points for Friday.', 'to_do', 'low', NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 0, NULL,
             admin_user.id, member_user.id, p.id, 0, 'demo,stakeholder'
FROM project p
JOIN user admin_user ON admin_user.username = 'admin'
JOIN user member_user ON member_user.username = 'member'
WHERE p.name = 'Customer Portal Rollout'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'Stakeholder Demo Prep' AND t.project_id = p.id
    );

INSERT INTO task (title, description, status, priority, creator_id, assignee_id, is_personal, created_at, due_date)
SELECT 'User Review', 'Review new user registrations', 'in_progress', 'medium', id, id, 1, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY)
FROM user WHERE username = 'admin';

INSERT INTO task (title, description, status, priority, creator_id, assignee_id, is_personal, created_at, due_date, completed, end_date)
SELECT 'Backup Database', 'Perform weekly database backup', 'done', 'low', id, id, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY), 1, NOW()
FROM user WHERE username = 'admin';

-- Sample project: Supply Chain Revamp
INSERT INTO project (name, description, color, owner_id, archived)
SELECT 'Supply Chain Revamp', 'Digitize supplier onboarding and tracking workflows.', '#16a34a', u.id, 0
FROM user u
WHERE u.username = 'admin'
    AND NOT EXISTS (SELECT 1 FROM project WHERE name = 'Supply Chain Revamp');

INSERT INTO project_member (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'manager', NOW()
FROM project p
JOIN user u ON u.username = 'manager'
WHERE p.name = 'Supply Chain Revamp'
    AND NOT EXISTS (
            SELECT 1 FROM project_member pm WHERE pm.project_id = p.id AND pm.user_id = u.id
    );

INSERT INTO project_member (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'member', NOW()
FROM project p
JOIN user u ON u.username = 'member'
WHERE p.name = 'Supply Chain Revamp'
    AND NOT EXISTS (
            SELECT 1 FROM project_member pm WHERE pm.project_id = p.id AND pm.user_id = u.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'Vendor Readiness Audit', 'Collect baseline KPIs from top 20 vendors.', 'to_do', 'medium', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 0, NULL,
             admin_user.id, member_user.id, p.id, 0, 'audit,vendor'
FROM project p
JOIN user admin_user ON admin_user.username = 'admin'
JOIN user member_user ON member_user.username = 'member'
WHERE p.name = 'Supply Chain Revamp'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'Vendor Readiness Audit' AND t.project_id = p.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'Workflow Prototype', 'Build proof-of-concept for automated PO approvals.', 'in_progress', 'high', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(NOW(), INTERVAL 3 DAY), 0, NULL,
             manager_user.id, manager_user.id, p.id, 0, 'automation,prototype'
FROM project p
JOIN user manager_user ON manager_user.username = 'manager'
WHERE p.name = 'Supply Chain Revamp'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'Workflow Prototype' AND t.project_id = p.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'KPI Dashboard Draft', 'Assemble pilot dashboard for weekly exec reviews.', 'done', 'medium', DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), 1, NOW(),
             manager_user.id, member_user.id, p.id, 0, 'analytics,dashboard'
FROM project p
JOIN user manager_user ON manager_user.username = 'manager'
JOIN user member_user ON member_user.username = 'member'
WHERE p.name = 'Supply Chain Revamp'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'KPI Dashboard Draft' AND t.project_id = p.id
    );

-- Sample project: Marketing Automation Push
INSERT INTO project (name, description, color, owner_id, archived)
SELECT 'Marketing Automation Push', 'Implement personalization journeys across campaigns.', '#db2777', u.id, 0
FROM user u
WHERE u.username = 'admin'
    AND NOT EXISTS (SELECT 1 FROM project WHERE name = 'Marketing Automation Push');

INSERT INTO project_member (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'manager', NOW()
FROM project p
JOIN user u ON u.username = 'manager'
WHERE p.name = 'Marketing Automation Push'
    AND NOT EXISTS (
            SELECT 1 FROM project_member pm WHERE pm.project_id = p.id AND pm.user_id = u.id
    );

INSERT INTO project_member (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'member', NOW()
FROM project p
JOIN user u ON u.username = 'member'
WHERE p.name = 'Marketing Automation Push'
    AND NOT EXISTS (
            SELECT 1 FROM project_member pm WHERE pm.project_id = p.id AND pm.user_id = u.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'Audience Segmentation', 'Finalize persona clusters for nurture streams.', 'to_do', 'high', NOW(), DATE_ADD(NOW(), INTERVAL 4 DAY), 0, NULL,
             manager_user.id, member_user.id, p.id, 0, 'segmentation,nurture'
FROM project p
JOIN user manager_user ON manager_user.username = 'manager'
JOIN user member_user ON member_user.username = 'member'
WHERE p.name = 'Marketing Automation Push'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'Audience Segmentation' AND t.project_id = p.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'Journey Builder QA', 'QA the branch logic for onboarding series.', 'in_progress', 'medium', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY), 0, NULL,
             admin_user.id, manager_user.id, p.id, 0, 'qa,journey'
FROM project p
JOIN user admin_user ON admin_user.username = 'admin'
JOIN user manager_user ON manager_user.username = 'manager'
WHERE p.name = 'Marketing Automation Push'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'Journey Builder QA' AND t.project_id = p.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'Email Template Refresh', 'Publish new component library for marketers.', 'done', 'low', DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), 1, NOW(),
             admin_user.id, member_user.id, p.id, 0, 'email,templates'
FROM project p
JOIN user admin_user ON admin_user.username = 'admin'
JOIN user member_user ON member_user.username = 'member'
WHERE p.name = 'Marketing Automation Push'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'Email Template Refresh' AND t.project_id = p.id
    );

-- Sample project: Support Playbook Refresh
INSERT INTO project (name, description, color, owner_id, archived)
SELECT 'Support Playbook Refresh', 'Modernize support macros and escalation paths.', '#0ea5e9', u.id, 0
FROM user u
WHERE u.username = 'admin'
    AND NOT EXISTS (SELECT 1 FROM project WHERE name = 'Support Playbook Refresh');

INSERT INTO project_member (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'manager', NOW()
FROM project p
JOIN user u ON u.username = 'manager'
WHERE p.name = 'Support Playbook Refresh'
    AND NOT EXISTS (
            SELECT 1 FROM project_member pm WHERE pm.project_id = p.id AND pm.user_id = u.id
    );

INSERT INTO project_member (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'member', NOW()
FROM project p
JOIN user u ON u.username = 'member'
WHERE p.name = 'Support Playbook Refresh'
    AND NOT EXISTS (
            SELECT 1 FROM project_member pm WHERE pm.project_id = p.id AND pm.user_id = u.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'Ticket Taxonomy Review', 'Revise categories for chatbot handoffs.', 'to_do', 'medium', NOW(), DATE_ADD(NOW(), INTERVAL 6 DAY), 0, NULL,
             admin_user.id, member_user.id, p.id, 0, 'taxonomy,chatbot'
FROM project p
JOIN user admin_user ON admin_user.username = 'admin'
JOIN user member_user ON member_user.username = 'member'
WHERE p.name = 'Support Playbook Refresh'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'Ticket Taxonomy Review' AND t.project_id = p.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'Macro Library Draft', 'Author updated macro set with localized tone.', 'in_progress', 'high', DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_ADD(NOW(), INTERVAL 1 DAY), 0, NULL,
             manager_user.id, manager_user.id, p.id, 0, 'content,localization'
FROM project p
JOIN user manager_user ON manager_user.username = 'manager'
WHERE p.name = 'Support Playbook Refresh'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'Macro Library Draft' AND t.project_id = p.id
    );

INSERT INTO task (title, description, status, priority, start_date, due_date, completed, end_date, creator_id, assignee_id, project_id, is_personal, tags)
SELECT 'Escalation Simulation', 'Run tabletop exercise for P1 incident flow.', 'done', 'medium', DATE_SUB(NOW(), INTERVAL 8 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), 1, NOW(),
             manager_user.id, member_user.id, p.id, 0, 'simulation,training'
FROM project p
JOIN user manager_user ON manager_user.username = 'manager'
JOIN user member_user ON member_user.username = 'member'
WHERE p.name = 'Support Playbook Refresh'
    AND NOT EXISTS (
            SELECT 1 FROM task t WHERE t.title = 'Escalation Simulation' AND t.project_id = p.id
    );