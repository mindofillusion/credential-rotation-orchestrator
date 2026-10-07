# Test réel phpBB → orchestrateur → Vaultwarden SIT

## Résultat du 7 octobre 2026

**Deux rotations consécutives réussies** sur le même compte de test, depuis
SER5 vers le coffre SIT du NAS par la passerelle SSH restreinte.

À chaque rotation, le véritable `RotationOrchestrator` du projet a :

1. Lu et déchiffré le mot de passe enregistré dans Vaultwarden.
2. Connecté le compte phpBB dans Chromium/Playwright.
3. Soumis le formulaire de changement de mot de passe du panneau utilisateur.
4. Vérifié la connexion avec le nouveau mot de passe dans une session neuve.
5. Vérifié que l'ancien mot de passe était refusé dans une autre session neuve.
6. Mis à jour l'entrée chiffrée du coffre, puis vérifié sa relecture.
7. Réussi une dernière connexion phpBB avec le secret relu depuis le coffre.

Le second passage repart de la même entrée du coffre ; il ne recrée pas le compte.
Le compte utilisateur dédié est `cro_rotation_test`, distinct de l'administrateur.
L'entrée du coffre est conservée pour les prochains tests.

## Environnement réellement utilisé

- phpBB **3.3.19**, source officielle `phpbb/phpbb`, commit
  `10356c2c3be3804402c7616e18bb53d54c02f143`.
- PHP **8.4.24** et bibliothèques Debian extraites dans un répertoire privé, sans
  installer de paquet système ni utiliser sudo.
- SQLite : fichier en dehors de la racine web.
- Dépendances PHP installées depuis `composer.lock` avec `--no-dev --no-plugins
  --no-scripts`; aucun changement de leurs versions.
- Playwright **1.63.0**, Chromium fourni par Playwright.
- Serveur PHP sur **127.0.0.1:8224 uniquement**, vérifié avec `ss`.
- Courrier désactivé, extensions optionnelles désactivées, installateur déplacé
  hors de la racine web après installation.
- Aucun forum tiers ni compte extérieur utilisé.

Le téléchargement phpBB principal renvoyait HTTP 403 : la source a donc été
récupérée dans le dépôt officiel GitHub. Les paquets Debian ont été téléchargés
avec des index signés actualisés dans le répertoire du test, sans modifier les
index APT système. Composer a été installé après vérification de l'empreinte
SHA384 de son installateur.

## Rejouer dans l'environnement préparé

Définir ces variables, puis lancer `npm run test:sit:phpbb` depuis le dépôt :

| Variable | Valeur attendue |
|---|---|
| `CRO_PHPBB_SIT_DIR` | Dossier privé du forum avec Playwright et `forum-secrets.json` |
| `CRO_SIT_ACCESS_DIR` | Dossier privé de la clé SSH et du compte Vaultwarden SIT |
| `CRO_SIT_SSH_HOST` | Compte SSH et hôte NAS autorisés |
| `PLAYWRIGHT_BROWSERS_PATH` | Sous-dossier `browsers` du test |
| `LD_LIBRARY_PATH` | Sous-dossier `runtime/usr/lib/x86_64-linux-gnu` du test |

`forum-secrets.json` contient `username`, `password`, puis `cipherId` après la
création de l'entrée. Il est propre à l'environnement, jamais publié. Le test
attend un forum installé et un compte dédié existant ; il ne crée pas un compte
sur un forum arbitraire. Sur SER5, l'ensemble réside dans le dossier privé
`cro-phpbb-sit` du compte d'exécution. Le serveur est un processus local de test,
pas un service configuré pour redémarrer automatiquement.

### Initialisation de la fixture

La procédure utilisée a été : extraction des paquets PHP et des bibliothèques
manquantes dans `runtime`, configuration d'un lanceur PHP utilisant uniquement
le `php.ini` local, récupération de la source phpBB épinglée, installation des
dépendances Composer, génération locale de secrets et du YAML d'installation
à partir de `docs/install-config.sample.yml`, puis installation par
`install/phpbbcli.php install`. Le compte a été ajouté via `user:add`, avec son
secret transmis en mémoire par un script PHP local, sans mot de passe sur la
ligne de commande. La vérification MX a été désactivée uniquement sur ce forum
de test pour accepter l'adresse `example.invalid` sans envoyer de courrier.

Deux particularités constatées : la configuration initiale limite le mot de
passe à 30 caractères (test fixé à 24) ; phpBB refuse une soumission du formulaire
de connexion dans la même seconde que sa création. Le parcours attend 1,5 seconde
avant soumission, en conservant le jeton CSRF fourni par phpBB.

## Limites et récupération

Ce test intègre le cœur de l'orchestrateur, un adaptateur de coffre SIT et un
parcours Playwright codé explicitement. Il **ne valide pas encore** l'exécution
d'un template importé/signé, l'interface graphique, le planificateur, les MFA,
CAPTCHA, thèmes alternatifs ou une version différente de phpBB.

Les requêtes du contexte navigateur sont limitées à l'origine locale fixe et les
service workers sont bloqués. Cela ne constitue pas une isolation réseau du
processus PHP ou du système complet. Chromium utilise la configuration de
lancement Playwright par défaut ; cette fixture ne doit servir qu'à ce forum local.

Un fichier `rotation-pending.json`, mode 0600, conserve les secrets candidats
avant la soumission. Une nouvelle exécution refuse de démarrer si ce journal
existe : réconcilier d'abord l'état réel du forum et du coffre. Après succès
complet il est supprimé ; `rotation-result.json` conserve uniquement les statuts
et dates. Le journal est une aide de récupération pour le SIT, pas une garantie
de durabilité transactionnelle en cas de coupure électrique.

Les secrets persistés sur SER5 sont protégés par les permissions Unix (répertoire
privé, fichiers 0600), mais restent en clair sur disque pour cette fixture. Ils ne
sont ni affichés, ni inclus dans les traces Playwright, ni enregistrés dans Git.
Ne jamais utiliser cette fixture avec des identifiants de production.

Validation supplémentaire : les 21 tests unitaires du projet passent. Le test
réel est volontairement déclenché explicitement ; `npm test` ne contacte pas le NAS.
