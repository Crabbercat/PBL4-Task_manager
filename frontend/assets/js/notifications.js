const TOAST_DEFAULT_DURATION = 4600;

(function initializeToastSystem() {
    function ensureToastStack() {
        let stack = document.getElementById("toastStack");
        if (!stack) {
            stack = document.createElement("section");
            stack.id = "toastStack";
            stack.className = "toast-stack";
            stack.setAttribute("aria-live", "polite");
            stack.setAttribute("aria-atomic", "false");
            document.body.appendChild(stack);
        }
        return stack;
    }

    window.showToast = function showToast(message, options = {}) {
        if (!message) {
            return;
        }
        const { type = "info", description = "", duration = TOAST_DEFAULT_DURATION } = options;
        const stack = ensureToastStack();
        const toast = document.createElement("article");
        toast.className = `toast toast--${type}`;
        toast.setAttribute("role", type === "error" ? "alert" : "status");
        toast.innerHTML = `
            <div class="toast__body">
                <strong>${message}</strong>
                ${description ? `<p>${description}</p>` : ""}
            </div>
            <button type="button" class="toast__close" aria-label="Dismiss notification">&times;</button>
        `;
        stack.appendChild(toast);

        let isDismissed = false;
        const timer = setTimeout(() => dismissToast(), duration);

        toast.addEventListener("mouseenter", () => clearTimeout(timer));
        toast.querySelector(".toast__close")?.addEventListener("click", () => {
            clearTimeout(timer);
            dismissToast();
        });

        function dismissToast() {
            if (isDismissed) {
                return;
            }
            isDismissed = true;
            toast.classList.add("toast--exit");
            setTimeout(() => toast.remove(), 200);
        }
    };
})();
