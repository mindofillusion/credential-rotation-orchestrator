# CMS SIT — parcours signés

Panel qualifié le 7 octobre 2026 sur des instances locales dédiées :

| CMS | Version | Origine fixe | Compte | Stockage |
|---|---|---|---|---|
| WordPress | 7.1.3 | http://127.0.0.1:8230 | Abonné | MariaDB, base dédiée |
| Joomla | 6.1.4 | http://127.0.0.1:8231 | Registered | MariaDB, base dédiée |
| Drupal | 11.4.8 | http://127.0.0.1:8232 | Authenticated | SQLite hors racine web |

Les comptes `cro_rotation_test` n'ont aucun droit d'administration. Les sessions, mots de passe et bases ne font partie ni du dépôt ni du paquet logiciel. Le coffre reste le Vaultwarden SIT déjà installé, accessible par sa passerelle restreinte.

## Parcours de renouvellement

- **WordPress** : connexion, profil personnel, bouton de définition du nouveau mot de passe, saisie puis sauvegarde. Le formulaire ne demande pas le mot de passe courant une seconde fois. Sa confirmation cachée est synchronisée par le JavaScript natif du CMS.
- **Joomla** : connexion via le formulaire principal `com-users-login__form`, modification du profil, saisie et confirmation du nouveau mot de passe, sauvegarde. Le formulaire de connexion latéral ne doit pas être confondu avec le principal.
- **Drupal** : connexion, page personnelle et lien « Edit », mot de passe courant, nouveau mot de passe et confirmation, sauvegarde. Aucun identifiant numérique d'utilisateur n'est codé dans le template.

Chaque recette contient uniquement des actions déclaratives. Les jetons anti-CSRF restent ceux produits par les formulaires. La signature, l'expiration, les permissions et les SHA sont contrôlés avant l'accès au coffre. Le runner n'autorise que l'origine fixe du CMS choisi et bloque les service workers.

La vérification commune utilise des contextes navigateur neufs : nouveau secret accepté, ancien refusé, puis connexion avec le secret relu du coffre après sa mise à jour. Un journal de récupération et un verrou exclusif empêchent une reprise aveugle.

## Activation explicite

En plus des variables de connexion SIT existantes :

```sh
CRO_ENABLE_CMS_SIT=1
CRO_CMS_SIT_DIR=/srv/cro-sit/cms
```

Le chemin est un exemple, à remplacer par le répertoire privé préparé. Les trois origines HTTP ne sont autorisées que par `allowCmsSitLoopback`. Le mode forums seul ne les autorise pas. Le serveur CRO reste lié à `127.0.0.1`.

Pour conserver aussi le panel de forums, activer `CRO_ENABLE_FORUMS_SIT=1` avec son répertoire existant. Le frontend indépendant permet de choisir chacun des six sites. Les mutations exigent l'origine exacte du frontend, un Host attendu et un jeton propre au processus. Aucun secret de coffre n'est envoyé au frontend.

## Configuration du banc

PHP 8.4, extensions mysqli, PDO SQLite, GD, intl et curl. Les dépendances privées sont extraites de paquets Debian signés ; aucun paquet système n'est remplacé. Les serveurs HTTP de développement écoutent sur la boucle locale. MariaDB utilise le socket privé du banc de forums, sans écoute TCP, avec un utilisateur SQL distinct et limité à chaque base CMS.

WordPress : cron, modifications de fichiers et mises à jour automatiques désactivés ; appels HTTP externes bloqués ; envoi de mail neutralisé par un mu-plugin. Joomla : installation retirée de la racine web, mail désactivé, URLs sans réécriture pour le serveur PHP de test. Drupal : inscription publique désactivée, base déplacée hors racine web. `sendmail_path=/bin/false` s'applique au runtime de qualification.

Cette configuration est un banc de développement, pas un hébergement de production. Le filtrage des requêtes Playwright n'est pas une isolation réseau de tous les processus PHP. Aucun ordonnanceur de rotation périodique n'est activé.

## Mise à jour des CMS et des templates

1. Lire les notes de version et de sécurité officielles. Épingler la version et archiver sa provenance ; vérifier les empreintes publiées. Un SHA local seul prouve l'intégrité du fichier conservé, pas l'identité de son éditeur.
2. Suspendre les rotations. Refuser toute mise à jour en présence d'un journal non réconcilié ou d'un runner actif.
3. Sauvegarder ensemble code, configuration, base et référence de compte. Dumps SQL cohérents ou sauvegarde SQLite par son API ; stockage privé hors racine web. Tester la restauration dans une copie isolée.
4. Préparer le candidat dans un répertoire distinct. WordPress : suivre la mise à jour du cœur et de sa base ; Joomla : utiliser son composant de mise à jour et vérifier extensions/schéma ; Drupal : mettre à jour les dépendances Composer, appliquer les mises à jour de base et reconstruire les caches selon sa documentation. Ne jamais remplacer seulement quelques fichiers d'un cœur sans ses dépendances et migrations.
5. Qualifier deux rotations successives par CMS, puis la non-régression du runner partagé sur les forums. Garder les mises à jour automatiques désactivées sur ce banc pour préserver sa reproductibilité.
6. Si le formulaire change, publier une nouvelle version immuable du template, signée après examen. La sélectionner explicitement. Ne jamais remplacer silencieusement une version validée.
7. Déployer selon la chaîne de livraison de l'hôte ; conserver la version précédente et ses sauvegardes. Le rollback logiciel ne restaure pas implicitement une base ni un mot de passe.
8. Après restauration d'une base, réconcilier le compte avec son entrée de coffre avant toute nouvelle rotation. Ne jamais restaurer tout le Vaultwarden pour annuler le test d'un CMS.

Les thèmes, extensions, MFA, CAPTCHA, SSO et politiques particulières nécessitent une qualification supplémentaire. Un changement de mot de passe n'est pas considéré comme réussi sur la seule présence d'un message visuel.

## Sources officielles et archives utilisées

- [WordPress 7.1.3](https://wordpress.org/news/2026/10/wordpress-7-1-3-maintenance-and-security-release/), archive `https://wordpress.org/wordpress-7.1.3.tar.gz`, SHA-256 mesuré `d2a09acb6a15e3b9c471d72557753c266d6f41a79ed19bfe04cbfe49e283b2a5`.
- [Joomla 6.1.4](https://www.joomla.org/announcements/release-news/joomla-6-1-4-5-4-9-security-bugfix-release.html), distribution officielle GitHub `Joomla_6.1.4-Stable-Full_Package.zip`, SHA-256 mesuré `817d2fa37c7f8a7ecbd1d028d6be9362dc6e5fd693f9e07e7fdb9998431e7196`.
- [Drupal 11.4.8](https://www.drupal.org/project/drupal/releases/11.4.8), archive officielle `drupal-11.4.8.tar.gz`, SHA-256 publié et vérifié `82f10f0ac8f4c06e61b30dbd3e8eec070ad292b385167cff42f1ce42a3389209`.

## Qualification obtenue

Deux rotations successives par CMS ont réussi, dont la seconde depuis le frontend. Une rotation de non-régression a ensuite réussi sur phpBB, MyBB et SMF avec le même runner. Les neuf succès comprennent la vérification du nouveau secret, le refus de l'ancien et une connexion depuis la relecture Vaultwarden. Aucun journal de récupération restant ni erreur JavaScript du frontend lors de cette série. Les 24 tests unitaires passent.

Le lanceur `control.py` démarre, inspecte ou arrête uniquement les trois serveurs CMS et leur frontend de qualification. Il requiert un banc déjà préparé, son propriétaire non privilégié et un fichier privé `cro-runtime.json` contenant les chemins `browserRuntime`, `forumsRoot`, `vaultAccess` et la destination SSH `sshHost`. Il refuse les ports occupés, les journaux de récupération et les identités de processus inattendues. Il n'installe rien, ne télécharge rien et ne gère pas la base partagée. Aucun démarrage automatique au boot n'est ajouté.
