import { AirVent, Sun, Camera, Zap, Droplets, Wrench } from 'lucide-react';

export const SERVICE_CATEGORY_ICONS = {
  'Air Conditioning': AirVent,
  'Solar Energy': Sun,
  Security: Camera,
  Electrical: Zap,
  Plumbing: Droplets,
  General: Wrench,
};

export function getServiceCategoryIcon(category) {
  return SERVICE_CATEGORY_ICONS[category] || Wrench;
}
