import { AirVent, Sun, Camera, Zap, Droplets, Smartphone, Refrigerator, Lightbulb, Hammer, Package } from 'lucide-react';

export const CATEGORY_ICONS = {
  'air-conditioners': AirVent,
  'solar-panels': Sun,
  'cctv-security': Camera,
  electrical: Zap,
  plumbing: Droplets,
  'smart-home': Smartphone,
  'home-appliances': Refrigerator,
  lighting: Lightbulb,
  tools: Hammer,
};

export function getCategoryIcon(slug) {
  return CATEGORY_ICONS[slug] || Package;
}
