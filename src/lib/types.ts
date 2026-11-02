export type AccountType = "individual" | "agency";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  account_type: AccountType;
  agency_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  owner_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
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
  public_slug: string;
  is_published: boolean;
  price_mode: PriceMode;
  price_amount: number | null;
  price_net: number | null;
  price_commission: number | null;
  created_at: string;
};

export type TripDay = {
  id: string;
  trip_id: string;
  day_date: string | null;
  day_order: number;
  notes: string | null;
};

export type ActivityType =
  | "volo"
  | "alloggio"
  | "trasporto"
  | "ristorante"
  | "attivita"
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

export type TripDocument = {
  id: string;
  trip_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  uploaded_at: string;
};
