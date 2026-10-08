import test from 'node:test';
import assert from 'node:assert/strict';
import {keycloakMailLink} from '../src/interventions/keycloak-mail-link.js';
const policy={origin:'http://127.0.0.1:18251',realm:'cro-sit-012345abcdef'};
const url=policy.origin+'/realms/'+policy.realm+'/login-actions/action-token?key=fictitious-token';
test('mail action link is bound to the exact local realm and origin',()=>{
  assert.equal(keycloakMailLink('Action: '+url,policy),url);
  for(const value of [url.replace('18251','18261'),url.replace(policy.realm,'cro-sit-abcdef012345'),url.replace('127.0.0.1','evil.example'),url+'&redirect_uri=https://evil.example',url+'&key=second',url+'#fragment',url+'\n'+url.replace('fictitious-token','other'),url.replace('127.0.0.1','user:pass@127.0.0.1'),'No link'])assert.throws(()=>keycloakMailLink(value,policy));
});
