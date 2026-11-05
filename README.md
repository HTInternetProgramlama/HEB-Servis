# HEB Servis · sürüm 0.3

Araç bakım ve servis yönetim sistemi. Next.js 16, React 19 ve TypeScript ile yazılmıştır. Personel paneli, müşteri portalı ve yazdırılabilir servis formu tek uygulamadadır.

## Çalıştırma

Bu klasörde `npm install`, ardından `npm run dev` çalıştırın. Uygulama http://127.0.0.1:3001 adresinde açılır. Node.js 20.9 veya üzeri gerekir.

| Komut | İşlev |
|---|---|
| `npm test` | İş kuralı testleri (18 test) |
| `npm run typecheck` | Tip denetimi |
| `npm run build` / `npm start` | Üretim derlemesi ve çalıştırma |

Açılışta giriş ekranından bir demo hesabı seçilir: yönetici, iki servis danışmanı, üç teknisyen ve iki müşteri.

## Modüller

| Modül | Kapsam | Gereksinim |
|---|---|---|
| Giriş ve roller | Yönetici, danışman, teknisyen ve müşteri için ayrı menü ve yetkiler. Kurallar her işlemde rolü yeniden denetler. | FR-01 |
| Müşteri ve araç | Bireysel/kurumsal müşteri, KVKK onayı, vergi/T.C. no denetimi, mükerrer telefon/plaka engeli, VIN, yakıt/vites, servis geçmişi | FR-02 |
| Randevu takvimi | Servis alanı sütunlu gün görünümü, doluluk, öğle arası, talep listesi, çakışma uyarısı, saat değiştirme, gelmedi/iptal | FR-03, FR-04 |
| Araç kabul | Kilometre (geri gidemez), yakıt seviyesi, şikâyet, tıklanabilir kaporta hasar haritası, eşyalar, müşteri teyidi, randevusuz kabul | FR-05 |
| İş emri | Durum adımları, teknisyen ataması, tahmini teslim ve gecikme, zaman/kullanıcı damgalı durum geçmişi, atölye panosu | FR-05 |
| Kontrol bulguları | Uygun / takip / acil sonuçları, bulgu bazında müşteriye açık-gizli seçimi | FR-06 |
| Teklif | Katalogdan veya elle kalem, miktar, indirim, KDV; sürümleme; gönderilen sürüm kilitlenir; telefon/şube onayı açıklamalı kaydedilir | FR-07, FR-08 |
| Tahsilat ve teslim | Kısmi/tam tahsilat, işlem anahtarıyla mükerrer kayıt engeli, açık bakiyeler, bakiyeli teslim yalnız yönetici onayıyla, sonraki bakım planı | FR-09 |
| Müşteri ilişkileri | Kategorili ve düzeltme geçmişli iç notlar; tamamlanan ziyaret başına üç ölçütlü değerlendirme | FR-10, FR-11 |
| Müşteri portalı | Araçlar, aktif servis takibi, teklif onay/ret, paylaşılan bulgular, ödeme özeti, randevu talebi/iptali | FR-12 |
| Raporlar ve çıktılar | Tarih aralıklı işlem tutarı ve tahsilat (ayrı), hizmet ve teknisyen kırılımı, CSV; A4 servis formu; bakım hatırlatma listesi | FR-13 |
| Teknik ön değerlendirme | Şikâyet, km, yaş ve yakıt türüne göre kontrol önerisi; teknisyen onayıyla bulguya dönüşür | FR-14 |
| Yönetim | Firma bilgileri, KDV, çalışma saatleri/günleri, servis alanları, hizmet türleri, kullanıcılar, fiyat listesi, işlem günlüğü, JSON yedek | — |

Para tutarları kuruş cinsinden tamsayı olarak hesaplanır; kayan nokta yuvarlama hatası oluşmaz.

## Klasör yapısı

```
app/(personel)/   Personel paneli sayfaları (genel bakış, takvim, atölye, iş emirleri, ...)
app/portal/       Müşteri portalı
app/servis-formu/ Yazdırılabilir servis formu
app/giris/        Oturum açma
components/       Kabuk, form pencereleri, ortak arayüz öğeleri, veri deposu
lib/rules.ts      Tüm iş kuralları ve yetki matrisi (arayüzden bağımsız, test edilir)
lib/advisor.ts    Teknik ön değerlendirme motoru
lib/seed.ts       Kurgusal örnek veri
db/schema.sql     PostgreSQL şeması, kısıtlar ve RLS politikaları
tests/            İş kuralı testleri
```

## Veri ve güvenlik sınırı

Bu sürümde veriler tarayıcının yerel depolamasında `heb-servis-v3` anahtarıyla tutulur; sunucuya gönderilmez. Oturum, tarayıcı sekmesine özeldir. Giriş ekranındaki hesap seçimi bir demo aracıdır, gerçek kimlik doğrulama değildir. Yalnız kurgusal veri girin.

`db/schema.sql`, PostgreSQL/Supabase geçişi için hazırlanmıştır: onaylı randevu çakışmasını `EXCLUDE` kısıtıyla, aynı randevudan ikinci iş emrini ve mükerrer tahsilatı benzersiz indekslerle, gönderilmiş teklifin değişmesini tetikleyiciyle engeller; müşteri ve teknisyen erişimini RLS ile sınırlar. Şema henüz bir veritabanında çalıştırılmamıştır.

Teknik ön değerlendirme şu an kural tabanlıdır. Kişisel bilgi, plaka ve iç notlar girdiye hiç verilmez. Bir yapay zekâ sağlayıcısı bağlandığında aynı girdi/çıktı sözleşmesi korunacaktır.

Önceki sürümün (0.2) kaynak kodu `.work/v0.2-yedek/` klasöründedir. Eski `heb-servis-v2` yerel kaydı silinmez ve otomatik aktarılmaz.
