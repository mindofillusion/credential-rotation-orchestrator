# Accès NAS limité au SIT

Ce courtier donne à une clé SSH existante des opérations fixes sur le projet
`cro-sit`. L'installation est une action locale de l'administrateur, sans visudo,
sans règle sudoers et sans modification des passerelles SER5 existantes.

## Capacités

- `status`, `start`, `stop`, `restart` : services `vaultwarden` et `gateway` du SIT.
- `registrations-open`, `registrations-close` : recréation du seul Vaultwarden SIT.
- `http` : routes explicites de connexion, inscription et gestion des entrées ;
  cible immuable `127.0.0.1:8223`, sans redirection ni proxy.

Aucun shell NAS, accès au socket Docker, fichier arbitraire, argument Compose,
API `/admin` ou journal de conteneur n'est exposé. Les tests navigateur et le
connecteur s'exécutent sur SER5 ; ils utilisent cette passerelle pour le coffre.
Les nouvelles capacités nécessitent une installation locale par l'administrateur.

## Installation

Python 3 et Docker Compose doivent déjà être présents. Télécharger `install.py`
et `broker.py` depuis le même commit vérifié, contrôler leurs SHA256, puis lancer :

```
sudo python3 -I install.py --account NOM --source IP_SER5 --public-key 'CLE_PUBLIQUE'
```

Le script exige la ligne de diagnostic attendue et les fichiers SIT aux empreintes
connues. Il refuse les chemins de déploiement symboliques ou accessibles en
écriture via les permissions Unix à d'autres comptes. Une copie figée est créée
sous `/volume1/docker/cro-sit-access`, protégée par root. Le coffre SIT est recréé
avec inscriptions fermées au démarrage du courtier. La clé SSH n'est remplacée
qu'après ce démarrage ; les autres clés sont conservées. Une installation
interrompue peut laisser le répertoire d'accès ; ne pas le supprimer aveuglément.

Dans DSM, créer une tâche déclenchée **au démarrage**, utilisateur **root**, dont
la commande est `/volume1/docker/cro-sit-access/bin/start`. Le verrou du courtier
empêche plusieurs instances. Sans cette tâche, l'accès ne survit pas au redémarrage.
Ce lanceur n'est pas un superviseur : après une panne du processus, relancer la tâche.

## Protocole

Envoyer une ligne JSON sur stdin d'une connexion SSH avec la commande `cro-sit`.
Exemples : `{"action":"status"}` ou
`{"action":"http","method":"GET","path":"/alive"}`.
La réponse HTTP contient `status` et `bodyBase64`. Les corps et jetons ne sont pas
journalisés. Fermer explicitement les inscriptions immédiatement après création
du compte. Un délai de dix minutes déclenche aussi la fermeture tant que le
courtier fonctionne ; ce n'est pas une garantie en cas de panne du processus.
Au redémarrage du courtier, les inscriptions sont toujours fermées.

## Frontière de confiance et révocation

La restriction porte sur cette clé, pas sur les autres accès de l'administrateur
NAS. Le courtier possède des privilèges root : son code et les fichiers figés sont
la base de confiance. Cela limite les opérations exposées, sans garantir une
absence absolue d'évasion en présence d'une faille de Python, Docker, SSH ou du
noyau. Les ACL DSM héritées doivent également interdire l'écriture du répertoire
d'accès et de ses parents aux comptes non autorisés ; les vérifications Unix ne
constituent pas un audit des ACL Synology.

Pour révoquer : supprimer uniquement la ligne de la clé dédiée dans
`authorized_keys`, désactiver la tâche DSM, fermer les inscriptions SIT et arrêter
le courtier. Ne pas restaurer globalement `authorized_keys.before` si d'autres
clés ont été modifiées depuis. Aucun `docker system prune` ni arrêt global.

## Validation

`python3 -m unittest discover -s sit/access -p 'test_*.py' -v` teste les refus,
la destination HTTP, l'intégrité et les commandes fixes. Le workflow
`SIT scoped access` teste aussi l'installation, les permissions, l'API et les
opérations Docker avec un conteneur voisin. Ces tests Linux ne remplacent pas
la confirmation finale sur DSM après installation.
