import test from 'node:test';
import assert from 'node:assert/strict';
import {road,validate,duplicate,distance,accepted,deliver} from '../core.js';
import {readFileSync,existsSync} from 'node:fs';
const photo=()=>new Blob(['test'],{type:'image/jpeg'});
const data={responsavel:'Teste',natureza:'Órgão público',municipio:'Teste',rodovia:'79',km:'12,5',lado:'Direito',latitude:'-23',longitude:'-48'};
const record={id:'c01',state:'pending',data:validate(data,[photo(),photo(),photo()])};
test('rodovias curtas e ramais são normalizados',()=>{
  for(const [input,output] of [['79','079'],['97','097'],['250','250'],['040079','040/079'],['SP 79','079']])assert.equal(road(input),output);
  assert.throws(()=>road('texto'));assert.throws(()=>road('1234'));
});
test('bloqueia zero, uma ou duas fotos e fotos acima do limite',()=>{
  for(const photos of [[],[photo()],[photo(),photo()]])assert.throws(()=>validate(data,photos),/três fotos/);
  assert.throws(()=>validate(data,[photo(),photo(),new Blob([new Uint8Array(5*1024*1024+1)],{type:'image/jpeg'})]),/três fotos/);
});
test('latitude zero é válida, campo vazio e coordenadas fora do globo não são',()=>{
  assert.equal(validate({...data,latitude:'0'},[photo(),photo(),photo()]).latitude,0);
  for(const coordinate of ['', 'abc', '91'])assert.throws(()=>validate({...data,latitude:coordinate},[photo(),photo(),photo()]));
  assert.throws(()=>validate({...data,longitude:181},[photo(),photo(),photo()]));
});
test('coordenadas com vírgula geram um link do Maps coerente',()=>{
  const result=validate({...data,latitude:'-23,125'},[photo(),photo(),photo()]);
  assert.equal(result.latitude,-23.125);assert.match(result.maps,/query=-23.125,-48$/);
});
test('mesmo lado bloqueia dentro de 5 metros, independentemente da rodovia',()=>{
  const near={id:'c02',data:{...record.data,rodovia:'097',latitude:-23+4/111195}};
  assert.ok(distance(record.data,near.data)<5);assert.equal(duplicate(record,[near]),near);
});
test('outro lado e localização além de 5 metros são permitidos',()=>{
  assert.equal(duplicate(record,[{id:'c02',data:{...record.data,lado:'Esquerdo'}}]),undefined);
  assert.equal(duplicate(record,[{id:'c02',data:{...record.data,latitude:-23+6/111195}}]),undefined);
});
test('resposta sem confirmação explícita não conclui o envio',async()=>{
  for(const response of [null,{}, {ok:true}, {ok:true,clientId:'outro',protocol:'AC-1'}, {ok:true,clientId:'c01',protocol:''}]){
    assert.equal(accepted(response,record.id),false);
    await assert.rejects(deliver(record,async()=>response),/não confirmou/);
  }
  assert.equal(record.state,'pending');
});
test('perda de conexão mantém o registro e permite repetir com o mesmo ID',async()=>{
  await assert.rejects(deliver(record,async()=>{throw Error('Sem sinal');}),/Sem sinal/);
  let id;
  const result=await deliver(record,async r=>{id=r.id;return {ok:true,clientId:r.id,protocol:'AC-123'};});
  assert.equal(id,record.id);assert.equal(result.state,'sent');assert.equal(result.protocol,'AC-123');assert.equal(record.state,'pending');
});
test('duplicata informada pelo servidor fica para conferência e preserva dados',async()=>{
  const result=await deliver(record,async()=>({code:'DUPLICATE'}));
  assert.equal(result.state,'conflict');assert.equal(result.data,record.data);
});
test('cache offline contém os arquivos necessários, sem dependências externas',()=>{
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const assets=sw.match(/const ASSETS = \[(.*?)\];/s)[1].match(/'[^']+'/g).map(x=>x.slice(1,-1));
  for(const asset of assets)assert.ok(existsSync(new URL('../'+asset,import.meta.url)),asset);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/<(?:script|link)[^>]+(?:src|href)="https?:/);
});
