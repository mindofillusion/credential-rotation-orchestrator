# Compléments du périmètre

Le registre principal compte les produits dont la source a été interrogée. Les pistes suivantes complètent l’inventaire sans être assimilées à des distributions installables vérifiées. Leurs versions exactes, droits et dépendances restent à vérifier. Aucun achat ni inscription n’est déclenché.

| Piste / source | Intérêt | Condition et versions à comparer |
|---|---|---|
| [XenForo](https://xenforo.com/) | Forum commercial, sécurité du compte | Licence de test; branche actuelle et précédente réellement disponibles |
| [Invision Community](https://invisioncommunity.com/) | Communauté, comptes et confirmation | Vérifier offre auto-hébergée et droits d’archive avant sélection |
| [vBulletin](https://www.vbulletin.com/) | Parc historique de forums | Licence; génération actuelle et génération ancienne encore observée |
| [WoltLab Suite](https://www.woltlab.com/) | Forum et compte central | Licence/édition; cœur et forum à verrouiller séparément |
| [FUDforum](https://fudforum.org/) | Ancien formulaire de forum | Dernière distribution et précédente; activité/compatibilité PHP à vérifier |
| [Elgg](https://elgg.org/) | Réseau social extensible | Cœur, thème et extensions d’authentification à versionner |
| [BuddyPress](https://buddypress.org/) | Profils WordPress alternatifs | Croiser version de WordPress et extension; ne pas multiplier les cœurs inutilement |
| [SPIP](https://www.spip.net/) | CMS important dans le parc francophone | Branches actuelle et historique d’après usage; distinguer espace public/privé |
| [Dotclear](https://dotclear.org/) | Blog francophone | Deux branches avec différence de compte/profil vérifiée |
| [Textpattern](https://textpattern.com/) | CMS léger | Deux versions disponibles, statistiques d’usage à rechercher |
| [MODX](https://modx.com/) | Administration CMS | Générations distinctes, distributions vérifiées |
| [Piwigo](https://piwigo.org/) | Galerie avec compte utilisateur | Deux versions de cœur et éventuels plugins de sécurité |
| [Coppermine](https://coppermine-gallery.com/) | Galerie historique | Disponibilité et maintenance à confirmer avant VM historique |
| [TYPO3 ELTS](https://typo3.com/services/extended-support-elts) | Anciennes branches en support commercial | Accès ELTS valide; ne pas présenter une archive publique comme correctif ELTS |
| [Drupal Commerce](https://drupalcommerce.org/) | Compte client Drupal | Couple cœur/extension compatible; pas de paiement réel |
| [Shopware anciennes générations](https://www.shopware.com/) | Rupture de pile et de back-office | Vérifier archives et licences, puis quarantaine si fin de support |
| [Jira / Confluence](https://www.atlassian.com/) | SSO et comptes d’entreprise | Vérifier disponibilité/licence Data Center actuelle; pas de supposition sur l’offre Server |
| [Liferay](https://www.liferay.com/) | Portail d’entreprise, annuaire | Édition/distribution et deux générations; coût mémoire à mesurer |
| [Alfresco](https://www.alfresco.com/) | Gestion documentaire, comptes délégués | Community/Enterprise et composants compatibles à vérifier |
| [Koha](https://koha-community.org/) | Portail lecteur / bibliothécaire | Deux branches et comptes distincts; données fictives |
| [Open Journal Systems](https://pkp.sfu.ca/software/ojs/) | Compte auteur et revue | Version applicative + runtime; données fictives |
| [DSpace](https://dspace.org/) | Portail documentaire | Backend et frontend doivent correspondre |
| [Sakai](https://www.sakailms.org/) | LMS Java et fédération | Deux distributions, test par lots lourds |
| [OpenOLAT](https://www.openolat.com/) | LMS et portail d’identité | Deux branches disponibles et édition vérifiée |
| [iTop](https://www.combodo.com/itop) | Support/CMDB | Community/édition et extensions à vérifier |
| [Faveo](https://www.faveohelpdesk.com/) | Helpdesk et portail client | Droits, éditions et branches à examiner |
| [GLPI plugins SSO](https://plugins.glpi-project.org/) | Le plugin change le propriétaire du secret | Verrouillage du couple GLPI/plugin indispensable |
| [Webmin / Usermin](https://webmin.com/) | Changement de compte système | VM sacrifiable uniquement, jamais administration du NAS ou de SER5 réel |
| [Cockpit](https://cockpit-project.org/) | PAM / compte système | Deux versions dans une VM jetable, pas le compte hôte |
| [Proxmox VE](https://www.proxmox.com/) | Realm local/PAM/LDAP/OIDC | Virtualisation imbriquée de test, pas le cluster réel |
| [Synology DSM](https://www.synology.com/dsm) | Compte NAS et MFA | Instance virtuelle officiellement autorisée si disponible; pas de tests sur DSM de production |
| [TrueNAS](https://www.truenas.com/) | Interface de stockage et compte | VM isolée, aucun disque réel monté |

## Applications construites sur des frameworks

Ajouter des fixtures minimales pour Django/allauth, Laravel/Fortify, Symfony Security, ASP.NET Core Identity, Spring Security et Rails/Devise. Pour chacune : une génération actuelle et une précédente, avec dépendances verrouillées. Elles couvrent des mécanismes personnalisés, mais ne prouvent pas la compatibilité avec tous les sites utilisant le framework.

## Services non installables

Google, Microsoft grand public, Apple, Amazon, Facebook, impôts et banques ne deviennent pas auto-hébergeables parce qu’un parcours est enregistrable. Couvrir leurs mécanismes par fixtures locales puis, séparément, par comptes de test autorisés si le service en fournit. Aucun clone ne prouve le fonctionnement réel d’un site. Un domaine de messagerie refusé, une vérification d’identité ou une MFA matérielle reste une contrainte du service.
