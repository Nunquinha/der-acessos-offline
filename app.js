import {config, TEST_MODE} from './config.js';
import {PHOTO_LABELS, road, duplicate, validate, deliver} from './core.js';
import {database, getDraft, saveDraft, allRecords, commitRecord, updateRecord} from './storage.js';
const aliases={survey:'form',capture:'public-app',save:'submit',message:'error',maps:'map-link'};
const $ = id => document.getElementById(aliases[id]||id), form = $('survey');
const photos = [null,null,null], photoUrls = [null,null,null];
let ready=false, saving=false, pending=0, syncRunning=false, recordId=crypto.randomUUID(), step=0;
let writes=Promise.resolve(), photoWork=Promise.resolve(), installPrompt;
function message(text, error=false) { $('message').hidden=false; $('message').classList.remove('hidden'); $('message').textContent=text; $('message').classList.toggle('error',error); }
function showStep(){
  document.querySelectorAll('.panel').forEach((panel,i)=>panel.classList.toggle('hidden',i!==step));
  document.querySelectorAll('.step').forEach((node,i)=>{
    node.classList.toggle('current',i===step);node.classList.toggle('done',i<step);
    if(i===step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');
  });
  $('back').classList.toggle('hidden',step===0);$('next').classList.toggle('hidden',step===3);$('save').classList.toggle('hidden',step!==3);
  if(step===3){
    const labels={responsavel:'Responsável pelo cadastro',natureza:'Natureza jurídica',municipio:'Município',rodovia:'Rodovia',km:'Quilômetro',lado:'Lado',latitude:'Latitude',longitude:'Longitude',observacoes:'Observações'},values=data();
    $('review').replaceChildren();
    for(const [key,label]of Object.entries(labels)){
      const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=values[key]||'Não informado';div.append(dt,dd);$('review').append(div);
    }
    $('review-photos').replaceChildren();
    photoUrls.forEach((url,i)=>{if(url){const img=new Image();img.src=url;img.alt=PHOTO_LABELS[i];img.className='preview-photo';$('review-photos').append(img);}});
  }
}
function advance(){
  if(pending){message('Aguarde a preparação das fotos.',true);return;}
  const panel=document.querySelector('.panel[data-panel="'+step+'"]');
  for(const input of panel.querySelectorAll('input,select,textarea'))if(!input.reportValidity())return;
  if(step===1){try{form.elements.rodovia.value=road(form.elements.rodovia.value);}catch(error){message(error.message,true);return;}}
  if(step===2 && photos.some(photo=>!photo)){message('As três fotos são obrigatórias: frontal, lado direito e lado esquerdo.',true);return;}
  if(step<3){step++;showStep();window.scrollTo({top:0,behavior:'smooth'});}
}
$('next').onclick=advance;$('back').onclick=()=>{if(step>0){step--;showStep();}};
function data() { return Object.fromEntries(new FormData(form)); }
function buttons() { $('save').disabled=!ready || saving || pending>0; $('sync').disabled=!config.endpoint || !navigator.onLine || syncRunning; }
function map() {
  const d=data(), lat=Number(d.latitude.replace(',','.')), lon=Number(d.longitude.replace(',','.'));
  $('maps').hidden=!d.latitude.trim() || !d.longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180;
  if(!$('maps').hidden) $('maps').href=`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}
function draft() {
  if(!ready || saving) return writes;
  const snapshot={recordId,data:data(),photos:[...photos],updatedAt:new Date().toISOString()};
  $('draft-status').textContent='Guardando rascunho neste celular…';
  writes=writes.catch(()=>{}).then(()=>saveDraft(snapshot)).then(()=>{
    $('draft-status').textContent='Rascunho guardado neste celular.';
  }).catch(error=>{
    $('draft-status').textContent='Rascunho não gravado. Mantenha esta tela aberta.';
    message('Não foi possível guardar o rascunho: '+error.message,true);
    throw error;
  });
  // A falha permanece visível; o próximo salvamento pode tentar novamente.
  writes.catch(()=>{});
  return writes;
}
form.addEventListener('input',()=>{map();draft();});
form.addEventListener('change',()=>{map();draft();});
form.elements.rodovia.addEventListener('blur',()=>{
  try{form.elements.rodovia.value=road(form.elements.rodovia.value);draft();}catch{}
});
function drawPhoto(index) {
  const node=$('photo-'+index), label=node.querySelector('label');
  if(photoUrls[index]) URL.revokeObjectURL(photoUrls[index]);
  photoUrls[index]=photos[index] ? URL.createObjectURL(photos[index]) : null;
  label.replaceChildren();
  if(photos[index]){const img=new Image();img.src=photoUrls[index];img.alt=PHOTO_LABELS[index];label.append(img);}
  else{const plus=document.createElement('span');plus.className='plus';plus.textContent='+';const title=document.createElement('span');title.textContent='Foto '+(index+1)+' — '+PHOTO_LABELS[index]+' *';title.style.textAlign='center';const small=document.createElement('small');small.textContent='Adicionar imagem';label.append(plus,title,small);}
  const status=node.querySelector('.photo-size');status.hidden=!photos[index];status.textContent=photos[index] ? 'Foto guardada · '+Math.round(photos[index].size/1024)+' KB' : '';
}
async function prepare(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('Escolha JPG, PNG ou WebP. Se a câmera gerar HEIC/HEIF, altere para JPG.');
  if(file.size>30*1024*1024) throw Error('A foto tem mais de 30 MB. Reduza a resolução da câmera.');
  const url=URL.createObjectURL(file), image=new Image();
  try{
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('A foto demorou para abrir. Selecione novamente.')),30000);
      image.onload=()=>{clearTimeout(timer);resolve();};
      image.onerror=()=>{clearTimeout(timer);reject(Error('A imagem não abriu. Escolha outra foto.'));};
      image.src=url;
    });
    if(!image.naturalWidth || !image.naturalHeight) throw Error('Foto vazia ou danificada.');
    if(file.size<=1536*1024 && Math.max(image.naturalWidth,image.naturalHeight)<=2048) return file;
    const canvas=document.createElement('canvas'), ratio=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight));
    canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio)); canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
    const ctx=canvas.getContext('2d'); if(!ctx) throw Error('Não foi possível preparar esta foto.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    let blob;
    for(const quality of [.86,.76,.66]) {
      blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      if(blob && blob.size<=1536*1024) break;
    }
    canvas.width=canvas.height=1;
    if(!blob || blob.size>5*1024*1024) throw Error('Não foi possível reduzir a foto. Escolha outra imagem.');
    return blob;
  } finally{image.onload=image.onerror=null;image.src='';URL.revokeObjectURL(url);}
}
PHOTO_LABELS.forEach((label,index)=>{
  const box=document.createElement('div');box.className='photo';box.id='photo-'+index;
  const title=document.createElement('label');title.htmlFor='file-'+index;title.textContent='Foto '+(index+1)+' — '+label;
  const input=document.createElement('input');input.id='file-'+index;input.type='file';input.accept='image/jpeg,image/png,image/webp';
  const note=document.createElement('small');note.className='photo-size';note.hidden=true;
  input.onchange=()=>{
    const file=input.files[0];if(!file)return;
    pending++;input.disabled=true;box.dataset.processing='true';buttons();note.hidden=false;note.textContent='Preparando foto…';
    photoWork=photoWork.catch(()=>{}).then(async()=>{
      try{photos[index]=await prepare(file);drawPhoto(index);await draft();}
      catch(error){drawPhoto(index);message('Foto '+(index+1)+': '+error.message,true);}
      finally{pending--;input.disabled=false;input.value='';delete box.dataset.processing;buttons();}
    });
  };
  box.append(title,input,note);$('photos').append(box);drawPhoto(index);
});
$('gps').onclick=()=>{
  if(!navigator.geolocation){message('Este navegador não oferece localização. Preencha as coordenadas manualmente.',true);return;}
  $('gps').disabled=true;$('gps-status').textContent='Buscando posição do celular…';
  navigator.geolocation.getCurrentPosition(position=>{
    form.elements.latitude.value=position.coords.latitude.toFixed(7);
    form.elements.longitude.value=position.coords.longitude.toFixed(7);
    $('gps-status').textContent='Precisão estimada: '+Math.round(position.coords.accuracy)+' metros. Confira se está alinhado ao eixo do acesso.';
    $('gps').disabled=false;map();draft();
  },error=>{
    $('gps').disabled=false;$('gps-status').textContent=error.code===1?'Localização não autorizada. Libere a permissão no navegador ou informe as coordenadas.':'Não foi possível obter a posição. Aguarde em local aberto e tente novamente ou informe as coordenadas.';
  },{enableHighAccuracy:true,maximumAge:0,timeout:30000});
};
form.addEventListener('submit',async event=>{
  event.preventDefault();if(saving || pending || !ready)return;
  if(step!==3){advance();return;}
  saving=true;buttons();
  try{
    const normalized=validate(data(),photos);
    const record={id:recordId, data:normalized, photos:[...photos], createdAt:new Date().toISOString(),state:'pending'};
    // Aguarda as gravações anteriores antes de limpar o rascunho na mesma transação do novo registro.
    await writes.catch(()=>{});
    const existing=await allRecords(), found=duplicate(record,existing);
    if(found) throw Error('Já existe neste celular um acesso a até 5 metros no mesmo lado. Confira os cadastros guardados.');
    await commitRecord(record);
    const name=form.elements.responsavel.value;
    form.reset();form.elements.responsavel.value=name;
    photos.fill(null);PHOTO_LABELS.forEach((_,i)=>drawPhoto(i));recordId=crypto.randomUUID();map();
    $('draft-status').textContent='';step=0;showStep();
    message('Acesso guardado neste celular com as três fotos. Você já pode cadastrar outro. O envio ainda precisa ser confirmado pelo sistema.');
    await render();
    if(navigator.onLine && config.endpoint) sync();
  } catch(error){message(error.message+' Os dados continuam nesta tela.',true);}
  finally{saving=false;buttons();}
});
async function render() {
  const records=await allRecords();records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $('count').textContent=records.filter(r=>r.state!=='sent').length;
  $('records').replaceChildren();
  if(!records.length){const p=document.createElement('p');p.textContent='Nenhum acesso guardado neste celular.';$('records').append(p);}
  for(const record of records){
    const card=document.createElement('article');card.className='record';
    const title=document.createElement('h3');title.textContent='SP '+record.data.rodovia+' · km '+record.data.km+' · '+record.data.municipio;
    const state=document.createElement('span');state.className='state '+record.state;
    state.textContent=record.state==='sent'?'Enviado · '+record.protocol:record.state==='conflict'?'Conferência necessária':'Pendente de envio';
    const details=document.createElement('p');details.textContent=record.data.lado+' · '+record.data.responsavel+' · '+new Date(record.createdAt).toLocaleString('pt-BR')+' · 3 fotos';
    const coords=document.createElement('p');coords.textContent=record.data.latitude+', '+record.data.longitude;
    const note=document.createElement('p');note.textContent=record.error || '';
    card.append(title,state,details,coords,note);$('records').append(card);
  }
  $('sync-info').textContent=config.endpoint ? 'Com sinal, os pendentes serão enviados enquanto este aplicativo estiver aberto.' : TEST_MODE ? 'TESTE LOCAL ISOLADO — nenhum registro desta área será enviado. O armazenamento é separado dos levantamentos reais.' : 'Envio ainda não conectado ao sistema. Os cadastros ficam somente neste celular. Esta versão não está liberada para uso em campo.';
}
function chooseTab(queue) {
  $('capture').hidden=queue;$('queue').hidden=!queue;
  $('tab-form').toggleAttribute('aria-current',!queue);$('tab-queue').toggleAttribute('aria-current',queue);
  if(!queue)$('tab-form').setAttribute('aria-current','page');else $('tab-queue').setAttribute('aria-current','page');
  if(queue)render().catch(error=>message(error.message,true));
  if($('queue-mobile'))$('queue-mobile').textContent=queue?'Novo cadastro':'Cadastros neste celular';
}
$('tab-form').onclick=event=>{event.preventDefault();chooseTab(false);};$('tab-queue').onclick=event=>{event.preventDefault();chooseTab(true);};
if($('queue-mobile'))$('queue-mobile').onclick=()=>chooseTab(!$('capture').hidden);
async function base64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}
async function transport(record){
  // Nunca usa no-cors: uma resposta ilegível não comprova que o servidor guardou os dados.
  const url=new URL(config.endpoint);
  if(url.protocol!=='https:')throw Error('O endereço de envio precisa usar HTTPS.');
  const payload={version:1,clientId:record.id,capturedAt:record.createdAt,data:record.data,photos:[]};
  for(let i=0;i<3;i++)payload.photos.push({slot:i,mimeType:record.photos[i].type,base64:await base64(record.photos[i])});
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),120000);
  try{
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload),signal:controller.signal,credentials:'omit',cache:'no-store'});
    if(!response.ok)throw Error('Falha de comunicação. O cadastro segue guardado.');
    return await response.json();
  }finally{clearTimeout(timer);}
}
async function sync(){
  if(syncRunning || !navigator.onLine || !config.endpoint)return;
  // Sem exclusão entre abas, não iniciamos tentativas concorrentes neste dispositivo.
  if(!navigator.locks){message('Use uma versão atual do Chrome ou Safari para sincronizar com segurança.',true);return;}
  syncRunning=true;buttons();
  try{
    await navigator.locks.request('der-campo-sync',{ifAvailable:true},async lock=>{
      if(!lock)return;
      for(const record of (await allRecords()).filter(r=>r.state==='pending')){
        if(!navigator.onLine)break;
        try{await updateRecord(await deliver(record,transport));}
        catch(error){await updateRecord({...record,error:'Envio não confirmado. Tente novamente com sinal. '+error.message});break;}
        await render();
      }
    });
  }catch(error){message('Não foi possível enviar agora: '+error.message,true);}
  finally{syncRunning=false;buttons();await render();}
}
$('sync').onclick=sync;
if($('check'))$('check').onclick=async()=>{
  $('check').disabled=true;$('check-status').textContent='Verificando…';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
    if(!config.endpoint)throw Error('Envio ainda não configurado.');
    const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({version:1,type:'health'}),signal:controller.signal,credentials:'omit',cache:'no-store'});
    const result=await response.json();
    if(!response.ok||result?.ok!==true||result.service!=='der-offline')throw Error('Resposta não reconhecida.');
    $('check-status').textContent='Conexão com o sistema confirmada. Nenhum cadastro foi enviado neste teste.';
  }catch(error){$('check-status').textContent='Conexão não confirmada. Os cadastros permanecem neste celular. '+error.message;}
  finally{clearTimeout(timer);$('check').disabled=false;}
};
if($('clear-draft'))$('clear-draft').onclick=async()=>{
  if(saving||pending)return;
  if(!confirm('Limpar somente o rascunho em preenchimento? Os acessos já guardados não serão alterados.'))return;
  form.reset();photos.fill(null);PHOTO_LABELS.forEach((_,i)=>drawPhoto(i));recordId=crypto.randomUUID();map();step=0;showStep();
  await draft().catch(()=>{});
};
function connection(){ $('connection').textContent=navigator.onLine?'Conexão disponível':'Sem internet · salvamento local';buttons(); }
window.addEventListener('online',()=>{connection();sync();});window.addEventListener('offline',connection);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){render().catch(()=>{});sync();}});
setInterval(()=>{if(document.visibilityState==='visible')sync();},60000);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('install').hidden=false;});
$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('install').hidden=true;}};
async function prepareOffline(){
  if(!('serviceWorker' in navigator)){ $('offline-ready').textContent='Este navegador não pode instalar o modo offline.';return; }
  try{
    const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
    registration.update().catch(()=>{});
    const worker=registration.installing || registration.waiting || registration.active;
    const mark=()=>{
      if(worker?.state==='activated' || registration.active){
        $('offline-ready').textContent='Aplicativo disponível sem internet neste celular';
        $('ready-detail').textContent='No Android: menu do Chrome → Instalar aplicativo. No iPhone: Compartilhar no Safari → Adicionar à Tela de Início. Abra uma vez pelo ícone com sinal antes de sair.';
      }
    };
    if(worker)worker.addEventListener('statechange',mark);mark();
  }catch{
    $('offline-ready').textContent='Preparação offline não concluída';
    $('ready-detail').textContent='Conecte-se à internet e reabra este endereço HTTPS. Não saia para o campo antes da confirmação.';
  }
}
try{
  await database();const saved=await getDraft();
  if(saved){
    recordId=saved.recordId || recordId;
    for(const [key,value] of Object.entries(saved.data || {})) if(form.elements[key])form.elements[key].value=value;
    for(let i=0;i<3;i++)photos[i]=saved.photos?.[i] || null;
    PHOTO_LABELS.forEach((_,i)=>drawPhoto(i));
    $('draft-status').textContent='Rascunho recuperado deste celular.';
  }
  ready=true;map();connection();showStep();await render();prepareOffline();
  if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  if(!config.endpoint)message(TEST_MODE ? 'TESTE LOCAL ISOLADO: nenhum cadastro será enviado. Não use esta área para levantamentos reais.' : 'Versão de preparação: o envio ao sistema ainda não foi conectado. Não usar em campo até a liberação.',true);
  else sync();
}catch(error){message('Não foi possível abrir o armazenamento do celular. '+error.message,true);$('offline-ready').textContent='Armazenamento indisponível';}
