import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Menu, Moon, Sun, X } from "lucide-react";
import Wordmark from "./Wordmark";
import { getSession, logout } from "../lib/auth";
import { getNotifications } from "../lib/notifications";

const STUDENT_NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/courses", label: "Courses" },
  { to: "/learn", label: "Learn" },
  { to: "/sarthi", label: "Sarthi AI" },
  { to: "/planner", label: "Planner" },
  { to: "/rewards", label: "Rewards" },
];
const STAFF_NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/learn", label: "Content" },
];
const ADMIN_NAV = STUDENT_NAV;
const GUEST_NAV = [
  { to: "/courses", label: "Courses" },
  { to: "/learn", label: "Learn" },
  { to: "/sarthi", label: "Sarthi AI" },
];

const DARK_KEY = "sarthi-theme";

function readDarkPref(): boolean {
  try {
    return localStorage.getItem(DARK_KEY) === "dark";
  } catch {
    return false;
  }
}

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState<boolean>(readDarkPref);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  // Re-read on every render; location changes re-render this header.
  const session = getSession();
  const NAV = !session
    ? GUEST_NAV
    : session.role === "student"
      ? STUDENT_NAV
      : session.role === "admin"
        ? ADMIN_NAV
        : STAFF_NAV;
  const notifications = session && notifOpen ? getNotifications(session.accountId) : [];

  // Close the mobile menu and the notifications card whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  // Close the notifications card on an outside click.
  useEffect(() => {
    if (!notifOpen) return;
    function onDown(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [notifOpen]);

  // Apply and persist the dark mode choice.
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.dataset.theme = "dark";
    } else {
      delete root.dataset.theme;
    }
    try {
      localStorage.setItem(DARK_KEY, dark ? "dark" : "light");
    } catch {
      // storage unavailable; the in-memory state still works
    }
  }, [dark]);

  function handleLogout() {
    logout();
    navigate("/");
  }

  const navState = menuOpen
    ? "max-h-96 opacity-100 overflow-x-auto"
    : "invisible max-h-0 opacity-0 overflow-hidden";

  return (
    <header className="nav-island anim-fade-in sticky top-3 z-40 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <Link to="/" className="brand-link order-1 no-underline">
        <Wordmark className="text-xl text-ink" />
      </Link>

      <nav
        id="main-nav-menu"
        aria-label="Main"
        className={`order-3 -mx-1 flex w-full items-center gap-x-1 whitespace-nowrap px-1 transition-all duration-300 ease-out [scrollbar-width:none] lg:visible lg:order-2 lg:mx-0 lg:max-h-none lg:w-auto lg:justify-center lg:overflow-x-auto lg:opacity-100 [&::-webkit-scrollbar]:hidden ${navState}`}
      >
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="nav-link shrink-0 rounded-md px-3 py-2 aria-[current=page]:font-semibold"
            aria-current={pathname === item.to ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="order-2 flex items-center gap-2 lg:order-3">
        <button
          type="button"
          className="btn-ghost h-10 w-10 !p-0 lg:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="main-nav-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <button
          type="button"
          className="btn-ghost h-10 w-10 !p-0"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={dark}
          onClick={() => setDark((d) => !d)}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {session && (
          <div ref={notifRef} className="relative">
            <button
              type="button"
              className="btn-ghost h-10 w-10 !p-0"
              aria-label="Notifications"
              aria-expanded={notifOpen}
              aria-controls="notifications-panel"
              onClick={() => setNotifOpen((open) => !open)}
            >
              <Bell size={18} />
            </button>
            {notifOpen && (
              <div
                id="notifications-panel"
                className="card absolute right-0 top-12 z-50 w-72 p-3 text-sm"
              >
                {notifications.length === 0 ? (
                  <p>Abhi koi notification nahi</p>
                ) : (
                  <ul className="grid max-h-80 gap-2 overflow-y-auto">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <p>{n.text}</p>
                        <p className="text-xs opacity-70">{new Date(n.at).toLocaleString("en-IN")}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {session ? (
          <button
            type="button"
            className="btn-ghost min-h-10 !px-4 !py-2 text-sm"
            onClick={handleLogout}
          >
            Log out
          </button>
        ) : (
          <>
            <Link to="/login" className="btn-ghost min-h-10 !px-4 !py-2 text-sm">
              Log in
            </Link>
            <Link to="/login?role=student" className="btn-primary min-h-10 !px-4 !py-2 text-sm">
              Join free
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
