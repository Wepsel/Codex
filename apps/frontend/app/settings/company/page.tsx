"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Building2,
  Check,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X
} from "lucide-react";
import type { CompanyAdminOverview, CompanyMember, CompanyRole } from "@kube-suite/shared";
import { useSession } from "@/components/session-context";
import {
  decideCompanyJoinRequest,
  fetchCompanyAdminOverview,
  inviteCompanyMember,
  resetCompanyMemberPassword,
  updateCompanyMember,
  removeCompanyMember
} from "@/lib/company-admin";

function formatRelative(value?: string) {
  if (!value) {
    return "nooit";
  }
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch (error) {
    return value;
  }
}

const roleLabels: Record<CompanyRole, string> = {
  admin: "Admin",
  member: "Member"
};

const statusStyles: Record<string, string> = {
  active: "bg-success/20 text-success",
  pending: "bg-warning/20 text-warning",
  invited: "bg-primary-500/20 text-primary-200",
  rejected: "bg-danger/20 text-danger"
};

export default function CompanyAdminPage() {
  const { user } = useSession();
  const [overview, setOverview] = useState<CompanyAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "member" as CompanyRole, expiresAt: "" });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [memberAction, setMemberAction] = useState<string | null>(null);
  const [requestAction, setRequestAction] = useState<string | null>(null);

  const isAdmin = useMemo(() => user?.company.role === "admin" && user.company.status === "active", [user]);

  const loadOverview = useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCompanyAdminOverview();
      setOverview(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kon bedrijfsgegevens niet laden";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadOverview();
    }
  }, [isAdmin, loadOverview]);

  const handleRoleChange = async (member: CompanyMember, role: CompanyRole) => {
    if (member.role === role) {
      return;
    }
    setMemberAction(member.id + ":role");
    try {
      await updateCompanyMember(member.id, role);
      await loadOverview();
      setFeedback({ type: "success", message: member.name + " is nu " + roleLabels[role].toLowerCase() });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kon rol niet bijwerken";
      setFeedback({ type: "error", message });
    } finally {
      setMemberAction(null);
    }
  };

  const handleRemoveMember = async (member: CompanyMember) => {
    if (!window.confirm("Weet je zeker dat je " + member.name + " wilt verwijderen?")) {
      return;
    }
    setMemberAction(member.id + ":remove");
    try {
      await removeCompanyMember(member.id);
      await loadOverview();
      setFeedback({ type: "success", message: member.name + " is verwijderd" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verwijderen mislukt";
      setFeedback({ type: "error", message });
    } finally {
      setMemberAction(null);
    }
  };

  const handleResetPassword = async (member: CompanyMember) => {
    if (!window.confirm("Genereer een tijdelijk wachtwoord voor " + member.name + "?")) {
      return;
    }
    setMemberAction(member.id + ":reset");
    try {
      const result = await resetCompanyMemberPassword(member.id);
      setFeedback({ type: "success", message: "Nieuw tijdelijk wachtwoord voor " + member.name + ": " + result.temporaryPassword });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reset mislukt";
      setFeedback({ type: "error", message });
    } finally {
      setMemberAction(null);
    }
  };

  const handleInviteSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteBusy(true);
    setFeedback(null);
    try {
      await inviteCompanyMember({
        email: inviteForm.email,
        role: inviteForm.role,
        expiresAt: inviteForm.expiresAt || undefined
      });
      await loadOverview();
      setInviteForm({ email: "", role: "member", expiresAt: "" });
      setFeedback({ type: "success", message: "Uitnodiging verstuurd" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Versturen mislukt";
      setFeedback({ type: "error", message });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleDecision = async (requestId: string, decision: "approve" | "reject") => {
    setRequestAction(requestId + decision);
    try {
      await decideCompanyJoinRequest(requestId, decision);
      await loadOverview();
      setFeedback({
        type: "success",
        message: decision === "approve" ? "Aanvraag goedgekeurd" : "Aanvraag afgewezen"
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Actie mislukt";
      setFeedback({ type: "error", message });
    } finally {
      setRequestAction(null);
    }
  };

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6 px-8 py-16 text-white/70">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-danger" />
          <h1 className="text-3xl font-semibold text-white">Geen toegang tot bedrijfsbeheer</h1>
        </div>
        <p className="text-sm">
          Alleen actieve bedrijfadmins kunnen leden beheren. Vraag een admin in jouw organisatie om je de juiste rol te geven.
        </p>
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Terug naar instellingen
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10 px-8 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-accent" />
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Bedrijfsbeheer</p>
            <h1 className="text-3xl font-semibold text-white">Beheer teamleden en toegang</h1>
          </div>
        </div>
        <Link href="/settings" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" /> Terug naar instellingen
        </Link>
      </header>

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger"}`}
        >
          {feedback.message}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {loading || !overview ? (
        <div className="flex h-48 items-center justify-center text-white/60">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
              <header className="flex items-center justify-between text-white">
                <span>Leden</span>
                <Users className="h-4 w-4 text-accent" />
              </header>
              <p className="mt-4 text-3xl font-semibold text-white">{overview.profile.memberCount}</p>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">{overview.profile.adminCount} admins</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
              <header className="flex items-center justify-between text-white">
                <span>Open aanvragen</span>
                <ShieldAlert className="h-4 w-4 text-warning" />
              </header>
              <p className="mt-4 text-3xl font-semibold text-white">{overview.profile.pendingRequests}</p>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Wachten op besluit</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
              <header className="flex items-center justify-between text-white">
                <span>Uitnodigingen</span>
                <ShieldCheck className="h-4 w-4 text-success" />
              </header>
              <p className="mt-4 text-3xl font-semibold text-white">{overview.profile.pendingInvites}</p>
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Wachten op reactie</p>
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
              <header className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Teamleden</h2>
                  <p className="text-sm text-white/50">Beheer rollen en reset wachtwoorden</p>
                </div>
                <button
                  onClick={loadOverview}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10"
                >
                  <Loader2 className="h-3 w-3" /> Refresh
                </button>
              </header>
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-white/80">
                  <thead className="text-xs uppercase tracking-[0.2em] text-white/40">
                    <tr>
                      <th className="pb-3 pr-4">Naam</th>
                      <th className="pb-3 pr-4">Rol</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pr-4">Laatste activiteit</th>
                      <th className="pb-3">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {overview.members.map(member => {
                      const busy = memberAction ? memberAction.startsWith(member.id) : false;
                      return (
                        <tr key={member.id} className="align-middle">
                          <td className="py-3 pr-4">
                            <div className="text-white">{member.name}</div>
                            <div className="text-xs text-white/40">{member.email}</div>
                          </td>
                          <td className="py-3 pr-4">
                            <select
                              className="rounded-md border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/80"
                              value={member.role}
                              onChange={event => handleRoleChange(member, event.target.value as CompanyRole)}
                              disabled={busy}
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.35em] ${statusStyles[member.status] ?? "bg-white/10 text-white/60"}`}>
                              {member.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-xs text-white/50">{formatRelative(member.lastSeenAt)}</td>
                          <td className="py-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleResetPassword(member)}
                              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10"
                              disabled={busy}
                            >
                              <KeyRound className="h-3 w-3" /> Reset
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member)}
                              className="inline-flex items-center gap-1 rounded-md border border-danger/50 px-3 py-1 text-xs text-danger transition hover:bg-danger/10"
                              disabled={busy || member.id === user.id}
                            >
                              <Trash2 className="h-3 w-3" /> Verwijder
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="space-y-6">
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
                <header className="flex items-center gap-3 text-white">
                  <UserCog className="h-5 w-5 text-accent" />
                  <div>
                    <h2 className="text-lg font-semibold">Nieuwe uitnodiging</h2>
                    <p className="text-sm text-white/50">Stuur een invite met passende rol</p>
                  </div>
                </header>
                <form className="mt-4 space-y-3 text-sm" onSubmit={handleInviteSubmit}>
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-white/40">E-mail</label>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={event => setInviteForm(prev => ({ ...prev, email: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white/80 focus:border-accent focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-white/40">Rol</label>
                    <select
                      value={inviteForm.role}
                      onChange={event => setInviteForm(prev => ({ ...prev, role: event.target.value as CompanyRole }))}
                      className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white/80 focus:border-accent focus:outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.35em] text-white/40">Verloopt op (optioneel)</label>
                    <input
                      type="date"
                      value={inviteForm.expiresAt}
                      onChange={event => setInviteForm(prev => ({ ...prev, expiresAt: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white/80 focus:border-accent focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent px-4 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:shadow-glow disabled:opacity-60"
                    disabled={inviteBusy}
                  >
                    {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Verstuur
                  </button>
                </form>
                <ul className="mt-4 space-y-2 text-xs text-white/60">
                  {overview.invites.length === 0 && <li>Geen open uitnodigingen.</li>}
                  {overview.invites.map(invite => (
                    <li key={invite.id} className="flex items-center justify-between rounded-md border border-white/10 bg-black/30 px-3 py-2">
                      <div>
                        <p className="text-white/80">{invite.email}</p>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-white/30">{invite.role.toUpperCase()} - {invite.status}</p>
                      </div>
                      <span className="text-[11px] uppercase tracking-[0.3em] text-white/30">
                        {invite.expiresAt ? "verloopt " + formatRelative(invite.expiresAt) : "geen einddatum"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
                <header className="flex items-center gap-3 text-white">
                  <ShieldAlert className="h-5 w-5 text-warning" />
                  <div>
                    <h2 className="text-lg font-semibold">Aanvragen</h2>
                    <p className="text-sm text-white/50">Keur pending requests goed of af</p>
                  </div>
                </header>
                <ul className="mt-4 space-y-3 text-sm">
                  {overview.joinRequests.length === 0 && (
                    <li className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white/60">
                      Geen open verzoeken.
                    </li>
                  )}
                  {overview.joinRequests.map(request => {
                    const pending = request.status === "pending";
                    return (
                      <li key={request.id} className="rounded-md border border-white/10 bg-black/30 px-3 py-3">
                        <div className="flex items-center justify-between text-white">
                          <span className="font-semibold">{request.userName}</span>
                          <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.35em] ${request.status === "approved" ? "bg-success/20 text-success" : request.status === "rejected" ? "bg-danger/20 text-danger" : "bg-warning/20 text-warning"}`}>
                            {request.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-white/50">Ingediend {formatRelative(request.submittedAt)}</p>
                        {pending && (
                          <div className="mt-3 flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-success/40 px-3 py-1 text-success transition hover:bg-success/10"
                              onClick={() => handleDecision(request.id, "approve")}
                              disabled={Boolean(requestAction)}
                            >
                              <Check className="h-3 w-3" /> Goedkeur
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-danger/40 px-3 py-1 text-danger transition hover:bg-danger/10"
                              onClick={() => handleDecision(request.id, "reject")}
                              disabled={Boolean(requestAction)}
                            >
                              <X className="h-3 w-3" /> Weiger
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}
