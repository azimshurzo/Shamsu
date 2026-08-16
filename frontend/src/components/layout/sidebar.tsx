"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const userNav: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "◈" },
  { label: "My APIs", href: "/dashboard/apis", icon: "⬡" },
  { label: "Workflows", href: "/dashboard/workflows", icon: "◉" },
  { label: "Payments", href: "/dashboard/payments", icon: "◎" },
  { label: "AI Settings", href: "/dashboard/ai", icon: "⚡" },
];

const adminNav: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "◈" },
  { label: "Users", href: "/admin/users", icon: "◇" },
  { label: "Payments", href: "/admin/payments", icon: "◎" },
  { label: "Plans", href: "/admin/pricing", icon: "◆" },
  { label: "Settings", href: "/admin/settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isAdmin = pathname.startsWith("/admin");
  const items = isAdmin ? adminNav : userNav;

  return (
    <aside className="w-64 min-h-screen bg-[#0d0d14] border-r border-glow flex flex-col">
      <div className="px-6 py-5 border-b border-glow">
        <Link href="/" className="text-xl font-bold gradient-neon-text">SHAMSU</Link>
        {isAdmin && (
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[rgba(124,58,237,0.2)] text-[#7c3aed] font-semibold border border-[rgba(124,58,237,0.3)]">
            ADMIN
          </span>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const active = item.href === "/dashboard" || item.href === "/admin"
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-[rgba(0,212,255,0.08)] text-[#00d4ff] border-glow"
                  : "text-[#64748b] hover:text-[#94a3b8] hover:bg-[rgba(255,255,255,0.03)]"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-glow">
        <div className="px-4 py-2 mb-2">
          <p className="text-sm font-medium text-[#e2e8f0] truncate">{user?.name}</p>
          <p className="text-xs text-[#64748b] truncate">{user?.email}</p>
        </div>
        <button
          onClick={logout}
          className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-[#64748b] hover:text-[#ff3366] hover:bg-[rgba(255,51,102,0.05)] transition-all"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
