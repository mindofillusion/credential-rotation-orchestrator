# Mise à jour des moteurs et des parcours

La rotation des mots de passe est implémentée et testée. La procédure ci-dessous décrit la maintenance des versions logicielles et des templates ; aucun téléchargement ni déploiement automatique de nouvelles versions n'est activé.

## Versions des moteurs

1. Consulter la publication officielle et les exigences PHP/SQL. Épingler une version ou un commit exact. Vérifier la signature officielle lorsqu'elle existe ; enregistrer le SHA-256 de l'archive et sa provenance. Un SHA seul ne prouve pas l'identité de l'auteur.
2. Bloquer les rotations et arrêter le frontend CRO. Vérifier qu'aucun runner, verrou actif ou journal non réconcilié ne subsiste. Arrêter les seuls serveurs de la fixture concernée en vérifiant le chemin de commande de leur PID.
3. Sauvegarder ensemble le code, les configurations, la base, le fichier privé du compte et l'identifiant de son entrée Vaultwarden. SQLite : sauvegarde par l'API SQLite ou copie après arrêt complet ; MariaDB : dump cohérent de `cro_smf` via le socket privé. Ne pas copier à chaud le répertoire de données MariaDB. Protéger les sauvegardes 0700/0600, hors racine web ; ne jamais les publier dans Git.
4. Tester la restauration de la base dans une copie séparée avant migration. Installer le candidat dans un nouveau dossier. Conserver les données/configurations conformément au guide de la version. Aucun écrasement automatique du dossier actif.
5. Exécuter le chemin de migration officiel, sur la fixture isolée : phpBB via son outil de mise à jour de base ; MyBB via `install/upgrade.php` seulement si les notes de version le demandent ; SMF via son paquet de mise à jour/upgrade officiel adapté. Le code et le schéma doivent correspondre. Sortir de nouveau les installateurs de la racine web.
6. Redémarrer sur le même port local, vérifier l'accueil et la connexion avec le compte de test. Actualiser la version constatée dans `src/core/sit-origins.js` et le relevé SIT.
7. Lancer `npm run check`, puis deux rotations complètes par moteur avec `regression.mjs`. Confirmer aussi le refus des origines non autorisées et le blocage des exécutions concurrentes lors d'une évolution du runner.
8. Publier les versions, empreintes et résultats sans secrets. Activer le candidat seulement après succès ; conserver la sauvegarde de retour arrière.

Références : [phpBB](https://www.phpbb.com/support/docs/), [MyBB — Upgrade](https://docs.mybb.com/1.8/install/upgrade/), [SMF](https://wiki.simplemachines.org/smf/Upgrading).

## Versions des parcours

- Un template publié est immuable : toute modification de sélecteur, d'origine ou d'étape produit une nouvelle version.
- Enregistrer le parcours avec le compte de test, puis convertir les actions en recette déclarative. Ne conserver ni valeurs saisies, ni cookies, ni jetons CSRF ; le navigateur récupère ces jetons à chaque session.
- Déclarer l'origine et les permissions minimales ; signer le manifeste, qui contient le SHA-256 de la recette. Le SHA du bundle sert au contrôle de transport et ne remplace pas la signature ni la confiance explicite dans la clé.
- Importer le candidat dans le catalogue, le sélectionner explicitement et effectuer deux rotations successives. Les chemins MyBB et SMF sont dans les fichiers `*-template.json` ; phpBB reste dans `sit/phpbb/template-draft.json`.
- Épingler ensuite la version validée dans le lanceur de régression. Une synchronisation future ne doit pas remplacer silencieusement un parcours actif par « latest ».
- Si un thème ou une extension modifie le formulaire, créer une variante qualifiée ; une erreur de sélecteur déclenche un échec ou une récupération, jamais une tentative improvisée sur d'autres formulaires.

## Retour arrière et cohérence du coffre

Un retour au code précédent n'annule pas un changement de mot de passe déjà réalisé. Avant de restaurer une base ancienne, arrêter toute rotation, conserver le journal éventuel et relever la relation entre sauvegarde et version du secret.

Après restauration, réconcilier le compte SIT et son entrée Vaultwarden : vérifier quel candidat est accepté, mettre le coffre en cohérence uniquement après cette vérification, puis refaire une rotation complète. Ne jamais restaurer globalement le coffre NAS pour annuler le test d'un forum. Si aucun candidat ne fonctionne, utiliser la récupération administrative de la seule fixture SIT et recréer une référence cohérente.

## Alertes locales

Les événements existants `credential.rotation.started`, `credential.rotation.succeeded`, `credential.rotation.failed` et `credential.rotation.state_ambiguous` restent exposés par le frontend/API et le flux SSE `/api/events/stream`. Ils identifient `account/phpbb-sit`, `account/mybb-sit` ou `account/smf-sit`. Les relais externes peuvent consommer ces événements localement ; aucun relais externe ni ordonnanceur n'est activé par cette installation. L'historique en mémoire ne remplace pas un journal durable de supervision.
