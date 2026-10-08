# Diffusion des versions — relevé du 8 octobre 2026

La diffusion justifie une priorité de test, **pas l’installation d’une ancienne version en production**. Les populations mesurées ci-dessous ne sont pas comparables entre elles. Les chiffres décrivent une branche, jamais tous ses correctifs individuellement.

## Mesures obtenues

| Produit | Observation | Date / population | Conséquence pour le panel |
|---|---|---|---|
| WordPress | 7.1 : 60,643 %; 7.0 : 9,186 %; 6.9 : 7,190 %; 6.8 : 5,554 %; 6.7 : 2,674 % | API de statistiques WordPress, relevée le 08/10/2026 à 10:20 UTC; installations du périmètre statistique WordPress | Retenir ces cinq branches, soit 85,247 % dans cet échantillon, pas 85 % de tous les sites web |
| Drupal | 11.4 : 130 668; 11.3 : 59 223; 10.6 : 153 308; 9.5 : 31 738 sites déclarants | Semaine commençant le 27/09/2026; sites remontant leur version au projet | 10.6 reste prioritaire; conserver 11.3 et une fixture historique 9.5. Ne pas calculer une part globale avec les anciennes séries exclues du tableau |
| Joomla | 3 : 51,9 %; 5 : 20,6 %; 6 : 9,2 %; 4 : 8,0 %; 2 : 6,0 %; 1 : 4,4 % | W3Techs, page datée du 06/10/2026; sites où Joomla est détecté | Inclure 3.10.12 en quarantaine et 4.4.14; 1.x/2.x restent un complément à évaluer, pas un déploiement prioritaire |
| Moodle | 4.5 : 35 563; 5.2 : 31 597; 5.0 : 11 191; 5.1 : 9 872; 4.1 : 11 082; 3.11 : 5 730; 5.3 : 3 124 inscriptions | Page officielle de statistiques récupérée le 08/10/2026 à 10:20 UTC; sites enregistrés, date interne de mise à jour non établie | Mettre 4.5 et 5.2 avant la seule nouveauté 5.3; 4.1 et 3.11 à résoudre si un parcours distinct justifie une fixture historique |

**Qualité Moodle :** le relevé contient des branches manifestement anormales (ex. 49.15). Ce sont des déclarations, pas un audit des binaires. Les conserver dans la preuve brute, ne pas en déduire des versions publiées ni utiliser le total sans nettoyage documenté.

L’API WordPress totalise 99,999 %, cohérent avec des arrondis. Les cinq branches choisies ne couvrent donc pas tout le parc observé. La branche 4.9 représente encore 1,032 %; 6.4, 6.5 et 6.6 dépassent chacune 1 %. Leur ajout dépendra de l’écart de mécanisme et des archives vérifiables. Pas de conclusion sur un correctif précis à partir d’une part de branche.

## Provenance

- [Statistiques WordPress](https://wordpress.org/about/stats/) et [API officielle](https://api.wordpress.org/stats/wordpress/1.0/). Données numériques préservées dans `adoption-observations.json`, sans reformulation intermédiaire. La page seule rend les graphiques côté navigateur; l’API a été lue directement.
- [Usage Drupal](https://new.drupal.org/project/usage/drupal), ligne du 27 septembre 2026, colonnes nommées 11.4.x, 11.3.x, 10.6.x, 9.5.x. Mesure de sites déclarants, pas recensement exhaustif.
- [Mesure Joomla par W3Techs](https://w3techs.com/technologies/details/cm-joomla). Source primaire de cette mesure, distincte de l’éditeur Joomla. [Méthodologie](https://w3techs.com/technologies) à prendre en compte : détectabilité publique et version masquée limitent les extrapolations.
- [Statistiques Joomla éditeur](https://developer.joomla.org/about/stats.html) : documentation du principe de collecte consultée; récupération directe bloquée en HTTP 403, aucun pourcentage éditeur inventé.
- [Statistiques Moodle](https://stats.moodle.org/) : données de branches extraites de l’attribut JSON de la page officielle; nombres exacts conservés dans `adoption-observations.json`. Le moteur de recherche ne pouvait pas charger la page; la récupération HTTPS directe a réussi.
- [Statistiques Jenkins](https://stats.jenkins.io/jenkins-stats/) : aucune répartition actuelle exploitable obtenue. [Incident officiel de statistiques](https://github.com/jenkins-infra/helpdesk/issues/4386) repéré. Ne pas publier une ancienne statistique comme actuelle.

## Diffusion non établie

Pour les autres candidats, la collecte de versions ne mesure pas leur usage. Le registre les marque `not-established`. Les pages W3Techs de [phpBB](https://w3techs.com/technologies/details/cm-phpbb) et [PrestaShop](https://w3techs.com/technologies/details/cm-prestashop) attestent une présence du produit, mais les pages consultées ne donnent pas une ventilation exploitable par correctif. Pas d’inférence « version largement utilisée » à partir de ces pages.

Ne pas confondre : téléchargements = événements de récupération, pulls = téléchargements d’images potentiellement répétés par CI, étoiles = intérêt, annonces = disponibilité. Une signature serveur ou une balise generator peut être cachée ou trompeuse.

## Règle de sélection

Quand une part fiable par branche est disponible, retenir en priorité les branches ≥5 % du périmètre mesuré; celles de 1–5 % restent intéressantes si leur parcours diffère. Ce seuil est une règle pratique du laboratoire, pas une définition universelle de « largement utilisé ». Pour des nombres absolus sans dénominateur propre, conserver le nombre et éviter le qualificatif global.

Sans mesure : donner la priorité au mécanisme nouveau, puis à une branche LTS/stable documentée, puis au coût de qualification. Une version inconnue n’est ni rare ni populaire par défaut. Relever à nouveau les sources avant une campagne; garder l’ancien relevé daté pour comparer au lieu de remplacer silencieusement les chiffres.

La recherche est une consultation de données publiques agrégées. Aucun scan de masse, connexion à un compte tiers, tentative de récupération de mot de passe ou test sur forum public n’a été effectué.
