# Courriel → changement → connexion navigateur

Qualification SIT du 8 octobre 2026, sur Windows Docker Desktop. Les paires Mailpit 1.31.4 / Keycloak 26.8.0 et Mailpit 1.30.7 / Keycloak 26.7.5 utilisent la recette isolée existante. Aucun service SER5/NAS ni coffre n'est modifié.

## Ce qui est vérifié

Le runner `email-browser.mjs` crée un realm et un utilisateur fictifs uniques via la préparation SIT existante, puis :

1. demande à Keycloak un mail d'action UPDATE_PASSWORD ;
2. exige un seul mail adressé au compte créé, provenant de l'expéditeur attendu et reçu après le début du test ;
3. lit le texte de **ce message précis**, sans utiliser `latest`, sans rendre son HTML ni ouvrir ses pièces jointes ; cette lecture de l'API Mailpit marque le message comme lu ;
4. vérifie l'origine locale exacte, le realm, le chemin et les paramètres du lien ; toute autre URL dans le texte fait échouer le contrôle ;
5. ouvre le lien dans un contexte Chromium vierge, avec service workers bloqués et requêtes réseau du contexte limitées à l'origine du site ;
6. écrit un journal de récupération privé avant la soumission du nouveau secret ;
7. change le mot de passe dans le véritable formulaire Keycloak ;
8. ouvre un nouveau contexte, se connecte avec le nouveau secret et échange le code d'autorisation avec PKCE ; l'Origin, le chemin du callback et le paramètre `state` sont vérifiés ;
9. exige le refus de l'ancien mot de passe dans un troisième contexte ;
10. vérifie le refus du lien déjà consommé, puis d'un autre lien volontairement expiré ;
11. se reconnecte avec le nouveau secret après le test d'expiration.

La lecture des corps est propre à ce runner SIT. Le module Laboratoire de l'interface conserve son observation de métadonnées et n'acquiert pas de nouveau droit sur une boîte personnelle.

## Résultat et preuve

Les deux versions ont réussi ce parcours réel. Les rapports de chaque tentative restent dans le dossier privé du banc, sans mots de passe, contenu des mails, jetons, liens ni captures d'écran. La synthèse publique figure dans `email-browser-qualification-2026-10-08.json`. Le runtime exact et les intégrités npm installées sont dans `browser-runtime-lock.json`.

Les premières tentatives ont révélé des sélecteurs incorrects (`kc-update-password-form` au lieu de `kc-passwd-update-form`, `input-error` au lieu de `input-error-username`) et une lecture trop précoce du code de callback. Les rapports d'échec ont été conservés. Après un échec survenu après préparation du journal, une sonde locale distingue l'acceptation de l'ancien et du nouveau secret ; cette sonde n'est pas assimilée à la validation navigateur complète. Les sélecteurs définitifs proviennent du DOM observé et la validation du callback se fait sur l'URL effectivement atteinte.

## Reproduction

Installer Playwright 1.64.0 dans `browser-runtime` sous le dossier privé du banc, avec `--save-exact --ignore-scripts`. Conserver le verrou npm et vérifier ses intégrités contre le relevé. Définir `PLAYWRIGHT_BROWSERS_PATH` vers le sous-dossier privé `browsers`, puis installer uniquement Chromium headless avec la CLI de cette version (`install chromium --only-shell`). Aucun profil utilisateur existant n'est réutilisé.

Démarrer une paire avec `labctl.mjs`, puis lancer depuis le dépôt :

```sh
node sit/lab/email-browser.mjs /chemin/prive/cro-lab current
```

Arrêter la paire dans tous les cas ; répéter avec `previous`. Un verrou par paire refuse les exécutions concurrentes. Chaque essai crée son propre compte : il n'est pas permis de relancer aveuglément une opération sur un vrai compte après une panne. Les rapports sont horodatés et les secrets restent uniquement sur l'hôte privé.

## Limites explicites

Ce runner est un outil de qualification, pas un template signé activable sur un compte réel. L'envoi initial utilise l'API d'administration du seul realm SIT préparé ; cela ne qualifie pas le parcours utilisateur « mot de passe oublié » d'un site quelconque. La connexion PKCE teste Keycloak comme fournisseur d'identité ; elle ne prouve pas la fédération avec Google, Microsoft, SAML ou un IdP externe.

**Aucune écriture ni relecture Vaultwarden n'est effectuée.** Le journal final est `site-verified-vault-not-connected`, et non « rotation terminée ». Ce journal SIT contient le secret en clair dans un dossier à ACL privées ; le magasin de récupération chiffré du produit reste à raccorder. Pas de garantie de reprise après crash, de remise de contrôle à un humain ou de CAPTCHA réel.

Le relais Windows → SER5 existant expose les anciennes routes SIT, sans opération pour ce nouveau mécanisme. Le raccordement au coffre doit passer par une évolution déclarée et livrée dans la chaîne de mise à jour existante ; il ne faut ni copier la clé SSH du NAS ni élargir le relais en proxy arbitraire.

Le contrat `keycloak-email-mechanism.json` documente le comportement testé ; il n'est pas importable dans le registre de templates signés actuel. La validation TLS, la rétention/purge des secrets de test et l'isolation réseau de tout le processus navigateur dépassent la preuve apportée par le filtrage des requêtes Playwright.
