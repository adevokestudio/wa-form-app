"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Shared top bar for every /builder/[slug]/* page — Build / Share /
 * Responses on the left (matching each to its own route so the browser
 * back button and direct links work), Open + Settings on the right. */
export default function TopNav({ slug, formName }: { slug: string; formName: string }) {
  const pathname = usePathname();
  const base = `/builder/${slug}`;

  const tabs = [
    { href: base, label: "Build", match: (p: string) => p === base },
    { href: `${base}/share`, label: "Share", match: (p: string) => p === `${base}/share` },
    { href: `${base}/responses`, label: "Responses", match: (p: string) => p === `${base}/responses` },
  ];

  const isSettings = pathname === `${base}/settings`;

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/" aria-label="Back to dashboard" className="text-gray-400 hover:text-gray-600">
            ←
          </Link>
          <h1 className="truncate text-sm font-semibold text-gray-900">{formName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/f/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400"
          >
            Open ↗
          </a>
          <Link
            href={`${base}/settings`}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              isSettings
                ? "border-green-600 text-green-700"
                : "border-gray-300 text-gray-700 hover:border-gray-400"
            }`}
          >
            Settings
          </Link>
        </div>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 px-4">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                active ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
