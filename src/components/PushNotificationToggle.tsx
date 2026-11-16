"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { removePushSubscription, savePushSubscription } from "@/lib/actions/push";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type Status = "checking" | "unsupported" | "denied" | "off" | "on";

export default function PushNotificationToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkStatus() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const existing = await registration?.pushManager.getSubscription();
      setStatus(existing ? "on" : "off");
    }
    checkStatus();
  }, []);

  async function enable() {
    setPending(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const { error: saveError } = await savePushSubscription(subscription.toJSON() as never);
      if (saveError) {
        setError(saveError);
        return;
      }
      setStatus("on");
    } catch {
      setError("Non è stato possibile attivare le notifiche su questo dispositivo.");
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
    } finally {
      setPending(false);
    }
  }

  if (status === "checking") return null;

  if (status === "unsupported") {
    return <p className="text-xs text-slate-500">Il tuo browser non supporta le notifiche push.</p>;
  }

  if (status === "denied") {
    return (
      <p className="text-xs text-slate-500">
        Hai bloccato le notifiche per questo sito dal browser: per riattivarle devi sbloccarle dalle impostazioni del
        browser stesso.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={status === "on" ? disable : enable}
        disabled={pending}
        className="flex items-center gap-2 rounded-lg border border-[#e6d7bb] bg-white px-3 py-2 text-sm font-medium text-[#233c5e] transition hover:bg-[#faf3e6] disabled:opacity-60"
      >
        {status === "on" ? <BellOff size={16} /> : <BellRing size={16} />}
        {pending ? "Attendi…" : status === "on" ? "Disattiva su questo dispositivo" : "Attiva notifiche su questo dispositivo"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
