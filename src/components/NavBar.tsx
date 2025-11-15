// components/Navbar.tsx
import Link from "next/link";

const navItems = [
  { href: "/today", label: "Today" },
  { href: "/createcalendar", label: "New Calendar" },
  { href: "/createobject", label: "New Object" },
];

export function Navbar() {
  return (
    <header className="app-navbar">
      <div className="app-navbar-inner">
        {/* Brand */}
        <Link href="/today" className="app-navbar-brand">
          <span className="app-navbar-logo" />
          <span className="app-navbar-name">Momentum</span>
        </Link>

        {/* Links */}
        <nav className="app-navbar-links">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="app-navbar-link">
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side stub */}
        <div className="app-navbar-right">
          <button className="app-navbar-pill">Settings</button>
        </div>
      </div>
    </header>
  );
}
