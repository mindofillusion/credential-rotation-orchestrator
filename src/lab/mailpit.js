// This adapter observes only an explicitly configured, local SIT mailbox.
// It never sends, deletes, releases mail, follows message links or renders HTML.
export class MailpitReader {
  constructor(baseUrl, {fetchImpl = fetch} = {}) {
    this.fetch = fetchImpl;
    this.base = null;
    if (baseUrl) {
      const u = new URL(baseUrl);
      if (u.protocol !== 'http:' || u.hostname !== '127.0.0.1' || !u.port || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw new Error('Mailpit doit être une origine HTTP explicite sur 127.0.0.1');
      this.base = u.origin;
    }
  }
  async get(path) {
    if (!this.base) throw new Error('Mailpit SIT non configuré');
    const r = await this.fetch(this.base + path, {redirect:'error',signal:AbortSignal.timeout(5000)});
    if (!r.ok) throw new Error('Mailpit SIT inaccessible');
    const reader=r.body.getReader(); const parts=[];let size=0;
    try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024)throw new Error('Réponse Mailpit trop volumineuse');parts.push(value);} }
    finally {await reader.cancel().catch(()=>{});}
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  }
  async status() {
    if (!this.base) return {configured:false,reachable:false};
    try {const r=await this.get('/api/v1/messages?limit=1');return {configured:true,reachable:Array.isArray(r.messages)};}catch{return {configured:true,reachable:false};}
  }
  async messages() {
    const all=[];
    // Bounded pagination; if the inbox exceeds this bound fail closed instead
    // of incorrectly claiming no match. Never trigger the Mailpit release API.
    for(let start=0;start<500;start+=100){
      const page=await this.get(`/api/v1/messages?limit=100&start=${start}`);
      if(!Array.isArray(page.messages)||!Number.isSafeInteger(page.total)||page.total<0||page.messages.length>100)throw new Error('Réponse Mailpit invalide');
      if(page.total>500)throw new Error('Boîte SIT trop volumineuse pour une corrélation sûre');
      all.push(...page.messages);
      if(all.length>=page.total)return all;
      if(!page.messages.length)throw new Error('Pagination Mailpit incohérente');
    }
    throw new Error('Pagination Mailpit incomplète');
  }
}
