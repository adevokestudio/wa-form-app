"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

/** Shared top bar for every logged-in page outside the per-form builder
 * (dashboard, admin, account). Shows who's logged in and a way to get
 * back to the right home + log out, consistently everywhere. */
export default function AppHeader({
  role,
  name,
}: {
  role: "admin" | "client";
  name: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const homeHref = role === "admin" ? "/admin" : "/dashboard";

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm font-medium ${
        pathname === href ? "text-green-700" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href={homeHref} className="flex items-center gap-2 text-base font-bold text-gray-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-600 text-sm text-white">
            W
          </span>
          WA Form
        </Link>

        <nav className="flex items-center gap-5">
          {role === "admin" && navLink("/admin", "Clients")}
          {navLink("/dashboard", role === "admin" ? "My forms" : "Dashboard")}
          {navLink("/account", "Account")}
          <span className="hidden text-sm text-gray-400 sm:inline">{name}</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-400 disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </nav>
      </div>
    </header>
  );
}
