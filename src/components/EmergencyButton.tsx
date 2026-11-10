"use client";

import { useState } from "react";
import { PhoneCall } from "lucide-react";
import { notifyEmergencyPush } from "@/app/client/(portal)/actions";

export default function EmergencyButton({
  tripId,
  tripTitle,
  clientName,
  agencyPhone,
}: {
  tripId: string;
  tripTitle: string;
  clientName: string;
  agencyPhone: string;
}) {
  const [sent, setSent] = useState(false);

  function handleClick() {
    const digits = agencyPhone.replace(/[^\d]/g, "");
    const message = `Emergenza - ${clientName} - viaggio "${tripTitle}": ho bisogno di assistenza, puoi richiamarmi appena possibile?`;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setSent(true);
    notifyEmergencyPush(tripId, tripTitle);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-700"
    >
      <PhoneCall size={18} />
      {sent ? "Messaggio aperto" : "Emergenza"}
    </button>
  );
}
