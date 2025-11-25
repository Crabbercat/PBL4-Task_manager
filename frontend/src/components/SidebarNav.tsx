import "../styles/sidebar.css";

const navItems = [
  { icon: "📊", label: "Dashboard" },
  { icon: "✅", label: "Completed" },
  { icon: "⏳", label: "Pending" },
  { icon: "⚙️", label: "In Progress" },
  { icon: "🚀", label: "Deployed" },
  { icon: "🕒", label: "Deferred" },
  { icon: "➕", label: "Add Task" },
  { icon: "📈", label: "Stats" }
];

export function SidebarNav() {
  return (
    <aside className="sidebar">
      <div className="sidebar__logo">Task Manager</div>
      <nav>
        <ul>
          {navItems.map((item) => (
            <li key={item.label}>
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
