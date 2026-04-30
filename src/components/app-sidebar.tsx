"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  EyeIcon,
  HomeIcon,
  SunIcon,
  MoonIcon,
  ArrowRightOnRectangleIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/actions";

type UserInfo = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type RecentItem = {
  id: string;
  fellowName: string | null;
  company: string | null;
  model: string;
  createdAt: string;
  score: number | null;
};

export function AppSidebar({
  user,
  recent = [],
}: {
  user: UserInfo | null;
  recent?: RecentItem[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const savedCollapsed = localStorage.getItem("sidebar-collapsed");
    if (savedCollapsed === "true") setCollapsed(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    setDark(isDark);
  }

  const initials = user?.name
    ? user.name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div
      className={cn(
        "relative flex flex-col h-full border-r border-border bg-card shrink-0 transition-[width] duration-200 ease-in-out overflow-hidden",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* ── Logo row ─────────────────────────────── */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border px-3 gap-3",
          collapsed && "justify-center px-0"
        )}
      >
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <EyeIcon className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-tight">Trinethra</div>
            <div className="truncate text-[10px] text-muted-foreground">Feedback Analyzer</div>
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
            collapsed && "hidden"
          )}
          title="Collapse sidebar"
        >
          <ChevronDoubleLeftIcon className="h-4 w-4" />
        </button>
      </div>

      {/* ── Expand button (collapsed state) ──────── */}
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex w-full items-center justify-center py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Expand sidebar"
        >
          <ChevronDoubleRightIcon className="h-4 w-4" />
        </button>
      )}

      {/* ── Navigation ───────────────────────────── */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        <NavItem
          href="/dashboard"
          icon={HomeIcon}
          label="Dashboard"
          collapsed={collapsed}
          active={pathname === "/dashboard"}
        />

        {/* Recent analyses — only shown when expanded */}
        {!collapsed && recent.length > 0 && (
          <div className="pt-3">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Recent
            </p>
            <div className="space-y-0.5">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  href={`/dashboard?a=${r.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {r.score !== null && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                        r.score <= 3
                          ? "band-need"
                          : r.score <= 6
                            ? "band-prod"
                            : "band-perf"
                      )}
                    >
                      {r.score}
                    </span>
                  )}
                  <span className="truncate">{r.fellowName ?? "Unnamed Fellow"}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ── Bottom section ────────────────────────── */}
      <div className="border-t border-border p-2 space-y-0.5">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleDark}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-0"
          )}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? (
            <SunIcon className="h-5 w-5 shrink-0" />
          ) : (
            <MoonIcon className="h-5 w-5 shrink-0" />
          )}
          {!collapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
        </button>

        {/* User info pill */}
        {user && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-2",
              collapsed && "justify-center px-0"
            )}
          >
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-white text-[11px] font-bold">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-foreground leading-tight">
                  {user.name ?? "User"}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {user.email}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sign out */}
        <form action={signOutAction}>
          <button
            type="submit"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400",
              collapsed && "justify-center px-0"
            )}
            title="Sign out"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </form>
      </div>
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  collapsed,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        collapsed && "justify-center px-0"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
