// Idee per la lista della valigia, senza AI: una base per tutti i viaggi e gruppi da aggiungere
// in base a come sarà il viaggio. Le quantità dei vestiti seguono la durata.

export type PackItem = { text: string; category: string };

export const TRIP_KINDS: { id: string; label: string }[] = [
  { id: "caldo", label: "Caldo" },
  { id: "freddo", label: "Freddo" },
  { id: "pioggia", label: "Pioggia" },
  { id: "mare", label: "Mare" },
  { id: "trekking", label: "Trekking" },
  { id: "citta", label: "Città" },
  { id: "neve", label: "Neve" },
  { id: "auto", label: "Auto a noleggio" },
  { id: "bambini", label: "Con bambini" },
];

export const PACK_CATEGORIES = ["Documenti e soldi", "Salute e igiene", "Elettronica", "Vestiti", "Scarpe", "Attività", "Altro"];

// Per quanti giorni di vestiti: oltre una settimana si lava
const clothesDays = (days: number) => Math.max(2, Math.min(days, 7));

export function baseList(days: number): PackItem[] {
  const n = clothesDays(days);
  return [
    { text: "Passaporto o carta d'identità", category: "Documenti e soldi" },
    { text: "Assicurazione di viaggio", category: "Documenti e soldi" },
    { text: "Biglietti e prenotazioni (anche offline)", category: "Documenti e soldi" },
    { text: "Carte di pagamento e un po' di contanti", category: "Documenti e soldi" },
    { text: "Medicine personali", category: "Salute e igiene" },
    { text: "Kit primo soccorso (cerotti, antidolorifici)", category: "Salute e igiene" },
    { text: "Beauty case", category: "Salute e igiene" },
    { text: "Caricabatterie e power bank", category: "Elettronica" },
    { text: "Cuffie", category: "Elettronica" },
    { text: `${n} magliette`, category: "Vestiti" },
    { text: `${n} cambi di biancheria e calze`, category: "Vestiti" },
    { text: "Pigiama", category: "Vestiti" },
    { text: "Felpa o maglione leggero", category: "Vestiti" },
    { text: "Scarpe comode", category: "Scarpe" },
  ];
}

export function kindList(kind: string, days: number): PackItem[] {
  const n = clothesDays(days);
  switch (kind) {
    case "caldo":
      return [
        { text: "Crema solare", category: "Salute e igiene" },
        { text: "Cappello e occhiali da sole", category: "Vestiti" },
        { text: `${Math.max(2, Math.round(n / 2))} pantaloncini o gonne leggere`, category: "Vestiti" },
        { text: "Borraccia", category: "Altro" },
      ];
    case "freddo":
      return [
        { text: "Giacca pesante", category: "Vestiti" },
        { text: "Strati termici", category: "Vestiti" },
        { text: "Cappello, sciarpa e guanti", category: "Vestiti" },
        { text: "Calze calde", category: "Vestiti" },
      ];
    case "pioggia":
      return [
        { text: "Giacca impermeabile", category: "Vestiti" },
        { text: "Ombrello piccolo", category: "Altro" },
        { text: "Sacchetti impermeabili per i dispositivi", category: "Elettronica" },
      ];
    case "mare":
      return [
        { text: "Costume (almeno 2)", category: "Vestiti" },
        { text: "Telo mare", category: "Altro" },
        { text: "Ciabatte", category: "Scarpe" },
        { text: "Crema solare", category: "Salute e igiene" },
        { text: "Maschera e boccaglio", category: "Attività" },
      ];
    case "trekking":
      return [
        { text: "Scarponi già usati", category: "Scarpe" },
        { text: "Zaino da giornata", category: "Attività" },
        { text: "Borraccia", category: "Attività" },
        { text: "Giacca antivento", category: "Vestiti" },
        { text: "Torcia frontale", category: "Attività" },
        { text: "Bastoncini", category: "Attività" },
      ];
    case "citta":
      return [
        { text: "Zainetto o borsa a tracolla antiborseggio", category: "Altro" },
        { text: "Scarpe comode per camminare", category: "Scarpe" },
        { text: "Un abito un po' più elegante", category: "Vestiti" },
      ];
    case "neve":
      return [
        { text: "Giacca da sci", category: "Vestiti" },
        { text: "Pantaloni da neve", category: "Vestiti" },
        { text: "Guanti impermeabili", category: "Vestiti" },
        { text: "Occhiali o maschera da sci", category: "Attività" },
        { text: "Stivali da neve", category: "Scarpe" },
      ];
    case "auto":
      return [
        { text: "Patente (e permesso internazionale se serve)", category: "Documenti e soldi" },
        { text: "Carta di credito per la cauzione", category: "Documenti e soldi" },
        { text: "Supporto per il telefono e cavo auto", category: "Elettronica" },
        { text: "Mappe offline scaricate", category: "Elettronica" },
      ];
    case "bambini":
      return [
        { text: "Documenti dei bambini", category: "Documenti e soldi" },
        { text: "Medicine e termometro per bambini", category: "Salute e igiene" },
        { text: "Giochi e libri per il viaggio", category: "Attività" },
        { text: "Snack per il viaggio", category: "Altro" },
        { text: "Cambi extra per ogni giorno", category: "Vestiti" },
      ];
    default:
      return [];
  }
}
