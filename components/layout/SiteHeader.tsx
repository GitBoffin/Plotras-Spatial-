"use client";

// =====================================================================
// PLOTRAS — Site Header
// =====================================================================
// Shared across pages that want the standard nav (home, verify, bank).
// /map deliberately omits it to keep the viewer full-bleed.
// =====================================================================

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (!session) {
        setEmail(null);
        setRole(null);
        return;
      }

      setEmail(session.user.email ?? null);

      const { data } = await supabaseBrowser
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .single();

      setRole(data?.role ?? null);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange(() => loadSession());

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabaseBrowser.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-serif text-xl text-foreground">
          Plotras
        </Link>
        <nav className="flex items-center gap-6 text-sm text-foreground-muted">
          <Link href="/map" className="transition-colors hover:text-foreground">
            Parcel Map
          </Link>
          <Link href="/verify" className="transition-colors hover:text-foreground">
            Verify Coordinates
          </Link>
          {email && role && role !== "RETAIL_USER" && (
            <Link href="/lineage" className="transition-colors hover:text-foreground">
              Title Lineage
            </Link>
          )}
          {role === "BANK_OFFICER" && (
            <Link href="/bank/dashboard" className="transition-colors hover:text-foreground">
              Bank Dashboard
            </Link>
          )}
          {role === "SURVEYOR" && (
            <Link href="/survey/submit" className="transition-colors hover:text-foreground">
              Submit Survey
            </Link>
          )}
          {role === "LAWYER" && (
            <Link href="/legal/transfer" className="transition-colors hover:text-foreground">
              Initiate Transfer
            </Link>
          )}
          {role === "GOVT_ADMIN" && (
            <Link href="/admin/dashboard" className="transition-colors hover:text-foreground">
              Admin Dashboard
            </Link>
          )}
          {email && !["BANK_OFFICER", "GOVT_ADMIN"].includes(role ?? "") && (
            <Link href="/apply-for-role" className="transition-colors hover:text-foreground">
              Apply for a Role
            </Link>
          )}

          {email ? (
            <div className="flex items-center gap-3 border-l border-border pl-6">
              <span className="text-foreground-faint">{email}</span>
              <button
                onClick={handleSignOut}
                className="text-foreground-muted transition-colors hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 border-l border-border pl-6">
              <Link href="/login" className="transition-colors hover:text-foreground">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-card bg-brass px-3 py-1.5 text-canvas transition-opacity hover:opacity-90"
              >
                Sign up
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
