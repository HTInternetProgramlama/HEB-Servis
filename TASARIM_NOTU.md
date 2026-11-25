# Tasarım C — Kurumsal / ERP

**Dayandığı ürünler:** Garage Hive (Microsoft Dynamics 365 Business Central tabanlı: rol merkezi, sayaç kutucukları, eylem çubuğu, FastTab, FactBox) ve Mitchell 1 Manager SE (yoğun WIP tablosu, belge mantığı, yazdırılabilir formlar). Türk servis programlarının (Canbus, Bilsoft) alıştığı üst menülü düzenin sade bir sürümü.

## Görsel dil
- **Yan menü yok.** Üstte lacivert (`#1F3A5F`) çubuk: yazı logosu, şube adı, genel arama (Ctrl K), tarih, sağda kullanıcı / ayarlar menüsü. Altında beyaz yatay ana menü; seçili öğenin altında 2 px lacivert çizgi.
- Sayfa başlığının altında **eylem çubuğu**: metin düğmeler (Yeni, Düzenle, Gönder ▾, Yazdır ▾, Excel'e aktar, İptal et …). Yalnız ilgili sayfada anlamlı olanlar gösterilir, yetkiye göre gizlenir.
- Açık gri sayfa zemini, beyaz paneller, 3–4 px köşe, gölge yok, ince çizgi. Durum rozetleri soluk zemin ve koyu yazıyla, köşeli (Taslak/Kabul gri, Onay bekliyor sarı, İşlemde mavi, Hazır yeşil, Teslim gri, İptal kırmızı). Renkler `app/globals.css` içinde CSS değişkenleri olarak tanımlı; koyu tema aynı adları yeniden tanımlar.
- Yazı: IBM Plex Sans ve IBM Plex Mono (`next/font/google`, latin-ext). Gövde 13,5 px, tablolar yoğun (36 px satır), sayılar sağa hizalı ve `tabular-nums`.
- Emoji, slogan, gradyan yok. Önceki POS/fiş ve yazıcı canlandırmaları kaldırıldı.

## Menü yapısı (7 öğe)
Ana Sayfa · Randevular · İş Emirleri · Müşteriler · Araçlar · Stok · Raporlar

Alt sekmeler (bölümün altında ikinci şerit):
- **İş Emirleri:** İş emri listesi · Teklif onayları (`/teklifler`) · Tahsilat (`/tahsilat`)
- **Araçlar:** Araç listesi · Bakım hatırlatmaları (`/hatirlatmalar`)
- **Raporlar:** Rapor belgeleri · Yapay zekâ asistanı (`/yapay-zeka`)
- **Kullanıcı menüsü (sağ üst):** Ayarlar ve personel, İşlem günlüğü, Yapay zekâ asistanı (teknisyen dahil), açık/koyu tema, oturumu kapat. Ayarlar sayfalarında "Ayarlar / İşlem günlüğü" alt sekmesi görünür.

Menü ve sekmeler `can(actor, …)` ile süzülür: teknisyen Ana Sayfa · İş Emirleri · Araçlar görür; Randevular/Müşteriler/Stok/Raporlar gizlenir.

## Kaldırılan / birleştirilen sayfalar
- **Atölye panosu (kanban) kaldırıldı.** `/atolye` İş Emirleri'nin "Duruma göre" görünümüne yönlenir (durum başına katlanabilir tablo). Durum değiştirme iş emri belgesindeki eylem çubuğunda.
- Teklif onayları, Tahsilat, Bakım hatırlatmaları, İşlem günlüğü ve Yapay zekâ asistanı ana menüden çıkarıldı; yukarıdaki alt sekmelerden ve kullanıcı menüsünden erişilir. Ana Sayfa kutucukları da bunlara bağlanır.
- "Parça ve işçilik" sayfası ana menüde **Stok** adıyla duruyor (`/katalog`).
- Kabul formu, teklif çıktısı ve servis/teslim formu tek **Yazdır** menüsünde; `/servis-formu?id=…&belge=kabul|teklif` ile üç belge aynı A4 sayfasında, üstte belge seçimiyle basılır.

## Ekran ekran
- **Kabuk (`components/shell.tsx`):** lacivert üst çubuk + yatay ana menü + bölüm alt sekmeleri; 720 px altında ana menü hamburger düğmesiyle çubuğun altında dikey liste olarak açılır (yan çekmece değil). Komut paleti (Ctrl K) korunur.
- **Ana Sayfa (rol merkezi):** gruplu sayaç kutucukları — Ön büro (bugünkü randevu, randevu talebi, bakım hatırlatması), Atölye (açık, onay bekleyen teklif, parça bekleyen, teslime hazır, gecikmede), Finans (bugünkü tahsilat, açık bakiye). Her kutucuk filtrelenmiş listeyi açar (`/is-emirleri?durum=…`). Altında Bugünkü randevular, Bugün teslim edilecekler, Dikkat gerektirenler, Teknisyen iş yükü ve Son iş emirleri tabloları. Teknisyen kendi kutucuklarını ve iş listesini görür.
- **İş Emirleri:** WIP tablosu (İE No · Tarih · Plaka · Araç · Müşteri · Teknisyen · Durum · Teslim sözü · Tutar · Kalan), başlıklara tıklanarak sıralanır. Filtre şeridi: Durum (açık, inceleme, onay, işlemde, parça, son kontrol, hazır, gecikmede, bakiyesi açık, teslim, iptal, tümü), Teknisyen, Kabul tarihi aralığı, arama. Filtreler adres satırında tutulur. Eylemler: Yeni iş emri, Excel'e aktar (CSV), Listeyi yazdır, Liste / Duruma göre.
- **İş emri belgesi:** başlıkta "İş Emri İE-…" ve durum rozeti; eylem çubuğunda durum geçişleri, Teslim et, Tahsilat al, Gönder ▾ (teklif / servis formu), Yazdır ▾ (kabul formu, teklif, servis formu), Değerlendir, İptal et. Gövde katlanabilir bölümler: Genel · Şikâyet ve kabul · Muayene (bulgular, bulgu ekle, yapay zekâ ön değerlendirmesi) · Teklif ve kalemler · Tahsilat · Geçmiş (durum geçmişi + yöneticiye işlem günlüğü). Sağda bilgi kutusu: araç illüstrasyonu (`CarDrawing`) ve araç bilgisi, bakiye (iş ve müşteri toplamı), son 3 servis, müşteri iç notları.
- **Müşteri kartı / Araç kartı:** aynı belge düzeni (FastTab + FactBox). Müşteride Genel, Araçlar, Servis geçmişi, Randevular, İç notlar, Değerlendirmeler; sağda müşteri özeti ve araç çizimi. Araçta Genel, Servis geçmişi, Takip bulguları; sağda araç çizimi, bakım planı, sahibi.
- **Randevular:** takvim korunur; eylem çubuğunda Yeni randevu, Seçileni değiştir, Araç geldi · kabul, Günlük planı yazdır. `?yeni=1` ile form açılır.
- **Tahsilat formu:** canlandırmasız sade kayıt formu (yöntem, tutar, açıklama); kayıttan sonra makbuz bilgisi paylaşılabilir.
- **Giriş:** lacivert çubuk ve ortada tek form; tanıtım/slogan bölümü kaldırıldı.
- **Müşteri portalı:** aynı lacivert çubuk ve yatay menü; içerik bileşenleri yeni stile uyar.
- Raporlar, Yapay zekâ, Ayarlar, Stok, Teklif onayları, Hatırlatmalar, Günlük: işlevleri aynı, görünümleri yeni başlık + eylem çubuğu + yoğun tablo stiline geçti.

## Denetim sonrası düzeltmeler
- Sayaç kutucukları dolu lacivert blok yerine açık zemin, lacivert sayı ve sol vurgu çizgisi (uyarı sarı, gecikme kırmızı, hazır yeşil).
- Teknisyen ana sayfasında kutucukların başlığın üstüne çıkması düzeltildi (yerleşim kuralı yalnız yönetici kutucuk gruplarına uygulanır).
- Eylem çubuğunda birincil eylem dolu lacivert düğme. Müşteri kararı beklenen iş emrinde "Onay kaydet / Ret kaydet" eylem çubuğuna taşındı ve birincil eylem oldu; teslime hazırda "Teslim et" birincil.
- İş emri tablolarında (liste, ana sayfa) ve bugünkü randevularda `VehicleCell` ile küçük araç illüstrasyonu + plaka.
- 390 px: iş emri tablosu kart satırlarına dönüşür (İE no + durum, araç, teslim sözü + kalan); belge sayfalarında yalnız "Genel" bölümü açık başlar, diğerleri kapalı; ana sayfada Teknisyen iş yükü ve Son iş emirleri gizlenir, kutucuklar küçülür.
- Yapay zekâ ekranındaki tarama animasyonu kaldırıldı.

## Doğrulama
`npm run typecheck`, `npm test` (23/23), `npm run build` hatasız. 1280 px ve 390 px genişlikte headless Chrome ile yerel test veritabanında (port 3013) ekran görüntüleri alındı; 390 px'te yatay sayfa taşması yok (geniş tablolar kendi içinde kayar).

## Bilinen eksikler
- Gerçek stok miktarı/depo verisi yok; "Kritik stok" kutucuğu bu yüzden konmadı, Stok menüsü fiyat kartlarını gösterir.
- Tablo sütunlarının taşınması/boyutlandırılması ve kullanıcıya göre kaydedilmesi (Mitchell 1 WIP) yapılmadı.
- FastTab açık/kapalı durumu sayfa yenilenince hatırlanmaz.
- `app/motion.css` içindeki eski POS/yazıcı canlandırma stilleri artık kullanılmıyor; temizlenmedi.
- Müşteri portalı ekran görüntüsüyle ayrıca kontrol edilmedi (teknisyen ana sayfası denetim sonrası kontrol edildi).
- İş emri dışındaki tablolar (müşteri listesi, tahsilat vb.) 390 px'te kart satırına dönmez; kendi içinde yatay kayar.
