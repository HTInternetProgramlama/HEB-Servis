import type { Vehicle } from './types';

/* Modele özel illüstrasyonlar (fotoğraf değil). Hepsi aynı stilde, şeffaf arka planlı, 720×480 WebP.
   Eşleşmeyen modellerde kasa tipine göre markasız genel çizim gösterilir ve bu açıkça belirtilir. */
export interface VehicleMedia { id: string; brand: string; models: string[]; from: number; to: number; label: string; src: string }

export const vehicleMedia: VehicleMedia[] = [
  { id: 'golf-8', brand: 'volkswagen', models: ['golf', 'golf 8', 'golf viii'], from: 2020, to: 2026, label: 'Golf VIII', src: '/vehicles/models/vw-golf-8.webp' },
  { id: 'megane-4', brand: 'renault', models: ['megane', 'megane sedan', 'megane 4', 'megane iv'], from: 2016, to: 2026, label: 'Megane IV Sedan', src: '/vehicles/models/renault-megane-4-sedan.webp' },
  { id: 'egea-sedan', brand: 'fiat', models: ['egea', 'egea sedan', 'tipo', 'tipo sedan'], from: 2015, to: 2026, label: 'Egea Sedan', src: '/vehicles/models/fiat-egea-sedan.webp' },
  { id: 'clio-5', brand: 'renault', models: ['clio', 'clio 5', 'clio v'], from: 2019, to: 2026, label: 'Clio V', src: '/vehicles/models/renault-clio-5.webp' },
  { id: 'corolla-e210', brand: 'toyota', models: ['corolla', 'corolla sedan'], from: 2019, to: 2026, label: 'Corolla Sedan (E210)', src: '/vehicles/models/toyota-corolla-e210.webp' },
  { id: 'duster-2', brand: 'dacia', models: ['duster'], from: 2018, to: 2024, label: 'Duster II', src: '/vehicles/models/dacia-duster-2.webp' },
  { id: 'i20-3', brand: 'hyundai', models: ['i20'], from: 2020, to: 2026, label: 'i20 (3. nesil)', src: '/vehicles/models/hyundai-i20-3.webp' },
  { id: '3008-2', brand: 'peugeot', models: ['3008'], from: 2017, to: 2024, label: '3008 II', src: '/vehicles/models/peugeot-3008-2.webp' },
  { id: 'transit-custom', brand: 'ford', models: ['transit custom', 'transit'], from: 2013, to: 2026, label: 'Transit Custom', src: '/vehicles/models/ford-transit-custom.webp' },
];

const SUV = ['duster', '3008', '2008', '5008', 'tucson', 'kuga', 'qashqai', 'rav4', 't-roc', 'tiguan', 'kadjar', 'captur', 'c-hr', 'sportage', 'kona', 'bayon', 'puma', 'juke', 'x1', 'x3', 'q3', 'q5', 'karoq', 'kodiaq', 'arona', 'ateca', 'x-trail', 'hr-v', 'cr-v', 't-cross', 'taigo', 'austral', 'compass', 'renegade', 'togg', 'transit', 'doblo', 'caddy', 'kangoo', 'berlingo', 'partner', 'vito', 'sprinter', 'connect', 'courier', 'rifter', 'combo'];

const normalize = (text: string) => text.trim().toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/\s+/g, ' ');

export function findVehicleMedia(vehicle: Pick<Vehicle, 'brand' | 'model' | 'year'>) {
  const brand = normalize(vehicle.brand) === 'vw' ? 'volkswagen' : normalize(vehicle.brand);
  return vehicleMedia.find(m => m.brand === brand && m.models.includes(normalize(vehicle.model)) && vehicle.year >= m.from && vehicle.year <= m.to);
}

/** Her araç için gösterilecek görsel: önce modele özel, yoksa kasa tipine göre markasız genel çizim. */
export function vehicleImage(vehicle: Pick<Vehicle, 'brand' | 'model' | 'year'>) {
  const exact = findVehicleMedia(vehicle);
  if (exact) return { src: exact.src, label: exact.label, generic: false };
  const m = normalize(vehicle.model);
  const suv = SUV.some(k => m.includes(k));
  return { src: suv ? '/vehicles/models/generic-suv.webp' : '/vehicles/models/generic-sedan.webp', label: suv ? 'SUV / ticari' : 'Binek', generic: true };
}
