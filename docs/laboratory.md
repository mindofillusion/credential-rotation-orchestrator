# Laboratoire — CRO 0.3.0

Ce module ajoute un inventaire de plans multiversion et des attentes de validation persistantes à l'interface autonome. Il n'installe ni ne démarre les applications du catalogue. Il ne suspend/reprend pas encore le navigateur de rotation et ne met jamais à jour le coffre. Le catalogue contient des pistes à qualifier, pas une liste de distributions exécutables approuvées.

## Utilisation

Lancer CRO sur `127.0.0.1`, ouvrir **Laboratoire**, sélectionner une application et une version, puis ajouter un plan. Une seule entrée est créée pour un couple produit/version, même en cas de demandes concurrentes. Un plan reste explicitement non déployé et non qualifié.

Pour observer un courriel de test, configurer explicitement `CRO_LAB_MAILPIT_URL=http://127.0.0.1:8025/` avant le démarrage. Mailpit doit déjà être installé localement ; ce module ne l'installe pas. Le lanceur Windows distribué filtre les variables CRO : le raccordement Mailpit dans ce lanceur reste à livrer. Le mode humain est indépendant de Mailpit et conserve l'adresse choisie par l'utilisateur sans imposer de domaine.

Créer l'attente **avant** de déclencher manuellement l'envoi sur le site SIT. Le lecteur compare les métadonnées des nouveaux messages : expéditeur, destinataire, objet exact et fenêtre temporelle. Il exclut les identifiants présents à la création de l'attente. Un résultat unique est un **candidat à vérifier**, pas une preuve de validation ; un message ancien retardé peut satisfaire les mêmes critères. Plusieurs candidats produisent un état ambigu.

Cliquer sur « Vérifier l'attente » pour actualiser son état : pas de scrutation automatique dans cette version. Une confirmation humaine produit elle aussi un état à vérifier. « Clôturer sans vérifier » ferme seulement l'observation locale : cette action n'annule rien sur le site et ne réconcilie pas le coffre.

## Limites et protections

- Le lecteur utilise uniquement GET sur l'API Mailpit locale explicitement configurée, sans redirection, avec limites de temps, taille et pagination (500 messages maximum).
- Aucun corps de message, HTML, code, lien ou pièce jointe n'est chargé ; aucun mail n'est envoyé, supprimé ou relayé.
- Les attentes et métadonnées de corrélation sont dans `lab/state.json` sous le dossier de données CRO : écriture atomique, permissions restrictives, journal limité à 250 événements. Les adresses et objets ne figurent pas dans les réponses publiques ni dans ce journal. Les métadonnées privées ne sont pas chiffrées ; une politique de purge reste à ajouter.
- Les mutations HTTP exigent un Host de boucle locale, une Origin exacte et un jeton de session. Les routes Laboratoire restent locales même avec un raccordement SIT distant.
- `rotationVerified` et `vaultUpdated` restent faux. La preuve finale doit venir d'une nouvelle connexion avec le nouveau secret, du refus de l'ancien et de la relecture vérifiée du coffre.
- Le journal d'observation est disponible dans `/api/lab/overview`. Il n'est pas encore intégré au flux d'alertes SSE distant.

## Qualification du 8 octobre 2026

35 tests Node réussis, dont 7 tests nouveaux : persistance/dédoublonnage, filtrage des messages, confidentialité des réponses, ambiguïté, clôture, expiration, panne du lecteur, limites du client HTTP et protection de l'API via un serveur réel éphémère. Les tests Mailpit utilisent des réponses contrôlées ; aucun essai SMTP réel ni parcours CMS avec validation courriel n'est revendiqué. L'interface est servie lors du test HTTP, mais sa qualification visuelle et native Windows reste à faire.

## Suite du lot

1. Installer un collecteur SMTP SIT sans relais externe et qualifier son API réelle.
2. Activer l'envoi de mail dans des copies isolées des CMS, avec comptes fictifs.
3. Relier les attentes à l'identité d'une transaction réelle et à sa reprise contrôlée.
4. Qualifier codes/liens expirés, messages retardés et ambiguïtés, puis vérifier site et coffre.
5. Livrer le paquet signé et qualifier son installation/retour arrière sur Windows.

Le futur client de messagerie personnelle et les réponses automatiques configurables sont consignés dans la [feuille de route](roadmap.md). Ils constituent une intégration distincte.

## Qualification ultérieure du banc isolé

Le [runner courriel Keycloak](../sit/lab/EMAIL-BROWSER-QUALIFICATION.md) possède désormais une qualification navigateur réelle sur deux versions. Cette preuve ne change pas les capacités de l’interface installée : aucune reprise navigateur ni écriture du coffre n’est ajoutée à ses routes Laboratoire.

Les derniers rapports navigateur locaux sont affichés dans le Laboratoire sous Windows. Seuls les champs de résultat autorisés sont lus : aucun secret, contenu de mail ou lien de validation n’est exposé. Un dernier échec remplace visuellement un ancien succès. Les rapports restent historiques, sans état vivant des conteneurs ni preuve d’écriture du coffre.
