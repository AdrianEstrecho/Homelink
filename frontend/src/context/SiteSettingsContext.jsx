import { createContext, useContext, useEffect, useState } from 'react';
import { api, setCurrency } from '../api/client';

// Currency, shipping, tax and delivery estimate from Platform Settings (GET /promos/storefront).
// Matches the backend's SETTINGS_DEFAULTS, which is what an unconfigured store charges.
const DEFAULTS = {
  currencyCode: 'PHP',
  currencySymbol: '₱',
  taxRate: 0,
  shippingFee: 0,
  freeShippingThreshold: 0,
  deliveryEstimate: '3-5 business days',
};

// The last visit's copy, so prices show the right symbol on the first paint instead of flipping
// once the request lands — which can take most of a minute while the free Render backend wakes.
const CACHE_KEY = 'homelink_storefront_settings';

function readCache() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(CACHE_KEY)) };
  } catch {
    return DEFAULTS;
  }
}

const initial = readCache();
setCurrency({ symbol: initial.currencySymbol, code: initial.currencyCode });

const SiteSettingsContext = createContext(initial);

export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(initial);

  useEffect(() => {
    api.get('/promos/storefront').then((fresh) => {
      const next = { ...DEFAULTS, ...fresh };
      setCurrency({ symbol: next.currencySymbol, code: next.currencyCode });
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      setSettings(next);
    }).catch(() => {});
  }, []);

  return <SiteSettingsContext.Provider value={settings}>{children}</SiteSettingsContext.Provider>;
}

// App reads this too, purely so a changed currency symbol re-renders the whole tree — formatPrice
// is a plain function and wouldn't otherwise know to redraw.
export const useSiteSettings = () => useContext(SiteSettingsContext);
