import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, loginUser } from "../api/auth";
import "../styles/login-panel.css";

export function LoginPanel() {
  const [rememberMe, setRememberMe] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = formData.get("username")?.toString().trim() ?? "";
    const password = formData.get("password")?.toString() ?? "";

    if (!username || !password) {
      setStatus("error");
      setMessage("Please provide both username and password.");
      return;
    }

    setStatus("loading");
    setMessage("");

    loginUser({ username, password })
      .then((data) => {
        const tokenStore = rememberMe ? localStorage : sessionStorage;
        tokenStore.setItem("tm_access_token", data.access_token);
        setStatus("success");
        setMessage("Signed in successfully. Redirect coming soon!");
      })
      .catch((error: unknown) => {
        const detail = error instanceof ApiError ? error.message : "Unable to sign in. Please try again.";
        setStatus("error");
        setMessage(detail);
      });
  };

  return (
    <section className="auth-panel login-panel" aria-labelledby="login-heading">
      <header>
        <p className="eyebrow">Welcome back</p>
        <h1 id="login-heading">Sign in to continue</h1>
        <p className="subtext">
          Access your task boards, collaborate with your squad, and keep every delivery on track.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="auth-form login-form">
        <label>
          <span>Username</span>
          <input name="username" type="text" placeholder="yourusername" required autoComplete="username" />
        </label>

        <label>
          <span>Password</span>
          <input name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
        </label>

        <div className="form-row">
          <label className="remember">
            <input
              type="checkbox"
              name="remember"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            Remember me
          </label>
          <button type="button" className="link-button">
            Forgot password?
          </button>
        </div>

        <button type="submit" className="primary-button" disabled={status === "loading"}>
          {status === "loading" ? "Signing in..." : "Sign in"}
        </button>

        {message && (
          <p className={`helper-text ${status === "error" ? "error" : "success"}`} role="status" aria-live="polite">
            {message}
          </p>
        )}

        <p className="helper-text">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </section>
  );
}
