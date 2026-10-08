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

## Journal et reprise préparés ensuite

Le magasin de récupération sur fichiers chiffre chaque enregistrement en AES-256-GCM avec une clé fournie en mémoire par l'appelant. Il ne crée ni ne sauvegarde de clé. L'identifiant du compte est lié cryptographiquement à l'enregistrement ; la publication du fichier est exclusive, après synchronisation de son contenu. Les chemins racines et leurs parents doivent appartenir au périmètre privé de l'application. Sous Windows, les ACL doivent être établies et vérifiées par l'installateur : les bits Unix ne suffisent pas.

Le moteur transmet désormais au journal le candidat, la référence de l'identité initiale et l'empreinte du template complet. Un verrou de fichier couvre les opérations du moteur et la reprise lorsque ce magasin est utilisé. Un verrou restant après arrêt brutal bloque les opérations ; il n'est jamais supprimé automatiquement à partir de son âge. Sa récupération contrôlée reste à intégrer. Sous Windows, la synchronisation du répertoire n'est pas effectuée : le test d'arrêt de processus n'est pas une preuve de résistance à une coupure électrique.

La reprise vérifie le candidat dans une session fraîche, relit le coffre, refuse une identité différente ou une valeur modifiée par ailleurs, et exige une écriture conditionnelle sur la révision du coffre. Si la valeur était déjà écrite malgré une réponse perdue, elle n'est pas réécrite. Après relecture, une nouvelle connexion avec la valeur issue du coffre est exigée avant suppression du journal. Aucun changement de mot de passe sur le site n'est rejoué pendant la reprise.

Qualification du code le 8 octobre 2026 : 55 tests locaux réussis. Les 10 tests spécifiques journal/reprise ont également réussi avec Node natif sous Windows dans le seul répertoire du laboratoire. L'arrêt forcé d'un processus écrivain laisse un journal chiffré lisible par un nouveau magasin utilisant la même clé de test. Altération, mauvaise clé, substitution de compte, modification externe du coffre, réponse perdue, relecture obsolète, verrou préexistant et échec de connexion finale sont couverts.

Les lectures et écritures de coffre ainsi que les connexions de site de ces tests utilisent des doubles de test. Seuls le système de fichiers, le chiffrement et l'arrêt de processus sont réels dans cette qualification. Le nouveau magasin et la reprise ne sont pas encore activés dans le lanceur ou le parcours courriel. Il reste à intégrer le fournisseur de clé local, la levée contrôlée des verrous après crash et un adaptateur SIT offrant une écriture conditionnelle vérifiée, puis à qualifier le parcours sur le coffre NAS. Le relais déployé reste limité à ses anciennes routes : aucune nouvelle capacité réseau n'est déployée par ce travail.
