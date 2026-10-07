# Panel forums SIT

État validé le 7 octobre 2026. Instances locales sur **la machine de test**, coffre Vaultwarden SIT sur le **NAS** via le broker SSH restreint. Aucun forum public ni compte de production utilisé.

| Moteur maintenu | Version installée | Adresse sur la machine de test | Stockage |
|---|---|---|---|
| phpBB | 3.3.19 | http://127.0.0.1:8224 | SQLite |
| MyBB | 1.8.41 | http://127.0.0.1:8226 | SQLite |
| Simple Machines Forum | 2.1.7 | http://127.0.0.1:8227 | MariaDB 11.8.6, socket privé, sans TCP |

Ce panel couvre trois moteurs et formulaires différents, mais pas encore les applications SPA, SSO, CAPTCHA ou MFA. Aucun contournement de ces mécanismes n'est prévu.

## Installation et organisation

Les chemins suivants sont des exemples génériques ; les chemins privés du déploiement ne sont pas publiés.

- phpBB et runtime PHP 8.4 / Playwright : `/srv/cro-sit/phpbb`.
- MyBB, SMF et MariaDB privée : `/srv/cro-sit/forums`.
- Sources MyBB : distribution officielle `mybb_1841.zip`, répertoire `mybb/source/Upload`.
- Sources SMF : dépôt officiel `SimpleMachines/SMF`, tag `v2.1.7`, répertoire `smf/SMF-2.1.7`.
- PHP et MariaDB extraits de paquets Debian signés dans ces dossiers, sans installation système ni sudo.
- MariaDB : base `cro_smf`, utilisateur applicatif limité à cette base ; socket `database/db.sock` dans un répertoire privé, `--skip-networking`.
- Installation par les assistants des moteurs. Compte non administrateur `cro_rotation_test` dans chaque forum ; création MyBB via son UserDataHandler, SMF via son administration.
- Les installateurs MyBB et SMF sont déplacés hors des racines web après création des comptes. Envoi de mail neutralisé (`sendmail_path=/bin/false`) et télémétrie non activée.
- Secrets de test en fichiers 0600 sous répertoires 0700, jamais dans Git. Les sauvegardes contenant ces fichiers doivent garder les mêmes protections.

Les serveurs PHP intégrés sont des services de développement, liés à la boucle locale et démarrés en processus utilisateur. Aucun service de démarrage système n'a été ajouté. Le redémarrage de la machine de test nécessite leur relance ; ceci n'est pas un déploiement de production.

## Activation du frontend

Variables du serveur CRO (en complément de `CRO_HOST=127.0.0.1`, `CRO_PORT=18787` et de son dossier de données privé) :

```sh
CRO_ENABLE_FORUMS_SIT=1
CRO_PHPBB_SIT_DIR=/srv/cro-sit/phpbb
CRO_FORUMS_SIT_DIR=/srv/cro-sit/forums
CRO_SIT_ACCESS_DIR=/srv/cro-sit/vault-access
CRO_SIT_SSH_HOST=sit-user@nas-sit.example.invalid
```

L'interface propose le forum, puis les versions signées de parcours compatibles avec son origine. L'API `POST /api/sit/forums/run` exige l'origine du frontend, son Host exact et un jeton propre au processus. Le mode simulation reste le défaut. L'ancien mode `CRO_ENABLE_PHPBB_SIT=1` conserve phpBB seul.

## Mécanisme de renouvellement

1. Vérifier signature Ed25519, SHA-256, expiration, permissions et origine fixe du template.
2. Prendre un verrou exclusif par forum, refuser tout journal de récupération existant.
3. Lire et déchiffrer l'entrée Vaultwarden du compte dédié ; la créer au premier passage si nécessaire.
4. Se connecter avec le mot de passe courant. SMF nécessite une première visite pour établir son cookie avant le formulaire de connexion.
5. Générer un mot de passe et conserver les deux candidats dans le journal privé avant toute soumission.
6. Exécuter uniquement les actions déclaratives signées du formulaire de changement de mot de passe. Les requêtes du navigateur sont limitées à l'origine de la fixture.
7. Vérifier dans des contextes navigateur neufs que le nouveau fonctionne et que l'ancien est refusé.
8. Mettre à jour le coffre, relire et déchiffrer la valeur sauvegardée, puis vérifier une nouvelle connexion avec cette valeur.
9. Supprimer le journal uniquement après succès complet ; conserver un résultat sans secrets et émettre l'événement local.

Une interruption ou un état ambigu bloque la reprise automatique. Un verrou résiduel après arrêt brutal nécessite de vérifier l'absence de processus actif et de réconcilier les candidats avant retrait. Ne jamais supprimer un journal pour simplement faire repartir une tâche.

## Régression

Sur la machine de test, depuis les sources CRO :

```sh
node sit/forums/regression.mjs 2
```

Cette commande **modifie réellement les trois comptes de test**, deux fois chacun, et s'arrête au premier échec. Elle épingle les recettes 0.1.0. Les résultats imprimés ne contiennent que le moteur, la réussite, la date et l'empreinte du parcours.

Les 23 tests unitaires couvrent notamment la signature, les altérations, les origines autorisées et les transactions de coffre. Les tests réels couvrent les trois moteurs ; ils ne constituent pas une certification de toutes leurs versions, thèmes ou extensions.

Voir [MISES-A-JOUR.md](MISES-A-JOUR.md) pour la maintenance et le retour arrière.

## Sources officielles

- [phpBB](https://www.phpbb.com/downloads/) — 3.3.19, sources épinglées au commit `10356c2c3be3804402c7616e18bb53d54c02f143`.
- [MyBB 1.8.41](https://blog.mybb.com/2026/09/16/mybb-1-8-41-released-security-maintenance-release/).
- [SMF 2.1.7](https://github.com/SimpleMachines/SMF/releases/tag/v2.1.7).

## Résultats du 7 octobre 2026

Deux rotations successives ont réussi sur chacun des trois moteurs : première série par API, seconde série par le bouton du frontend avec sélection du forum. Six changements validés, avec refus de l'ancien secret et connexion depuis la relecture du coffre pour chacun. Aucun journal de récupération restant. Aucun événement JavaScript d'erreur dans le frontend pendant le test.
