# CRO — catalogue multiversion du laboratoire web

Édition **1.0.0**, observations du **8 octobre 2026**. Catalogue de recherche et plan de qualification, indépendant de la version du logiciel CRO (0.2.6). Aucun déploiement n’est déclenché par ces fichiers.

**Objectif : apprendre des mécanismes reproductibles, pas accumuler des installations identiques.** Une nouvelle version ne prouve pas un nouveau parcours; un thème, une extension ou un IdP peut changer complètement celui d’une même version.

## Ce qui est effectivement livré

- Un registre JSON et CSV par produit/version, avec provenance et état explicites.
- Des observations horodatées des flux officiels (`release-observations.jsonl`). Ce relevé conserve aussi des tags non retenus (y compris préversions); il ne certifie ni stabilité ni maintenance.
- Une sélection de versions, revue pour écarter préversions, tags flottants et composants confondus avec l’application.
- Des mesures d’usage quand elles existent et leurs limites dans [ADOPTION.md](ADOPTION.md).
- 35 scénarios dans `scenarios.json`; un plan par instance dans `campaign.json`, **désactivé** tant que les prérequis ne sont pas prouvés.
- Les recettes déjà disponibles pour [les forums](../forums/README.md) et [les CMS](../cms/README.md). Les autres recettes restent à réaliser et valider.

**État réel : six versions de sites ont des comptes rendus de qualification antérieurs. Aucun nouveau produit installé pendant cet inventaire.** Les trois forums écoutaient lors du contrôle du 8 octobre; les trois CMS étaient arrêtés. L’interface Windows a une qualification de bout en bout récente sur phpBB uniquement. Le coffre Vaultwarden SIT est une infrastructure existante, pas un nouveau site qualifié pour changer son propre mot de passe maître.

## Lire le tableau

P1 : mécanisme manquant ou base de régression prioritaire. P2 : élargissement après couverture du mécanisme. P3 : historique, coût élevé ou contrainte particulière. Cette priorité est un choix d’ingénierie, **pas un classement de popularité**.

Les numéros sont des versions repérées dans les publications. Ils ne sont pas des images Docker validées. Les champs `artifact_sha256` et `image_digest` restent nuls jusqu’au téléchargement et à la vérification de provenance. Aucune recette ne peut être qualifiée « prête » sur la seule existence d’un tag.

† : quarantaine historique explicite. Pour toutes les autres versions, le statut de support doit encore être audité; l’absence de † n’est pas un certificat de sécurité.

La colonne « mécanismes » est une **hypothèse de couverture à examiner par version, édition et configuration**, pas une assertion que chaque fonction existe nativement. Certaines exigent une extension, une édition particulière ou un fournisseur d’identité. `email` couvre confirmation/récupération, `reauth` une nouvelle preuve d’identité, `sso` la délégation à un IdP, `app-password` un secret client distinct, `token` les jetons API. Les auxiliaires de test sont séparés des sites cibles dans le JSON.

Autres pistes et offres commerciales : [compléments du panel](EXTENSIONS.md).

## Politique multiversion

1. Retenir une version récente, une branche encore significative selon les mesures et une rupture de parcours ou d’architecture. Ne pas confondre une ancienne branche avec une branche encore maintenue.
2. Choisir le correctif approprié à la branche retenue; les anciens correctifs ne sont ajoutés que pour une différence utile ou une régression reproductible.
3. Pour les produits sans mesure publique, noter « diffusion non établie ». Le nombre de téléchargements, pulls et étoiles ne prouve pas le nombre d’installations actives.
4. Séparer version du site, du thème, des extensions, du runtime, de la base, du template CRO et du navigateur. Chaque exécution doit enregistrer ces versions et leurs empreintes.
5. Les flux GitHub ne montrent qu’un échantillon récent. Les versions absentes nécessitent archives officielles ou tags et inspection manuelle. Ne pas traiter un flux vide comme une disparition du produit.

## Lots de travail et installation

| Lot | Cibles | Résultat recherché |
|---|---|---|
| 0 | Les six moteurs existants, avec leurs versions alternatives | Régression et comparaison des formulaires; nouvelles instances séparées |
| 1 | Mailpit, GreenMail, WordPress/Joomla/Drupal, Moodle | Confirmation, reset, délais et corrélation du mail sans adresse générique imposée |
| 2 | Keycloak, authentik, Authelia, LLDAP, Self Service Password | TOTP, WebAuthn, SSO, annuaire et expiration; savoir s’arrêter pour validation humaine |
| 3 | Discourse, Flarum, NodeBB, Ghost, Strapi, Directus | SPA et comptes sans mot de passe; distinguer comptes administrateur et lecteur |
| 4 | PrestaShop, WooCommerce, OpenCart, BookStack, MediaWiki, Nextcloud | Portails client/personnel, wikis, sessions et secrets applicatifs |
| 5 | Gitea/Forgejo, GLPI, osTicket, Dolibarr, Grafana, Roundcube | Jetons distincts, helpdesk, gestion et dépendance au backend d’authentification |
| 6 | Applications lourdes et historiques | Compléter seulement les écarts de couverture; VM dédiée pour anciennes piles |

Le banc partagé impose un lancement à la demande. Commencer par **une instance cible et ses dépendances**, mesurer CPU/RAM/IO et garder une réserve pour les services existants. Les classes `heavy-batch` sont des estimations de complexité, pas des mesures de consommation. Aucun redémarrage global ni installation de paquet système n’est requis par ce catalogue.

Préparer une instance `/srv/cro-sit/<produit>/<version>/<profil>` avec ses propres volumes, bases et comptes. Aucune base partagée entre versions d’un site, aucun montage du socket Docker dans une cible, aucun accès aux comptes réels. Pour Portainer/act ou d’autres outils contrôlant des conteneurs, utiliser un hôte de test sacrifiable, jamais le moteur du NAS de production.

Avant installation : verrouiller distribution et runtimes, vérifier licence/architecture, signature éditeur si disponible et SHA-256, relire les scripts d’installation, définir les limites et le contrôle de santé. Télécharger en zone de préparation puis exécuter sans sortie Internet sur un réseau SIT distinct. Un blocage Playwright des URLs **ne filtre pas** les connexions du serveur applicatif. Les anciennes branches doivent être dans une VM isolée du LAN, sans secrets réels.

Le broker NAS actuel ne permet pas le déploiement arbitraire de nouveaux conteneurs. Son périmètre n’est pas élargi ici. Toute évolution de l’hôte SER5 suit la livraison signée habituelle; ce catalogue n’est pas un paquet d’installation.

## Qualification et preuve

Pour chaque instance : vérifier la version depuis l’application, créer un compte limité et son entrée de coffre dédiée, enregistrer le parcours, le relire et signer le template. Effectuer deux rotations, vérifier nouveau secret accepté et ancien refusé depuis des sessions neuves, relire le coffre puis reconnecter avec la valeur relue. Tester interruption et réconciliation avant rotation périodique. Les captures/traces doivent masquer secrets, jetons de reset, cookies et contenus privés.

Une validation courriel demeure un point d’attente jusqu’à preuve de l’effet. Le banc SMTP intercepte uniquement ses propres messages. Un accès à une boîte réelle n’est pas requis par cet inventaire. Passkeys, CAPTCHA, SMS et push peuvent imposer une intervention : apprendre à reconnaître cette limite est un résultat valide.

Un scénario `planned` devient `qualified` seulement avec un rapport horodaté lié à l’empreinte exacte de la pile et du template. HTTP 200, santé du conteneur et succès visuel ne suffisent pas.

## Maintenance reproductible

```sh
# Lecture publique des flux, aucune installation. Réseau requis.
python3 sit/catalogue/observe-releases.py < sit/catalogue/candidates.tsv > /tmp/cro-release-observations.jsonl
# Examiner le diff avant de remplacer le relevé versionné.
# Puis compiler le registre hors ligne depuis les fichiers approuvés :
python3 sit/catalogue/build.py
python3 -m unittest discover -s sit/catalogue -p 'test_*.py'
```

Les changements de support/diffusion et les nouveaux tags alimentent une revue; ils ne mettent jamais les fixtures à jour automatiquement. Restaurer une base après un test nécessite de réconcilier le compte correspondant avec le coffre. Un rollback logiciel n’annule pas une rotation distante.
