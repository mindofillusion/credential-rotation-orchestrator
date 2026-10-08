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

## Chiffres du registre

- `products` : 134
- `web_targets` : 127
- `companions` : 7
- `selected_versions` : 335
- `products_multiversion` : 124
- `products_without_selected_version` : 8
- `historically_qualified_versions` : 6
- `new_installations_this_inventory` : 0

## Forums et communautés

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [phpBB](https://github.com/phpbb/phpbb) | [3.3.19](https://github.com/phpbb/phpbb/releases/tag/release-3.3.19), [3.3.17](https://github.com/phpbb/phpbb/releases/tag/release-3.3.17) | 1 | PHP + SQL | password, csrf, session |
| [MyBB](https://github.com/mybb/mybb) | [1.8.41](../forums/README.md), [1.8.40](https://mybb.com/versions/1.8.40/) | 1 | PHP + SQL | password, csrf, session |
| [Simple Machines Forum](https://github.com/SimpleMachines/SMF) | [2.1.7](https://github.com/SimpleMachines/SMF/releases/tag/v2.1.7), [2.1.2](https://github.com/SimpleMachines/SMF/releases/tag/v2.1.2) | 1 | PHP + SQL | password, csrf, session |
| [Discourse](https://github.com/discourse/discourse) | [2026.9.0](https://github.com/discourse/discourse/releases/tag/v2026.9.0), [2026.8.1](https://github.com/discourse/discourse/releases/tag/v2026.8.1), [2026.7.3](https://github.com/discourse/discourse/releases/tag/v2026.7.3) | 1 | Ruby + PostgreSQL + Redis | password, email, totp, sso |
| [Flarum](https://github.com/flarum/flarum) | [1.8.19](https://github.com/flarum/flarum/releases/tag/v1.8.19), [1.8.12](https://discuss.flarum.org/d/38617-january-patch-release-1812) | 1 | PHP + MySQL | password, email, spa |
| [NodeBB](https://github.com/NodeBB/NodeBB) | [4.16.2](https://github.com/NodeBB/NodeBB/releases/tag/v4.16.2), [4.15.2](https://github.com/NodeBB/NodeBB/releases/tag/v4.15.2), [4.14.10](https://github.com/NodeBB/NodeBB/releases/tag/v4.14.10) | 1 | Node + Redis/PostgreSQL/MongoDB | password, email, spa |
| [Vanilla Forums](https://github.com/vanilla/vanilla) | **À résoudre** | 3 | PHP + MySQL | password, email, sso |
| [FluxBB](https://github.com/fluxbb/fluxbb) | [1.5.11](https://github.com/fluxbb/fluxbb/releases/tag/fluxbb-1.5.11), [1.4.13](https://github.com/fluxbb/fluxbb/releases/tag/fluxbb-1.4.13) | 3 | PHP + SQL | password, csrf |
| [bbPress](https://github.com/bbpress/bbPress) | [2.6.11](https://github.com/bbpress/bbPress/releases/tag/2.6.11), [2.6.2](https://github.com/bbpress/bbPress/releases/tag/2.6.2) | 2 | WordPress extension | password, email |
| [Apache Answer](https://github.com/apache/answer) | [2.0.3](https://github.com/apache/answer/releases/tag/v2.0.3), [2.0.0](https://github.com/apache/answer/releases/tag/v2.0.0) | 2 | Go + SQL | password, email, spa |
| [Lemmy](https://github.com/LemmyNet/lemmy) | [0.19.20](https://github.com/LemmyNet/lemmy/releases/tag/0.19.20), [0.19.19](https://github.com/LemmyNet/lemmy/releases/tag/0.19.19) | 2 | Rust + PostgreSQL | password, email, totp |

## CMS et contenu

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [WordPress](https://github.com/WordPress/WordPress) | [7.1.3](https://github.com/WordPress/WordPress/releases/tag/7.1.3), [7.0.7](https://github.com/WordPress/WordPress/releases/tag/7.0.7), [6.9.10](https://github.com/WordPress/WordPress/releases/tag/6.9.10), [6.8.11](https://github.com/WordPress/WordPress/releases/tag/6.8.11), [6.7.10](https://github.com/WordPress/WordPress/releases/tag/6.7.10) | 1 | PHP + MySQL | password, email, session |
| [Joomla](https://github.com/joomla/joomla-cms) | [6.1.4](https://github.com/joomla/joomla-cms/releases/tag/6.1.4), [5.4.9](https://github.com/joomla/joomla-cms/releases/tag/5.4.9), [4.4.14 †](https://downloads.joomla.org/cms/joomla4/4-4-14), [3.10.12 †](https://downloads.joomla.org/cms/joomla3/3-10-12) | 1 | PHP + SQL | password, email, totp, webauthn |
| [Drupal](https://github.com/drupal/drupal) | [11.4.8](https://github.com/drupal/drupal/releases/tag/11.4.8), [11.3.18](https://github.com/drupal/drupal/releases/tag/11.3.18), [10.6.18](https://github.com/drupal/drupal/releases/tag/10.6.18), [9.5.11 †](https://www.drupal.org/project/drupal/releases/9.5.11), [7.103 †](https://www.drupal.org/project/drupal/releases/7.103) | 1 | PHP + SQL | password, email, reauth |
| [TYPO3](https://github.com/typo3/typo3) | [14.3.7](https://github.com/TYPO3/typo3/releases/tag/v14.3.7), [13.4.35](https://github.com/TYPO3/typo3/releases/tag/v13.4.35) | 2 | PHP + SQL | password, email, totp |
| [Ghost](https://github.com/TryGhost/Ghost) | [6.69.0](https://github.com/TryGhost/Ghost/releases/tag/v6.69.0), [6.68.0](https://github.com/TryGhost/Ghost/releases/tag/v6.68.0), [6.67.0](https://github.com/TryGhost/Ghost/releases/tag/v6.67.0) | 1 | Node + MySQL | password, email, magiclink |
| [Grav](https://github.com/getgrav/grav) | [2.2.5](https://github.com/getgrav/grav/releases/tag/2.2.5), [2.1.12](https://github.com/getgrav/grav/releases/tag/2.1.12), [1.7.53.5](https://github.com/getgrav/grav/releases/tag/1.7.53.5) | 2 | PHP + flat files + Admin plugin | password, totp |
| [Concrete CMS](https://github.com/concretecms/concretecms) | [9.5.5](https://github.com/concretecms/concretecms/releases/tag/9.5.5), [9.4.8](https://github.com/concretecms/concretecms/releases/tag/9.4.8) | 2 | PHP + MySQL | password, email |
| [Contao](https://github.com/contao/contao) | [6.0.2](https://github.com/contao/contao/releases/tag/6.0.2), [5.7.13](https://github.com/contao/contao/releases/tag/5.7.13), [5.3.51](https://github.com/contao/contao/releases/tag/5.3.51) | 2 | PHP + MySQL | password, email, totp |
| [ProcessWire](https://github.com/processwire/processwire) | [3.0.259](https://github.com/processwire/processwire/releases/tag/3.0.259), [3.0.210](https://github.com/processwire/processwire/releases/tag/3.0.210) | 2 | PHP + MySQL | password, email |
| [Craft CMS](https://github.com/craftcms/cms) | [5.11.5](https://github.com/craftcms/cms/releases/tag/5.11.5), [4.18.9](https://github.com/craftcms/cms/releases/tag/4.18.9) | 2 | PHP + SQL; edition/license review | password, email, totp |
| [Statamic](https://github.com/statamic/cms) | [6.35.1](https://github.com/statamic/cms/releases/tag/v6.35.1), [6.34.1](https://github.com/statamic/cms/releases/tag/v6.34.1), [5.74.5](https://github.com/statamic/cms/releases/tag/v5.74.5) | 3 | PHP; edition/license review | password, email |
| [Silverstripe CMS](https://github.com/silverstripe/silverstripe-framework) | [6.2.11](https://github.com/silverstripe/silverstripe-framework/releases/tag/6.2.11), [6.2.4](https://github.com/silverstripe/silverstripe-framework/releases/tag/6.2.4) | 2 | PHP + SQL | password, email |
| [Bolt CMS](https://github.com/bolt/core) | [6.1.8](https://github.com/bolt/core/releases/tag/6.1.8), [6.0.3](https://github.com/bolt/core/releases/tag/6.0.3) | 3 | PHP + SQL | password, email |
| [Plone](https://github.com/plone/Products.CMFPlone) | [6.2.2](https://github.com/plone/Products.CMFPlone/releases/tag/6.2.2), [6.1.5](https://github.com/plone/Products.CMFPlone/releases/tag/6.1.5) | 2 | Python + ZODB | password, email, sso |
| [Wagtail](https://github.com/wagtail/wagtail) | [8.0](https://github.com/wagtail/wagtail/releases/tag/v8.0), [7.4.3](https://github.com/wagtail/wagtail/releases/tag/v7.4.3), [7.3.4](https://github.com/wagtail/wagtail/releases/tag/v7.3.4) | 2 | Python + SQL | password, email, admin |
| [Strapi](https://github.com/strapi/strapi) | [5.57.0](https://github.com/strapi/strapi/releases/tag/v5.57.0), [5.56.0](https://github.com/strapi/strapi/releases/tag/v5.56.0), [5.55.1](https://github.com/strapi/strapi/releases/tag/v5.55.1) | 1 | Node + SQL | password, email, spa, admin |
| [Directus](https://github.com/directus/directus) | [12.5.0](https://github.com/directus/directus/releases/tag/v12.5.0), [12.4.1](https://github.com/directus/directus/releases/tag/v12.4.1), [12.3.1](https://github.com/directus/directus/releases/tag/v12.3.1) | 1 | Node + SQL; license review | password, email, totp, sso |
| [Payload](https://github.com/payloadcms/payload) | [3.90.2](https://github.com/payloadcms/payload/releases/tag/v3.90.2), [3.89.0](https://github.com/payloadcms/payload/releases/tag/v3.89.0), [3.88.0](https://github.com/payloadcms/payload/releases/tag/v3.88.0) | 2 | Node + SQL/MongoDB | password, email, spa |
| [Umbraco](https://github.com/umbraco/Umbraco-CMS) | [18.2.1](https://github.com/umbraco/Umbraco-CMS/releases/tag/release-18.2.1), [17.7.1](https://github.com/umbraco/Umbraco-CMS/releases/tag/release-17.7.1), [13.16.2](https://github.com/umbraco/Umbraco-CMS/releases/tag/release-13.16.2) | 2 | .NET + SQL | password, email, admin |
| [DNN Platform](https://github.com/dnnsoftware/Dnn.Platform) | [10.4.0](https://github.com/dnnsoftware/Dnn.Platform/releases/tag/v10.4.0), [10.3.3](https://github.com/dnnsoftware/Dnn.Platform/releases/tag/v10.3.3), [10.2.5](https://github.com/dnnsoftware/Dnn.Platform/releases/tag/v10.2.5) | 3 | Windows IIS + SQL Server | password, email, admin |

## Wikis et documentation

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [MediaWiki](https://github.com/wikimedia/mediawiki) | [1.46.2](https://github.com/wikimedia/mediawiki/releases/tag/1.46.2), [1.45.6](https://github.com/wikimedia/mediawiki/releases/tag/1.45.6), [1.43.11](https://github.com/wikimedia/mediawiki/releases/tag/1.43.11) | 1 | PHP + SQL | password, email, reauth |
| [DokuWiki](https://github.com/dokuwiki/dokuwiki) | [2026-07-14c](https://github.com/dokuwiki/dokuwiki/releases/tag/release-2026-07-14c), [2025-05-14b](https://github.com/dokuwiki/dokuwiki/releases/tag/release-2025-05-14b), [2024-02-06b](https://github.com/dokuwiki/dokuwiki/releases/tag/release-2024-02-06b) | 1 | PHP + flat files | password, email, csrf |
| [BookStack](https://github.com/BookStackApp/BookStack) | [26.09.1](https://github.com/BookStackApp/BookStack/releases/tag/v26.09.1), [26.05.5](https://github.com/BookStackApp/BookStack/releases/tag/v26.05.5), [26.03.5](https://github.com/BookStackApp/BookStack/releases/tag/v26.03.5) | 1 | PHP + MySQL | password, email, totp, sso |
| [Wiki.js](https://github.com/Requarks/wiki) | [2.5.315](https://github.com/requarks/wiki/releases/tag/v2.5.315) | 2 | Node + SQL | password, email, sso, spa |
| [XWiki](https://github.com/xwiki/xwiki-platform) | [18.8.0](https://github.com/xwiki/xwiki-platform/releases/tag/xwiki-platform-18.8.0), [17.10.13](https://github.com/xwiki/xwiki-platform/releases/tag/xwiki-platform-17.10.13), [16.10.19](https://github.com/xwiki/xwiki-platform/releases/tag/xwiki-platform-16.10.19) | 2 | Java + SQL | password, email, sso |
| [Joplin Server](https://github.com/laurent22/joplin) | [3.7.2](https://joplinapp.org/help/about/changelog/server/), [3.6.1](https://joplinapp.org/help/about/changelog/server/), [3.5.2](https://joplinapp.org/help/about/changelog/server/) | 2 | Node + PostgreSQL | password, email |
| [Outline](https://github.com/outline/outline) | [1.10.1](https://github.com/outline/outline/releases/tag/v1.10.1), [1.9.2](https://github.com/outline/outline/releases/tag/v1.9.2), [1.8.1](https://github.com/outline/outline/releases/tag/v1.8.1) | 2 | Node + PostgreSQL + Redis | magiclink, sso |

## Commerce

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [PrestaShop](https://github.com/PrestaShop/PrestaShop) | [9.2.0](https://github.com/PrestaShop/PrestaShop/releases/tag/9.2.0), [9.1.5](https://github.com/PrestaShop/PrestaShop/releases/tag/9.1.5), [8.2.8](https://github.com/PrestaShop/PrestaShop/releases/tag/8.2.8) | 1 | PHP + MySQL | password, email, customer-admin |
| [WooCommerce](https://github.com/woocommerce/woocommerce) | [11.2.0](https://github.com/woocommerce/woocommerce/releases/tag/11.2.0), [11.1.2](https://github.com/woocommerce/woocommerce/releases/tag/11.1.2) | 1 | WordPress extension | password, email, customer-admin |
| [Magento Open Source](https://github.com/magento/magento2) | [2.4.9](https://github.com/magento/magento2/releases/tag/2.4.9), [2.4.8-p5](https://github.com/magento/magento2/releases/tag/2.4.8-p5), [2.4.7-p10](https://github.com/magento/magento2/releases/tag/2.4.7-p10) | 2 | PHP + MySQL + search | password, email, totp, customer-admin |
| [OpenCart](https://github.com/opencart/opencart) | [4.1.0.4](https://github.com/opencart/opencart/releases/tag/4.1.0.4), [3.0.5.1](https://github.com/opencart/opencart/releases/tag/3.0.5.1) | 1 | PHP + MySQL | password, email, customer-admin |
| [Shopware](https://github.com/shopware/shopware) | [6.7.15.1](https://github.com/shopware/shopware/releases/tag/v6.7.15.1), [6.6.10.29](https://github.com/shopware/shopware/releases/tag/v6.6.10.29) | 2 | PHP + MySQL | password, email, customer-admin |
| [Sylius](https://github.com/Sylius/Sylius) | [2.3.0](https://github.com/Sylius/Sylius/releases/tag/v2.3.0), [2.2.10](https://github.com/Sylius/Sylius/releases/tag/v2.2.10), [1.14.20](https://github.com/Sylius/Sylius/releases/tag/v1.14.20) | 2 | PHP + SQL | password, email, customer-admin |
| [Saleor](https://github.com/saleor/saleor) | [3.23.40](https://github.com/saleor/saleor/releases/tag/3.23.40), [3.22.73](https://github.com/saleor/saleor/releases/tag/3.22.73), [3.21.71](https://github.com/saleor/saleor/releases/tag/3.21.71) | 2 | Python + PostgreSQL + frontend | password, email, api |
| [Medusa](https://github.com/medusajs/medusa) | [2.21.2](https://github.com/medusajs/medusa/releases/tag/v2.21.2), [2.20.1](https://github.com/medusajs/medusa/releases/tag/v2.20.1), [2.19.0](https://github.com/medusajs/medusa/releases/tag/v2.19.0) | 2 | Node + PostgreSQL + frontend | password, email, api |
| [nopCommerce](https://github.com/nopSolutions/nopCommerce) | [4.90.8](https://github.com/nopSolutions/nopCommerce/releases/tag/release-4.90.8), [4.90.0](https://github.com/nopSolutions/nopCommerce/releases/tag/release-4.90.0) | 2 | .NET + SQL | password, email, customer-admin |
| [Bagisto](https://github.com/bagisto/bagisto) | [2.5.0](https://github.com/bagisto/bagisto/releases/tag/v2.5.0), [2.4.13](https://github.com/bagisto/bagisto/releases/tag/v2.4.13) | 2 | PHP + MySQL | password, email, customer-admin |

## Formation

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [Moodle](https://github.com/moodle/moodle) | [5.3.0](https://github.com/moodle/moodle/releases/tag/v5.3.0), [5.2.4](https://github.com/moodle/moodle/releases/tag/v5.2.4), [5.1.8](https://github.com/moodle/moodle/releases/tag/v5.1.8), [5.0.11](https://github.com/moodle/moodle/releases/tag/v5.0.11), [4.5.15](https://github.com/moodle/moodle/releases/tag/v4.5.15) | 1 | PHP + SQL | password, email, expiry, sso |
| [Chamilo](https://github.com/chamilo/chamilo-lms) | [3.0.1](https://github.com/chamilo/chamilo-lms/releases/tag/v3.0.1), [2.0.3](https://github.com/chamilo/chamilo-lms/releases/tag/v2.0.3), [1.11.40](https://github.com/chamilo/chamilo-lms/releases/tag/v1.11.40) | 2 | PHP + MySQL | password, email, expiry |
| [Open edX](https://github.com/openedx/edx-platform) | [Verawood.1](https://docs.openedx.org/en/latest/community/release_notes/named_release_branches_and_tags.html), [Ulmo.4 †](https://docs.openedx.org/en/latest/community/release_notes/named_release_branches_and_tags.html), [Teak.3 †](https://docs.openedx.org/en/latest/community/release_notes/named_release_branches_and_tags.html) | 3 | Python + multiple services | password, email, sso |
| [Canvas LMS](https://github.com/instructure/canvas-lms) | **À résoudre** | 3 | Ruby + PostgreSQL + Redis | password, email, sso |
| [ILIAS](https://github.com/ILIAS-eLearning/ILIAS) | [11.5](https://github.com/ILIAS-eLearning/ILIAS/releases/tag/v11.5), [10.12](https://github.com/ILIAS-eLearning/ILIAS/releases/tag/v10.12), [9.24](https://github.com/ILIAS-eLearning/ILIAS/releases/tag/v9.24) | 2 | PHP + MySQL | password, email, expiry |

## Collaboration et médias

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [Nextcloud](https://github.com/nextcloud/server) | [35.0.1](https://github.com/nextcloud/server/releases/tag/v35.0.1), [34.0.4](https://github.com/nextcloud/server/releases/tag/v34.0.4), [33.0.9](https://github.com/nextcloud/server/releases/tag/v33.0.9), [32.0.15](https://github.com/nextcloud/server/releases/tag/v32.0.15) | 1 | PHP + SQL | password, email, totp, webauthn, app-password, sso |
| [ownCloud Server](https://github.com/owncloud/core) | [11.0.1](https://github.com/owncloud/core/releases/tag/v11.0.1), [10.16.6](https://github.com/owncloud/core/releases/tag/v10.16.6) | 2 | PHP + SQL | password, email, app-password, sso |
| [Seafile](https://github.com/haiwen/seafile) | **À résoudre** | 2 | C/Python + SQL | password, email, totp |
| [Pydio Cells](https://github.com/pydio/cells) | [5.1.0](https://github.com/pydio/cells/releases/tag/v5.1.0), [5.0.3](https://github.com/pydio/cells/releases/tag/v5.0.3), [4.4.18](https://github.com/pydio/cells/releases/tag/v4.4.18) | 2 | Go + SQL | password, email, sso |
| [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) | [3.3.0](https://github.com/paperless-ngx/paperless-ngx/releases/tag/v3.3.0), [3.2.1](https://github.com/paperless-ngx/paperless-ngx/releases/tag/v3.2.1), [3.1.3](https://github.com/paperless-ngx/paperless-ngx/releases/tag/v3.1.3) | 2 | Python + SQL + Redis | password, email, totp, sso |
| [Immich](https://github.com/immich-app/immich) | [3.3.0](https://github.com/immich-app/immich/releases/tag/v3.3.0), [3.2.4](https://github.com/immich-app/immich/releases/tag/v3.2.4) | 2 | Node + PostgreSQL + Redis + ML | password, sso, spa |
| [PhotoPrism](https://github.com/photoprism/photoprism) | [261007-65faaae5d](https://github.com/photoprism/photoprism/releases/tag/261007-65faaae5d), [260919-28c46a116](https://github.com/photoprism/photoprism/releases/tag/260919-28c46a116), [260523-0544f71c1](https://github.com/photoprism/photoprism/releases/tag/260523-0544f71c1) | 2 | Go + SQL | password, app-password |
| [Jellyfin](https://github.com/jellyfin/jellyfin) | [12.2](https://github.com/jellyfin/jellyfin/releases/tag/v12.2), [12.1](https://github.com/jellyfin/jellyfin/releases/tag/v12.1), [12.0](https://github.com/jellyfin/jellyfin/releases/tag/v12.0) | 2 | .NET + SQLite | password, admin, session |
| [Navidrome](https://github.com/navidrome/navidrome) | [0.64.2](https://github.com/navidrome/navidrome/releases/tag/v0.64.2), [0.63.2](https://github.com/navidrome/navidrome/releases/tag/v0.63.2), [0.62.0](https://github.com/navidrome/navidrome/releases/tag/v0.62.0) | 2 | Go + SQLite | password, admin, spa |
| [Mattermost](https://github.com/mattermost/mattermost) | [11.11.1](https://github.com/mattermost/mattermost/releases/tag/v11.11.1), [11.10.2](https://github.com/mattermost/mattermost/releases/tag/v11.10.2), [10.11.24](https://github.com/mattermost/mattermost/releases/tag/v10.11.24) | 1 | Go + PostgreSQL | password, email, totp, sso |
| [Rocket.Chat](https://github.com/RocketChat/Rocket.Chat) | [8.9.0](https://github.com/RocketChat/Rocket.Chat/releases/tag/8.9.0), [8.8.1](https://github.com/RocketChat/Rocket.Chat/releases/tag/8.8.1) | 2 | Node + MongoDB | password, email, totp, sso |
| [Zulip](https://github.com/zulip/zulip) | [12.3](https://github.com/zulip/zulip/releases/tag/12.3), [12.2](https://github.com/zulip/zulip/releases/tag/12.2), [11.6](https://github.com/zulip/zulip/releases/tag/11.6) | 2 | Python + PostgreSQL + services | password, email, totp, sso |
| [Mastodon](https://github.com/mastodon/mastodon) | [4.7.3](https://github.com/mastodon/mastodon/releases/tag/v4.7.3), [4.6.9](https://github.com/mastodon/mastodon/releases/tag/v4.6.9), [4.5.19](https://github.com/mastodon/mastodon/releases/tag/v4.5.19) | 2 | Ruby + PostgreSQL + Redis | password, email, totp, webauthn |
| [Friendica](https://github.com/friendica/friendica) | [2026.05](https://github.com/friendica/friendica/releases/tag/2026.05), [2024.12](https://github.com/friendica/friendica/releases/tag/2024.12), [2023.12](https://github.com/friendica/friendica/releases/tag/2023.12) | 3 | PHP + SQL | password, email |
| [HumHub](https://github.com/humhub/humhub) | [1.18.6](https://github.com/humhub/humhub/releases/tag/v1.18.6), [1.17.6](https://github.com/humhub/humhub/releases/tag/v1.17.6) | 2 | PHP + SQL | password, email, sso |

## Développement et projets

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [Gitea](https://github.com/go-gitea/gitea) | [28.1.0](https://github.com/go-gitea/gitea/releases/tag/v28.1.0), [28.0.0](https://github.com/go-gitea/gitea/releases/tag/v28.0.0), [1.27.3](https://github.com/go-gitea/gitea/releases/tag/v1.27.3) | 1 | Go + SQL | password, email, totp, webauthn, token |
| [Forgejo](https://forgejo.org/releases/) | [16.0.5](https://forgejo.org/releases/), [15.0.9](https://forgejo.org/releases/) | 1 | Go + SQL | password, email, totp, webauthn, token |
| [GitLab CE](https://github.com/gitlabhq/gitlabhq) | [19.4.1](https://github.com/gitlabhq/gitlabhq/releases/tag/v19.4.1), [19.3.3](https://github.com/gitlabhq/gitlabhq/releases/tag/v19.3.3), [18.11.12](https://github.com/gitlabhq/gitlabhq/releases/tag/v18.11.12) | 2 | Ruby + PostgreSQL + Redis + services | password, email, totp, webauthn, sso |
| [Jenkins](https://github.com/jenkinsci/jenkins) | [2.585](https://github.com/jenkinsci/jenkins/releases/tag/jenkins-2.585), [2.580.1](https://github.com/jenkinsci/jenkins/releases/tag/jenkins-2.580.1) | 2 | Java | password, token, sso |
| [Redmine](https://github.com/redmine/redmine) | [7.0.2](https://github.com/redmine/redmine/releases/tag/7.0.2), [6.1.5](https://github.com/redmine/redmine/releases/tag/6.1.5), [5.1.13](https://github.com/redmine/redmine/releases/tag/5.1.13) | 1 | Ruby + SQL | password, email, expiry |
| [OpenProject](https://github.com/opf/openproject) | [17.9.1](https://github.com/opf/openproject/releases/tag/v17.9.1), [17.8.1](https://github.com/opf/openproject/releases/tag/v17.8.1), [17.7.2](https://github.com/opf/openproject/releases/tag/v17.7.2) | 2 | Ruby + PostgreSQL | password, email, totp, sso |
| [Taiga](https://github.com/taigaio/taiga-back) | [6.10.2](https://github.com/taigaio/taiga-back/releases/tag/6.10.2), [6.9.0](https://github.com/taigaio/taiga-back/releases/tag/6.9.0), [6.8.3](https://github.com/taigaio/taiga-back/releases/tag/6.8.3) | 2 | Python + PostgreSQL + frontend | password, email, spa |
| [Wekan](https://github.com/wekan/wekan) | [12.23](https://github.com/wekan/wekan/releases/tag/v12.23), [12.22](https://github.com/wekan/wekan/releases/tag/v12.22), [12.21](https://github.com/wekan/wekan/releases/tag/v12.21) | 2 | Node + MongoDB | password, email, sso |
| [Kanboard](https://github.com/kanboard/kanboard) | [1.2.54](https://github.com/kanboard/kanboard/releases/tag/v1.2.54), [1.2.45](https://github.com/kanboard/kanboard/releases/tag/v1.2.45) | 1 | PHP + SQL | password, totp, sso |
| [Vikunja](https://github.com/go-vikunja/vikunja) | [2.7.0](https://github.com/go-vikunja/vikunja/releases/tag/v2.7.0), [2.6.0](https://github.com/go-vikunja/vikunja/releases/tag/v2.6.0), [2.5.0](https://github.com/go-vikunja/vikunja/releases/tag/v2.5.0) | 2 | Go + SQL | password, email, totp, sso |
| [Plane](https://github.com/makeplane/plane) | [1.4.2](https://github.com/makeplane/plane/releases/tag/v1.4.2), [1.3.1](https://github.com/makeplane/plane/releases/tag/v1.3.1) | 2 | Python/Node + PostgreSQL + Redis | password, email, magiclink, sso |
| [Gerrit](https://github.com/GerritCodeReview/gerrit) | [3.14.4](https://github.com/GerritCodeReview/gerrit/releases/tag/v3.14.4), [3.13.10](https://github.com/GerritCodeReview/gerrit/releases/tag/v3.13.10), [3.12.11](https://github.com/GerritCodeReview/gerrit/releases/tag/v3.12.11) | 3 | Java | password, sso, token |
| [Nexus Repository](https://github.com/sonatype/nexus-public) | [3.96.4-01](https://github.com/sonatype/nexus-public/releases/tag/release-3.96.4-01), [3.95.4-01](https://github.com/sonatype/nexus-public/releases/tag/release-3.95.4-01), [3.94.2-01](https://github.com/sonatype/nexus-public/releases/tag/release-3.94.2-01) | 3 | Java + SQL; edition review | password, reauth, admin |
| [Harbor](https://github.com/goharbor/harbor) | [2.15.3](https://github.com/goharbor/harbor/releases/tag/v2.15.3), [2.14.5](https://github.com/goharbor/harbor/releases/tag/v2.14.5), [2.13.6](https://github.com/goharbor/harbor/releases/tag/v2.13.6) | 2 | Go + PostgreSQL + Redis | password, sso, token |

## Support et inventaire

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [GLPI](https://github.com/glpi-project/glpi) | [12.0.0](https://github.com/glpi-project/glpi/releases/tag/12.0.0), [11.0.11](https://github.com/glpi-project/glpi/releases/tag/11.0.11), [10.0.28](https://github.com/glpi-project/glpi/releases/tag/10.0.28) | 1 | PHP + MySQL | password, email, sso |
| [Zammad](https://github.com/zammad/zammad) | [7.2.2](https://github.com/zammad/zammad/releases/tag/7.2.2), [7.1.3](https://github.com/zammad/zammad/releases/tag/7.1.3), [7.0.3](https://github.com/zammad/zammad/releases/tag/7.0.3) | 1 | Ruby + PostgreSQL + search | password, email, totp, sso |
| [osTicket](https://github.com/osTicket/osTicket) | [1.18.4](https://github.com/osTicket/osTicket/releases/tag/v1.18.4), [1.17.8](https://github.com/osTicket/osTicket/releases/tag/v1.17.8) | 1 | PHP + MySQL | password, email, customer-admin |
| [FreeScout](https://github.com/freescout-help-desk/freescout) | [1.8.245](https://github.com/freescout-help-desk/freescout/releases/tag/1.8.245), [1.8.236](https://github.com/freescout-help-desk/freescout/releases/tag/1.8.236) | 2 | PHP + MySQL | password, email |
| [Helpy](https://github.com/helpyio/helpy) | [2.8.0](https://github.com/helpyio/helpy/releases/tag/2.8.0), [2.7.0](https://github.com/helpyio/helpy/releases/tag/2.7.0), [2.6.0](https://github.com/helpyio/helpy/releases/tag/2.6.0) | 3 | Ruby + PostgreSQL | password, email |
| [UVdesk](https://github.com/uvdesk/community-skeleton) | [1.1.8](https://github.com/uvdesk/community-skeleton/releases/tag/v1.1.8), [1.0.18](https://github.com/uvdesk/community-skeleton/releases/tag/v1.0.18) | 2 | PHP + MySQL | password, email |
| [Snipe-IT](https://github.com/snipe/snipe-it) | [8.8.0](https://github.com/grokability/snipe-it/releases/tag/v8.8.0), [8.7.2](https://github.com/grokability/snipe-it/releases/tag/v8.7.2), [8.6.3](https://github.com/grokability/snipe-it/releases/tag/v8.6.3) | 1 | PHP + MySQL | password, email, totp, sso |

## Gestion et CRM

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [Dolibarr](https://github.com/Dolibarr/dolibarr) | [24.0.2](https://github.com/Dolibarr/dolibarr/releases/tag/24.0.2), [23.0.4](https://github.com/Dolibarr/dolibarr/releases/tag/23.0.4), [22.0.5](https://github.com/Dolibarr/dolibarr/releases/tag/22.0.5) | 1 | PHP + SQL | password, email |
| [Odoo Community](https://github.com/odoo/odoo) | **À résoudre** | 1 | Python + PostgreSQL | password, email, totp, sso |
| [ERPNext](https://github.com/frappe/erpnext) | [16.50.0](https://github.com/frappe/erpnext/releases/tag/v16.50.0), [16.49.0](https://github.com/frappe/erpnext/releases/tag/v16.49.0), [15.122.0](https://github.com/frappe/erpnext/releases/tag/v15.122.0) | 2 | Python + MariaDB + Redis + Frappe | password, email, totp, expiry |
| [SuiteCRM](https://github.com/salesagility/SuiteCRM) | [7.15.2](https://github.com/SuiteCRM/SuiteCRM/releases/tag/v7.15.2), [7.14.9](https://github.com/SuiteCRM/SuiteCRM/releases/tag/v7.14.9) | 2 | PHP + MySQL | password, email, expiry |
| [EspoCRM](https://github.com/espocrm/espocrm) | [10.0.9](https://github.com/espocrm/espocrm/releases/tag/10.0.9), [10.0.0](https://github.com/espocrm/espocrm/releases/tag/10.0.0) | 2 | PHP + MySQL | password, email, totp |
| [Invoice Ninja](https://github.com/invoiceninja/invoiceninja) | [5.13.44](https://github.com/invoiceninja/invoiceninja/releases/tag/v5.13.44), [5.13.35](https://github.com/invoiceninja/invoiceninja/releases/tag/v5.13.35) | 2 | PHP + MySQL; license review | password, email, totp, customer-admin |
| [Akaunting](https://github.com/akaunting/akaunting) | [3.2.4](https://github.com/akaunting/akaunting/releases/tag/3.2.4), [3.1.21](https://github.com/akaunting/akaunting/releases/tag/3.1.21) | 2 | PHP + MySQL; modules review | password, email |
| [Kimai](https://github.com/kimai/kimai) | [2.69.0](https://github.com/kimai/kimai/releases/tag/2.69.0), [2.68.0](https://github.com/kimai/kimai/releases/tag/2.68.0), [2.67.0](https://github.com/kimai/kimai/releases/tag/2.67.0) | 2 | PHP + SQL | password, email, totp, sso |
| [Mautic](https://github.com/mautic/mautic) | [7.2.1](https://github.com/mautic/mautic/releases/tag/7.2.1), [6.0.9](https://github.com/mautic/mautic/releases/tag/6.0.9), [5.2.11](https://github.com/mautic/mautic/releases/tag/5.2.11) | 2 | PHP + MySQL | password, email, admin |
| [LimeSurvey](https://github.com/LimeSurvey/LimeSurvey) | [7.5.0+261001](https://github.com/LimeSurvey/LimeSurvey/releases/tag/7.5.0%2B261001), [7.4.0+260928](https://github.com/LimeSurvey/LimeSurvey/releases/tag/7.4.0%2B260928), [7.3.0+260922](https://github.com/LimeSurvey/LimeSurvey/releases/tag/7.3.0%2B260922) | 2 | PHP + SQL | password, email |

## Identité et annuaire

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [Keycloak](https://github.com/keycloak/keycloak) | [26.8.0](https://github.com/keycloak/keycloak/releases/tag/26.8.0), [26.7.5](https://github.com/keycloak/keycloak/releases/tag/26.7.5), [26.6.7](https://github.com/keycloak/keycloak/releases/tag/26.6.7) | 1 | Java + SQL | password, email, totp, webauthn, expiry, sso, recovery |
| [authentik](https://github.com/goauthentik/authentik) | [2026.8.3](https://github.com/goauthentik/authentik/releases/tag/version%2F2026.8.3), [2026.5.7](https://github.com/goauthentik/authentik/releases/tag/version%2F2026.5.7), [2026.2.7](https://github.com/goauthentik/authentik/releases/tag/version%2F2026.2.7) | 1 | Python + PostgreSQL + worker | password, email, totp, webauthn, sso, recovery |
| [Authelia](https://github.com/authelia/authelia) | [4.39.28](https://github.com/authelia/authelia/releases/tag/v4.39.28), [4.39.19](https://github.com/authelia/authelia/releases/tag/v4.39.19) | 1 | Go + SQL/LDAP | password, email, totp, webauthn, sso |
| [ZITADEL](https://github.com/zitadel/zitadel) | [4.19.4](https://github.com/zitadel/zitadel/releases/tag/v4.19.4), [4.18.0](https://github.com/zitadel/zitadel/releases/tag/v4.18.0), [3.4.15](https://github.com/zitadel/zitadel/releases/tag/v3.4.15) | 2 | Go + PostgreSQL | password, email, totp, webauthn, sso |
| [Kanidm](https://github.com/kanidm/kanidm) | [1.11.2](https://github.com/kanidm/kanidm/releases/tag/v1.11.2), [1.10.5](https://github.com/kanidm/kanidm/releases/tag/v1.10.5), [1.9.4](https://github.com/kanidm/kanidm/releases/tag/v1.9.4) | 2 | Rust | password, webauthn, sso, recovery |
| [Apereo CAS](https://github.com/apereo/cas) | [8.0.2](https://github.com/apereo/cas/releases/tag/v8.0.2), [7.3.8.3](https://github.com/apereo/cas/releases/tag/v7.3.8.3) | 2 | Java + backend | password, sso, totp, webauthn |
| [Ory Kratos](https://github.com/ory/kratos) | [26.2.0](https://github.com/ory/kratos/releases/tag/v26.2.0), [25.4.0](https://github.com/ory/kratos/releases/tag/v25.4.0), [1.3.1](https://github.com/ory/kratos/releases/tag/v1.3.1) | 1 | Go + SQL + frontend | password, email, totp, webauthn, recovery |
| [LLDAP](https://github.com/lldap/lldap) | [0.6.3](https://github.com/lldap/lldap/releases/tag/v0.6.3), [0.5.0](https://github.com/lldap/lldap/releases/tag/v0.5.0), [0.4.3](https://github.com/lldap/lldap/releases/tag/v0.4.3) | 1 | Rust + SQL | password, email, ldap |
| [LDAP Account Manager](https://github.com/LDAPAccountManager/lam) | [9.7](https://github.com/LDAPAccountManager/lam/releases/tag/9.7), [9.6.1](https://github.com/LDAPAccountManager/lam/releases/tag/9.6.1), [9.5.2](https://github.com/LDAPAccountManager/lam/releases/tag/9.5.2) | 2 | PHP + LDAP | password, expiry, ldap |
| [Self Service Password](https://github.com/ltb-project/self-service-password) | [1.8.2](https://github.com/ltb-project/self-service-password/releases/tag/v1.8.2), [1.7.3](https://github.com/ltb-project/self-service-password/releases/tag/v1.7.3), [1.6.1](https://github.com/ltb-project/self-service-password/releases/tag/v1.6.1) | 1 | PHP + LDAP | password, email, expiry, ldap |
| [SimpleSAMLphp](https://github.com/simplesamlphp/simplesamlphp) | [2.5.3.1](https://github.com/simplesamlphp/simplesamlphp/releases/tag/v2.5.3.1), [2.4.10](https://github.com/simplesamlphp/simplesamlphp/releases/tag/v2.4.10) | 2 | PHP + identity backend | password, sso |
| [privacyIDEA](https://github.com/privacyidea/privacyidea) | [3.14](https://github.com/privacyidea/privacyidea/releases/tag/v3.14), [3.13.4](https://github.com/privacyidea/privacyidea/releases/tag/v3.13.4) | 2 | Python + SQL | password, totp, webauthn, recovery |
| [FusionAuth](https://github.com/FusionAuth/fusionauth-issues) | **À résoudre** | 3 | Java + SQL; license/edition review | password, email, totp, sso |

## Coffres et secrets

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [Vaultwarden](https://github.com/dani-garcia/vaultwarden) | [1.37.4](https://github.com/dani-garcia/vaultwarden/releases/tag/1.37.4), [1.36.0](https://github.com/dani-garcia/vaultwarden/releases/tag/1.36.0), [1.35.8](https://github.com/dani-garcia/vaultwarden/releases/tag/1.35.8) | 1 | Rust + SQL | password, email, totp, webauthn, recovery |
| [Passbolt](https://github.com/passbolt/passbolt_api) | [5.16.0](https://github.com/passbolt/passbolt_api/releases/tag/v5.16.0), [5.15.0](https://github.com/passbolt/passbolt_api/releases/tag/v5.15.0), [5.14.3](https://github.com/passbolt/passbolt_api/releases/tag/v5.14.3) | 2 | PHP + SQL + browser extension | password, email, totp, recovery |
| [Psono](https://github.com/psono/psono-server) | **À résoudre** | 2 | Python + PostgreSQL + frontend | password, email, totp, recovery |
| [TeamPass](https://github.com/nilsteampassnet/TeamPass) | [3.2.2.8](https://github.com/nilsteampassnet/TeamPass/releases/tag/3.2.2.8), [3.2.1.7](https://github.com/nilsteampassnet/TeamPass/releases/tag/3.2.1.7) | 2 | PHP + MySQL | password, email, totp |

## Exploitation et données

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [Grafana](https://github.com/grafana/grafana) | [13.2.3](https://github.com/grafana/grafana/releases/tag/v13.2.3), [13.1.7](https://github.com/grafana/grafana/releases/tag/v13.1.7), [12.4.12](https://github.com/grafana/grafana/releases/tag/v12.4.12) | 1 | Go + SQL | password, email, sso, token |
| [Zabbix](https://github.com/zabbix/zabbix) | [7.4.15](https://github.com/zabbix/zabbix/releases/tag/7.4.15), [7.0.31](https://github.com/zabbix/zabbix/releases/tag/7.0.31) | 2 | C/PHP + SQL | password, sso, admin |
| [Matomo](https://github.com/matomo-org/matomo) | [5.14.1](https://github.com/matomo-org/matomo/releases/tag/5.14.1) | 1 | PHP + MySQL | password, email, totp |
| [Metabase](https://github.com/metabase/metabase) | [0.64.1.1](https://github.com/metabase/metabase/releases/tag/v0.64.1.1), [0.63.19.4](https://github.com/metabase/metabase/releases/tag/v0.63.19.4) | 2 | Java + SQL | password, email, sso |
| [Apache Superset](https://github.com/apache/superset) | **À résoudre** | 2 | Python + SQL + Redis | password, sso, admin |
| [Portainer CE](https://github.com/portainer/portainer) | [2.45.2](https://github.com/portainer/portainer/releases/tag/2.45.2), [2.44.0](https://github.com/portainer/portainer/releases/tag/2.44.0), [2.43.0](https://github.com/portainer/portainer/releases/tag/2.43.0) | 3 | Go + container API | password, sso, admin |
| [Uptime Kuma](https://github.com/louislam/uptime-kuma) | [2.5.5](https://github.com/louislam/uptime-kuma/releases/tag/2.5.5), [2.4.0](https://github.com/louislam/uptime-kuma/releases/tag/2.4.0), [2.3.2](https://github.com/louislam/uptime-kuma/releases/tag/2.3.2) | 1 | Node + SQL | password, totp |
| [n8n](https://github.com/n8n-io/n8n) | [2.43.2](https://github.com/n8n-io/n8n/releases/tag/n8n%402.43.2), [2.42.5](https://github.com/n8n-io/n8n/releases/tag/n8n%402.42.5), [1.123.84](https://github.com/n8n-io/n8n/releases/tag/n8n%401.123.84) | 2 | Node + SQL; license review | password, email, totp |
| [act (auxiliaire CI, pas serveur web)](https://github.com/nektos/act) | [0.2.89](https://github.com/nektos/act/releases/tag/v0.2.89), [0.2.80](https://github.com/nektos/act/releases/tag/v0.2.80) | 3 | Container execution | infrastructure |

## Webmails

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [Roundcube](https://github.com/roundcube/roundcubemail) | [1.7.4](https://github.com/roundcube/roundcubemail/releases/tag/1.7.4), [1.6.19](https://github.com/roundcube/roundcubemail/releases/tag/1.6.19) | 1 | PHP + SQL + IMAP + password plugin | password, plugin, imap |
| [SnappyMail](https://github.com/the-djmaze/snappymail) | [2.38.2](https://github.com/the-djmaze/snappymail/releases/tag/v2.38.2), [2.37.3](https://github.com/the-djmaze/snappymail/releases/tag/v2.37.3), [2.36.4](https://github.com/the-djmaze/snappymail/releases/tag/v2.36.4) | 1 | PHP + IMAP + password backend | password, plugin, imap |
| [SOGo](https://github.com/Alinto/sogo) | [5.12.11](https://github.com/Alinto/sogo/releases/tag/SOGo-5.12.11), [5.12.2](https://github.com/Alinto/sogo/releases/tag/SOGo-5.12.2) | 2 | Objective-C + SQL + IMAP/LDAP | password, ldap, imap |

## Auxiliaires de laboratoire

| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |
|---|---|---|---|---|
| [Mailpit](https://github.com/axllent/mailpit) | [1.31.4](https://github.com/axllent/mailpit/releases/tag/v1.31.4), [1.30.7](https://github.com/axllent/mailpit/releases/tag/v1.30.7) | 1 | Go | infrastructure, email |
| [GreenMail](https://github.com/greenmail-mail-test/greenmail) | [2.1.14](https://github.com/greenmail-mail-test/greenmail/releases/tag/release-2.1.14), [2.1.5](https://github.com/greenmail-mail-test/greenmail/releases/tag/release-2.1.5) | 1 | Java | infrastructure, email, imap |
| [WireMock](https://github.com/wiremock/wiremock) | **À résoudre** | 1 | Java | infrastructure, faults |
| [Toxiproxy](https://github.com/Shopify/toxiproxy) | [2.12.0](https://github.com/Shopify/toxiproxy/releases/tag/v2.12.0), [2.11.0](https://github.com/Shopify/toxiproxy/releases/tag/v2.11.0), [2.10.0](https://github.com/Shopify/toxiproxy/releases/tag/v2.10.0) | 1 | Go | infrastructure, faults |
| [Pebble ACME](https://github.com/letsencrypt/pebble) | [2.10.1](https://github.com/letsencrypt/pebble/releases/tag/v2.10.1), [2.9.0](https://github.com/letsencrypt/pebble/releases/tag/v2.9.0), [2.8.0](https://github.com/letsencrypt/pebble/releases/tag/v2.8.0) | 2 | Go | infrastructure, tls |
| [Playwright](https://github.com/microsoft/playwright) | [1.64.0](https://github.com/microsoft/playwright/releases/tag/v1.64.0), [1.63.0](https://github.com/microsoft/playwright/releases/tag/v1.63.0), [1.62.1](https://github.com/microsoft/playwright/releases/tag/v1.62.1) | 1 | Node + browsers | infrastructure, webauthn |

## Sélections particulières et limites

- **phpBB** : Régression récente; 3.3.18 exclue de la sélection, correctif de sécurité incomplet signalé par l’éditeur. Ancienne branche 3.2 à verrouiller séparément.
- **MyBB** : 1.8.41 documentée dans le banc existant; 1.8.40 confirmée par la page officielle. Pas de statistique de diffusion par version obtenue.
- **Flarum** : Distribution actuelle repérée et publication antérieure officielle. Le cœur Flarum et le squelette flarum/flarum doivent être verrouillés ensemble.
- **Vanilla Forums** : Flux officiel historique indisponible (404); disponibilité d’une distribution auto-hébergeable à réexaminer. Moins de deux versions sélectionnées; résolution complémentaire nécessaire.
- **WordPress** : Branches présentes dans les statistiques publiques; ajouter 4.9 et 6.4–6.6 après verrouillage des archives si leur couverture reste utile.
- **Joomla** : Diffusion observée des branches 3/4/5/6; 3 et 4 en quarantaine historique.
- **Drupal** : Usage déclaré et rupture d’architecture; 7 et 9 en quarantaine historique.
- **MediaWiki** : Branches distinctes, dont série LTS à vérifier dans le cycle éditeur avant installation.
- **Wiki.js** : Échantillon du flux: branches distinctes, sinon patch ancien. Diffusion non établie. Moins de deux versions sélectionnées; résolution complémentaire nécessaire.
- **Joplin Server** : Versions du serveur confirmées par son changelog dédié; 3.6.1 introduit MFA, utile pour comparer avant/après. Ne pas utiliser les versions desktop du flux.
- **PrestaShop** : Branches distinctes; diffusion par version inconnue. Ajouter 1.7 après recherche d’usage et verrouillage.
- **Magento Open Source** : Branches de correctifs distinctes, pile PHP/base/recherche adaptée à chacune.
- **Moodle** : 4.5 et 5.2 dominent les inscriptions observées; conserver 5.0/5.1, surveiller 5.3. Ajouter 4.1 après verrouillage d’archive.
- **Open edX** : Tags nommés exacts publiés: release/verawood.1, release/ulmo.4, release/teak.3. Les sections détaillées indiquent Ulmo et Teak hors support; une phrase introductive de la page demeure incohérente avec ces sections.
- **Canvas LMS** : Flux avec tags de build release/date; sélectionner les distributions stables et leurs migrations avant verrouillage. Moins de deux versions sélectionnées; résolution complémentaire nécessaire.
- **Nextcloud** : Parcours de sécurité, sessions et mots de passe applicatifs; support de chaque branche à recontrôler.
- **Seafile** : Le dépôt seafile est un composant; verrouiller l’ensemble serveur et Seahub compatibles avant sélection. Moins de deux versions sélectionnées; résolution complémentaire nécessaire.
- **Forgejo** : Version stable et LTS attestées par la page officielle de versions.
- **GitLab CE** : Deux générations; lot lourd isolé, jamais connecté aux dépôts de production.
- **Jenkins** : Comparer génération hebdomadaire et publication avec correctif LTS; maintenance à confirmer avant déploiement.
- **Odoo Community** : Branches 20/19/18 à examiner dans la documentation; épingler un commit/build Community, pas l’ancienne release addons trouvée dans le flux. Moins de deux versions sélectionnées; résolution complémentaire nécessaire.
- **FusionAuth** : Dépôt de tickets, pas distribution. Recette et fonctionnalités selon licence à examiner. Moins de deux versions sélectionnées; résolution complémentaire nécessaire.
- **Psono** : Échantillon du flux: branches distinctes, sinon patch ancien. Diffusion non établie. Moins de deux versions sélectionnées; résolution complémentaire nécessaire.
- **Matomo** : Échantillon du flux: branches distinctes, sinon patch ancien. Diffusion non établie. Moins de deux versions sélectionnées; résolution complémentaire nécessaire.
- **Apache Superset** : Le flux récent ne contient que des charts Helm. Une version de chart ne vaut pas version applicative. Moins de deux versions sélectionnées; résolution complémentaire nécessaire.
- **WireMock** : Échantillon du flux: branches distinctes, sinon patch ancien. Diffusion non établie. Moins de deux versions sélectionnées; résolution complémentaire nécessaire.

## Installations postérieures à cet inventaire

Le [lot courriel/identité](../lab/README.md) documente quatre installations Windows du 8 octobre 2026. Le présent catalogue reste le relevé initial : ses badges historiques et ses gates ne sont pas remplacés par une simple preuve de démarrage ou de réception de mail.
