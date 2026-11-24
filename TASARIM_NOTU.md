# Tasarım B — Kart Akışı / Tablet

## Dayanak ve görsel dil

Shopmonkey araştırmasındaki Workflow, sekmeli iş emri ve sağ toplam/ödeme paneli temel alındı. Birebir ürün kopyası değildir. Açık zemin, petrol yeşili (#0F766E), Source Sans 3, sekiz piksellik kontrol köşeleri ve hafif kart gölgeleri kullanıldı. Source Sans 3 mevcut harici CSS font yükleme yöntemiyle çağrılır; erişilemezse Segoe UI/sistem fontuna düşer. Yeni bağımlılık eklenmedi.

## Menü yapısı

Dar ve açık renkli ikon rayında beş ana öğe: **İş Akışı, Takvim, Müşteriler, Stok, Raporlar**. Her öğede kısa altyazı ve title etiketi bulunur. Yetkisiz öğeler `can(actor, ...)` ile gizlenir. Ayarlar/araçlar açılır menüsü ve kullanıcı rayın altındadır. Hatırlatmalar, işlem günlüğü ve yapay zekâ asistanı bu alt menüden ve genel aramadan açılır.

Üst çubuktaki geniş genel arama mevcut Ctrl+K paletini açar; plaka, araç, müşteri ve iş emri araması korunur. “+ Yeni iş” doğrudan mevcut araç kabul formunu açar ve kayıttan sonra iş emrine gider.

## Birleştirilen ekranlar ve erişim

- Ayrı Genel bakış kaldırıldı. `/` artık İş Akışı panosudur; `/atolye` aynı panoyu sunan uyumlu adres olarak kalır.
- İş emirleri ana menüden çıkarıldı. Pano içindeki Liste görünümü ve “Tüm kayıtlar ve iptaller” bağlantısı üzerinden erişilir. Eski liste/adres, filtreler ve kabul formu korunur.
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

1024 px için dar ray ve yatay kaydırılabilir beş sütun; 390 px için açılır ray, yatay kaydırılan kartlar/sekmeler/adımlar ve tek sütunlu iş emri düzeni tanımlandı. Başlıca düğme, arama, seçim, sekme ve görünürlük kontrolleri en az 44 px dokunma alanına sahiptir. Koyu tema korunur; ikon rayı koyu temada da açık renklidir.

- `npm.cmd run typecheck`: başarılı.
- `npm.cmd test`: 23/23 başarılı.
- `npm.cmd run build`: başarılı; 25 statik sayfa üretildi.
- 3012 portunda yerel test sunucusu çalıştırıldı; `/` ve `/portal` HTTP 200 verdi.
- Tarayıcı önizleme aracı “The browser access host is unavailable” döndürdüğü için oturum açılmış ekranlarda 1024/390 px görsel inceleme yapılamadı. Duyarlı düzen kod üzerinden kontrol edildi; cihaz üzerinde görsel doğrulama gerekir.

## Bilinen sınırlar

- Veri modeli iş kalemi başına tamamlanma tutmadığı için kart yüzdesi kalemlerin tamamlanma oranı değil, servis aşamasıdır.
- Sütun düzeni menüsünden beş sütunun sırası değiştirilebilir ve tarayıcıda hatırlanır. İş durumlarının anlamını korumak için özel sütun ekleme/silme eklenmedi. Sürükleme yalnız iş kurallarının izin verdiği geçişlerde çalışır; teslim işlemi mevcut ödeme/teslim formundan tamamlanır.
- Stok ekranı mevcut parça/işçilik kataloğudur; stok miktarı ve depo hareketi ortak veri modelinde bulunmaz.
- Mevcut bulgu sonuçları sonradan değiştirilemez; üç büyük sonuç seçeneği yeni bulgu formundadır. Fotoğraf kaydı bulgu kaydedildikten sonra yapılır.
- İç notlar müşteri dosyasındaki mevcut not yönetimine bağlıdır; gerçek zamanlı sohbet eklenmedi.
- İş kuralları, komutlar, API, veri modeli, veritabanı ve test dosyaları değiştirilmedi. Push veya yayın yapılmadı.
