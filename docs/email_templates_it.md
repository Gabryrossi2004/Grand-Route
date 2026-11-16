# Testi delle email di Supabase (italiano)

Dove incollarli: Supabase → Authentication → Emails → Templates.
Per ogni modello: copia l'oggetto nel campo "Subject" e il codice nel campo "Message body", poi Save.
Le parti tra doppie graffe (`{{ .ConfirmationURL }}`) NON vanno modificate: Supabase le sostituisce da solo.

---

## 1. Confirm signup (conferma registrazione)

Oggetto:

```
Conferma la tua registrazione a Grand Route
```

Corpo:

```html
<div style="background:#faf3e6;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6d7bb;border-radius:12px;padding:32px;">
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#cda876;">Grand Route</p>
    <h1 style="margin:0 0 20px;font-size:24px;color:#233c5e;">Benvenuto a bordo</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#233c5e;">Grazie per esserti registrato a Grand Route. Per completare la registrazione conferma il tuo indirizzo email cliccando sul pulsante qui sotto.</p>
    <p style="margin:28px 0;text-align:center;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#233c5e;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-family:Arial,sans-serif;font-size:15px;">Conferma la mia email</a>
    </p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#5b6b82;">Se il pulsante non funziona, copia e incolla questo indirizzo nel browser:</p>
    <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#5b6b82;word-break:break-all;">{{ .ConfirmationURL }}</p>
    <hr style="border:none;border-top:1px solid #e6d7bb;margin:24px 0;">
    <p style="margin:0;font-size:13px;line-height:1.5;color:#5b6b82;">Non hai richiesto tu questa registrazione? Puoi ignorare questa email: senza conferma l'account non verrà attivato.</p>
  </div>
</div>
```

---

## 2. Reset password (recupero password)

Oggetto:

```
Reimposta la password di Grand Route
```

Corpo:

```html
<div style="background:#faf3e6;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6d7bb;border-radius:12px;padding:32px;">
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#cda876;">Grand Route</p>
    <h1 style="margin:0 0 20px;font-size:24px;color:#233c5e;">Reimposta la tua password</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#233c5e;">Abbiamo ricevuto una richiesta per cambiare la password del tuo account. Clicca sul pulsante per sceglierne una nuova.</p>
    <p style="margin:28px 0;text-align:center;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#233c5e;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-family:Arial,sans-serif;font-size:15px;">Scegli una nuova password</a>
    </p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#5b6b82;">Se il pulsante non funziona, copia e incolla questo indirizzo nel browser:</p>
    <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#5b6b82;word-break:break-all;">{{ .ConfirmationURL }}</p>
    <hr style="border:none;border-top:1px solid #e6d7bb;margin:24px 0;">
    <p style="margin:0;font-size:13px;line-height:1.5;color:#5b6b82;">Non hai richiesto tu il cambio password? Ignora questa email: la tua password attuale resta valida.</p>
  </div>
</div>
```

---

## 3. Change email address (cambio indirizzo email)

Oggetto:

```
Conferma il nuovo indirizzo email di Grand Route
```

Corpo:

```html
<div style="background:#faf3e6;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6d7bb;border-radius:12px;padding:32px;">
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#cda876;">Grand Route</p>
    <h1 style="margin:0 0 20px;font-size:24px;color:#233c5e;">Conferma il cambio email</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#233c5e;">Hai chiesto di cambiare l'indirizzo email del tuo account da <strong>{{ .Email }}</strong> a <strong>{{ .NewEmail }}</strong>. Conferma la modifica con il pulsante qui sotto.</p>
    <p style="margin:28px 0;text-align:center;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#233c5e;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-family:Arial,sans-serif;font-size:15px;">Conferma il nuovo indirizzo</a>
    </p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#5b6b82;">Se il pulsante non funziona, copia e incolla questo indirizzo nel browser:</p>
    <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#5b6b82;word-break:break-all;">{{ .ConfirmationURL }}</p>
    <hr style="border:none;border-top:1px solid #e6d7bb;margin:24px 0;">
    <p style="margin:0;font-size:13px;line-height:1.5;color:#5b6b82;">Non hai richiesto tu questa modifica? Ignora questa email e, per sicurezza, cambia la tua password.</p>
  </div>
</div>
```

---

## 4. Invite user (invito)

Oggetto:

```
Sei stato invitato su Grand Route
```

Corpo:

```html
<div style="background:#faf3e6;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6d7bb;border-radius:12px;padding:32px;">
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#cda876;">Grand Route</p>
    <h1 style="margin:0 0 20px;font-size:24px;color:#233c5e;">Hai ricevuto un invito</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#233c5e;">Sei stato invitato a usare Grand Route. Clicca sul pulsante per accettare l'invito e creare il tuo accesso.</p>
    <p style="margin:28px 0;text-align:center;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#233c5e;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-family:Arial,sans-serif;font-size:15px;">Accetta l'invito</a>
    </p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#5b6b82;">Se il pulsante non funziona, copia e incolla questo indirizzo nel browser:</p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#5b6b82;word-break:break-all;">{{ .ConfirmationURL }}</p>
  </div>
</div>
```

---

## 5. Magic link e 6. Reauthentication

Il sito non usa l'accesso con link magico né la riautenticazione: lasciali com'erano.
