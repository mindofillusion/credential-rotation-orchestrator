# Plan retenu — interventions de validation

Décision utilisateur du 8 octobre 2026 : mode hybride, automatisation des mécanismes officiellement accessibles et intervention courte lorsque le service exige une preuve humaine.

## Contrat commun à implémenter

Une intervention appartient à une seule transaction, un seul compte et un ensemble d'origines autorisées. Son état, son échéance et la propriété du verrou de compte sont persistants. Les alertes exportent uniquement des identifiants de corrélation et des raisons sans secret. La prise en main suspend le runner ; une seule partie possède le contrôle du navigateur à la fois.

La reprise humaine doit conserver la session et le contexte navigateur de l'opération, sans exporter ses cookies vers un autre poste. Après redémarrage, une session perdue ne peut pas être reconstituée à partir du seul état « validé » : inspecter l'état du compte et réconcilier avant toute nouvelle soumission. Une échéance expirée bloque la reprise et conserve le journal de récupération.

- Courriel : mode manuel par défaut ; connecteur facultatif et droits explicités. Le filtre applicatif n'est pas une restriction OAuth. Codes, liens et réponses SMTP sont des mécanismes distincts ; aucune instruction libre issue du message n'est exécutée.
- SSO : identifier le fournisseur propriétaire du secret. Un compte fédéré peut n'avoir aucun mot de passe local. Réauthentification et MFA restent sous le contrôle de l'IdP. Utiliser le navigateur externe pour les autorisations OAuth de CRO.
- CAPTCHA : pause puis intervention humaine dans la session concernée. Aucun service de résolution tiers ni contournement. Les clés officielles de test ne qualifient que la mécanique SIT, pas la compatibilité avec un contrôle de production.

Toute validation est une condition de reprise, jamais une preuve de rotation. Le résultat final exige les preuves du site et du coffre. Prévoir erreurs, annulation locale, expiration, demande de réauthentification, interruption réseau et récupération après changement distant.

## État

Le module Laboratoire possède des attentes d'observation et des confirmations humaines. Il n'est pas encore ce gestionnaire transactionnel : pas de transfert du contrôle navigateur, pas de reprise réelle, pas de connexion au coffre dans ce module. Les installations du catalogue sont une activité distincte, qualifiée progressivement.

## Références vérifiées le 8 octobre 2026

- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://learn.microsoft.com/fr-fr/graph/permissions-reference
- https://openid.net/specs/openid-connect-core-1_0.html
- https://www.rfc-editor.org/rfc/rfc8252
- https://developers.cloudflare.com/cloudflare-challenges/troubleshooting/challenge-solve-issues/
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/
