import * as webpush from "web-push";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails("mailto:privacy@grandroute.it", vapidPublicKey, vapidPrivateKey);
}

export type PushTarget = { endpoint: string; p256dh: string; auth_key: string };

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

// Invia la stessa notifica a più iscrizioni, senza far fallire le altre se
// una fallisce (es. il browser ha revocato il permesso): in quel caso
// restituiamo l'endpoint così chi chiama può rimuovere la riga scaduta.
export async function sendPushToTargets(
  targets: PushTarget[],
  payload: PushPayload,
): Promise<{ expiredEndpoints: string[] }> {
  if (!vapidPublicKey || !vapidPrivateKey) return { expiredEndpoints: [] };

  const expiredEndpoints: string[] = [];
  const body = JSON.stringify(payload);

  await Promise.all(
    targets.map(async (target) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth_key },
          },
          body,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.push(target.endpoint);
        }
      }
    }),
  );

  return { expiredEndpoints };
}
