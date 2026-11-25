# Tasarım A — İş Panosu

**Dayandığı ürün:** Tekmetric (Job Board + tek sayfalık Repair Order). Servis danışmanı güne panoyla başlar, her şey iş emri kartından açılır.

## Görsel dil
- Açık gri zemin (`#F6F7F9`), beyaz kartlar, **beyaz 220 px sol menü**; seçili öğede solda 3 px lacivert çizgi ve açık mavi zemin.
- Tek vurgu rengi lacivert `#1E4E8C` (hover `#173E70`). Gradyan, emoji, slogan yok; logo yalnız yazı ("HEB Servis").
- Yazı: Inter (gövde 14 px, tablo 13 px, sayfa başlığı 20 px/600); plaka, iş emri no ve kodlar IBM Plex Mono.
- Durum renkleri tek yerde (`--st-*` değişkenleri): Kabul gri, Onay bekliyor koyu sarı, Serviste mavi, Hazır yeşil, Teslim koyu gri; Acil/gecikme kırmızı. Koyu tema aynı değişken adlarıyla korunur.
- Araç görselleri `CarImage` / `Plate` / `VehicleCell` ile (kodla çizim yok).

## Menü (6 öğe + altta Ayarlar)
`Pano · Randevular · İş Emirleri · Müşteriler · Stok · Raporlar` — alt köşede `Ayarlar` (yalnız yönetici) ve kullanıcı.
Üst çubuk: genel arama (Ctrl K), **Asistan** düğmesi (`/yapay-zeka`), **+ Yeni iş emri**, tema.
Teknisyen menüsü: Pano · İş Emirleri · Araçlar. Tüm öğeler `can(actor, …)` ile süzülür.

## Kaldırılan / birleştirilen sayfalar (işlev kaybı yok)
| Eski menü | Yeni yeri |
|---|---|
| Genel bakış + Atölye panosu | **Pano** (sayaçlar + kanban). `/atolye` → `/` yönlendirir |
| Teklif onayları | **İş Emirleri › "Onay bekliyor" filtresi** (teklif sürümü, gönderim, bekleme süresi sütunları); pano sayacı. `/teklifler` → `/is-emirleri?filtre=onay` |
| Tahsilat | Açık bakiyeler: **İş Emirleri › "Açık bakiye" filtresi** (Tahsil et düğmesiyle); dönem hareketleri: **Raporlar › Tahsilat** alt sekmesi; iş emri sağ paneli "Ödeme al" |
| Bakım hatırlatmaları | **Müşteriler › Bakım hatırlatmaları** alt sekmesi + pano uyarı satırı |
| Araçlar | **Müşteriler › Araçlar** alt sekmesi; müşteri kartında ilk sekme Araçlar |
| Parça ve işçilik | **Stok** |
| İşlem günlüğü | **Ayarlar › İşlem günlüğü** alt sekmesi |
| Yapay zekâ asistanı | Üst çubuktaki **Asistan** düğmesi + iş emri Muayene bölümünde "Asistandan kontrol listesi öner" |

Eski adresler çalışmaya devam eder; komut paletinde (Ctrl K) "Teklif onayları", "Tahsilat", "Bakım hatırlatmaları", "İşlem günlüğü" ile de bulunur.

## Ekran ekran
- **Pano:** 4 sayaç (Bugün kabul, Onay bekleyen, Serviste, Teslime hazır; her biri ilgili listeye gider). Altında tek satır uyarılar (geciken iş, randevu talebi, bakım hatırlatması, açık bakiye). 5 sütunlu kanban: Kabul/Teklif · Onay bekliyor · Serviste · Hazır · Teslim (bugün). "Parça bekliyor", "Son kontrol", "Acil bulgu", "Gecikti", "Teklif taslağı" sütun değil kart etiketi. Kartta plaka, model illüstrasyonu, marka/model, müşteri, iş emri no, teknisyen baş harfleri, söz verilen saat, tutar. Teknisyen filtresi ve Pano/Liste geçişi. Teknisyen yalnız kendi kartlarını görür. 1280 px altında Teslim sütunu gizlenip altta bağlantı olur; 1023 px altında sütunlar yatay kaydırılır.
- **İş Emirleri (liste):** filtre çipleri Açık · Onay bekliyor · Serviste · Hazır · Gecikenler · Açık bakiye · Teslim edildi · İptal · Tümü (adres `?filtre=` ile paylaşılabilir); teknisyen seçimi, arama. Satır tıklanınca iş emri açılır.
- **İş emri:** sekmeler kaldırıldı, tek sayfa. Başlıkta büyük plaka, araç, durum, müşteri, telefon, hizmet, söz verilen saat; sağda **duruma göre tek ana eylem** (Muayeneye başla → Teklif hazırla / Onaya gönder → Onayı kaydet / İşe başla → Son kontrole al → Hazır → Tahsil et / Teslim et → Ziyareti değerlendir; Parça bekliyor'da "Parça geldi, işe devam") ve diğer tüm izinli geçişler, servis formu ve iptal için "Diğer" menüsü. Gövde 4 numaralı bölüm: 1) Şikâyet ve kabul (km, yakıt, hasar haritası) 2) Muayene (yeşil/sarı/kırmızı sayaç, satır içi bulgu ekleme, isteğe bağlı asistan önerisi) 3) İşler ve parçalar (teklif kalemleri, sürümler, onay/ret kaydı, müşteriye iletme) 4) Notlar ve geçmiş (iç notlar + durum geçmişi). Sağda yapışkan panel: parça/işçilik/ara toplam/KDV/genel toplam, onaylı iş, tahsil edilen, kalan, "Ödeme al", tahsilat satırları; altında araç görseli ve sorumlular (teknisyen değiştirme).
- **Müşteriler / Araçlar / Hatırlatmalar:** tek başlık altında alt sekmeler. Açıklama metinleri kısaltıldı.
- **Stok:** eski fiyat listesi, yeni ad ve kısa alt başlıkla.
- **Raporlar / Tahsilat:** alt sekmeler; A4 belge, PDF ve CSV aynen korunur.
- **Ayarlar / İşlem günlüğü:** alt sekmeler.
- **Randevular, Asistan, Giriş, Portal, Servis formu:** yapı korunarak yeni renk, yazı ve logo diline geçti.

## Bilinen eksikler
- Kanban kartları sürükle-bırak ile taşınmaz; durum değişikliği iş emri başlığındaki ana eylemle yapılır (iş kuralları geçiş kısıtlarını koruduğu için bilinçli tercih).
- Kartlarda Tekmetric'teki "teklif görüldü" göz ikonu yok (veri modelinde görüntüleme kaydı tutulmuyor).
- "Stok" yalnız parça/işçilik fiyat listesidir; depo miktarı ve kritik stok takibi veri modelinde olmadığı için eklenmedi.
- Pano/Liste geçişi ayrı adreslere gider (`/` ve `/is-emirleri`); seçilen teknisyen filtresi iki görünüm arasında taşınmaz.
- Portal ve giriş ekranlarında yerleşim değiştirilmedi, yalnız görsel dil uyarlandı.
