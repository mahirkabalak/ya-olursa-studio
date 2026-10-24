const SYSTEM = `Sen Dr. Ada adlı Türkçe konuşan yapay zekâ bilim konuğusun. Sunucu Murat Mahir Kabalak; program Konuşuyoruz da Ya Olursa? OSTİM Radyo. Kendini gerçek veya lisanslı hekim olarak tanıtma. İlk yanıtta kısaca yapay zekâ olduğunu belirt. Sıcak, doğal, meraklı bir podcast konuğu ol; Mahir diye hitap edebilirsin. Yanıtları genellikle 2–4 kısa cümle tut, liste ve markdown kullanma. Sohbetin bağlamını izle. Tıbbi iddialarda temkinli ol; kaynak veya sayı uydurma, kişisel teşhis veya ilaç dozu verme. Acil tehlike anlatılırsa acil yardım öner. Sağlık dışında bilim ve teknoloji hakkında da konuşabilirsin. Gerçek insan, görüntülü avatar veya canlı yayın bağlantın olduğunu iddia etme.`;

export function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 24) throw Error('1–24 mesaj gerekli.');
  let total = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || m.role !== (i % 2 ? 'assistant' : 'user') || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 4000) throw Error('Mesaj biçimi geçersiz.');
    total += m.content.length;
  }
  if (messages.at(-1).role !== 'user' || total > 24000) throw Error('Konuşma çok uzun veya son mesaj geçersiz.');
  return messages.map(m => ({ role: m.role, content: m.content.trim() }));
}

export async function onRequestPost({ request, env }) {
  const reply = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return reply({error:'Bu kaynağa izin yok.'},403);
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL || !env.STUDIO_TOKEN) return reply({error:'Dr. Ada henüz bağlanmadı. Sunucuda GEMINI_API_KEY, GEMINI_MODEL ve STUDIO_TOKEN ayarlanmalı.'},503);
  if (request.headers.get('Authorization') !== `Bearer ${env.STUDIO_TOKEN}`) return reply({error:'Stüdyo parolası eksik veya hatalı.'},401);
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return reply({error:'JSON gerekli.'},415);
  try {
    const raw = await request.text();
    if (raw.length > 40000) return reply({error:'İstek çok büyük.'},413);
    const messages = validateMessages(JSON.parse(raw).messages);
    if (!/^[a-zA-Z0-9._-]+$/.test(env.GEMINI_MODEL)) return reply({error:'Model adı geçersiz.'},503);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`, {
      method:'POST', signal:AbortSignal.timeout(45000),
      headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
      body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),generationConfig:{maxOutputTokens:700,temperature:0.65}})
    });
    if (!response.ok) return reply({error: response.status===429 ? 'Servis kotası doldu. Biraz sonra tekrar dene.' : 'Yapay zekâ servisi yanıt vermedi. Model ve anahtar ayarını kontrol et.'},502);
    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || []).filter(p=>!p.thought).map(p=>p.text || '').join('').trim();
    if (!text) return reply({error:'Servis metin üretemedi. Sorunu yeniden ifade et.'},502);
    return reply({text});
  } catch(e) {
    if(e instanceof SyntaxError || /mesaj|Mesaj|Konuşma/.test(e.message)) return reply({error:'Konuşma verisi geçersiz.'},400);
    return reply({error:'Bağlantı kurulamadı veya zaman aşımına uğradı.'},502);
  }
}

// Cloudflare Pages Advanced Mode: also works with dashboard ZIP upload.
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if(path === '/api/ada') {
      if(request.method !== 'POST') return Response.json({error:'POST gerekli.'},{status:405});
      return onRequestPost({request,env});
    }
    if(!['GET','HEAD'].includes(request.method) || !['/','/index.html','/ada.js'].includes(path)) return new Response('Bulunamadı.',{status:404});
    return env.ASSETS.fetch(request);
  }
};
