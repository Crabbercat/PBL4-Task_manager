import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, registerUser } from "../api/auth";
import "../styles/login-panel.css";

export function SignupPanel() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const username = formData.get("username")?.toString().trim() ?? "";
    const email = formData.get("email")?.toString().trim() ?? "";
    const password = formData.get("password")?.toString() ?? "";
    const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";
    const role = (formData.get("role")?.toString() ?? "user") as "user" | "manager" | "admin";
    const termsAccepted = formData.get("terms") === "on";

    if (!termsAccepted) {
      setStatus("error");
      setMessage("Please agree to the workspace guidelines.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");
    setMessage("");

    registerUser({ username, email, password, role })
      .then(() => {
        setStatus("success");
        setMessage("Account created successfully. You can sign in now.");
        formElement.reset();
      })
      .catch((error: unknown) => {
        const detail = error instanceof ApiError ? error.message : "Unable to create account.";
        setStatus("error");
        setMessage(detail);
      });
  };

  return (
    <section className="auth-panel signup-panel" aria-labelledby="signup-heading">
      <header>
        <p className="eyebrow">Create account</p>
        <h1 id="signup-heading">Join the workspace</h1>
        <p className="subtext">
          Spin up project hubs, invite teammates, and keep every delivery milestone visible from day one.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="auth-form signup-form">
        <div className="form-grid">
          <label>
            <span>Username</span>
            <input name="username" type="text" placeholder="alexnguyen" autoComplete="username" required />
          </label>
          <label>
            <span>Work email</span>
            <input name="email" type="email" placeholder="alex@studio.io" required autoComplete="email" />
          </label>
        </div>

        <div className="form-grid">
          <label>
            <span>Team / org</span>
            <input name="team" type="text" placeholder="Growth Squad" />
          </label>
          <label>
            <span>Role</span>
            <select name="role" defaultValue="member">
              <option value="user">Project Contributor</option>
              <option value="manager">Project Manager</option>
              <option value="admin">Workspace Admin</option>
            </select>
          </label>
        </div>

        <label>
          <span>Password</span>
          <input name="password" type="password" placeholder="Create a password" required autoComplete="new-password" />
        </label>

        <label>
          <span>Confirm password</span>
          <input name="confirmPassword" type="password" placeholder="Repeat password" required autoComplete="new-password" />
        </label>

        <label className="terms">
          <input type="checkbox" name="terms" required />
          I agree to the collaborative workspace guidelines.
        </label>

        <button type="submit" className="primary-button" disabled={status === "loading"}>
          {status === "loading" ? "Creating account..." : "Create account"}
        </button>

        {message && (
          <p className={`helper-text ${status === "error" ? "error" : "success"}`} role="status" aria-live="polite">
            {message}
          </p>
        )}

        <p className="helper-text">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </section>
  );
}
