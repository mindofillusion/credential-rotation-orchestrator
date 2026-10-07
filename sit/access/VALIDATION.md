# Validation du coffre SIT — 7 octobre 2026

Validation réelle effectuée depuis SER5 via la clé SSH restreinte, après
installation du courtier par l'administrateur NAS :

- `status` : les deux conteneurs SIT sont actifs, Vaultwarden est sain.
- `/alive` : HTTP 200 via le courtier.
- Compte dédié `cro-sit@example.invalid` créé ; inscriptions refermées ensuite.
- Connexion par mot de passe et déchiffrement authentifié de la clé du coffre réussis.
- Entrée synthétique chiffrée créée, relue et déchiffrée.
- Mot de passe de cette entrée remplacé, relu et comparé au nouveau secret.
- Entrée synthétique supprimée après le test.

Le premier essai d'écriture a reçu HTTP 422 : Vaultwarden 1.37.4 exige
`encryptedFor`. Le client de test transmet désormais l'identifiant obtenu par
`/api/accounts/profile`. Le second essai a réussi.

`account-smoke.mjs` nécessite Node 22 et les variables `CRO_SIT_ACCESS_DIR`
(répertoire privé contenant `id_ed25519`) et `CRO_SIT_SSH_HOST` (compte@hôte).
La clé hôte doit déjà être validée dans known_hosts. Les secrets de test sont
conservés dans `sit-account.json`, mode 0600, sur la machine cliente uniquement.
Ce fichier contient le mot de passe maître en clair : il ne doit jamais être
publié, ajouté à Git ni inclus dans les sorties de diagnostic. Sa protection
repose sur le compte système et le répertoire privé de la machine cliente.
Le script ne journalise ni mot de passe, ni jeton, ni clé déchiffrée.

Ce client est un outil de validation SIT expérimental, pas un remplacement du
SDK/CLI Bitwarden ni un connecteur de production. Une interruption après la
création du compte mais avant la mise à jour du fichier local nécessite une
réconciliation ; ne pas supprimer le fichier ni générer un autre mot de passe.

## Ce qui reste à valider

- Tâche de démarrage DSM : configuration et reprise après redémarrage non confirmées.
- Compatibilité du compte avec les clients officiels Bitwarden non testée.
- Adaptateur intégré à l'orchestrateur et interface utilisateur non livrés par ce test.
- Changement effectif sur un site web de démonstration, reconnexion avec le nouveau
  mot de passe et synchronisation du coffre : non encore exécutés.

Le succès de ce test valide l'intégration au coffre, pas encore une rotation web
complète de bout en bout.
