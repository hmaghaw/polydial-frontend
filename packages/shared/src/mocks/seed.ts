import type * as T from "../api/types";

const now = Date.now();
const iso = (offsetMin: number) => new Date(now + offsetMin * 60000).toISOString();
const dayAt = (dayOffset: number, h: number, m = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.toISOString(); };

export function seed() {
  const business: T.Business = {
    business_id: 1, name: "Maple & Main Bistro", business_type: "restaurant", timezone: "America/Toronto", status: "active",
    balance_cents: 1840, is_auto_recharge: true, recharge_threshold: 500, recharge_amount: 2000,
    address: "214 Queen St W, Toronto, ON", branch_phone_number: "+14165550142",
  };
  const users: T.User[] = [
    { id: "u_1", email: "admin@polydial.com", first_name: "Hany", last_name: "Elgamal", role: "admin", business_id: 1, active: true, phone: "+14165550101", email_verified: true, last_login: iso(-30), department: "Management", calls_handled: 42, satisfaction: 4.8 },
    { id: "u_2", email: "maya@polydial.com", first_name: "Maya", last_name: "Okafor", role: "manager", business_id: 1, active: true, phone: "+14165550102", email_verified: true, last_login: iso(-300), department: "Customer Support", calls_handled: 128, satisfaction: 4.7 },
    { id: "u_3", email: "luis@polydial.com", first_name: "Luis", last_name: "Ortega", role: "staff", business_id: 1, active: true, phone: null, email_verified: true, last_login: iso(-2000), department: "Sales", calls_handled: 96, satisfaction: 4.5 },
    { id: "u_4", email: "amira@polydial.com", first_name: "Amira", last_name: "Haddad", role: "staff", business_id: 1, active: false, phone: null, email_verified: false, last_login: null, department: "Technical", calls_handled: 12, satisfaction: 4.2 },
  ];
  const languages: T.Language[] = [
    ["en", "English"], ["fr", "French"], ["ar", "Arabic"], ["es", "Spanish"], ["zh", "Mandarin Chinese"], ["pt", "Portuguese"],
    ["de", "German"], ["hi", "Hindi"], ["ur", "Urdu"], ["tl", "Tagalog"], ["it", "Italian"], ["ko", "Korean"],
  ].map(([c, n]) => ({ language_code: c, language_name: n, supported: true }));
  const voices: T.LanguageVoice[] = languages.flatMap((l, i) => [
    { language_voice_id: i * 2 + 1, language_code: l.language_code, region_code: l.language_code.toUpperCase(), voice_provider: "ElevenLabs", voice_name: "Aria" },
    { language_voice_id: i * 2 + 2, language_code: l.language_code, region_code: l.language_code.toUpperCase(), voice_provider: "ElevenLabs", voice_name: "Daniel" },
  ]);
  const business_languages: T.BusinessLanguage[] = [
    { language_code: "en", is_default: true, language_voice_id: 1 },
    { language_code: "fr", is_default: false, language_voice_id: 3 },
    { language_code: "ar", is_default: false, language_voice_id: 6 },
  ];
  const phones: T.BusinessPhone[] = [
    { business_phone_id: 1, business_phone: "+14165550199", friendly_name: "Main line", channel: "twilio", status: "active", language_code: "en", is_primary: true, forwarding_to: "+14165550142" },
    { business_phone_id: 2, business_phone: "+14165550177", friendly_name: "French line", channel: "twilio", status: "active", language_code: "fr", is_primary: false, forwarding_to: null },
  ];
  const premium: T.PremiumNumber[] = ["+14165551000", "+14165552222", "+16475557777", "+14378889999", "+19055551234"].map((p, i) => ({ _id: i + 1, phone_number: p, price: [49, 79, 99, 59, 39][i], taken: i === 2 }));
  const hours: T.BusinessHours[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, is_closed: d === 0, open_time: d === 0 ? null : "11:00", close_time: d === 0 ? null : d >= 5 ? "23:00" : "22:00" }));
  const services: T.Service[] = [
    { service_id: 1, name: "Private dining booking", description: "Reserve the back room for up to 18 guests.", duration_minutes: 120, price: 150, is_active: true, buffer_before_minutes: 15, buffer_after_minutes: 30, translations: { fr: { name: "Réservation salle privée", description: "Réservez la salle arrière pour 18 personnes." } } },
    { service_id: 2, name: "Table reservation", description: "Standard table for 2–6 guests.", duration_minutes: 90, price: 0, is_active: true, buffer_before_minutes: 0, buffer_after_minutes: 10, translations: {} },
    { service_id: 3, name: "Catering consultation", description: "Plan a catered event with our chef.", duration_minutes: 45, price: 0, is_active: false, buffer_before_minutes: 0, buffer_after_minutes: 0, translations: {} },
  ];
  const names = [["Sara", "Benali", "fr"], ["Omar", "Farouk", "ar"], ["Jenna", "Liu", "en"], ["Diego", "Ramos", "es"], ["Priya", "Natarajan", "en"], ["Marc", "Tremblay", "fr"], ["Noor", "Aziz", "ar"], ["Tom", "Becker", "en"]];
  const customers: T.Customer[] = names.map(([f, l, lang], i) => ({
    customer_id: i + 1, customer_phone: `+1416555${(2100 + i * 37).toString().padStart(4, "0")}`, first_name: f, last_name: l,
    email: i % 3 === 0 ? `${f.toLowerCase()}@example.com` : null, language: lang, notes: i === 1 ? "Prefers window seat. Nut allergy." : null, is_active: true, created_at: iso(-60 * 24 * (30 - i * 3)),
  }));
  const appointments: T.Appointment[] = [
    { appointment_id: 1, customer_id: 1, service_id: 2, start_time: dayAt(0, 18, 30), end_time: dayAt(0, 20), booking_type: "appointment", status: "scheduled", notes: "Anniversary — 2 guests" },
    { appointment_id: 2, customer_id: 3, service_id: 1, start_time: dayAt(0, 19), end_time: dayAt(0, 21), booking_type: "appointment", status: "confirmed", notes: "Team dinner, 14 guests" },
    { appointment_id: 3, customer_id: 5, service_id: 2, start_time: dayAt(1, 12), end_time: dayAt(1, 13, 30), booking_type: "appointment", status: "scheduled", notes: null },
    { appointment_id: 4, customer_id: null, service_id: null, start_time: dayAt(2, 15), end_time: dayAt(2, 16), booking_type: "block", status: "scheduled", notes: "Staff training" },
    { appointment_id: 5, customer_id: 7, service_id: 3, start_time: dayAt(-1, 14), end_time: dayAt(-1, 14, 45), booking_type: "appointment", status: "completed", notes: null },
  ];
  const sentiments: T.CallMeta["sentiment"][] = ["positive", "positive", "neutral", "negative", "positive", "neutral", "positive", "negative", "positive", "neutral", "positive", "positive"];
  const calls: T.CallMeta[] = sentiments.map((s, i) => {
    const c = customers[i % customers.length];
    const start = iso(-i * 190 - 12);
    const dur = 45 + ((i * 53) % 300);
    return {
      call_sid: `CA${(1000 + i).toString(16)}e9f${i}`, customer_id: c.customer_id, customer_name: `${c.first_name} ${c.last_name}`, customer_phone: c.customer_phone,
      call_start: start, call_end: new Date(new Date(start).getTime() + dur * 1000).toISOString(), call_duration: dur, call_status: "completed",
      communication_channel: i % 5 === 3 ? "whatsapp" : "phone", direction: i % 6 === 5 ? "outbound" : "inbound", sentiment: s, language: c.language,
      summary: ["Placed pickup order for 2 margherita pizzas.", "Asked about gluten-free options.", "Booked table for Friday 7pm.", "Complained about late delivery; refund requested.", "Confirmed private dining for 14."][i % 5],
    };
  });
  const conversations: T.ConversationTurn[] = calls.flatMap((c, ci) => [
    ["assistant", "Thank you for calling Maple & Main Bistro. How can I help you today?"],
    ["user", c.summary?.includes("pizza") ? "Hi, I'd like to order two margherita pizzas for pickup." : c.summary?.includes("gluten") ? "Do you have gluten-free options?" : c.summary?.includes("late") ? "My delivery is 40 minutes late." : "I'd like to book a table please."],
    ["assistant", c.summary?.includes("late") ? "I'm sorry about that. I've flagged your order and a manager will call you back about a refund." : "Of course — I can help with that. May I have your name?"],
    ["user", `It's ${c.customer_name}.`],
    ["assistant", "Perfect, you're all set. Is there anything else?"],
  ].map(([role, content], i) => ({ call_conversation_id: ci * 10 + i + 1, call_sid: c.call_sid, role: role as T.ConversationTurn["role"], content, created_at: new Date(new Date(c.call_start).getTime() + i * 15000).toISOString() })));
  const ledger: T.LedgerEntry[] = [
    { ledger_id: 1, amount_cents: 2000, reason: "Top-up", comments: "Stripe checkout", created_at: iso(-60 * 24 * 12) },
    { ledger_id: 2, amount_cents: -100, reason: "Monthly number fee", comments: "+14165550199", created_at: iso(-60 * 24 * 10) },
    { ledger_id: 3, amount_cents: -35, reason: "AI call", comments: "4m 12s", created_at: iso(-60 * 24 * 2) },
    { ledger_id: 4, amount_cents: -25, reason: "AI call", comments: "2m 40s", created_at: iso(-60 * 6) },
  ];
  const translations: T.Translation[] = [
    { translation_id: 1, phrase: "Your order is confirmed", language_code: "fr", translated_phrase: "Votre commande est confirmée", updated_at: iso(-60 * 24 * 3) },
    { translation_id: 2, phrase: "Your order is confirmed", language_code: "ar", translated_phrase: "تم تأكيد طلبك", updated_at: iso(-60 * 24 * 3) },
    { translation_id: 3, phrase: "We are closed today", language_code: "es", translated_phrase: "Hoy estamos cerrados", updated_at: iso(-60 * 24 * 8) },
  ];

  // ---- restaurant ----
  const categories: T.ItemCategory[] = [
    { item_category_id: 1, name: "Pizzas", description: "Wood-fired, 12 inch" }, { item_category_id: 2, name: "Pasta", description: null },
    { item_category_id: 3, name: "Sides", description: null }, { item_category_id: 4, name: "Drinks", description: "Cold and hot drinks" },
  ];
  const option_groups: T.OptionGroup[] = [
    { option_group_id: 1, name: "Size", is_required: true, min_select: 1, max_select: 1, display_order: 1 },
    { option_group_id: 2, name: "Crust", is_required: false, min_select: 0, max_select: 1, display_order: 2 },
  ];
  const options: T.Option[] = [
    { option_id: 1, option_group_id: 1, name: "Small (10\")", price_delta: -3, is_default: false, display_order: 1 },
    { option_id: 2, option_group_id: 1, name: "Regular (12\")", price_delta: 0, is_default: true, display_order: 2 },
    { option_id: 3, option_group_id: 1, name: "Large (16\")", price_delta: 5, is_default: false, display_order: 3 },
    { option_id: 4, option_group_id: 2, name: "Gluten-free", price_delta: 3, is_default: false, display_order: 1 },
  ];
  const modifier_groups: T.ModifierGroup[] = [
    { modifier_group_id: 1, name: "Extra toppings", is_required: false, min_select: 0, max_select: 5 },
    { modifier_group_id: 2, name: "Dips", is_required: false, min_select: 0, max_select: 3 },
  ];
  const modifiers: T.Modifier[] = [
    { modifier_id: 1, modifier_group_id: 1, name: "Extra cheese", price_delta: 1.5, is_active: true, display_order: 1 },
    { modifier_id: 2, modifier_group_id: 1, name: "Hot honey", price_delta: 1, is_active: true, display_order: 2 },
    { modifier_id: 3, modifier_group_id: 1, name: "Halal pepperoni", price_delta: 2, is_active: true, display_order: 3 },
    { modifier_id: 4, modifier_group_id: 2, name: "Garlic dip", price_delta: 0.75, is_active: true, display_order: 1 },
  ];
  const tags: T.Tag[] = [{ tag_id: 1, name: "Vegetarian" }, { tag_id: 2, name: "Spicy" }, { tag_id: 3, name: "Popular" }, { tag_id: 4, name: "Halal" }];
  const mk = (id: number, name: string, price: number, cat: number, extra: Partial<T.RestaurantItem> = {}): T.RestaurantItem => ({
    item_id: id, name, description: null, base_price: price, calories: null, preparation_time: 12, is_combo: false, is_active: true, image_url: null,
    category_ids: [cat], option_group_ids: cat === 1 ? [1, 2] : [], modifier_group_ids: cat === 1 ? [1, 2] : [], tag_ids: [], ...extra,
  });
  const items: T.RestaurantItem[] = [
    mk(1, "Margherita", 14, 1, { description: "San Marzano tomato, fior di latte, basil", calories: 820, tag_ids: [1, 3] }),
    mk(2, "Spicy Soppressata", 18, 1, { description: "Soppressata, chili, hot honey", calories: 960, tag_ids: [2] }),
    mk(3, "Funghi", 17, 1, { description: "Roasted mushrooms, thyme, mozzarella", tag_ids: [1] }),
    mk(4, "Rigatoni Vodka", 19, 2, { description: "Creamy tomato vodka sauce, parmesan", calories: 780 }),
    mk(5, "Garlic Knots", 7, 3, { description: "Six knots, parsley butter", preparation_time: 8, tag_ids: [1, 3] }),
    mk(6, "Caesar Salad", 11, 3, { description: "Romaine, croutons, anchovy dressing" }),
    mk(7, "San Pellegrino", 3.5, 4, { preparation_time: 1 }),
    mk(8, "Lemonade", 4, 4, { preparation_time: 1, is_active: false }),
    mk(9, "Pizza Night for Two", 34, 1, { description: "Any two pizzas plus a side", is_combo: true, option_group_ids: [], modifier_group_ids: [] }),
  ];
  const combo_groups: T.ComboGroup[] = [
    { combo_group_id: 1, item_id: 9, name: "Choose your pizzas", min_select: 2, max_select: 2, display_order: 1 },
    { combo_group_id: 2, item_id: 9, name: "Choose a side", min_select: 1, max_select: 1, display_order: 2 },
  ];
  const combo_group_items: T.ComboGroupItem[] = [
    { combo_group_item_id: 1, combo_group_id: 1, item_id: 1, price_delta: 0 }, { combo_group_item_id: 2, combo_group_id: 1, item_id: 2, price_delta: 2 },
    { combo_group_item_id: 3, combo_group_id: 1, item_id: 3, price_delta: 1 }, { combo_group_item_id: 4, combo_group_id: 2, item_id: 5, price_delta: 0 },
    { combo_group_item_id: 5, combo_group_id: 2, item_id: 6, price_delta: 2 },
  ];
  const availabilities: T.Availability[] = [
    { availability_id: 1, name: "Standard hours", details: hours.map((h) => ({ ...h })) },
    { availability_id: 2, name: "Lunch only", details: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, is_closed: d === 0 || d === 6, open_time: "11:00", close_time: "15:00" })) },
  ];
  const menus: T.Menu[] = [
    { menu_id: 1, name: "All-day menu", description: "Our main menu", is_active: true, availability_ids: [1] },
    { menu_id: 2, name: "Lunch specials", description: "Weekday lunch", is_active: false, availability_ids: [2] },
  ];
  const sections: T.MenuSection[] = [
    { menu_section_id: 1, menu_id: 1, name: "Pizzas", description: null, display_order: 1, item_ids: [1, 2, 3, 9] },
    { menu_section_id: 2, menu_id: 1, name: "Pasta & sides", description: null, display_order: 2, item_ids: [4, 5, 6] },
    { menu_section_id: 3, menu_id: 1, name: "Drinks", description: null, display_order: 3, item_ids: [7, 8] },
    { menu_section_id: 4, menu_id: 2, name: "Lunch", description: "Includes a drink", display_order: 1, item_ids: [1, 4] },
  ];
  const statuses: T.OrderStatus[] = ["confirmed", "preparing", "ready", "pending", "delivered", "cancelled", "delivered", "delivered"];
  const orders: T.RestaurantOrder[] = statuses.map((st, i) => {
    const c = customers[i % customers.length];
    const lines: T.OrderLine[] = [
      { order_item_id: i * 10 + 1, item_id: 1 + (i % 3), name: items[i % 3].name, quantity: 1 + (i % 2), total_price: items[i % 3].base_price * (1 + (i % 2)), options: ["Regular (12\")"], modifiers: i % 2 ? ["Extra cheese"] : [] },
      ...(i % 3 === 0 ? [{ order_item_id: i * 10 + 2, item_id: 5, name: "Garlic Knots", quantity: 1, total_price: 7, options: [], modifiers: ["Garlic dip"] }] : []),
    ];
    return {
      order_id: 1040 + i, customer_id: c.customer_id, customer_name: `${c.first_name} ${c.last_name}`, customer_phone: c.customer_phone, order_status: st,
      order_time: iso(-(i * 23 + 4) - (i > 3 ? 60 * 24 : 0)), scheduled_time: i === 3 ? iso(45) : null,
      total_price: lines.reduce((s, l) => s + l.total_price, 0), notes: i === 1 ? "Ring the side door" : null, items: lines,
    };
  });
  const reports: T.Report[] = [
    { id: "r1", name: "Call summary — October", type: "Call summary", created_at: iso(-60 * 24 * 10), size_kb: 184 },
    { id: "r2", name: "Sentiment — week 44", type: "Sentiment", created_at: iso(-60 * 24 * 7), size_kb: 92 },
  ];
  const report_schedules: T.ReportSchedule[] = [{ id: "s1", template: "Call summary", frequency: "weekly", recipients: "admin@polydial.com" }];

  return {
    business, users, languages, voices, business_languages, phones, premium, hours, services, customers, appointments, calls, conversations,
    ledger, translations, categories, option_groups, options, modifier_groups, modifiers, tags, items, combo_groups, combo_group_items,
    availabilities, menus, sections, orders, reports, report_schedules,
  };
}
export type MockDb = ReturnType<typeof seed>;
