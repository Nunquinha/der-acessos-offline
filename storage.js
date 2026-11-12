import {TEST_MODE} from './config.js';
const NAME = 'der-acessos-campo-v1' + (TEST_MODE ? '-teste-isolado' : '');
let opening;
export function database() {
  return opening ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('records', {keyPath:'id'});
      request.result.createObjectStore('draft', {keyPath:'id'});
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); opening = undefined; };
      resolve(db);
    };
    request.onerror = () => { opening=undefined; reject(request.error); };
    request.onblocked = () => { opening=undefined; reject(Error('Feche outras abas deste aplicativo para continuar.')); };
  });
}
export async function transaction(stores, mode, run) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    try { result = run(tx); } catch (error) { tx.abort(); reject(error); return; }
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = tx.onabort = () => reject(tx.error || Error('Não foi possível gravar neste celular. Verifique o espaço disponível.'));
  });
}
export const allRecords = () => transaction(['records'], 'readonly', tx => tx.objectStore('records').getAll());
export const getDraft = () => transaction(['draft'], 'readonly', tx => tx.objectStore('draft').get('current'));
export const saveDraft = data => transaction(['draft'], 'readwrite', tx => tx.objectStore('draft').put({...data, id:'current'}));
export const updateRecord = record => transaction(['records'], 'readwrite', tx => tx.objectStore('records').put(record));
export const commitRecord = record => transaction(['records','draft'], 'readwrite', tx => {
  tx.objectStore('records').add(record);
  tx.objectStore('draft').delete('current');
});
