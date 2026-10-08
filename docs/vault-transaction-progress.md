# Raccordement du parcours courriel au coffre — état du 8 octobre 2026

## Installation 0.3.0

Contrôle sur l’installation Windows après confirmation utilisateur : santé locale 0.3.0, mode configuré paired-sit, dernière mise à jour succeeded. Le Laboratoire retourne 134 produits et les deux rapports navigateur historiques attendus. Les deux rapports conservent vaultVerified=false. Le backend distant répond à overview ; son indicateur de connexion ne constitue pas une nouvelle qualification de rotation.

## Correction préparée dans le moteur, non déployée

L’inspection a identifié trois faiblesses du moteur générique : conservation du candidat seulement après une erreur d’écriture au coffre, exception du navigateur classée comme absence de modification, et réussite déduite de la seule réponse d’écriture du coffre. Les runners forums avaient déjà des protections spécifiques, mais elles n’étaient pas imposées par le moteur.

Le moteur prépare maintenant le candidat dans le magasin de récupération avant d’entrer dans le navigateur. Un échec de cette préparation bloque le parcours. Une exception du navigateur laisse l’issue distante inconnue, conserve le candidat et produit un état ambigu. La réussite exige une relecture du coffre avec le mot de passe attendu et le même nom d’utilisateur. Les exceptions brutes des adaptateurs ne sont plus émises dans les événements. Les tentatives simultanées sur une même instance sont bloquées ; un journal restant impose une réconciliation avant nouvel essai. Le magasin mémoire refuse également de remplacer un candidat existant.

Le runner forums garde son verrou de fichier et son contrôle de journal préexistant ; sa préparation utilise une création exclusive. Son journal n’est supprimé qu’après son contrôle final de connexion avec la valeur relue du coffre. Le magasin mémoire reste réservé à la simulation : il n’apporte aucune persistance après arrêt. La création exclusive du journal SIT protège du remplacement accidentel ; sa tenue actuelle n’est pas une garantie de résistance à une coupure électrique.

## Vérifications et limites

Tests avec adaptateurs simulés : échec de préparation avant navigateur, exception après entrée navigateur, réponse d’écriture perdue, relecture obsolète, mauvaise identité relue, concurrence et blocage sur récupération en attente. Ces tests ne qualifient pas le transport NAS, le chiffrement Vaultwarden ou une nouvelle rotation réelle.

La 0.3.0 installée reste inchangée. Ce commit de développement n’est pas une nouvelle livraison 0.3.0 et ne modifie pas le paquet signé publié. Avant une prochaine livraison, il faut intégrer et qualifier une reprise explicite ainsi que le transport strictement limité entre le banc navigateur et le coffre SIT. Les secrets de l’accès existant restent sur leur hôte ; aucune extension du relais n’est déployée dans cette étape.
