# Coffre Vaultwarden pour les SIT

Instance dédiée, compatible avec les clients Bitwarden. Elle ne partage aucun
volume, compte ou paramètre CLI avec le coffre de production. Image Vaultwarden
1.37.4 ; compte réservé : `cro-sit@example.invalid`. Aucun compte n'est créé par
Compose et aucun mot de passe n'est inclus dans le dépôt.

## Démarrage sur un hôte Docker

Depuis la racine du dépôt (Docker Engine et Compose v2 requis) :

```sh
CRO_SIT_SIGNUPS=true docker compose -f sit/compose.yaml up -d
curl --fail http://localhost:8223/alive
```

Ouvrir `http://localhost:8223` et créer le compte `cro-sit@example.invalid` avec
un mot de passe maître aléatoire dédié. Stocker celui-ci dans le gestionnaire
de secrets de l'environnement de test, jamais dans les sources ou les logs.
L'inscription ne nécessite pas de boîte mail dans cette configuration sans SMTP.
Refermer ensuite les inscriptions :

```sh
CRO_SIT_SIGNUPS=false docker compose -f sit/compose.yaml up -d
```

Le port est accessible uniquement sur l'hôte. Pour un hôte distant, utiliser
un tunnel SSH local vers son port 8223 ; conserver l'accès navigateur via
`http://localhost:8223` (contexte local sécurisé). Ne pas exposer ce port sur le LAN.
Le réseau du coffre est interne ; aucun serveur SMTP ni jeton admin n'est configuré.
Une passerelle TCP à destination fixe expose uniquement le coffre sur la boucle
locale. Elle relie le réseau interne à un réseau d'accès séparé, car Docker ne
publie pas les ports d'un conteneur connecté uniquement à un réseau interne.

## Profil Bitwarden CLI distinct

Installer le CLI officiel `bw` sur l'hôte de test. Dans un terminal dédié :

```sh
umask 077
mkdir -p .cro-sit/bitwarden-cli
export BITWARDENCLI_APPDATA_DIR="$PWD/.cro-sit/bitwarden-cli"
unset BW_SESSION BW_CLIENTID BW_CLIENTSECRET
bw config server http://localhost:8223
bw login cro-sit@example.invalid
bw status
```

Saisir le mot de passe à l'invite interactive. Ne pas utiliser un profil CLI
de production. Ne pas copier la clé de session affichée dans un ticket ou un log.
Créer ensuite une entrée `CRO SIT — test website` avec uniquement des identifiants
fictifs et l'URL du futur site de test. Terminer les sessions avec `bw lock`.

## Arrêt et conservation

`docker compose -f sit/compose.yaml down` arrête le laboratoire et conserve
son volume. La suppression du volume doit rester une décision explicite ; elle
efface tous les comptes de ce laboratoire.

## État de validation

Le workflow `Vaultwarden SIT smoke` démarre un coffre jetable sur GitHub Actions,
vérifie `/alive` et `/api/config`, puis supprime uniquement ses propres ressources.
Il ne crée pas encore de compte et ne prouve pas une rotation de bout en bout.
La création du compte persistant attend un hôte Docker accessible.
L'adaptateur CLI et le rejeu Playwright restent à implémenter.

Sources : [Compose Vaultwarden](https://github.com/dani-garcia/vaultwarden/wiki/Using-Docker-Compose),
[CLI Bitwarden](https://bitwarden.com/help/cli/).
