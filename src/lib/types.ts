export type AccountType = "individual" | "agency";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  account_type: AccountType;
  agency_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  terms_and_conditions: string | null;
  created_at: string;
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

export type Trip = {
  id: string;
  owner_id: string;
  client_id: string | null;
  group_id: string | null;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  title_color: string | null;
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
  itinerary_stage: ItineraryStage;
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
  created_at: string;
};

export type ServiceStatus = "da_prenotare" | "richiesto" | "confermato" | "cancellato";

export type TripService = {
  id: string;
  trip_id: string;
  activity_id: string | null;
  supplier_id: string | null;
  title: string;
  status: ServiceStatus;
  net_cost: number | null;
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
