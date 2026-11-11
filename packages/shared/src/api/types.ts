// Types mirror the polydial_schema.sql columns (snake_case) so API rows map 1:1.
export type ID = number;
export type Role = "admin" | "manager" | "staff";

export interface Business {
  business_id: ID; name: string; business_type: "restaurant" | "general" | "car_rental" | "muslim_will";
  timezone: string; status: string; balance_cents: number; is_auto_recharge: boolean;
  recharge_threshold: number; recharge_amount: number; address: string | null; branch_phone_number: string | null;
}
export interface User {
  id: string; email: string; first_name: string; last_name: string; role: Role; business_id: ID;
  active: boolean; phone: string | null; email_verified: boolean; last_login: string | null;
  department?: string; calls_handled?: number; satisfaction?: number;
}
export interface Session { token: string; user: User; business: Business }

export interface Service {
  service_id: ID; name: string; description: string | null; duration_minutes: number; price: number;
  is_active: boolean; buffer_before_minutes: number; buffer_after_minutes: number;
  translations?: Record<string, { name: string; description: string | null }>;
}
export interface Customer {
  customer_id: ID; customer_phone: string; first_name: string | null; last_name: string | null;
  email: string | null; language: string; notes: string | null; is_active: boolean; created_at: string;
}
export interface Appointment {
  appointment_id: ID; customer_id: ID | null; service_id: ID | null; start_time: string; end_time: string;
  booking_type: "appointment" | "anonymous" | "block" | "break" | "holiday"; status: string; notes: string | null;
}
export interface CallMeta {
  call_sid: string; customer_id: ID | null; customer_name?: string; customer_phone?: string;
  call_start: string; call_end: string | null; call_duration: number; call_status: string;
  communication_channel: "phone" | "whatsapp" | "web"; direction: "inbound" | "outbound";
  sentiment?: "positive" | "neutral" | "negative"; summary?: string; language?: string;
}
export interface ConversationTurn { call_conversation_id: ID; call_sid: string; role: "user" | "assistant" | "system" | "tool"; content: string | null; created_at: string }
export interface LedgerEntry { ledger_id: ID; amount_cents: number; reason: string | null; comments: string | null; created_at: string }
export interface Language { language_code: string; language_name: string; supported: boolean }
export interface LanguageVoice { language_voice_id: ID; language_code: string; region_code: string; voice_provider: string; voice_name: string }
export interface BusinessLanguage { language_code: string; language_name?: string; is_default: boolean; language_voice_id: ID | null }
export interface BusinessPhone {
  business_phone_id: ID; business_phone: string; friendly_name: string | null; channel: "twilio" | "whatsapp";
  status: "active" | "disconnected" | "banned"; language_code: string | null; is_primary: boolean; forwarding_to?: string | null;
}
export interface AvailableNumber { phone_number: string; friendly_name: string; region: string; locality: string; monthly_fee: number }
export interface PremiumNumber { _id: ID; phone_number: string; price: number; taken: boolean }
export interface BusinessHours { day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }
export interface Translation { translation_id: ID; phrase: string; language_code: string; translated_phrase: string; updated_at: string }

// Restaurant
export interface Menu { menu_id: ID; name: string; description: string | null; is_active: boolean; availability_ids: ID[] }
export interface MenuSection { menu_section_id: ID; menu_id: ID; name: string; description: string | null; display_order: number; item_ids: ID[] }
export interface Availability { availability_id: ID; name: string; details: BusinessHours[] }
export interface RestaurantItem {
  item_id: ID; name: string; description: string | null; base_price: number; calories: number | null;
  preparation_time: number | null; is_combo: boolean; is_active: boolean; image_url: string | null;
  category_ids: ID[]; option_group_ids: ID[]; modifier_group_ids: ID[]; tag_ids: ID[];
}
export interface ItemCategory { item_category_id: ID; name: string; description: string | null }
export interface OptionGroup { option_group_id: ID; name: string; is_required: boolean; min_select: number; max_select: number; display_order: number }
export interface Option { option_id: ID; option_group_id: ID; name: string; price_delta: number; is_default: boolean; display_order: number }
export interface ModifierGroup { modifier_group_id: ID; name: string; is_required: boolean; min_select: number; max_select: number }
export interface Modifier { modifier_id: ID; modifier_group_id: ID; name: string; price_delta: number; is_active: boolean; display_order: number }
export interface Tag { tag_id: ID; name: string }
export interface ComboGroup { combo_group_id: ID; item_id: ID; name: string; min_select: number; max_select: number; display_order: number }
export interface ComboGroupItem { combo_group_item_id: ID; combo_group_id: ID; item_id: ID; price_delta: number }
export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
export interface OrderLine { order_item_id: ID; item_id: ID; name: string; quantity: number; total_price: number; options: string[]; modifiers: string[] }
export interface RestaurantOrder {
  order_id: ID; customer_id: ID; customer_name: string; customer_phone: string; order_status: OrderStatus;
  order_time: string; scheduled_time: string | null; total_price: number; notes: string | null; items: OrderLine[];
}
export interface Report { id: string; name: string; type: string; created_at: string; size_kb: number }
export interface ReportSchedule { id: string; template: string; frequency: "daily" | "weekly" | "monthly"; recipients: string }
