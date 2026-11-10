"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { createInvite, revokeInvite } from "@/app/dashboard/community/groups/actions";
import type { CommunityGroupInvite } from "@/lib/types";

function InviteRow({ groupId, invite }: { groupId: string; invite: CommunityGroupInvite }) {
  const [copied, setCopied] = useState(false);

  const isExpired = invite.expires_at ? new Date(invite.expires_at) < new Date() : false;
  const isExhausted = invite.max_uses !== null && invite.use_count >= invite.max_uses;
  const isActive = !invite.revoked && !isExpired && !isExhausted;

  async function copyLink() {
    const url = `${window.location.origin}/dashboard/community/groups/join/${invite.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copia questo link:", url);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <div>
        <p className={isActive ? "text-slate-700" : "text-slate-400 line-through"}>
          Usato {invite.use_count}
          {invite.max_uses ? ` / ${invite.max_uses}` : ""} volte
        </p>
        <p className="text-xs text-slate-400">
          {invite.expires_at ? `Scade il ${new Date(invite.expires_at).toLocaleDateString("it-IT")}` : "Senza scadenza"}
          {invite.revoked ? " · Revocato" : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isActive && (
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copiato" : "Copia link"}
          </button>
        )}
        {!invite.revoked && (
          <button
            type="button"
            onClick={() => revokeInvite(groupId, invite.id)}
            className="text-xs font-medium text-red-500 hover:underline"
          >
            Revoca
          </button>
        )}
      </div>
    </div>
  );
}

export default function InvitePanel({ groupId, invites }: { groupId: string; invites: CommunityGroupInvite[] }) {
  return (
    <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm shadow-[#e6d7bb]/30">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Inviti</h2>

      <form action={createInvite.bind(null, groupId)} className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Numero massimo di utilizzi</label>
          <input
            type="number"
            name="max_uses"
            min={1}
            placeholder="illimitato"
            className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Scade dopo (giorni)</label>
          <input
            type="number"
            name="expires_in_days"
            min={1}
            placeholder="mai"
            className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[#2b333e] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#1e242d]"
        >
          Genera link
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {invites.length === 0 && <p className="text-sm text-slate-400">Nessun invito creato ancora.</p>}
        {invites.map((invite) => (
          <InviteRow key={invite.id} groupId={groupId} invite={invite} />
        ))}
      </div>
    </div>
  );
}
