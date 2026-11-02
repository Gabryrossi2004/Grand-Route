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

export type Trip = {
  id: string;
  owner_id: string;
  client_id: string | null;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  public_slug: string;
  is_published: boolean;
  created_at: string;
};

export type TripDay = {
  id: string;
  trip_id: string;
  day_date: string | null;
  day_order: number;
  notes: string | null;
};

export type Activity = {
  id: string;
  trip_day_id: string;
  start_time: string | null;
  title: string;
  description: string | null;
  location: string | null;
  activity_order: number;
};

export type TripDocument = {
  id: string;
  trip_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  uploaded_at: string;
};
