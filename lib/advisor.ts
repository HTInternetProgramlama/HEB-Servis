import type { Fuel, InspectionResult } from './types';
import { fold } from './format';

/**
 * Teknik ön değerlendirme taslağı (FR-14).
 * Girdi yalnız teknik alanlardır: müşteri adı, telefon, plaka ve iç notlar bu fonksiyona hiç verilmez.
 * Şu an kural tabanlı çalışır; yapay zekâ sağlayıcısı bağlandığında aynı girdi/çıktı sözleşmesi korunacaktır.
 * Çıktı kesin teşhis değildir ve teknisyen onayı olmadan kalıcı kayda dönüşmez.
 */
export interface TechnicalInput { brand: string; model: string; year: number; km: number; fuel: Fuel; complaint: string; pastItems: string[] }
export interface Suggestion { item: string; reason: string; priority: InspectionResult }

const rules: { keys: string[]; checks: [string, string][] }[] = [
  { keys: ['fren', 'balata', 'disk', 'durma', 'pedal'], checks: [['Ön/arka fren balata kalınlığı', 'Şikâyette fren belirtisi var'], ['Fren diski yüzeyi ve salgı', 'Titreşim veya ses fren diskinden kaynaklanabilir'], ['Fren hidroliği seviyesi ve nem oranı', 'Pedal hissi değişiminde ilk kontrol']] },
  { keys: ['titres', 'sallan', 'direksiyon', 'cek'], checks: [['Rot-balans ve lastik aşınma deseni', 'Direksiyon titremesi / çekme belirtisi'], ['Ön düzen burç ve rotil boşlukları', 'Yol tutuş şikâyetinde kontrol edilmeli']] },
  { keys: ['ses', 'tikirti', 'vuruntu', 'gicirti'], checks: [['Ön düzen ve amortisör takozları', 'Sürüşte ses şikâyeti'], ['Egzoz askı lastikleri ve bağlantıları', 'Gövdeden gelen metalik ses']] },
  { keys: ['yag', 'sizinti', 'damla', 'leke'], checks: [['Motor yağ seviyesi ve kaçak noktaları', 'Sızıntı belirtisi'], ['Karter ve şanzıman keçeleri', 'Araç altında leke şikâyeti']] },
  { keys: ['harar', 'isin', 'sicaklik', 'antifriz', 'su eksil'], checks: [['Soğutma sıvısı seviyesi ve antifriz derecesi', 'Hararet belirtisi'], ['Termostat ve fan devreye girme kontrolü', 'Sıcaklık göstergesi yükseliyorsa'], ['Radyatör ve hortum kaçak testi', 'Sıvı eksilmesi şikâyeti']] },
  { keys: ['aku', 'mars', 'calismi', 'zor cal'], checks: [['Akü sağlık testi (CCA / SoH)', 'Marş şikâyeti'], ['Şarj dinamosu çıkış voltajı', 'Akünün şarj olmaması ihtimali']] },
  { keys: ['klima', 'sogut', 'kalorifer', 'koku'], checks: [['Klima gaz basıncı ve kaçak testi', 'Soğutma performansı şikâyeti'], ['Polen filtresi durumu', 'Koku veya zayıf hava akışı']] },
  { keys: ['vites', 'debriyaj', 'kavrama', 'sanziman'], checks: [['Debriyaj kavrama noktası ve kayma testi', 'Vites geçiş şikâyeti'], ['Şanzıman yağı seviyesi / durumu', 'Sert geçiş veya ses']] },
  { keys: ['lamba', 'ariza isigi', 'motor isigi', 'uyari'], checks: [['OBD arıza kodu okuma', 'Gösterge uyarı lambası şikâyeti']] },
  { keys: ['duman', 'egzoz', 'guc', 'cekis', 'tekle'], checks: [['OBD arıza kodu ve canlı veri', 'Performans kaybı belirtisi'], ['Ateşleme sistemi (buji / bobin)', 'Tekleme şikâyeti'], ['Hava filtresi ve emme hattı', 'Güç kaybında temel kontrol']] },
  { keys: ['lastik', 'patlak', 'hava kac'], checks: [['Lastik diş derinliği, basınç ve yanak hasarı', 'Lastik şikâyeti']] },
];

export function generateTechnicalDraft(input: TechnicalInput) {
  const text = fold(input.complaint);
  const seen = new Set(input.pastItems.map(fold));
  const out: Suggestion[] = [];
  const push = (item: string, reason: string, priority: InspectionResult) => {
    if (!out.some(s => s.item === item)) out.push({ item, reason, priority: seen.has(fold(item)) ? 'Takip edilmeli' : priority });
  };
  for (const rule of rules) if (rule.keys.some(k => text.includes(k))) for (const [item, reason] of rule.checks) push(item, reason, 'Takip edilmeli');

  const age = new Date().getFullYear() - input.year;
  if (input.km >= 90000 && input.fuel !== 'Elektrik') push('Triger kayışı / zincir değişim geçmişi', `${input.km.toLocaleString('tr-TR')} km’de üretici değişim aralığı kontrol edilmeli`, 'Takip edilmeli');
  if (input.km >= 60000) push('Amortisör performansı', 'Kilometreye bağlı aşınma kontrolü', 'Uygun');
  if (age >= 4) push('Akü sağlık testi (CCA / SoH)', `${age} yaşındaki araçta önleyici kontrol`, 'Uygun');
  if (input.fuel === 'Dizel') push('Yakıt filtresi ve DPF doluluk oranı', 'Dizel motorlarda periyodik kontrol', 'Uygun');
  if (input.fuel === 'LPG') push('LPG sızdırmazlık ve enjektör kontrolü', 'LPG’li araçlarda güvenlik kontrolü', 'Takip edilmeli');
  if (input.fuel === 'Hibrit' || input.fuel === 'Elektrik') push('Yüksek voltaj sistem uyarıları (OBD)', 'Elektrikli tahrik sistemi kontrolü', 'Uygun');
  push('Fren hidroliği seviyesi ve nem oranı', 'Her serviste temel güvenlik kontrolü', 'Uygun');
  push('Lastik diş derinliği, basınç ve yanak hasarı', 'Her serviste temel güvenlik kontrolü', 'Uygun');

  const matched = out.filter(s => s.priority !== 'Uygun').length;
  const explanation = matched
    ? `${input.brand} ${input.model} (${input.year}, ${input.km.toLocaleString('tr-TR')} km) için müşteri şikâyetiyle ilişkili ${matched} kontrol önerildi. Bulgular teknisyen muayenesiyle doğrulanmadan müşteriye teşhis olarak iletilmemelidir.`
    : `Şikâyet metninde eşleşen belirti bulunamadı; kilometre ve araç yaşına göre temel kontroller önerildi. Teknisyen muayenesi esastır.`;
  return { suggestions: out.slice(0, 8), explanation, engine: 'Kural tabanlı ön değerlendirme v1' };
}
