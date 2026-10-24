# Ya Olursa Studio 0.3 — Dr. Ada ile Türkçe konuşma

Mevcut 0.2 stüdyonun üzerine Türkçe mikrofon → yapay zekâ yanıtı → Türkçe ses akışı eklenmiştir. Kamera, medya kütüphanesi ve favoriler korunur. Tarayıcıdaki eski kütüphane aynı site adresinde korunabilir; site adresi değişirse eski depolamaya erişilemez.

Bu paket henüz canlı sitenize uygulanmadı. Bir model servisi ve mikrofon izni gerektirir. Türkçe ses, kadın sesi ve ses tanıma desteği cihaz/tarayıcıya bağlıdır. Ses tanıma desteklenmezse yazı kutusu çalışır. Gerçekçi görüntülü avatar bu sürümde yoktur.

## A. Cloudflare Pages üzerinden telefon/tablet ile konuşma

1. ZIP’i aç. `index.html`, `ada.js` ve `_worker.js` dosyaları aynı kök klasörde olsun. Bu üç dosyayı içeren klasörü mevcut Cloudflare Pages projenin yeni dağıtımına yükle. Advanced Mode `_worker.js` sürümü panelden dosya/ZIP yüklemeyi destekler. GitHub Pages yalnızca arayüzü açar; konuşma sunucusunu çalıştırmaz.
2. Google AI Studio üzerinden kendi Gemini API anahtarını oluştur: https://aistudio.google.com/api-keys . Anahtarı sohbete, GitHub’a veya HTML içine koyma.
3. Cloudflare Pages projesinin Settings → Variables and Secrets bölümünde üretim ortamı için şu değerleri tanımla:
   - `GEMINI_API_KEY`: Secret olarak API anahtarın.
   - `GEMINI_MODEL`: hesabında generateContent destekleyen, erişilebilir metin modelinin tam kimliği. AI Studio’da kullanabildiğin modelin API adını seç; `models/` önekini yazma.
   - `STUDIO_TOKEN`: Secret olarak yalnızca senin bildiğin uzun, rastgele bir stüdyo parolası. En az 24 karakter kullan.
4. Ayarları uygulamak için yeni dağıtım yap. Siteyi HTTPS adresinden aç. Dr. Ada panelinde “Bağlantı ve Türkçe ses ayarları”na stüdyo parolanı gir; konuşma adresi `/api/ada` kalsın. Bu alan API anahtarı istemez.
5. Önce “Tanışalım”a, ardından “Soruyu gönder”e bas. Yanıt geldiğinde Türkçe sesi seç. “Konuş”a basıp mikrofon izni ver. Cümlen bitince algılanan soru gönderilir; gerekirse “Sözü bitir”e bas.

Gemini’nin ücretsiz kota ve model erişimi hesap/ülke/model koşullarına bağlıdır. Bu kod ücretli plana geçiş veya ödeme başlatmaz; kota bitince hata gösterir. Ücretli bir hesabın mevcut API kullanım koşulları geçerlidir. Ücretsiz kalmak istiyorsan ücretli planı etkinleştirme. Başka kullanıcılarla stüdyo parolanı paylaşma; bu kişisel pilot sürüm, çok kullanıcılı bir yayın hizmeti değildir.

## B. Bilgisayarda ek model API ücreti olmadan: Ollama

Bu yol bilgisayarda çalışır. Telefonun `localhost` adresi bilgisayarın adresi değildir. Bilgisayarda Python 3.10+ ve Ollama gerekir; modelin hızı bilgisayarına bağlıdır.

1. https://ollama.com/download üzerinden Ollama’yı kur ve aç.
2. Terminalde `ollama pull gemma3:4b` ile modeli indir. İndirme birkaç GB olabilir.
3. Bu klasörde terminal açıp `python3 server.py` çalıştır. Windows’ta `python server.py` kullanılabilir.
4. Aynı bilgisayarın tarayıcısında http://localhost:8765 adresini aç. Chrome ile mikrofon ve Türkçe ses denemesi yap.

Sunucu varsayılan olarak Ollama’nın ilk yüklü modelini kullanır. Belirli bir model için Mac/Linux’ta `OLLAMA_MODEL=gemma3:4b python3 server.py` çalıştır. Dış ağa açılmaz; yalnızca 127.0.0.1’e bağlanır. Ek Python paketi gerekmez. İnternet kullanan tarayıcı ses tanıma hizmeti nedeniyle sesli girişin tamamen çevrimdışı olduğu garanti edilmez.

Yerel sunucuda Gemini kullanmak istersen ortamda `ADA_PROVIDER=gemini`, `GEMINI_API_KEY` ve `GEMINI_MODEL` tanımla. Anahtarları dosyaya veya komut geçmişine yazmak yerine işletim sisteminin ortam değişkeni yönetimini kullan.

## Konuşma ve podcast kaydı

- “Sözü kes / Durdur”: dinlemeyi, bekleyen yanıtı ve seslendirmeyi durdurur.
- “Ada bitirince yeniden dinle”: sesli yanıt tamamlanınca sıradaki sözünü dinler. Başlangıçta kapalıdır; hata oluşunca kendiliğinden tekrar denemez.
- “Sohbet metnini indir”: tamamlanmış soru ve yanıtları TXT olarak indirir.
- “Yeni sohbet”: mevcut konuşma bağlamını temizler.
- Türkçe ses yoksa yanıt yazılı gösterilir. Cihazın dil/konuşma ayarlarından Türkçe ses eklemen gerekebilir. Tarayıcı sesi, gerçekçi kadın avatar sesi değildir.
- Kameradaki kayıt düğmesi önceki sürümdeki gibi yalnızca kamera ve mikrofonu kaydeder. Dr. Ada sesi ve medya oynatıcısı sesi bu kayda otomatik girmez. Yayın öncesi ayrı bir kayıt ve ses testi gerekir; kulaklıkla yankıyı azaltabilirsin.
- Konuşmalar kalıcı olarak sunucuda saklanmaz. Sayfa yenilenince sohbet kaybolur. Tarayıcı/servis sağlayıcının kendi veri işleme koşulları ayrıca geçerlidir.

## Doğrulama kapsamı

Kodun sözdizimi, mesaj biçimi, kimlik doğrulama ve sunucu hata durumları kontrollü testlerle doğrulandı. İstemci mantığı, taklit DOM ve ses tanıma olaylarıyla test edildi. Tarayıcı kurulumu bu ortamda başarısız olduğu için görsel/mobil tarayıcı testi tamamlanamadı. Gerçek API anahtarı, fiziksel mikrofon ve cihazın Türkçe sesi bu ortamda test edilmedi. Canlı API entegrasyonu için yukarıdaki bağlantı kurulmalıdır.

## Teknik kaynaklar

- Gemini generateContent ve kimlik doğrulama: https://ai.google.dev/api
- API anahtarlarının sunucuda tutulması: https://ai.google.dev/gemini-api/docs/generate-content/api-key
- Cloudflare yükleme ve `_worker.js`: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Ollama Gemma 3 modeli ve sohbet API örneği: https://ollama.com/library/gemma3
