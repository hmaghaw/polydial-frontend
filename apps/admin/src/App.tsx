import { Navigate, Route, Routes } from "react-router-dom";
import { BarChart3, CalendarDays, Clock, CreditCard, Database, Gauge, Headphones, Info, Languages, LayoutDashboard, LifeBuoy, MessagesSquare, Phone, Settings, Smile, Star, Users, UsersRound, Wrench } from "lucide-react";
import {
  AppShell, AuthCallbackPage, BillingPage, BusinessHoursPage, BusinessPhonesPage, CallConversationsPage, CustomersPage, LoginPage, NotFoundPage, PremiumNumbersPage,
  RequireAuth, ResetPasswordPage, VerifyEmailPage, type NavGroup,
} from "@polydial/shared";
import { DashboardPage } from "./pages/dashboard";
import { CalendarPage } from "./pages/calendar";
import { ServicesPage } from "./pages/services";
import { CallInsightsPage, ReportsPage, SentimentAnalysisPage, VoiceAnalyticsPage } from "./pages/analytics";
import { AboutPage, ContactPage, DatabaseBrowserPage, SettingsPage, TeamManagementPage, TranslationsPage } from "./pages/workspace";

const nav: NavGroup[] = [
  { items: [
    { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
    { to: "/calendar", label: "Calendar", icon: <CalendarDays /> },
    { to: "/call-conversations", label: "Calls", icon: <MessagesSquare /> },
    { to: "/customers", label: "Customers", icon: <Users /> },
    { to: "/services", label: "Services", icon: <Wrench /> },
  ] },
  { label: "Insights", items: [
    { to: "/voice-analytics", label: "Voice analytics", icon: <Headphones /> },
    { to: "/call-insights", label: "Call insights", icon: <Gauge /> },
    { to: "/sentiment-analysis", label: "Sentiment", icon: <Smile /> },
    { to: "/reports", label: "Reports", icon: <BarChart3 /> },
  ] },
  { label: "Business", items: [
    { to: "/business-phones", label: "Phone numbers", icon: <Phone /> },
    { to: "/premium-numbers", label: "Premium numbers", icon: <Star /> },
    { to: "/business-hours", label: "Business hours", icon: <Clock /> },
    { to: "/translations", label: "Translations", icon: <Languages /> },
    { to: "/team-management", label: "Team", icon: <UsersRound />, roles: ["admin", "manager"] },
    { to: "/billing", label: "Billing", icon: <CreditCard />, roles: ["admin"] },
    { to: "/settings", label: "Settings", icon: <Settings /> },
  ] },
  { label: "Help", items: [
    { to: "/database", label: "Database", icon: <Database />, roles: ["admin"] },
    { to: "/contact", label: "Contact support", icon: <LifeBuoy /> },
    { to: "/about", label: "About", icon: <Info /> },
  ] },
];

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage home="/dashboard" />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/:provider/callback" element={<AuthCallbackPage home="/dashboard" />} />
      <Route path="/auth/callback/:provider" element={<AuthCallbackPage home="/dashboard" />} />
      <Route element={<RequireAuth><AppShell nav={nav} portalName="Business portal" /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/appointments" element={<Navigate to="/calendar" replace />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/call-conversations" element={<CallConversationsPage />} />
        <Route path="/billing" element={<RequireAuth roles={["admin"]}><BillingPage /></RequireAuth>} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/voice-analytics" element={<VoiceAnalyticsPage />} />
        <Route path="/call-insights" element={<CallInsightsPage />} />
        <Route path="/sentiment-analysis" element={<SentimentAnalysisPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/team-management" element={<RequireAuth roles={["admin", "manager"]}><TeamManagementPage /></RequireAuth>} />
        <Route path="/translations" element={<TranslationsPage />} />
        <Route path="/business-hours" element={<BusinessHoursPage />} />
        <Route path="/business-phones" element={<BusinessPhonesPage />} />
        <Route path="/premium-numbers" element={<PremiumNumbersPage />} />
        <Route path="/database" element={<RequireAuth roles={["admin"]}><DatabaseBrowserPage /></RequireAuth>} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
