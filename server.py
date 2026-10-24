"""Yerel Dr. Ada sunucusu. Python 3.10+, ek Python paketi gerektirmez."""
import json
import os
import re
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SYSTEM = """Sen Dr. Ada adlı Türkçe konuşan yapay zekâ bilim konuğusun. Sunucu Murat Mahir Kabalak, program Konuşuyoruz da Ya Olursa? OSTİM Radyo. İlk yanıtında yapay zekâ olduğunu kısaca belirt, lisanslı hekim olduğunu iddia etme. Doğal, sıcak ve bilimsel konuş. Yanıtın genellikle 2–4 kısa cümle olsun, markdown kullanma. Konuşmanın bağlamını izle. Kaynak, sayı veya yetenek uydurma; kişisel teşhis ve ilaç dozu verme. Acil tehlikede acil yardım öner. Sağlık, bilim ve teknoloji hakkında konuşabilirsin."""

def validate(messages):
    if not isinstance(messages, list) or not 1 <= len(messages) <= 24:
        raise ValueError('1–24 mesaj gerekli.')
    for i, m in enumerate(messages):
        if not isinstance(m, dict) or m.get('role') != ('assistant' if i % 2 else 'user') or not isinstance(m.get('content'), str) or not m['content'].strip() or len(m['content']) > 4000:
            raise ValueError('Mesaj biçimi geçersiz.')
    if messages[-1]['role'] != 'user' or sum(len(m['content']) for m in messages) > 24000:
        raise ValueError('Konuşma çok uzun veya son mesaj geçersiz.')
    return messages

def remote(url, payload=None, headers=None):
    req = urllib.request.Request(url, data=None if payload is None else json.dumps(payload).encode(), headers={'Content-Type':'application/json', **(headers or {})})
    # Loopback requests must not pass through a machine's external proxy.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({})) if url.startswith('http://127.0.0.1:11434/') else urllib.request.build_opener()
    with opener.open(req, timeout=50) as result:
        return json.load(result)

def generate(messages):
    if os.getenv('ADA_PROVIDER', 'ollama') == 'gemini':
        key, model = os.getenv('GEMINI_API_KEY'), os.getenv('GEMINI_MODEL')
        if not key or not model or not re.fullmatch(r'[A-Za-z0-9._-]+', model):
            raise ValueError('GEMINI_API_KEY ve GEMINI_MODEL ayarlanmalı.')
        data = remote(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', {
            'systemInstruction':{'parts':[{'text':SYSTEM}]},
            'contents':[{'role':'model' if m['role']=='assistant' else 'user','parts':[{'text':m['content']}]} for m in messages],
            'generationConfig':{'maxOutputTokens':700,'temperature':0.65}
        }, {'x-goog-api-key':key})
        parts = (data.get('candidates') or [{}])[0].get('content', {}).get('parts', [])
        text = ''.join(p.get('text','') for p in parts if not p.get('thought')).strip()
    else:
        model = os.getenv('OLLAMA_MODEL')
        if not model:
            models = remote('http://127.0.0.1:11434/api/tags').get('models', [])
            if not models:
                raise ValueError('Ollama üzerinde yüklü model yok. Önce Türkçe destekleyen bir sohbet modeli yükle.')
            model = models[0]['name']
        data = remote('http://127.0.0.1:11434/api/chat', {'model':model,'stream':False,'messages':[{'role':'system','content':SYSTEM},*messages]})
        text = data.get('message', {}).get('content', '').strip()
    if not text:
        raise ValueError('Yapay zekâ boş yanıt verdi; tekrar dene.')
    return text

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def json_reply(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split('?')[0] not in ('/', '/index.html', '/ada.js'):
            return self.json_reply(404, {'error':'Bulunamadı.'})
        return super().do_GET()

    def do_POST(self):
        if self.path != '/api/ada':
            return self.json_reply(404, {'error':'Bulunamadı.'})
        port = self.server.server_port
        if self.headers.get('Host') not in (f'localhost:{port}', f'127.0.0.1:{port}'):
            return self.json_reply(403, {'error':'Yalnızca yerel erişim.'})
        if self.headers.get('Origin') not in (None, f'http://localhost:{port}', f'http://127.0.0.1:{port}'):
            return self.json_reply(403, {'error':'Bu kaynağa izin yok.'})
        if not self.headers.get('Content-Type','').startswith('application/json'):
            return self.json_reply(415, {'error':'JSON gerekli.'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 40000:
                return self.json_reply(413, {'error':'İstek boyutu geçersiz.'})
            messages = validate(json.loads(self.rfile.read(size)).get('messages'))
            return self.json_reply(200, {'text':generate(messages)})
        except (ValueError, AttributeError) as e:
            return self.json_reply(400, {'error':str(e)})
        except urllib.error.HTTPError as e:
            return self.json_reply(502, {'error': 'Servis kotası doldu.' if e.code == 429 else 'Model servisi yanıt vermedi. Ayarları kontrol et.'})
        except (OSError, TimeoutError):
            return self.json_reply(503, {'error':'Dr. Ada modeline ulaşılamadı. Yerel kullanımda Ollama açık ve model yüklü olmalı; alternatif Gemini kurulumu KURULUM.md içinde.'})

if __name__ == '__main__':
    port = int(os.getenv('PORT','8765'))
    print(f'Dr. Ada: http://localhost:{port} — Ctrl+C ile durdur.', flush=True)
    ThreadingHTTPServer(('127.0.0.1',port), Handler).serve_forever()
