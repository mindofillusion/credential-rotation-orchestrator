# Authentification et connexion aux coffres

Décision du 9 octobre 2026 : MFA et chiffrement des données sensibles sont des exigences de livraison. Ce document est une spécification, pas une annonce de fonctionnalités installées ni une attestation de conformité.

## Trois frontières d'authentification

1. **Utilisateur vers CRO** : privilégier WebAuthn/FIDO2 avec vérification utilisateur obligatoire (PIN ou biométrie locale). Vérifier côté serveur challenge à usage unique, expiration, origine, RP ID, signature et indicateur de vérification utilisateur avec une bibliothèque maintenue. Une clé utilisée par simple toucher sans vérification utilisateur ne satisfait pas à elle seule cette exigence MFA. Prévoir un second authentificateur et une récupération contrôlée, sans réinitialisation par simple courriel.
2. **CRO vers le coffre** : utiliser un connecteur documenté, d'abord le CLI officiel Bitwarden installé séparément. Respecter les méthodes MFA effectivement prises en charge par ce client et le serveur. Ne pas annoncer que WebAuthn de CRO fournit du MFA au coffre. Une authentification CLI par clé API ne remplace pas le déverrouillage du coffre ; les deux étapes sont distinctes. Un connecteur incapable de satisfaire la politique requise doit être déclaré incompatible.
3. **CRO vers le site cible** : respecter les demandes MFA du site. Suspendre pour intervention de l'utilisateur si nécessaire. Ne pas collecter automatiquement les facteurs du coffre ou de CRO via le futur lecteur de courriels de validation. Aucun contournement de CAPTCHA, MFA ou restrictions du fournisseur.

L'ajout/retrait d'un facteur, le changement de coffre, l'élargissement des comptes autorisés, la modification de la récupération et l'activation de l'automatisation exigent une authentification récente. Les contrôles doivent protéger les API et le worker, pas seulement masquer des boutons. Prévoir limitation de débit, prévention CSRF et contrôle d'origine, expiration et révocation des sessions, cookies HttpOnly/SameSite et Secure dès HTTPS. Ne pas placer de session de coffre dans le navigateur ou localStorage.

## Secrets au repos et clés

- Conserver uniquement les secrets nécessaires ; ne pas stocker le mot de passe maître pour relancer automatiquement le coffre.
- Utiliser le protocole cryptographique du client officiel pour les données du coffre. Le journal propre à CRO utilise déjà AES-256-GCM avec nonce aléatoire de 96 bits et authentification du contexte ; ne pas ajouter de chiffrement maison au protocole Bitwarden.
- Protéger les clés locales avec les mécanismes natifs du système et des ACL dédiées (DPAPI sous Windows, Keychain ou service de secrets adapté ailleurs). Séparer clés de signature, de récupération et de session ; prévoir versionnement, rotation et récupération des clés avant déploiement. Une clé sur disque à côté de données chiffrées n'offre pas cette protection.
- Aucun secret, code MFA, jeton ou lien de validation dans les logs, événements publics, rapports, captures, traces Playwright ou arguments de commandes. Le connecteur doit utiliser des canaux privés et limiter l'héritage des variables d'environnement.
- Limiter durée de vie et copies des secrets en mémoire. Ne pas promettre d'effacement garanti des chaînes JavaScript ni de protection contre un poste déjà compromis.

## Échanges et périmètre

- Pour toute liaison réseau de production transportant des secrets, exiger HTTPS avec validation du nom et de la chaîne de certificats. Préférer TLS 1.3 ; TLS 1.2 sécurisé seulement pour une compatibilité explicitement qualifiée. Refuser certificat invalide, désactivation de validation et redirection vers une autre origine non autorisée.
- Privilégier l'appel local du CLI par processus et canaux privés. Une éventuelle API locale doit être authentifiée et restreinte ; écouter sur loopback ne suffit pas à autoriser tous les processus du poste. Aucun `bw serve` exposé sur le LAN.
- Les tunnels ou exceptions HTTP des fixtures SIT ne constituent pas la politique de production. Documenter leurs extrémités et leur isolation ; aucune activation implicite par repli après erreur TLS.
- La sélection d'entrées dans CRO est une restriction applicative, pas un jeton Bitwarden limité à ces seules entrées. Réduire les droits réels par compte dédié et permissions de partage lorsque le fournisseur le permet. Documenter les droits effectifs avant consentement.
- Vaultwarden est un serveur compatible non officiel : qualifier des couples de versions client/serveur, sans assimiler cette compatibilité à un support Bitwarden.

## Automatisation et reprise

Par défaut, l'utilisateur autorise une session de travail bornée. Une tâche planifiée ne démarre pas si le coffre est verrouillé, si la session a expiré ou si un nouveau facteur est demandé. Elle attend et expose une alerte sans secret. Une éventuelle identité de service non interactive devra faire l'objet d'un mode séparé, explicitement autorisé et restreint ; ne pas la présenter comme un MFA humain exécuté à chaque tâche.

Avant une modification distante, vérifier session et journal de récupération disponible. Après une modification distante, une expiration ou panne ne doit pas supprimer le candidat : conserver le journal chiffré, bloquer les nouvelles rotations et reprendre selon `vault-transaction-progress.md`. Ne pas répéter aveuglément une opération dont l'issue est inconnue. Conserver la garde persistante de `site-authentication-lock.md` après un premier refus.

## État et critères de validation

| Élément | État au 9 octobre 2026 | Preuve à obtenir avant activation |
|---|---|---|
| Journal AES-256-GCM | Implémenté dans la branche de développement et testé ; clé externe fournie par l'appelant | Fournisseur de clés natif, migration, rotation et récupération sur chaque OS |
| Identité de signature | Clé privée chiffrée ; clé de protection encore stockée sur disque avec permissions | Remplacement du stockage transitoire, qualification des sauvegardes |
| MFA CRO | À implémenter | Enrôlement, vérification utilisateur obligatoire, rejeu, mauvaise origine, expiration, révocation et récupération |
| Connecteur officiel | À implémenter ; les scripts SIT existants utilisent un client spécifique | Login/MFA/déverrouillage, lecture, écriture et relecture sur les versions supportées |
| Sessions et transports | Politique définie ici ; pas de qualification globale revendiquée | Certificat invalide, redirection, client local non autorisé, expiration pendant rotation, absence de fuite de secrets |
| Déploiement | Aucun changement de production effectué par cette décision documentaire | Livraison signée, installation et retour arrière testés |

## Sources primaires

- Bitwarden CLI : https://bitwarden.com/help/cli/
- Différence API publique / gestion de coffre : https://bitwarden.com/help/bitwarden-apis/
- Vaultwarden : https://github.com/dani-garcia/vaultwarden
- OWASP MFA : https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
- OWASP Passkeys : https://cheatsheetseries.owasp.org/cheatsheets/Passkey_Security_Cheat_Sheet.html
- OWASP TLS : https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html
