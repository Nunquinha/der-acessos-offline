export const PHOTO_LABELS = ['Eixo do acesso — frontal', 'Lado direito', 'Lado esquerdo'];
export function road(value) {
  const raw = String(value).trim().replace(/^SP[A]?\s*[-–]?\s*/i, '');
  if (/^\d{1,3}$/.test(raw)) return raw.padStart(3, '0');
  if (/^\d{6}$/.test(raw)) return raw.slice(0, 3) + '/' + raw.slice(3);
  if (/^\d{3}\/\d{3}$/.test(raw)) return raw;
  throw new Error('Informe a rodovia com 1 a 3 dígitos ou no formato 040/079.');
}
export function distance(a, b) {
  const rad = n => n * Math.PI / 180;
  const dlat = rad(b.latitude - a.latitude), dlon = rad(b.longitude - a.longitude);
  const h = Math.sin(dlat/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1-h)));
}
export function duplicate(record, records) {
  return records.find(r => r.id !== record.id && r.data.lado === record.data.lado && distance(r.data, record.data) <= 5);
}
export function validate(data, photos) {
  for (const key of ['responsavel', 'natureza', 'municipio', 'rodovia', 'km', 'lado']) {
    if (!String(data[key] ?? '').trim()) throw new Error('Preencha todos os campos obrigatórios.');
  }
  if (!['Direito', 'Esquerdo'].includes(data.lado)) throw new Error('Escolha o lado direito ou esquerdo.');
  const latitude = Number(String(data.latitude).replace(',', '.'));
  const longitude = Number(String(data.longitude).replace(',', '.'));
  if (String(data.latitude).trim() === '' || String(data.longitude).trim() === '' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) throw new Error('Informe latitude e longitude válidas.');
  const km = Number(String(data.km).replace(',', '.'));
  if (!Number.isFinite(km) || km < 0) throw new Error('Informe um quilômetro válido.');
  if (photos.length !== 3 || photos.some(p => !(p instanceof Blob) || !p.size || p.size>5*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(p.type))) throw new Error('As três fotos são obrigatórias: frontal, lado direito e lado esquerdo.');
  return {...data, latitude, longitude, rodovia: road(data.rodovia), maps: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`};
}
// Somente uma confirmação explícita do mesmo ID permite concluir um envio.
export function accepted(body, id) {
  return body?.ok === true && body.clientId === id && typeof body.protocol === 'string' && body.protocol.length > 0;
}
export async function deliver(record, transport) {
  const response = await transport(record);
  if (response?.code === 'DUPLICATE') return {...record, state:'conflict', error:'Já existe um acesso a até 5 metros no mesmo lado. Solicite a conferência do responsável.'};
  if (!accepted(response, record.id)) throw new Error('O servidor não confirmou o recebimento. Cadastro preservado para nova tentativa.');
  return {...record, state:'sent', protocol:response.protocol, sentAt:new Date().toISOString(), error:''};
}
