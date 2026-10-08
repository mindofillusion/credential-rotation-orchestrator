# Qualification du raccordement Windows — 8 octobre 2026

CRO 0.2.6 côté Windows, backend Forums SIT et coffre Vaultwarden SIT distinct. Le relais signé installé a été vérifié par son SHA-256 puis démarré sous un compte non privilégié. L'association du lanceur Windows est active ; les clés privées restent sur leurs hôtes respectifs.

## Résultats observés

- L'API locale Windows affiche le mode Forums SIT et les trois moteurs phpBB, MyBB et SMF.
- Une rotation phpBB déclenchée via cette API a terminé le 8 octobre 2026 à 09:10:10 UTC.
- Résultat : succeeded ; remoteChanged=true ; vaultUpdated=true.
- Nouveau mot de passe accepté, ancien refusé, connexion avec le secret relu dans Vaultwarden réussie.
- recoveryPending=false.
- Une requête HTTPS non signée vers le relais retourne HTTP 403.

Aucun secret, identifiant personnel, clé privée ou adresse de déploiement n'est publié dans ce rapport.

## Limites

La rotation depuis Windows a été validée sur phpBB uniquement ; la présence de MyBB et SMF dans l'interface n'est pas une nouvelle qualification de leur rotation via le relais. Les CMS ne sont pas activés par ce raccordement. Le relais n'est pas encore configuré pour redémarrer automatiquement avec l'hôte. Le raccourci Windows relance CRO avec l'association préparée.

L'endpoint local /api/health indique encore le mode du moteur local (simulation), même lorsque les API métier sont transférées au banc distant : il ne doit pas être utilisé pour conclure à l'absence ou à la disponibilité du coffre. Le mode métier doit être lu dans /api/overview. Cette distinction reste à corriger dans l'indicateur de santé.
