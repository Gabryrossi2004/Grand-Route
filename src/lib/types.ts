export type AccountType = "individual" | "agency";

export type UiFontSize = "normale" | "grande" | "molto_grande";
export type UiFontFamily = "predefinito" | "leggibile" | "classico";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  account_type: AccountType;
  agency_name: string | null;
  logo_url: string | null;
  logo_shape?: string | null;
  ai_plan?: string | null;
  brand_color: string | null;
  terms_and_conditions: string | null;
  ui_font_size: UiFontSize;
  ui_font_family: UiFontFamily;
  is_professional: boolean;
  business_kind?: string | null;
  emergency_phone: string | null;
  ai_rules: string | null;
  ai_preferences: Record<string, string> | null;
  notify_trips: boolean;
  notify_community: boolean;
  notify_emergencies: boolean;
  created_at: string;
};

export type CommunityProfileDirectoryEntry = {
  id: string;
  full_name: string | null;
  agency_name: string | null;
  logo_url: string | null;
};

export type Client = {
  id: string;
  owner_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  nationality: string | null;
  fiscal_code: string | null;
  residence_address: string | null;
  id_card_number: string | null;
  id_card_expiry: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  created_at: string;
};

export type TripGroup = {
  id: string;
  owner_id: string;
  client_id: string | null;
  title: string;
  created_at: string;
};

export type PriceMode = "nessuno" | "lordo" | "commissioni";

export type ItineraryStage = "preliminare" | "finale";

export type TripTheme =
  | "elegante"
  | "azteco"
  | "giungla"
  | "deserto"
  | "nordico"
  | "marocco"
  | "giapponese"
  | "tropicale";

export type ApprovalStatus = "none" | "pending" | "approved" | "changes_requested";

export type TripMessage = {
  id: string;
  trip_id: string;
  author_id: string;
  author_role: "agency" | "client";
  kind: "message" | "change_request" | "approved" | "sent_for_approval";
  body: string;
  day_id: string | null;
  activity_id?: string | null;
  read_at: string | null;
  created_at: string;
};

export type Trip = {
  id: string;
  owner_id: string;
  assigned_to?: string | null; // collega della squadra che segue il viaggio (migrazione 0075)
  approval_status?: ApprovalStatus;
  client_zefiro?: "default" | "on" | "off";
  client_id: string | null;
  group_id: string | null;
  // "activities" (default): una scheda per attività; "days": un blocco di testo per giornata
  itinerary_mode?: "activities" | "days";
  // Numero di giorni dell'itinerario (solo nelle liste, calcolato dai giorni veri)
  day_count?: number;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  title_color: string | null;
  ai_notes: string | null;
  public_slug: string;
  is_published: boolean;
  price_mode: PriceMode;
  price_amount: number | null;
  price_net: number | null;
  price_commission: number | null;
  theme: TripTheme;
  rate_includes: string | null;
  rate_excludes: string | null;
  show_rate_block: boolean;
  show_emergency_button: boolean;
  itinerary_stage: ItineraryStage;
  client_request_notes: string | null;
  // codice breve per ritrovare il viaggio (migrazione 0047; null prima dell'aggiornamento)
  code?: string | null;
  created_at: string;
};

export type TripDay = {
  id: string;
  trip_id: string;
  day_date: string | null;
  day_order: number;
  notes: string | null;
  title: string | null;
};

export type ActivityType =
  | "volo"
  | "alloggio"
  | "transfer"
  | "treno"
  | "traghetto"
  | "crociera"
  | "ristorante"
  | "attivita"
  | "info"
  | "altro";

export type ActivityDetails = Record<string, string>;

export type Activity = {
  id: string;
  trip_day_id: string;
  start_time: string | null;
  title: string;
  description: string | null;
  location: string | null;
  activity_type: ActivityType;
  details: ActivityDetails;
  activity_order: number;
};

export type ActivityTemplate = {
  id: string;
  owner_id: string;
  activity_type: ActivityType;
  title: string;
  description: string | null;
  location: string | null;
  details: ActivityDetails;
  cover_photo_url: string | null;
  created_at: string;
};

export type PromptStyle = {
  id: string;
  owner_id: string;
  title: string;
  prompt_text: string;
  created_at: string;
};

export type ActivityPhoto = {
  id: string;
  activity_id: string;
  url: string;
  file_path: string;
  created_at: string;
};

export type TripChecklistItem = {
  id: string;
  trip_id: string;
  label: string;
  done: boolean;
  item_order: number;
  created_at: string;
};

export type TripDocument = {
  id: string;
  trip_id: string;
  activity_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  cover_image_path: string | null;
  visible_to_client?: boolean;
  uploaded_at: string;
};

export type SupplierCategory = "alloggio" | "trasporto" | "attivita" | "ristorazione" | "altro";

export type Supplier = {
  id: string;
  owner_id: string;
  full_name: string;
  category: SupplierCategory;
  email: string | null;
  phone: string | null;
  notes: string | null;
  countries?: string[] | null;
  regions?: string[] | null;
  network_user_id?: string | null; // partner della Rete (dati arrivati con la collaborazione)
  created_at: string;
};

export type ServiceStatus = "da_prenotare" | "richiesto" | "confermato" | "cancellato";

// Una riga del listino prezzi di un fornitore: catalogo riutilizzabile,
// indipendente dai viaggi (diverso da TripService, che è legato a un
// singolo viaggio).
export type SupplierPriceListItem = {
  id: string;
  owner_id: string;
  supplier_id: string;
  category: SupplierCategory;
  title: string;
  description: string | null;
  price: number | null;
  unit: string | null;
  valid_from: string | null;
  valid_to: string | null;
  notes: string | null;
  created_at: string;
};

export type TripService = {
  id: string;
  trip_id: string;
  activity_id: string | null;
  supplier_id: string | null;
  title: string;
  status: ServiceStatus;
  net_cost: number | null;
  sell_price: number | null;
  confirmation_number: string | null;
  notes: string | null;
  service_order: number;
  created_at: string;
};

export type PaymentDirection = "incasso" | "pagamento";

export type TripPayment = {
  id: string;
  trip_id: string;
  service_id: string | null;
  direction: PaymentDirection;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
};

export const COMMUNITY_CATEGORIES = [
  { value: "hotel", label: "Hotel e alloggi" },
  { value: "tour", label: "Tour e tour operator" },
  { value: "trasporti", label: "Voli, navi e trasporti" },
  { value: "esperienze", label: "Esperienze ed escursioni" },
  { value: "destinazioni", label: "Destinazioni" },
  { value: "fornitori", label: "Fornitori e agenzie locali" },
  { value: "altro", label: "Altro" },
] as const;

export type CommunityGroup = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  is_open?: boolean;
  category?: string | null;
};

export type CommunityGroupMemberRole = "owner" | "member";

export type CommunityGroupMember = {
  group_id: string;
  profile_id: string;
  role: CommunityGroupMemberRole;
  joined_at: string;
};

export type CommunityGroupInvite = {
  id: string;
  group_id: string;
  token: string;
  created_by: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
};

export type CommunityPostKind = "domanda" | "recensione" | "chat";

export type CommunityPost = {
  id: string;
  group_id: string | null;
  author_id: string;
  title: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  kind?: CommunityPostKind;
  subject?: string | null;
  rating?: number | null;
  pros?: string | null;
  cons?: string | null;
  country_code?: string | null;
  would_resell?: boolean | null;
};

export type CommunityPostPhoto = {
  id: string;
  post_id: string;
  url: string;
  created_at: string;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type CommunityPostLike = {
  post_id: string;
  profile_id: string;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};
