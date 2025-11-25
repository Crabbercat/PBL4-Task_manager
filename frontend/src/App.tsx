import { ReactNode } from "react";
import { Navigate, Route, Routes, BrowserRouter } from "react-router-dom";
import { LoginPanel } from "./components/LoginPanel";
import { SidebarNav } from "./components/SidebarNav";
import { SignupPanel } from "./components/SignupPanel";
import "./styles/app.css";

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <section className="login-shell">
      <SidebarNav />
      {children}
    </section>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="gradient-backdrop" />
        <Routes>
          <Route
            path="/login"
            element={
              <AuthLayout>
                <LoginPanel />
              </AuthLayout>
            }
          />
          <Route
            path="/register"
            element={
              <AuthLayout>
                <SignupPanel />
              </AuthLayout>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
