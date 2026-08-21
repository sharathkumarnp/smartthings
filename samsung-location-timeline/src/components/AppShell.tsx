"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bug,
  Clock3,
  Cloud,
  LocateFixed,
  LockKeyhole,
  LogOut,
  MapPinned,
  Map,
  Radio,
  Smartphone,
  ScanSearch
} from "lucide-react";

const links = [
  ["/", "Overview", Map],
  ["/live", "Live", Radio],
  ["/devices", "Devices", Smartphone],
  ["/samsung-find", "Samsung Find", ScanSearch],
  ["/history", "History", Clock3],
  ["/analytics", "Analytics", Activity],
  ["/places", "Places", MapPinned],
  ["/debug/locations", "Raw data", Bug]
] as const;

const primaryLinks = links.slice(0, 4);
const insightLinks = links.slice(4);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <Link href="/" className="brand">
            <span className="brand-mark">
              <LocateFixed size={21} strokeWidth={2.4} />
            </span>
            <span className="brand-copy">
              <strong>Trace</strong>
              <small>Private timeline</small>
            </span>
          </Link>
          <span className="cloud-state"><Cloud size={14} /> Private cloud</span>
        </div>
        <nav aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {primaryLinks.map(([href, label, Icon]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""}>
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
          <p className="nav-label nav-label-spaced">Insights</p>
          {insightLinks.map(([href, label, Icon]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""}>
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="privacy-note">
            <span className="privacy-icon"><LockKeyhole size={16} /></span>
            <div>
              <strong>Local-first privacy</strong>
              <span>Encrypted, private and never shared</span>
            </div>
          </div>
          <button className="logout" onClick={logout}>
            <span className="profile-avatar">SK</span>
            <span className="profile-copy"><strong>Private workspace</strong><small>Sign out securely</small></span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <div className="content-frame">{children}</div>
      </main>
      <nav className="mobile-nav">
        {links.slice(0, 5).map(([href, label, Icon]) => (
          <Link key={href} href={href} className={pathname === href ? "active" : ""}>
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
