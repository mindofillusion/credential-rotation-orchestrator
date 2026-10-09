# Verrou après un seul échec d’authentification

Demande du 9 octobre 2026 : CRO ne doit jamais essayer une liste de mots de passe jusqu’à en trouver un valide.

La nouvelle protection réserve un verrou persistant avant chaque authentification. Seule une authentification explicitement réussie le libère. Un refus, une réponse incertaine, une exception ou un arrêt du processus le conserve. Aucun nouvel essai n’est alors envoyé, même pour le même mot de passe, un autre compte, un autre template ou après redémarrage. Le verrou ne contient aucun identifiant utilisateur, mot de passe ni empreinte de mot de passe. Il n’expire pas et aucune API de déverrouillage n’est fournie.

Le périmètre utilise le nom d’hôte normalisé, sans distinguer protocole, port ou chemin. Les deux versions locales d’un laboratoire utilisant le même hôte partagent donc volontairement leur blocage. Des noms DNS différents ne sont pas automatiquement reconnus comme appartenant au même service : leur regroupement en identité de site doit être traité lors du provisionnement avant d’autoriser ces alias. Cette protection ne prétend pas résister à un administrateur qui modifie le code ou supprime ses données.

Tous les runners réels concernés exigent CRO_AUTH_GUARD_DIR, un répertoire absolu partagé et privé. En son absence ils refusent de démarrer. Les ACL Windows et les parents du répertoire doivent être contrôlés par l’installation. Changer de répertoire de garde ne constitue pas un mécanisme de réinitialisation autorisé.

Intégrations : connexions navigateur forums/CMS, parcours Keycloak par courriel, authentifications de préparation Keycloak et procédure de réconciliation. La reprise refuse de fonctionner sans garde. Les tests volontaires de l’ancien mot de passe et le diagnostic qui essayait successivement ancien et nouveau mots de passe ont été retirés. Les rapports ne prétendent plus que le rejet de l’ancien mot de passe a été testé. Les rapports historiques conservent leurs résultats historiques.

Tests : refus unique, redémarrage dans un autre processus, concurrence entre instances, changement de compte/chemin/port, résultat incertain, site indépendant et authentifications successives réussies. Les échecs sont injectés sur des doubles de test, sans provoquer de refus sur un site réel.

État : code de développement, pas encore livré ni actif dans la 0.3.0 installée ou les anciens runners distants. Le provisionnement commun du répertoire et la qualification des runners lors de la prochaine livraison restent nécessaires. Le client d’accès au coffre utilise encore son authentification dédiée : il ne reçoit pas de listes de candidats et n’est pas remplacé par ce module dans cette étape.
