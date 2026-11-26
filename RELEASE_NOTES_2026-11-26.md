# HEB Servis — 26 Kasım 2026

Bu geliştirme turu ana `uygulama` projesinde yapıldı. Önceki tasarım karşılaştırma klasörleri korunur.

## Müşteri portalı tasarım turu

Geçmiş randevular artık karttaki ayrıntı bağlantısından açılır. Tarih aralığı ve araç/hizmet aramasıyla kayıtlar bulunabilir; Geçmiş görünümü doğrudan `/portal/randevular?gorunum=gecmis` adresiyle paylaşılabilir. Detayda kayıtlı talep, araç ve randevu bilgileri; varsa randevuya bağlı servis, müşteriye paylaşılan kontrol bulguları, teklif sürümleri ve ödeme hareketleri gösterilir. İş emrine dönüşmemiş randevu için servis veya ödeme geçmişi üretilmez. Randevu durumlarının değişiklik tarihleri ayrı saklanmadığından böyle bir zaman çizelgesi uydurulmaz.

Yerel `dev:test` sunucusu test derleme çıktısını `.next-test` altında tutar; normal geliştirme/yayın `.next` kullanır. Gerekirse `PORT` ile ayrı test portu seçilir. `scripts/enrich-appointment-history.ts` iki kurgusal ders hesabına geçmiş randevu/servis örnekleri ekler; varsayılan önizleme, uygulama için `--apply`, bulutta ayrıca `--allow-cloud` gerekir. Mevcut kayıtları değiştirmez ve tekrar çalıştırıldığında çoğaltmaz.

Müşteri ana sayfası kişisel araç ve servis paneli olarak yenilendi. Araçlar, aktif servisler, onay bekleyen teklifler, randevular, bakım planları ve ödeme özeti mevcut kayıtlardan oluşturulur. Randevu ekranı yaklaşan ve geçmiş kayıtları ayrı gösterir. Servis detayında araç özeti, dört adımlı ilerleme, durum geçmişi, kontrol bulguları ve ödeme hareketleri birlikte sunulur. Telefon ve firma bilgileri servis ayarlarından gelir. Müşteriye iç not, değerlendirme veya personel ödülü açılmaz.

## Kullanım

- **Stok takibi:** Menüden stok kartı açın; başlangıç miktarını giriş hareketiyle kaydedin. Çıkışı iş emrine bağlayabilirsiniz. Minimum stok uyarısı ve hareket geçmişi bulunur. Miktarlar yüzde birlik tam sayı tutulur. Negatif stok ve geçmiş hareketi değiştirme engellenir; düzeltme ters hareketle yapılır. Teklifte parça eklemek stok hareketi oluşturmaz; fiilî kullanım çıkış olarak kaydedilir.
- **Müşteri değerlendirmesi:** Müşteri kartından araç veya iş emri gerektirmeden değerlendirme eklenebilir. Servis ziyareti tüm durumlarda değerlendirilebilir. Randevuya uyum, ödeme ve iletişim yıldızları ile açıklama yalnız yetkili personele açıktır.
- **Teknisyen başarıları:** Yönetici kalite, dakiklik, işbirliği veya ustalık rozeti; gerekçe ve isteğe bağlı ödül kaydeder. İş emrine bağlanabilir. Teknisyen yalnız kendi ödüllerini görür.
- **Müşteri portalı:** Müşterinin e-postasını ve araçlarını kaydedin. Müşteri kartındaki “Hesabı aç ve e-posta gönder” düğmesini kullanın. Mevcut hesap için şifre e-postası yeniden gönderilebilir. Gönderim geçmişi aynı karttadır. Müşteri `/giris` ekranındaki Müşteri sekmesinden giriş yapar.
- **Şifre oluşturma:** Supabase Auth e-postasındaki bağlantı `/erisim` sayfasını açar. Müşteri en az 10 karakterli şifre belirler. Parola veya erişim bağlantısı iş verisine, günlüğe ya da gönderim geçmişine kaydedilmez. E-posta sağlayıcısının kabul etmesi gelen kutusuna teslim garantisi değildir.
- **Görseller ve takvim:** Yeni HEB amblemi, güncellenmiş marka logoları, klavye ile de kullanılabilen kaporta haritası, haftalık/günlük randevu planı ve düz fiş çıktısı eklendi.

## Ortam ve yayın

Yeni migration dosyalarını uygulama sürümünü yayımlamadan önce `npm run db:migrate` ile uygulayın. Mevcut kayıtlar korunur. Üretimde demo zenginleştirmeden önce yedek alın. `scripts/enrich-demo.ts` yalnız tanımlı kurgusal kayıtları zenginleştirmek içindir; veri sıfırlama aracı değildir.

Supabase Auth URL ayarlarında üretim adresi ve `https://HEDEF_ADRES/erisim` yönlendirmesi izinli olmalıdır. SMTP sağlayıcısı, izinli alıcılar ve gönderim limitleri Supabase tarafında yönetilir. Varsayılan e-posta şablonunun doğrulama bağlantısı oturum tokenlarını `/erisim` fragment alanına getirir; uygulama bunları çereze aktarır ve adres çubuğundan temizler. Özel token-hash/PKCE şablonu kullanılıyorsa buna uygun callback ayrıca uyarlanmalıdır.

Gerçek banka/kart tahsilatı entegrasyonu bulunmaz; tahsilat ekranı alınan ödemelerin kaydını tutar. Stok hareketi ve ödüller kalıcı PostgreSQL tablolarındadır; müşteri portalına iç notlar, müşteri puanları veya stok/ödül kayıtları gönderilmez.
