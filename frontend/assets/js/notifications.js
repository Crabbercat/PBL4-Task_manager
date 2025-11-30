const TOAST_DEFAULT_DURATION = 3000;
const DIALOG_CLOSE_DELAY = 180;

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

    window.notifySuccess = function notifySuccess(message, description = "") {
        window.showToast(message || "Success", { type: "success", description });
    };

    window.notifyError = function notifyError(message, description = "") {
        window.showToast(message || "Something went wrong", { type: "error", description });
    };

    window.showConfirmDialog = function showConfirmDialog(options = {}) {
        const {
            title = "Confirm action",
            message = "Are you sure you want to continue?",
            confirmText = "Confirm",
            cancelText = "Cancel",
            tone = "default"
        } = options;

        return new Promise(resolve => {
            const existing = document.querySelector(".confirm-dialog");
            if (existing) {
                existing.remove();
            }

            const dialog = document.createElement("section");
            dialog.className = "confirm-dialog";
            dialog.innerHTML = `
                <div class="confirm-dialog__panel" role="dialog" aria-modal="true" aria-label="${title}">
                    <button type="button" class="confirm-dialog__close" data-dialog-dismiss aria-label="Close">&times;</button>
                    <strong class="confirm-dialog__title">${title}</strong>
                    <p class="confirm-dialog__message">${message}</p>
                    <div class="confirm-dialog__actions">
                        <button type="button" class="ghost-button" data-dialog-cancel>${cancelText}</button>
                        <button type="button" class="primary-button" data-dialog-confirm data-tone="${tone}">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);
            const previousOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";

            let handleKeyDown;

            const cleanup = result => {
                if (handleKeyDown) {
                    dialog.removeEventListener("keydown", handleKeyDown);
                }
                dialog.classList.add("confirm-dialog--closing");
                setTimeout(() => {
                    dialog.remove();
                    document.body.style.overflow = previousOverflow;
                    resolve(result);
                }, DIALOG_CLOSE_DELAY);
            };

            dialog.addEventListener("click", event => {
                if (event.target === dialog || event.target.hasAttribute("data-dialog-dismiss")) {
                    cleanup(false);
                }
            });

            dialog.querySelector("[data-dialog-cancel]")?.addEventListener("click", () => cleanup(false));
            dialog.querySelector("[data-dialog-confirm]")?.addEventListener("click", () => cleanup(true));
            const confirmButton = dialog.querySelector("[data-dialog-confirm]");
            confirmButton?.focus();

            handleKeyDown = event => {
                if (event.key === "Escape") {
                    cleanup(false);
                }
                if (event.key === "Enter" && event.target?.tagName !== "TEXTAREA") {
                    cleanup(true);
                }
            };

            dialog.addEventListener("keydown", handleKeyDown);
        });
    };
})();
