// Fixed fixture addresses, never supplied by an imported template or HTTP caller.
export const FORUM_SIT = Object.freeze({
  phpbb: Object.freeze({name:'phpBB',version:'3.3.19',origin:'http://127.0.0.1:8224'}),
  mybb: Object.freeze({name:'MyBB',version:'1.8.41',origin:'http://127.0.0.1:8226'}),
  smf: Object.freeze({name:'SMF',version:'2.1.7',origin:'http://127.0.0.1:8227'})
});

export const CMS_SIT = Object.freeze({
  wordpress:Object.freeze({name:'WordPress',version:'7.1.3',origin:'http://127.0.0.1:8230'}),
  joomla:Object.freeze({name:'Joomla',version:'6.1.4',origin:'http://127.0.0.1:8231'}),
  drupal:Object.freeze({name:'Drupal',version:'11.4.8',origin:'http://127.0.0.1:8232'})
});
export const ALL_SIT=Object.freeze({...FORUM_SIT,...CMS_SIT});
