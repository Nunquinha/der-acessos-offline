// Somente envio público. Consultas, Excel, PDF e exclusões seguem na gestão autenticada.
export const TEST_MODE = new URLSearchParams(location.search).get('teste') === 'local';
export const config = Object.freeze({ endpoint: TEST_MODE ? null : 'https://script.google.com/macros/s/AKfycbzEJ1esTc7eFahvwxJp3oM-u1FDaFuiHCKB0OwQPu6qGTst8MiCK2PB5b8vrgMcxsn_/exec' });
