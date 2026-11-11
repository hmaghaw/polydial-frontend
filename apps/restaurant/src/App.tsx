import { Navigate, Route, Routes } from "react-router-dom";
import { ChefHat, ClipboardList, Clock, CreditCard, FolderTree, History, Home, Layers, ListTree, MessagesSquare, Package, Phone, RefreshCw, Settings, SlidersHorizontal, Tag, Users, Utensils, BookOpen } from "lucide-react";
import {
  AppShell, AuthCallbackPage, BillingPage, BusinessHoursPage, BusinessHoursSection, BusinessPhonesPage, BusinessProfileSection, CallConversationsPage, CloverLoginPage, CustomersPage,
  LanguagesSection, LoginPage, NotFoundPage, PageHeader, PhoneNumbersSection, RequireAuth, ResetPasswordPage, VerifyEmailPage, type NavGroup,
} from "@polydial/shared";
import { CategoriesPage, ModifiersPage, OptionsPage, TagsPage } from "./pages/catalog";
import { CombosPage, CreateItemWizardPage, EditItemPage, ItemsPage } from "./pages/items";
import { MenuManagementPage, MenuOverviewPage } from "./pages/menus";
import { OrdersHistoryPage, OrdersPage } from "./pages/orders";
import { CloverSyncPage, KitchenVoiceControlPage, RestaurantHubPage } from "./pages/ops";

const HOME = "/restaurant";
const nav: NavGroup[] = [
  { items: [
    { to: "/restaurant", label: "Home", icon: <Home />, end: true },
    { to: "/app/orders", label: "Live orders", icon: <ClipboardList /> },
    { to: "/app/orders-history", label: "Order history", icon: <History /> },
    { to: "/kitchen-voice-control", label: "Kitchen voice", icon: <ChefHat /> },
  ] },
  { label: "Menu", items: [
    { to: "/restaurant/overview", label: "Overview", icon: <BookOpen /> },
    { to: "/menu-management", label: "Menu management", icon: <Utensils /> },
    { to: "/restaurant/items", label: "Items", icon: <Package /> },
    { to: "/restaurant/combos", label: "Combos", icon: <Layers /> },
    { to: "/restaurant/categories", label: "Categories", icon: <FolderTree /> },
    { to: "/restaurant/options", label: "Options", icon: <ListTree /> },
    { to: "/restaurant/modifiers", label: "Modifiers", icon: <SlidersHorizontal /> },
    { to: "/restaurant/tags", label: "Tags", icon: <Tag /> },
    { to: "/clover-sync", label: "Clover sync", icon: <RefreshCw />, roles: ["admin", "manager"] },
  ] },
  { label: "Calls", items: [
    { to: "/call-conversations", label: "Calls", icon: <MessagesSquare /> },
    { to: "/customers", label: "Customers", icon: <Users /> },
  ] },
  { label: "Business", items: [
    { to: "/business-phones", label: "Phone numbers", icon: <Phone /> },
    { to: "/business-hours", label: "Business hours", icon: <Clock /> },
    { to: "/billing", label: "Billing", icon: <CreditCard />, roles: ["admin"] },
    { to: "/settings", label: "Settings", icon: <Settings /> },
  ] },
];

function RestaurantSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="How your AI assistant introduces the restaurant and when it takes orders." />
      <div className="space-y-5"><BusinessProfileSection /><LanguagesSection /><PhoneNumbersSection compact /><BusinessHoursSection /></div>
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage home={HOME} allowSignup={false} />} />
      <Route path="/login-clover" element={<CloverLoginPage home={HOME} />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/:provider/callback" element={<AuthCallbackPage home={HOME} />} />
      <Route path="/auth/callback/:provider" element={<AuthCallbackPage home={HOME} />} />
      <Route element={<RequireAuth><AppShell nav={nav} portalName="Restaurant portal" /></RequireAuth>}>
        <Route index element={<Navigate to={HOME} replace />} />
        <Route path="/restaurant" element={<RestaurantHubPage />} />
        <Route path="/restaurant/overview" element={<MenuOverviewPage />} />
        <Route path="/menu-management" element={<MenuManagementPage />} />
        <Route path="/restaurant/items" element={<ItemsPage />} />
        <Route path="/restaurant-items" element={<ItemsPage />} />
        <Route path="/create-item-wizard" element={<CreateItemWizardPage />} />
        <Route path="/edit-item/:itemId" element={<EditItemPage />} />
        <Route path="/restaurant/combos" element={<CombosPage />} />
        <Route path="/restaurant/categories" element={<CategoriesPage />} />
        <Route path="/restaurant/options" element={<OptionsPage />} />
        <Route path="/restaurant/modifiers" element={<ModifiersPage />} />
        <Route path="/restaurant/tags" element={<TagsPage />} />
        <Route path="/clover-sync" element={<RequireAuth roles={["admin", "manager"]}><CloverSyncPage /></RequireAuth>} />
        <Route path="/app/orders" element={<OrdersPage />} />
        <Route path="/app/orders-history" element={<OrdersHistoryPage />} />
        <Route path="/kitchen-voice-control" element={<KitchenVoiceControlPage />} />
        <Route path="/call-conversations" element={<CallConversationsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/business-phones" element={<BusinessPhonesPage />} />
        <Route path="/business-hours" element={<BusinessHoursPage />} />
        <Route path="/billing" element={<RequireAuth roles={["admin"]}><BillingPage /></RequireAuth>} />
        <Route path="/settings" element={<RestaurantSettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
