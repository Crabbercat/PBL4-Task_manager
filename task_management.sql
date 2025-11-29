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

-- Add sample tasks for admin (so they see something on login)
INSERT INTO task (title, description, status, priority, creator_id, assignee_id, is_personal, created_at, due_date)
SELECT 'System Maintenance', 'Check server logs and update packages', 'to_do', 'high', id, id, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY)
FROM user WHERE username = 'admin';

INSERT INTO task (title, description, status, priority, creator_id, assignee_id, is_personal, created_at, due_date)
SELECT 'User Review', 'Review new user registrations', 'in_progress', 'medium', id, id, 1, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY)
FROM user WHERE username = 'admin';

INSERT INTO task (title, description, status, priority, creator_id, assignee_id, is_personal, created_at, due_date, completed, end_date)
SELECT 'Backup Database', 'Perform weekly database backup', 'done', 'low', id, id, 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY), 1, NOW()
FROM user WHERE username = 'admin';