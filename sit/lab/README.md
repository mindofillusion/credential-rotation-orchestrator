# Premier lot du catalogue — courriel et identité

Recette Docker distincte de CRO, sans modification du coffre, de SER5 ni du NAS. Déploiement de qualification sur un poste Windows avec Docker Desktop (moteur Linux 29.7.2), le 8 octobre 2026. Les versions sont choisies dans le catalogue existant ; les images sont figées par leur digest de registre dans `recipe-compose.json`. Ce digest garantit l'immuabilité du contenu téléchargé, pas une signature indépendante de l'éditeur.

| Paire | Collecteur SMTP | Fournisseur d'identité | Interfaces locales |
|---|---|---|---|
| current | Mailpit 1.31.4 | Keycloak 26.8.0 | Mailpit 18250, Keycloak 18251 |
| previous | Mailpit 1.30.7 | Keycloak 26.7.5 | Mailpit 18260, Keycloak 18261 |

Deux passerelles Node utilitaires complètent les quatre applications. Les services sont arrêtés après qualification et ne redémarrent pas automatiquement. L'installation ne signifie pas qu'un template de rotation est qualifié.

## Isolation et ressources

Chaque paire possède un réseau Docker interne et deux volumes distincts. Keycloak et Mailpit n'ont aucun port publié et ne sont attachés qu'au réseau interne. Une passerelle TCP non privilégiée est reliée à ce réseau et à un réseau d'accès dédié ; ses deux destinations sont codées en dur. Seule cette passerelle publie les ports sur `127.0.0.1`. Aucun socket Docker ni secret n'y est monté. Le port SMTP reste interne.

Le premier essai de publication directe des ports sur un réseau exclusivement interne a échoué : services démarrés mais ports non publiés. Le diagnostic est conservé ; la passerelle corrige précisément ce problème sans donner de réseau externe aux applications. Les réseaux internes Docker ne constituent pas une VM séparée ni une preuve d'absence de faille du noyau ou du moteur.

Par paire : limites de 1 Gio pour Keycloak, 192 Mio pour Mailpit, 64 Mio pour la passerelle ; CPU respectivement 1, 0,5 et 0,25. Mesure après démarrage de la paire current : environ 483 Mio, 6 Mio et 14 Mio. Une seule paire est utilisée à la fois pendant la qualification. Les données persistent dans les volumes ; ne pas utiliser `down -v` pour une simple extinction.

Mailpit accepte uniquement les destinataires `@example.invalid`, sans relais externe, sans résolution DNS inverse et sans recherche de nouvelle version. Les identifiants de bootstrap et les comptes fictifs sont générés sur le poste, conservés dans un dossier privé et exclus du dépôt et des rapports. Le bootstrap est réservé à la préparation SIT, pas au fonctionnement futur de CRO.

## Reproduction

Préparer un dossier privé vide (permissions 0700 sur Unix ; ACL limitée à l'utilisateur sur Windows). Conserver le dépôt source séparément. Télécharger les images **par les digests de la recette** ; aucune mise à jour automatique n'est lancée par le contrôleur.

```sh
node sit/lab/labctl.mjs install /chemin/prive/cro-lab
node sit/lab/labctl.mjs start /chemin/prive/cro-lab current
node sit/lab/qualify.mjs /chemin/prive/cro-lab current
node sit/lab/labctl.mjs stop /chemin/prive/cro-lab current
```

Sous Windows, utiliser un chemin absolu Windows protégé. `install` refuse un projet Docker existant ou des fichiers bootstrap existants. Le script de qualification crée un nouveau realm et un compte fictif à chaque lancement : ce n'est pas un travail périodique. Ses rapports sont horodatés et ses erreurs conservées. Après un échec, arrêter seulement la paire concernée, inspecter le rapport et conserver les volumes.

Pour vérifier la persistance, redémarrer la même paire, lancer `verify-restart.mjs` avec les mêmes arguments, puis l'arrêter. Répéter avec `previous`. Une remise à zéro destructive, une sauvegarde restaurable et un installateur général pour le reste du catalogue restent à développer.

## Qualification obtenue et limites

Les deux paires ont réussi : découverte OIDC, authentification de bootstrap, création et connexion d'un utilisateur fictif, demande d'envoi du mail d'action UPDATE_PASSWORD, réception SMTP et lecture des métadonnées par le **véritable adaptateur Mailpit de CRO**.

Le test utilise le grant de mot de passe uniquement dans ce realm jetable. Il ne constitue ni une recommandation OAuth pour le produit, ni une qualification du parcours navigateur SSO/PKCE. Le premier essai d'envoi a reçu HTTP 404 parce que Keycloak n'avait pas conservé l'ID utilisateur proposé ; le runner utilise désormais l'identifiant retourné par l'en-tête Location. L'ancien rapport et son realm de test sont conservés.

Les realms et courriels ont été retrouvés après arrêt et redémarrage des deux paires. Le premier arrêt de la passerelle nécessitait un SIGKILL (code 137, OOM faux) : un gestionnaire SIGTERM/SIGINT borné corrige son arrêt. Les résultats structurés figurent dans [le rapport](qualification-2026-10-08.json).

Aucun clic sur le lien de réinitialisation, aucune rotation de mot de passe, aucune relecture du coffre et aucun CAPTCHA réel n'ont été qualifiés par ce lot. Le raccordement à l'interface CRO installée et au gestionnaire transactionnel d'interventions reste à livrer. Le catalogue complet n'est pas installé : ce lot couvre deux produits, quatre versions, et constitue l'infrastructure des prochaines campagnes.

## Mise à jour et retour arrière

Ne jamais remplacer le tag ou le digest d'une instance qualifiée. Ajouter la nouvelle version avec sa propre paire, ses volumes et ses ports, puis qualifier. Le retour à la précédente consiste à arrêter la nouvelle paire et redémarrer l'ancienne ; ne jamais ouvrir une base migrée avec un ancien Keycloak. Les sources publiques, les digests et les résultats doivent évoluer ensemble sur GitHub.

## Sources éditeurs consultées

- https://www.keycloak.org/getting-started/getting-started-docker
- https://www.keycloak.org/server/containers
- https://www.keycloak.org/docs-api/latest/rest-api/index.html — `execute-actions-email`
- https://mailpit.axllent.org/docs/install/docker/
- https://mailpit.axllent.org/docs/configuration/runtime-options/
- https://mailpit.axllent.org/docs/api-v1/
- https://docs.docker.com/desktop/features/networking/networking-how-tos/
