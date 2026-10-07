// Fixed TCP target: no dynamic destinations, credentials or request logging.
import { createServer, connect } from 'node:net';
createServer((client) => {
  const upstream = connect(80, 'vaultwarden');
  client.on('error', () => upstream.destroy());
  upstream.on('error', () => client.destroy());
  client.on('close', () => upstream.destroy());
  upstream.on('close', () => client.destroy());
  client.setTimeout(120000, () => client.destroy());
  upstream.setTimeout(120000, () => upstream.destroy());
  client.pipe(upstream).pipe(client);
}).listen(8223, '0.0.0.0');
