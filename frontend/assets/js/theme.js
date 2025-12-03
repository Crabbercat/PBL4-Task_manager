/**
 * Theme Manager
 * Handles light/dark mode toggling and persistence
 */

const ThemeManager = {
    init() {
        this.toggleBtn = document.getElementById('themeToggleBtn');
        this.html = document.documentElement;
        this.icon = this.toggleBtn?.querySelector('.theme-icon');

        // Check saved theme or system preference
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme) {
            this.setTheme(savedTheme);
        } else {
            this.setTheme(systemPrefersDark ? 'dark' : 'light');
        }

        this.bindEvents();
    },

    bindEvents() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
    },

    toggle() {
        const currentTheme = this.html.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    },

    setTheme(theme) {
        if (!this.html) {
            return;
        }
        const previousTheme = this.html.getAttribute('data-theme');
        this.html.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.updateIcon(theme);
        if (previousTheme !== theme) {
            this.emitThemeChange(theme);
        }
    },

    emitThemeChange(theme) {
        document.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme }
        }));
    },

    updateIcon(theme) {
        if (this.icon) {
            this.icon.textContent = theme === 'light' ? '🌙' : '☀️';
        }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
});
