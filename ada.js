(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  let history = [], recognition = null, controller = null, busy = false, speaking = false;
  let generation = 0, listening = false, resumeTimer = null;
  const status = text => { el('adaStatus').textContent = text; el('ada').querySelector('span').textContent = 'Yapay zekâ konuğu · ' + text; };
  const line = (who, text) => {
    const row = document.createElement('p'), name = document.createElement('b');
    name.textContent = who + ': '; row.append(name, document.createTextNode(text));
    el('adaChat').append(row); el('adaChat').scrollTop = el('adaChat').scrollHeight;
  };
  function voices() {
    if (!synth) return;
    const old = el('adaVoice').value;
    el('adaVoice').replaceChildren();
    for (const v of synth.getVoices().filter(v=>v.lang.toLowerCase().startsWith('tr'))) {
      const o = document.createElement('option'); o.value = v.voiceURI; o.textContent = v.name; el('adaVoice').append(o);
    }
    if (!el('adaVoice').options.length) {
      const o = document.createElement('option'); o.textContent = 'Türkçe ses bulunamadı — yazılı yanıt'; o.value = ''; el('adaVoice').append(o);
    } else if ([...el('adaVoice').options].some(o=>o.value===old)) el('adaVoice').value = old;
  }
  voices(); if(synth) synth.addEventListener('voiceschanged', voices);
  const stopListening = () => { if(recognition) recognition.abort(); recognition=null; listening=false; el('adaListen').textContent='🎙 Konuş'; };
  function cancel() {
    generation++; clearTimeout(resumeTimer); stopListening(); controller?.abort(); controller=null;
    synth?.cancel(); busy=false; speaking=false; el('adaSend').disabled=false;
    el('ada').classList.remove('active'); status('Durduruldu.');
  }
  function resume() {
    if(el('adaContinuous').checked && !busy && !speaking && Recognition) {
      clearTimeout(resumeTimer); resumeTimer=setTimeout(startListening,700);
    }
  }
  function speak(text, ticket) {
    const voice = synth?.getVoices().find(v=>v.voiceURI===el('adaVoice').value);
    if(!voice || !el('adaSpeak').checked) { status(voice ? 'Yanıt hazır.' : 'Yanıt hazır. Cihazda Türkçe ses bulunamadı.'); return; }
    speaking=true; el('ada').classList.add('active'); status('Konuşuyor…');
    const u = new SpeechSynthesisUtterance(text); u.lang='tr-TR'; u.voice=voice; u.rate=1;
    u.onend=()=> { if(ticket!==generation)return; speaking=false; el('ada').classList.remove('active'); status('Seni dinlemeye hazır.'); resume(); };
    u.onerror=()=> { if(ticket!==generation)return; speaking=false; el('ada').classList.remove('active'); status('Ses oynatılamadı. Yanıtı aşağıdan okuyabilirsin.'); };
    synth.speak(u);
  }
  function endpoint() {
    const value=el('adaEndpoint').value.trim() || '/api/ada';
    const url=new URL(value,location.href);
    if(url.origin!==location.origin) throw Error('Bağlantı aynı site üzerindeki /api/ada adresi olmalı.');
    return url.href;
  }
  async function send(text) {
    if(busy || !text.trim()) return;
    clearTimeout(resumeTimer); stopListening(); synth?.cancel(); speaking=false;
    const ticket=++generation; busy=true; el('adaSend').disabled=true;
    const recent=history.slice(-20); const messages=[...recent,{role:'user',content:text.trim().slice(0,4000)}];
    line('Mahir',text); el('adaInput').value=''; status('Yanıt hazırlıyor…');
    controller=new AbortController(); const timeout=setTimeout(()=>controller?.abort(),60000);
    try {
      const response=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json',...(el('adaToken').value?{'Authorization':'Bearer '+el('adaToken').value}:{})},body:JSON.stringify({messages}),signal:controller.signal});
      let data; try { data=await response.json(); } catch { throw Error('Dr. Ada bağlantısı bulunamadı. Yalnızca index.html yüklemek yeterli değil; konuşma sunucusu da kurulmalı.'); }
      if(!response.ok) throw Error(data.error || 'Bağlantı hatası.');
      if(typeof data.text!=='string' || !data.text.trim()) throw Error('Boş yanıt alındı.');
      if(ticket!==generation)return;
      history=[...messages,{role:'assistant',content:data.text}];
      line('Dr. Ada',data.text); busy=false; speak(data.text,ticket);
    } catch(e) {
      if(ticket!==generation)return;
      const msg=e.name==='AbortError'?'Yanıt zaman aşımına uğradı. Yeniden dene.':e.message;
      status(msg); line('Bağlantı',msg);
    } finally {
      clearTimeout(timeout);
      if(ticket===generation) { controller=null; busy=false; el('adaSend').disabled=false; }
    }
  }
  function startListening() {
    if(!Recognition) return status('Bu tarayıcı ses tanımayı desteklemiyor. Sorunu yazarak gönder.');
    if(busy) return status('Yanıt hazırlanıyor. Sözü kesmek için Durdur düğmesini kullan.');
    if(listening) { recognition.stop(); return; }
    clearTimeout(resumeTimer); synth?.cancel(); speaking=false; el('ada').classList.remove('active');
    const r=new Recognition(); recognition=r; r.lang='tr-TR'; r.interimResults=true; r.continuous=false;
    let final='', failed=false; const ticket=generation;
    r.onstart=()=> { if(recognition!==r)return; listening=true; status('Dinliyor…'); el('adaListen').textContent='✓ Sözü bitir'; };
    r.onresult=e=> { if(recognition!==r)return; let interim=''; final=''; for(const result of e.results) { if(result.isFinal)final+=result[0].transcript+' '; else interim+=result[0].transcript; } el('adaInput').value=(final+interim).trim(); };
    r.onerror=e=> { if(recognition!==r)return; failed=true; status(({ 'not-allowed':'Mikrofon izni verilmedi. Tarayıcı izinlerini kontrol et.', 'audio-capture':'Mikrofon bulunamadı.', 'no-speech':'Ses algılanmadı. Yeniden Konuş düğmesine bas.', 'network':'Ses tanıma servisine ulaşılamadı. Yazarak devam edebilirsin.'})[e.error] || 'Ses tanıma durdu: '+e.error); };
    r.onend=()=> { if(recognition!==r)return; recognition=null; listening=false; el('adaListen').textContent='🎙 Konuş'; if(ticket!==generation || failed)return; if(final.trim())send(final); else status('Ses algılanmadı. Yeniden deneyebilirsin.'); };
    try { r.start(); } catch(e) { recognition=null; status('Mikrofon başlatılamadı: '+e.message); }
  }
  el('adaListen').onclick=startListening;
  el('adaStop').onclick=cancel;
  el('adaForm').onsubmit=e=>{e.preventDefault();send(el('adaInput').value);};
  el('adaClear').onclick=()=>{cancel();history=[];el('adaChat').replaceChildren();el('adaInput').value='';status('Yeni sohbet hazır.');};
  el('adaContinuous').onchange=()=>{if(!el('adaContinuous').checked)clearTimeout(resumeTimer);};
  el('adaSpeak').onchange=()=>{if(!el('adaSpeak').checked){synth?.cancel();speaking=false;el('ada').classList.remove('active');}};
  el('adaExport').onclick=()=>{
    const text='Konuşuyoruz da Ya Olursa? — Mahir & Dr. Ada\nDr. Ada yapay zekâ karakteridir; lisanslı hekim değildir.\n\n'+history.map(m=>(m.role==='user'?'Mahir':'Dr. Ada')+': '+m.content).join('\n\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='dr-ada-sohbet-'+new Date().toISOString().slice(0,10)+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);
  };
  document.querySelectorAll('[data-ada-prompt]').forEach(b=>b.onclick=()=>{el('adaInput').value=b.dataset.adaPrompt;el('adaInput').focus();});
  if(!Recognition) { el('adaListen').disabled=true; status('Ses tanıma desteklenmiyor; yazarak konuşabilirsin.'); }
  window.addEventListener('pagehide',cancel);
})();
