// Single entry point for API calls. USE_MOCKS=true → in-browser demo backend (endpoints.mock.ts + mocks/router.ts);
// otherwise the PolyDial Flask API at API_BASE_URL (endpoints.flask.ts). Both expose identical shapes.
import { env } from "../lib/env";
import * as mock from "./endpoints.mock";
import * as flask from "./endpoints.flask";

const api = env.USE_MOCKS ? mock : flask;

export const {
  authApi, businessApi, servicesApi, customersApi, appointmentsApi, callsApi, billingApi, languagesApi,
  phonesApi, premiumApi, hoursApi, usersApi, translationsApi, analyticsApi, reportsApi, dbApi, supportApi,
  menusApi, sectionsApi, availabilityApi, itemsApi, categoriesApi, optionGroupsApi, optionsApi,
  modifierGroupsApi, modifiersApi, tagsApi, comboGroupsApi, comboItemsApi, ordersApi, cloverApi,
} = api;
