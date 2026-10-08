// Fixed TCP destinations only; no forwarding API, Docker socket or secrets.
import net from 'node:net';
const pair=process.env.CRO_LAB_PAIR;
if(!['current','previous'].includes(pair))throw new Error('Invalid pair');
const servers=[],sockets=new Set();
for(const [port,host] of [[8025,`mail-${pair}`],[8080,`identity-${pair}`]]){
  const server=net.createServer(client=>{
    const upstream=net.connect({host,port});
    for(const socket of [client,upstream]){sockets.add(socket);socket.once('close',()=>sockets.delete(socket));}
    const close=()=>{client.destroy();upstream.destroy();};
    client.setTimeout(60000,close);upstream.setTimeout(60000,close);
    client.on('error',close);upstream.on('error',close);
    client.on('close',()=>upstream.destroy());upstream.on('close',()=>client.destroy());
    client.pipe(upstream);upstream.pipe(client);
  }).listen(port,'0.0.0.0');
  servers.push(server);
}

function shutdown(){
  for(const socket of sockets)socket.destroy();
  let remaining=servers.length;
  for(const server of servers)server.close(()=>{if(--remaining===0)process.exit(0);});
  setTimeout(()=>process.exit(1),2000).unref();
}
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
