# Mises à jour CRO

## Livraison 0.3.0 — source exacte 0.2.6

- Onglet Laboratoire autonome : catalogue multiversion, plans persistants, attentes courriel/manuelles et clôture sans fausse validation.
- Affichage des derniers rapports navigateur du banc Windows, avec mention explicite du coffre non raccordé.
- Santé locale : `paired-sit` lorsque le raccordement est configuré ; ce statut décrit le mode, pas la disponibilité du coffre.
- Routes Laboratoire locales protégées par Host, Origin et jeton de session ; aucune extension des droits du relais SER5/NAS.

Le paquet est complet et signé au format `.cropatch`. Il accepte uniquement 0.2.6, déploie une nouvelle arborescence et conserve la version précédente. Les clés de confiance, l'appairage et les données utilisateur restent hors du paquet. Une panne de démarrage déclenche le retour à 0.2.6. Aucun conteneur n'est installé/démarré et aucun parcours de rotation n'est lancé par cette mise à jour.

Installation : interface `http://127.0.0.1:8787/` → Mises à jour CRO → sélectionner le `.cropatch` → Vérifier → Installer. Après redémarrage, contrôler la version 0.3.0 et l'onglet Laboratoire. Les nouvelles routes sont indépendantes de l'accessibilité du banc distant.

Limites : l'interface ne pilote pas encore les conteneurs, le lecteur Mailpit nécessite une configuration explicite non ajoutée au lanceur distribué, et la reprise navigateur transactionnelle avec écriture/relecture Vaultwarden reste à intégrer. Les tests du parcours Keycloak sont des qualifications séparées du banc local, pas une nouvelle capacité de rotation dans l'interface.

## Livraison 0.2.6

L'interface locale comporte un panneau **Mises à jour CRO** : choisir un `.cropatch`, vérifier, puis installer. L'autorité de publication est provisionnée hors du paquet, dans `publisher.pem` du répertoire d'installation privé. La signature est Ed25519 sur le manifeste JSON canonique ; chaque fichier est lié par SHA-256. La version source, l'expiration et les chemins sont contrôlés. Aucun script npm ou téléchargement de dépendance n'est exécuté.

Les nouvelles versions sont préparées dans un dossier distinct. Le lanceur lit `current.json`. Un processus séparé redémarre CRO et contrôle sa version par HTTP ; si le démarrage échoue, il restaure le pointeur précédent et relance cette version. Le résultat apparaît dans le panneau. L'ancienne version est conservée. Cette première implémentation ne prend pas en charge les migrations du format de données : ne publier que des versions compatibles avec les données existantes.

Le lanceur et la clé publique de publication doivent être installés une première fois. Un paquet ne peut ni choisir sa propre autorité ni modifier le lanceur extérieur à sa version. Le compte système exécutant CRO reste une frontière de confiance : son propriétaire peut modifier ses fichiers. Les pauses/reprises après coupure de courant en pleine installation restent à renforcer ; un travail interrompu doit être diagnostiqué avant de retirer son verrou.

Qualification : tests de signature, altération, chemins, version et expiration ; installation avec redémarrage et retour arrière sur échec volontaire sous Linux ; installation signée réelle sur le poste Windows de qualification. L'interface de mise à jour n'accepte que des requêtes locales avec origine exacte et jeton de session.

## Raccordement du banc existant

Le coffre reste derrière son courtier SSH NAS. Le navigateur Windows utilise son serveur CRO local ; celui-ci transmet les requêtes à un relais HTTPS associé explicitement à une clé publique client. Chaque requête est signée, datée et munie d'un nonce unique. Le certificat serveur est approuvé explicitement. Aucune clé privée n'est transférée. Le relais ne peut joindre que le backend CRO SIT local et une liste fermée de routes ; il ne fournit ni shell ni proxy arbitraire.

La configuration d'association réside hors du logiciel. `CRO_REMOTE_SIT_DIR` active explicitement le raccordement. Sans cette option, le mode simulation reste actif. Le relais est livré dans `sit/remote/bridge.mjs`. Sur un hôte géré par un autre système de maintenance, son installation suit la chaîne signée de cet hôte ; CRO reste indépendant de son interface et de sa numérotation.

Tests locaux : HTTPS, refus sans signature, transmission authentifiée et refus de rejeu. La qualification réseau et les rotations depuis Windows doivent être effectuées après installation et activation du relais. La mise en service automatique au redémarrage n'est pas incluse dans ce premier relais.

## Correctif de chemin du relais sur l'hôte de qualification

La première installation a révélé que l'updater crée ses nouveaux répertoires avec un umask 077 : le fichier 0644 devenait inaccessible au compte non privilégié derrière un parent 0700 root. Le correctif place le relais public directement sous le répertoire logiciel existant et traversable, sans élargir les droits du dossier privé. Le test d'installation reproduit désormais cet umask et vérifie les droits de traversée de chaque parent ainsi que la lecture du fichier. L'activation attend l'installation du correctif signé ; aucune disponibilité réseau n'est revendiquée avant le test réel.
