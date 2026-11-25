// File XML della fattura elettronica (formato FatturaPA 1.2, tra privati: FPR12), pronto da caricare
// sul portale «Fatture e Corrispettivi» dell'Agenzia delle Entrate o nel programma del fornitore.
// Grand Route non lo invia allo SDI: lo prepara soltanto. Nessun import con alias: si prova anche da solo.

import { NATURE, computeTotals, type InvoiceDoc, type Party } from "./engine";

const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];

// Solo caratteri ammessi (latino di base e latin-1), senza a capo, tagliati alla lunghezza massima
export function clean(text: string | null | undefined, max: number): string {
  const s = String(text ?? "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/€/g, "EUR")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^ -~ -ÿ]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return s.slice(0, max);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const tag = (name: string, value: string | null | undefined) => (value == null || value === "" ? "" : `<${name}>${esc(value)}</${name}>`);
const amount = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const qty = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

// Partita IVA divisa in paese + codice
function fiscalId(p: Party): { country: string; code: string } | null {
  const raw = (p.vat ?? "").replace(/[\s.-]/g, "").toUpperCase();
  if (!raw) return null;
  if (p.country === "IT") return { country: "IT", code: raw.replace(/^IT/, "") };
  if (EU.includes(p.country) && raw.startsWith(p.country)) return { country: p.country === "GR" ? "EL" : p.country, code: raw.slice(2) };
  if (raw.startsWith("EL")) return { country: "EL", code: raw.slice(2) };
  return { country: p.country, code: raw.slice(0, 28) };
}

function anagrafica(p: Party): string {
  if (p.person && p.first_name && p.last_name)
    return `<Anagrafica>${tag("Nome", clean(p.first_name, 60))}${tag("Cognome", clean(p.last_name, 60))}</Anagrafica>`;
  return `<Anagrafica>${tag("Denominazione", clean(p.name, 80))}</Anagrafica>`;
}

function sede(p: Party): string {
  const it = p.country === "IT";
  const cap = it ? (p.postal_code ?? "").replace(/\D/g, "").slice(0, 5) : "00000";
  return (
    "<Sede>" +
    tag("Indirizzo", clean(p.address, 60)) +
    tag("CAP", cap.padStart(5, "0")) +
    tag("Comune", clean(p.city, 60)) +
    (it && p.province ? tag("Provincia", clean(p.province, 2).toUpperCase()) : "") +
    tag("Nazione", p.country) +
    "</Sede>"
  );
}

// Nome del file: IT + codice del trasmittente + "_" + progressivo (5 caratteri)
export function xmlFileName(doc: InvoiceDoc, progressivo: string): string {
  const id = (doc.seller.tax_code || doc.seller.vat || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return `IT${id}_${progressivo.replace(/[^A-Z0-9]/gi, "").slice(-5).padStart(5, "0")}.xml`;
}

export function buildFatturaXml(
  doc: InvoiceDoc,
  meta: {
    number: string;
    issueDate: string;
    dueDate: string | null;
    currency: string;
    progressivo: string;
    docType?: "TD01" | "TD04"; // fattura o nota di credito
    linked?: { number: string; date: string | null } | null; // fattura stornata dalla nota di credito
  },
): string {
  const t = computeTotals(doc);
  const seller = doc.seller;
  const buyer = doc.buyer;
  const sellerId = fiscalId(seller);
  const buyerId = fiscalId(buyer);
  const trasmittente = (seller.tax_code || seller.vat || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();

  // Destinatario: codice SDI, oppure 0000000 (+ PEC se c'è), oppure XXXXXXX per l'estero
  let codiceDestinatario = "0000000";
  let pec = "";
  if (buyer.country !== "IT") codiceDestinatario = "XXXXXXX";
  else if (buyer.sdi_code && /^[A-Z0-9]{7}$/i.test(buyer.sdi_code)) codiceDestinatario = buyer.sdi_code.toUpperCase();
  else if (buyer.pec) pec = buyer.pec.trim();

  const datiTrasmissione =
    "<DatiTrasmissione>" +
    `<IdTrasmittente><IdPaese>IT</IdPaese>${tag("IdCodice", trasmittente)}</IdTrasmittente>` +
    tag("ProgressivoInvio", meta.progressivo.replace(/[^A-Z0-9]/gi, "").slice(0, 10)) +
    "<FormatoTrasmissione>FPR12</FormatoTrasmissione>" +
    tag("CodiceDestinatario", codiceDestinatario) +
    (pec ? tag("PECDestinatario", clean(pec, 256)) : "") +
    "</DatiTrasmissione>";

  const cedente =
    "<CedentePrestatore><DatiAnagrafici>" +
    (sellerId ? `<IdFiscaleIVA>${tag("IdPaese", sellerId.country)}${tag("IdCodice", sellerId.code)}</IdFiscaleIVA>` : "") +
    (seller.tax_code ? tag("CodiceFiscale", seller.tax_code.toUpperCase()) : "") +
    anagrafica(seller) +
    tag("RegimeFiscale", doc.regime) +
    "</DatiAnagrafici>" +
    sede(seller) +
    "</CedentePrestatore>";

  const cessionario =
    "<CessionarioCommittente><DatiAnagrafici>" +
    (buyerId ? `<IdFiscaleIVA>${tag("IdPaese", buyerId.country)}${tag("IdCodice", buyerId.code)}</IdFiscaleIVA>` : "") +
    (buyer.country === "IT" && buyer.tax_code ? tag("CodiceFiscale", buyer.tax_code.toUpperCase()) : "") +
    anagrafica(buyer) +
    "</DatiAnagrafici>" +
    sede(buyer) +
    "</CessionarioCommittente>";

  const ritenuta =
    doc.ritenuta.enabled && t.ritenuta > 0
      ? "<DatiRitenuta>" +
        tag("TipoRitenuta", doc.ritenuta.type) +
        tag("ImportoRitenuta", amount(t.ritenuta)) +
        tag("AliquotaRitenuta", amount(doc.ritenuta.rate)) +
        tag("CausalePagamento", doc.ritenuta.causale || "A") +
        "</DatiRitenuta>"
      : "";
  const bollo = doc.bollo ? "<DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>2.00</ImportoBollo></DatiBollo>" : "";

  // Causale: le note, divise in pezzi da 200 caratteri
  const causaleText = clean(doc.notes, 1200);
  const causali: string[] = [];
  for (let i = 0; i < causaleText.length; i += 200) causali.push(tag("Causale", causaleText.slice(i, i + 200)));

  const datiGenerali =
    "<DatiGenerali><DatiGeneraliDocumento>" +
    tag("TipoDocumento", meta.docType ?? "TD01") +
    tag("Divisa", meta.currency) +
    tag("Data", meta.issueDate) +
    tag("Numero", clean(meta.number, 20)) +
    ritenuta +
    bollo +
    tag("ImportoTotaleDocumento", amount(t.totale)) +
    causali.join("") +
    "</DatiGeneraliDocumento>" +
    (meta.linked
      ? "<DatiFattureCollegate>" + tag("IdDocumento", clean(meta.linked.number, 20)) + (meta.linked.date ? tag("Data", meta.linked.date) : "") + "</DatiFattureCollegate>"
      : "") +
    "</DatiGenerali>";

  const linee = doc.lines
    .map((l, i) => {
      const natura = l.vat_rate === 0 ? l.natura : null;
      return (
        "<DettaglioLinee>" +
        tag("NumeroLinea", String(i + 1)) +
        tag("Descrizione", clean(l.description, 1000) || "Servizio") +
        tag("Quantita", qty(l.quantity)) +
        (l.unit ? tag("UnitaMisura", clean(l.unit, 10)) : "") +
        tag("PrezzoUnitario", amount(l.unit_price)) +
        tag("PrezzoTotale", amount(t.lineTotals[l.id] ?? 0)) +
        tag("AliquotaIVA", amount(l.vat_rate)) +
        (doc.ritenuta.enabled && l.ritenuta && l.kind === "servizio" ? "<Ritenuta>SI</Ritenuta>" : "") +
        (natura ? tag("Natura", natura) : "") +
        "</DettaglioLinee>"
      );
    })
    .join("");

  const riepilogo = t.riepilogo
    .map(
      (r) =>
        "<DatiRiepilogo>" +
        tag("AliquotaIVA", amount(r.vat_rate)) +
        (r.natura ? tag("Natura", r.natura) : "") +
        tag("ImponibileImporto", amount(r.imponibile)) +
        tag("Imposta", amount(r.imposta)) +
        (r.vat_rate > 0 ? "<EsigibilitaIVA>I</EsigibilitaIVA>" : "") +
        (r.natura ? tag("RiferimentoNormativo", clean(NATURE[r.natura].norma, 100)) : "") +
        "</DatiRiepilogo>",
    )
    .join("");

  const iban = (doc.payment.iban ?? "").replace(/\s+/g, "").toUpperCase();
  const pagamento =
    "<DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento>" +
    tag("ModalitaPagamento", doc.payment.method || "MP05") +
    (meta.dueDate ? tag("DataScadenzaPagamento", meta.dueDate) : "") +
    tag("ImportoPagamento", amount(t.netto)) +
    (doc.payment.bank ? tag("IstitutoFinanziario", clean(doc.payment.bank, 80)) : "") +
    (iban ? tag("IBAN", iban) : "") +
    "</DettaglioPagamento></DatiPagamento>";

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">' +
    "<FatturaElettronicaHeader>" +
    datiTrasmissione +
    cedente +
    cessionario +
    "</FatturaElettronicaHeader>" +
    "<FatturaElettronicaBody>" +
    datiGenerali +
    "<DatiBeniServizi>" +
    linee +
    riepilogo +
    "</DatiBeniServizi>" +
    (meta.docType === "TD04" ? "" : pagamento) +
    "</FatturaElettronicaBody>" +
    "</p:FatturaElettronica>\n"
  );
}
