# HEB Servis · sürüm 0.5

26 Kasım 2026 geliştirmeleri ve yeni modüllerin kullanımı: [sürüm notları](RELEASE_NOTES_2026-11-26.md).

Araç Bakım ve Servis Yönetim Sistemi. Raporun mimarisi uygulanır: Next.js/TypeScript, Supabase üzerinde PostgreSQL, Supabase Auth ve özel Storage alanı. Aktif backend SQLite veya localStorage kullanmaz.

## Çalıştırma

Node.js 22.18 veya üzeri gerekir. `npm ci`, ardından `npm run dev`. Adres: http://127.0.0.1:3001/giris. Üretim çalıştırması: `npm run build`, sonra `npm start`. Kök klasördeki `HEB Servisi Ac.cmd` de uygulamayı açar.

Yönetici girişi ilk kurulumda `.env.local` içindeki `HEB_ADMIN_EMAIL` ve `HEB_ADMIN_PASSWORD` ile oluşturulur. Bu ayarları sonradan değiştirmek mevcut Auth parolasını değiştirmez. Personel hesapları Ayarlar ve personel bölümünden açılır. Müşteri kartında e-posta ve araç kaydından sonra portal hesabı açılıp şifre oluşturma e-postası gönderilebilir. Müşteri şifresini kendisi belirler; gönderim sonucu kartta izlenir.

Kurgusal ders hesapları:

| Rol | E-posta |
|---|---|
| Danışman | `selin@hebservis.test`, `burak@hebservis.test` |
| Teknisyen | `ahmet@hebservis.test`, `mehmet@hebservis.test`, `emre@hebservis.test` |
| Müşteri | `ayse.demir@ornek.test`, `mert.kaya@ornek.test` |

Kurulum sırasında bu hesaplara atanan rastgele ortak ders parolası `.work/demo-access.txt` dosyasındadır. Yönetici parolası bu dosyaya yazılmaz. `.work/`, `.env*` ve `backups/` Git'e alınmaz.

## İlk Supabase kurulumu

1. Boş bir Supabase projesi açın. `.env.example` dosyasını `.env.local` adıyla kopyalayın.
2. Proje URL, Publishable key ve sunucuya özel Secret key alanlarını doldurun.
3. Connect → Session pooler URI'sini `DATABASE_URL` alanına kopyalayın; parolayı `DATABASE_PASSWORD` alanına yazın. Ayrı parola alanı URI içindeki parola yerine kullanılır ve özel karakterler otomatik kodlanır.
4. Uygulama yöneticisi için `HEB_ADMIN_EMAIL` ve en az 10 karakterli `HEB_ADMIN_PASSWORD` belirleyin. Bu hesap, Supabase paneli veya PostgreSQL yönetici hesabından farklıdır.
5. `npm run db:check` ile bağlantıyı doğrulayın; `npm run db:setup` ile migration, ilk Auth hesapları ve kurgusal verileri oluşturun.

Kurulum yeniden çalıştırılırsa mevcut veriler korunur. Var olan başka bir uygulamanın şemasının üzerine kurulum yapmayın. Secret key ve PostgreSQL parolasını `NEXT_PUBLIC_` adıyla tanımlamayın. Bağlantı kontrolü gizli değerleri çıktılamaz.

SQL migration dosyaları `supabase/migrations/` altındadır. Uygulanmış migration değiştirilmez; sonraki değişiklik için yeni dosya eklenir. `db/schema.sql` ilk migration'ın okunabilir kopyasıdır. Supabase CLI'nin uyguladığı yerel migration'lar da kurulum komutu tarafından tanınır.

Bulut PostgreSQL bağlantısında TLS ve sunucu kimliği doğrulaması açıktır. Supabase'in herkese açık CA sertifikası `db/certs/supabase-root-2021.crt` dosyasındadır. Sertifika kaynağı: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt. Gerekirse farklı CA PEM'i `DATABASE_CA_CERT` alanıyla verilebilir; sertifika kontrolü kapatılmaz.

## Modüller

| Modül | İşlevler |
|---|---|
| Giriş ve roller | Supabase Auth, yönetici/danışman/teknisyen/müşteri yetkileri |
| Müşteri ve araç | Kayıt, iletişim, KVKK teyidi, mükerrer telefon/plaka ve VIN kontrolü |
| Randevu | Servis alanı, mesai ve mola denetimi; onay/iptal; veritabanında çakışma engeli |
| Araç kabul ve iş emri | Km, yakıt, hasar haritası, eşya, teknisyen ataması ve durum geçmişi |
| Kontrol bulguları | Uygun/takip/acil, müşteriye açık/gizli ayrımı, özel fotoğraf yükleme |
| Teklif | Parça/işçilik, miktar, indirim, KDV, sürümler ve müşteri onayı/ret |
| Tahsilat ve teslim | Kısmi/tam tahsilat kaydı, tekrar işlem engeli, bakiye ve bakım planı |
| Müşteri ilişkileri | İç notlar, düzeltme geçmişi, tüm durumlarda ziyaret ve bağımsız müşteri değerlendirmesi |
| Stok | Stok kartları, giriş/çıkış hareketleri, minimum seviye ve iş emri bağlantısı |
| Teknisyen başarıları | Kalite, dakiklik, işbirliği ve ustalık rozetleri; gerekçeli ödül geçmişi |
| Müşteri portalı | Kendi araçları, randevuları, servis takibi, teklif kararı ve açık fotoğraflar |
| Rapor ve çıktı | Tarih aralığı, hizmet/teknisyen kırılımı, CSV, A4 servis formu |
| Teknik ön değerlendirme | Kişisel bilgi almayan kural tabanlı öneriler; teknisyen teyidi |
| Yönetim | Firma, saatler, hizmetler, personel, katalog, işlem günlüğü ve yedek |

Para kuruş, miktarlar yüzde birlik tam sayı olarak tutulur; örneğin 1,5 saat = 150.

## Backend ve ilişkisel veri modeli

Müşteriler, araçlar, profiller, servis alanları, randevular, iş emirleri, durum olayları, bulgular, teklifler, teklif kalemleri, tahsilatlar, notlar, düzeltmeler, değerlendirmeler, hatırlatmalar ve işlem günlüğü ayrı PostgreSQL tablolarındadır. UUID kimlikleri ve foreign key'ler ilişki bütünlüğünü sağlar. Tek uygulama durumunu saklayan bir JSON blob tablosu yoktur. JSONB yalnız firma bilgileri ve kabuldeki hasar listesi gibi sınırlı alanlarda kullanılır.

`lib/server/repository.ts` ilişkisel kayıtlar ile arayüzün TypeScript modeli arasındaki dönüşümü yapar. `lib/server/database.ts` parametreli sorguları ve transaction'ları yönetir. İş kuralları `lib/rules.ts` içinde korunur ve sunucuda çalıştırılır.

Her yazma, `app_control` satırını `FOR UPDATE` ile kilitler. Eski sürüm `409` ile reddedilir. Çoklu işlemde bir kural bozulursa tüm SQL değişiklikleri geri alınır. `operation_keys`, aynı isteğin ikinci kez yazılmasını engeller. PostgreSQL `EXCLUDE` kısıtı onaylı randevu çakışmasını; benzersiz kısıtlar aynı randevudan ikinci iş emrini ve aynı tahsilat anahtarını engeller. Gönderilmiş teklif kalemlerini trigger kilitler.

## Kimlik ve erişim

Parolalar ve oturumlar Supabase Auth tarafından yönetilir. Node API her istekte Auth kimliğini doğrular; rolü istemcinin verdiği alandan değil aktif PostgreSQL profilinden alır. Auth çerezleri HttpOnly'dir. Yazma isteklerinde Origin denetlenir; oturum yanıtları önbelleğe alınmaz. API'ye tüm veritabanını yükleyebilen bir istemci ucu yoktur.

RLS tüm uygulama tablolarında açıktır. Public/Publishable key ile doğrudan iş verisi yazılamaz; yazmalar doğrulanan Node API üzerinden yapılır. RLS müşteriye kendi kayıtlarını, teknisyene atandığı işleri açar. İç notlar ve değerlendirmeler müşteri/teknisyen tarafından okunamaz; taslak teklifler ve gizli bulgular müşteriye kapalıdır. Sunucu yanıtı ayrıca hassas alanları süzer.

Yeni Auth hesabı oluşturulup SQL kaydı başarısız olursa bu işlemde oluşturulan Auth hesabı geri alınır. Rol/pasiflik değişiklikleri her API isteğinde yeniden değerlendirilir. Supabase erişim token'ları sağlayıcının süre/yenileme kurallarına tabidir.

## Özel fotoğraflar

`service-photos` bucket'ı public değildir. JPEG/PNG/WebP ve en fazla 5 MB kabul edilir; sunucu uzantıyla yetinmeyip dosya imzasını kontrol eder. Yükleme yetkisi aktif iş emri ve atanmış teknisyen üzerinden doğrulanır. Müşteri yalnız kendi işindeki müşteriye açık bulgunun fotoğrafını açabilir. Bağlantılar beş dakika geçerlidir. Kalıcı public fotoğraf URL'si üretilmez. Bir bulguya fotoğraf eklenebilir veya yenisi yüklenebilir.

## API

| Uç | İşlev |
|---|---|
| `POST /api/login`, `POST /api/logout` | Supabase Auth girişi ve bu tarayıcıdaki oturumu kapatma |
| `GET /api/session` | Rol kapsamındaki güncel kayıtlar ve sürüm |
| `POST /api/commands` | İzin listesindeki iş kuralları, transaction ve sürüm kontrolü |
| `POST /api/password` | Auth üzerinden yönetici parola belirleme veya mevcut parolayla kendi parolasını değiştirme |
| `POST /api/photos` | Yetkili personelin bulgu fotoğrafı yüklemesi |
| `GET /api/photos?inspectionId=...` | Yetki denetimi sonrası süreli fotoğraf URL'si |

## Yedek ve geri yükleme

`npm run backup`, `backups/postgres-.../application.json` ile iş verilerini ve `photos/` altında ilgili özel dosyaları ayrı alır. Supabase Auth parola hash'leri bu yedekte bulunmaz; parola yönetimi sağlayıcıdadır. Bu araç aynı Supabase projesindeki iş verisini geri döndürür, Auth kullanıcılarını başka projeye taşımaz.

Geri yüklemeden önce uygulama sunucusunu durdurun. Komut: `npm run restore -- YEDEK_KLASORU --confirm-restore`. Araç Auth kimliklerinin hâlâ hedef projede olduğunu doğrular, eksik fotoğrafları tamamlar, mevcut iş verisinin geri dönüş yedeğini alır ve SQL değişikliklerini transaction içinde uygular. Yalnız bakım işlemi boyunca teklif kalemi kilidi transaction içinde askıya alınır ve commit öncesi yeniden açılır; hata halinde rollback bu değişikliği de geri alır. Foreign key'ler ve diğer kısıtlar açık kalır. Normal API bu bakım işlemini çağıramaz.

## Doğrulama

| Komut | Kapsam |
|---|---|
| `npm test` | 22 iş kuralı, veri kapsamı, alan doğrulaması, fotoğraf türü ve model görseli testi |
| `npm run build` | TypeScript kontrolü ve üretim derlemesi |
| `npm run test:integration` | 5 gerçek PostgreSQL/Supabase testi: tablolar, Auth ilişkileri, RLS, rollback, eşzamanlılık ve tam servis akışı |
| `npm run test:http` | Gerçek Auth çerezleri, giriş/çıkış, rol sınırları, yeniden başlatma sonrası kalıcılık ve özel fotoğraf akışı |
| `npm run test:backup` | Değişen kaydı ve silinmiş test fotoğrafını yedekten geri getirme; kilit trigger'ının açık kaldığını doğrulama |

Entegrasyon/HTTP/geri yükleme testleri bulut projesine yazmaz; yalnız ayrı yerel Supabase ortamını kabul eder. Docker Desktop çalışırken `npx supabase start`, ardından `npm run test:local-env` çalıştırılır. PowerShell'de `$env:HEB_ENV_FILE='.env.test.local'` ayarlayıp ilgili test komutunu çalıştırın; bittiğinde `Remove-Item Env:HEB_ENV_FILE` kullanın. Bu dosya `.env.local` bulut bağlantısını değiştirmez. Yerel Studio adresi http://127.0.0.1:54323'tür.

GitHub Actions aynı kontrolleri ayrı yerel Supabase ortamında çalıştırır; bulut sırlarını gerektirmez ve uygulamayı yayımlamaz.

## Kalan yayın işleri

Mevcut Vercel adresi https://heb-servis.vercel.app . Yayında uygulama değişkenleri tanımlanmalı; Auth Site URL/redirect adresleri ve e-posta doğrulama/kurtarma teslimatı ayrıca doğrulanmalıdır. Müşteri şifre akışı için `/erisim` yönlendirmesi izinli olmalıdır. Uygulamadaki hesapları yetkili personel oluşturur.

Gerçek karttan ödeme ve otomatik SMS bağlı değildir. Tahsilat, dışarıda yapılan ödemeyi kaydeder. Müşteri şifre e-postaları Supabase Auth üzerinden gönderilir; gerçek teslim sağlayıcının SMTP ve alıcı ayarlarına bağlıdır. SQLite 0.4 dosyaları `.work/sqlite-v04/`, eski veri dosyası `data/` ve mevcut yedekler korunur; buluta otomatik taşınmaz.

Bu sürümde otomatik PostgreSQL, HTTP ve dosya testleri tamamlanmıştır. Windows tarayıcı aracındaki erişim kısıtlaması nedeniyle görsel/etkileşimli arayüz doğrulaması ayrıca yapılmalıdır.
