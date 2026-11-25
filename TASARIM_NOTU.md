# Tasarım B — Kart Akışı / Tablet

## Dayanak ve görsel dil

Shopmonkey araştırmasındaki Workflow, sekmeli iş emri ve sağ toplam/ödeme paneli temel alındı. Birebir ürün kopyası değildir. Açık zemin, petrol yeşili (#0F766E), Source Sans 3, sekiz piksellik kontrol köşeleri ve hafif kart gölgeleri kullanıldı. Source Sans 3 mevcut harici CSS font yükleme yöntemiyle çağrılır; erişilemezse Segoe UI/sistem fontuna düşer. Yeni bağımlılık eklenmedi.

## Menü yapısı

Dar ve açık renkli ikon rayında altı ana öğe: **İş Akışı, İş emirleri, Takvim, Müşteriler, Stok, Raporlar**. Her öğede kısa altyazı ve title etiketi bulunur. Yetkisiz öğeler `can(actor, ...)` ile gizlenir. Alt menü yalnız erişilebilir araçları içerir; “Ayarlar” adı ve bağlantısı yalnız `can(actor, 'settings.write')` olan kullanıcıya görünür. Diğer kullanıcılar için menünün adı “Araçlar”dır. Hatırlatmalar, işlem günlüğü ve yapay zekâ asistanı yetkiye göre bu alt menüden ve genel aramadan açılır.

Üst çubuktaki geniş genel arama mevcut Ctrl+K paletini açar; plaka, araç, müşteri ve iş emri araması korunur. “+ Yeni iş” doğrudan mevcut araç kabul formunu açar ve kayıttan sonra iş emrine gider.

## Birleştirilen ekranlar ve erişim

- Ayrı Genel bakış kaldırıldı. `/` artık İş Akışı panosudur; `/atolye` aynı panoyu sunan uyumlu adres olarak kalır.
- **İş emirleri** raydaki ayrı öğeden doğrudan `/is-emirleri` listesine açılır. Panoda yalnız araç çubuğundaki **Liste** görünümü vardır ve pano filtreleriyle çalışır. Başlıktaki tekrarlanan Liste bağlantısı kaldırıldı. Eski liste/adres, filtreler ve kabul formu korunur.
- Randevular tek **Takvim** adıyla sunulur; günlük alan planı ve talep yönetimi korunur.
- Araçlar, **Müşteriler** içindeki araç kayıtları bağlantısına ve müşteri dosyasındaki Araçlar sekmesine bağlanır. Mevcut araç detay adresleri çalışır.
- Parça ve işçilik kataloğu **Stok** adıyla sunulur. Katalog kapsamı ekranda açıklanır.
- Teklif onayları ve tahsilat ana menüden çıkarıldı; pano araç çubuğundaki yetkili bağlantılar ve iş emrinin teklif/ödeme alanlarından erişilir. Eski adresler kaldırılmadı.

## Ekran değişiklikleri

- **İş Akışı:** Kabul, Teklif/Onay, Serviste, Hazır, Teslim sütunları ve başlıklarında filtrelenmiş kayıt sayaçları. Mevcut alt durumlar beş sütuna eşlenir; Son kontrol Serviste içindedir. Parça bekliyor ayrı sütun yerine kart etiketidir. CarImage, plaka, model, müşteri, şikâyet, teknisyen ve söz verilen tarih/saat gösterilir. İlerleme çubuğu gerçek kayıt durumundan hesaplanan **akış ilerlemesi** olarak açıkça adlandırılır. Liste ve Parça durumu görünümleri, teknisyen filtresi ve pano araması eklendi. Teknisyen panosu yalnız kendisine atanmış işleri içerir. Masaüstünde geçerli sütuna sürükleme, tablette/klavyede mevcut durum düğmeleri kullanılabilir. Durum işlemleri `allowedMoves` ve `run(moveJob)` üzerinden yürür.
- **İş emri:** Kabul → Muayene → Teklif → Onay → İş → Ödeme → Teslim adım çubuğu mevcut kayıt/teklif durumunu gösterir. Tıklama ilgili içeriği açar; geçmiş adıma tıklamak kayıt durumunu geriye taşımaz. Teslim tıklaması yalnız uygun durumda ve yetkili kullanıcı için mevcut teslim formunu açar. Özet, Hizmetler/Teklif, Muayene, Mesajlar/Notlar sekmeleri vardır. Son sekme tercihi iş emri başına tarayıcıda hatırlanır. Ödeme kayıtları Özet içindedir. Sağ panelde ana eylem, CarDrawing, müşteri, sorumlular, tutarlar ve ödeme düğmesi bulunur. İkincil eylemler “Diğer işlemler” menüsündedir.
- **Muayene:** Bulgular açıklama ve fotoğraf erişimiyle tam genişlikte satırlar halinde gösterilir; mobilde açıklama saklanmaz. Yeni bulgu için büyük İyi/Yakında/Acil radyo düğmeleri bulunur. Kaydedilen değerler mevcut Uygun/Takip edilmeli/Acil değerleridir. Fotoğraf yükleme mevcut kayıt kimliği üzerinden korunur. Teknik ön değerlendirme aynı ekranın içinde kalır.
- **Mesajlar/Notlar:** Mevcut müşteri iç notları ve iş emri durum geçmişi görünür; not yönetimi müşteri dosyasına, teklif iletimi Hizmetler/Teklif alanına bağlıdır. Yeni bir mesajlaşma altyapısı eklenmedi.
- **Müşteriler, Takvim, Stok:** Yeni bilgi mimarisine uygun başlıklar ve bağlantılar; mevcut kayıt/plan/katalog işlemleri korunur.
- **Portal:** Ortak petrol yeşili tema, Source Sans 3 ve büyük kontroller uygulanır; mobil üst çubuk sarılabilir. Portalın veri ve yetki sınırları değiştirilmedi.
- **Raporlar:** A4 belge, PDF/yazdırma ve CSV işlevleri korunur; önizleme zemini sadeleştirildi, belge vurgu rengi yeşile uyarlandı.
- **Diğer ekranlar:** Ortak tema, form ve düğme boyutları üzerinden yeni görsel dile uyarlandı. Yapay zekâ ekranının dekoratif tarama/gradyan vurgusu sadeleştirildi.

## Duyarlı düzen ve doğrulama

Masaüstünde (1024/1280 px) beş sütun kullanılabilir genişliği eşit paylaşır; sabit 258 px alt sınırı kaldırıldı ve kart içeriği sarılabilir. 390 px için açılır ray, **tek görünür pano sütunu** ve tek sütunlu iş emri düzeni tanımlandı. Mobil sütun segmentleri sayaç içerir; varsayılan **Serviste** sütunudur. Gizli sütunlar sayfayı uzatmaz. Başlıca düğme, arama, seçim, sekme ve görünürlük kontrolleri en az 44 px dokunma alanına sahiptir. Koyu temada ikon rayı koyu yüzey, açık temada açık gri yüzey kullanır; etkin/üzerine gelinen öğeler tema değişkenlerini izler.

## Denetim düzeltmeleri · 25.11.2026

- **Giriş:** Slogan, sahte iş emri/onay kartları, dekoratif önizleme ve teknik altyapı metni kaldırıldı. Ortalanmış logo/firma adı, oturum formu ve tema seçimi kaldı.
- **Teslim:** Pano yalnız `deliveredAt` tarihi İstanbul saat diliminde bugün olan teslim edilmiş işleri gösterir. Başlık “Bugün” bilgisini içerir; **Teslim edilenlerin tümü** bağlantısı iş emirleri listesini Teslim edildi filtresiyle açar. Tarihi olmayan eski teslimler panoya girmez. Pano içindeki Liste görünümünde geçmiş kayıtlar korunur.
- **Durum eylemleri:** Kartlar, iş emrinin Diğer işlemler menüsü ve Sonraki işlem paneli aynı fiil etiketlerini kullanır: İşe başla, Son kontrole al, Hazır olarak işaretle, İşleme geri al vb. Durum değerleri, yetkiler ve `run(moveJob)` akışı korunur.
- **Portal:** Mobil adım numaraları tek satırda kalır; geçerli aşamanın tam adı alt satırda gösterilir. “Teslime hazır” etiketi kesilmez.
- `components/route-guard.tsx` ve `app/(personel)/layout.tsx` değiştirilmedi. İş kuralları, API/veri modeli ve mevcut testler değiştirilmedi.

- `npm.cmd run typecheck`: başarılı.
- `npm.cmd test`: 23/23 başarılı.
- `npm.cmd run build`: başarılı; 25 statik sayfa üretildi.
- Önceki uygulamada 3012 portunda `/` ve `/portal` için HTTP 200 kontrolü yapılmıştı. Bu düzeltmelerde yerel test sunucusunun açıldığı doğrulandı; oturumlu tarayıcı kontrolü araç erişim hatası nedeniyle yapılamadı.
- Denetim sonrası tür kontrolü, 23 test ve üretim derlemesi başarılıdır. Denetimdeki 1280 px pano ve 390 px portal ekran görüntüleri incelendi. Güncel ekranlar için tarayıcı önizleme aracı yine “The browser access host is unavailable” döndürdü; yeni düzenin tarayıcıda görsel doğrulaması yapılamadı. Duyarlı düzen kod üzerinden kontrol edildi; cihaz üzerinde görsel doğrulama gerekir.

## 2. tur denetim düzeltmeleri · 25.11.2026

- **Kart eylemleri:** Kartta tek, tam genişlikte birincil düğme var. İşlemde durumunda ana eylem “Son kontrol”, parça bekletme gibi diğer izinli geçişler “⋯” menüsünde. Son kontrolde ileri eylem “Hazır işaretle”; geri alma menüdedir. Kısa etiketler tek satırda tutulur; aşırı dar alanda metin düğme dışına taşmadan kısaltılır, tam eylem adı title içinde kalır. Menü normal akışta açılır, kart sınırından taşmaz. Aynı kurallar açık ve koyu temada geçerlidir. Geçişler hâlâ `allowedMoves` ve `run(moveJob)` kullanır.
- **Teknisyen rayı:** “Ayarlar” yalnız `settings.write` yetkisinde görünür; teknisyen yalnız erişebildiği araçları görür.
- **Tahsilat:** POS, kart ve fiş canlandırmaları, rastgele onay/fiş bilgileri ve paylaşım aşaması kaldırıldı. Pencere yöntem seçimi, tutar, açıklama ve “Tahsilatı kaydet” alanlarından oluşur. Saf ön doğrulama `@/lib/rules` içindeki `recordPayment` ile gerçek kullanıcı üzerinden yapılır; kayıt `run(...)` içinde `@/lib/commands` komutuyla sürer. İşlem anahtarı, mükerrer gönderim engeli, bekleme ve hata gösterimi korunur. Başarılı kayıtta pencere kapanır.
- **Liste erişimi:** Panodaki iki Liste kontrolü teke indirildi; rayda ayrı İş emirleri bağlantısı eklendi. Ana öğe sayısı en fazla altıdır ve liste/detayda doğru öğe etkinleşir.
- **Şasi:** İş emrinin araç bilgi kutusu tek sütuna alındı. Şasi tek satırdır; gerekirse yalnız kendi alanında yatay kaydırılır.
- **Kapsam:** Yetki koruması dosyaları, iş kuralları, komutlar, API, veri modeli ve testler değiştirilmedi. Commit yapılmadı.
- **Doğrulama:** `npm run typecheck` başarılı; `npm test` 23/23 başarılı; `npm run build` başarılı, 25 statik sayfa üretildi. `git diff --check` başarılı. Denetim görüntüsü incelendi. Güncel tarayıcı kontrolü “The browser access host is unavailable” hatası nedeniyle yapılamadı; yeni ekranların görsel doğrulaması tamamlanamadı.

## Bilinen sınırlar

- Veri modeli iş kalemi başına tamamlanma tutmadığı için kart yüzdesi kalemlerin tamamlanma oranı değil, servis aşamasıdır.
- Sütun düzeni menüsünden beş sütunun sırası değiştirilebilir ve tarayıcıda hatırlanır. İş durumlarının anlamını korumak için özel sütun ekleme/silme eklenmedi. Sürükleme yalnız iş kurallarının izin verdiği geçişlerde çalışır; teslim işlemi mevcut ödeme/teslim formundan tamamlanır.
- Stok ekranı mevcut parça/işçilik kataloğudur; stok miktarı ve depo hareketi ortak veri modelinde bulunmaz.
- Mevcut bulgu sonuçları sonradan değiştirilemez; üç büyük sonuç seçeneği yeni bulgu formundadır. Fotoğraf kaydı bulgu kaydedildikten sonra yapılır.
- İç notlar müşteri dosyasındaki mevcut not yönetimine bağlıdır; gerçek zamanlı sohbet eklenmedi.
- İş kuralları, komutlar, API, veri modeli, veritabanı ve test dosyaları değiştirilmedi. Push veya yayın yapılmadı.
