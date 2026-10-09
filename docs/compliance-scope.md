# Périmètre réglementaire et exigences de conception

État au 9 octobre 2026. Analyse de cadrage, non avis juridique ni attestation de conformité. Le code de développement n'est pas automatiquement présent dans les installations 0.3.0.

## Décision d'architecture

Le coffre est un prérequis installé et administré par l'utilisateur. CRO ne déploie, ne met à jour et ne sauvegarde pas un serveur de coffre de production. Les recettes de déploiement Vaultwarden du répertoire `sit/` restent exclusivement des fixtures de test isolées. Le paquet autonome ne contient pas le serveur Bitwarden/Vaultwarden. Le connecteur de production et son assistant de configuration restent à réaliser.

Cette séparation ne doit pas servir de justification à une exemption réglementaire. CRO manipule encore des secrets et conserve des candidats dans un journal de récupération chiffré. Il possède aussi une identité de signature locale. Supprimer ces protections pour essayer de changer de qualification juridique serait contraire à l'objectif de sécurité.

## Analyse juridique à confirmer avant diffusion générale

| Sujet | Fait sourcé | Conséquence pour CRO / inconnue |
|---|---|---|
| CRA, périmètre | La fourniture commerciale de produits numériques relève du règlement ; le logiciel libre fourni hors activité commerciale bénéficie d'un traitement spécifique. | Le porteur confirme le 9 octobre 2026 une diffusion non commerciale. Dans ce modèle libre hors activité commerciale, l'exclusion CRA est l'hypothèse de cadrage ; vérifier les conditions effectives de distribution. Cette intention ne modifie pas la licence et n'interdit pas les usages commerciaux autorisés par celle-ci. |
| CRA, catégorie | Le règlement d'exécution 2025/2392 décrit les gestionnaires de mots de passe comme des produits stockant des mots de passe, localement ou sur serveur, incluant notamment génération et intégration à des applications. | Une API vers un coffre ne suffit pas à conclure à cette catégorie ; le stockage de récupération et la fonction principale de CRO nécessitent néanmoins une analyse formelle. Ne pas déclarer CRO hors champ ni classé définitivement. |
| RGPD | Le rôle de sous-traitant suppose un traitement effectif pour le compte d'un responsable ; le simple éditeur ne reçoit pas automatiquement ce rôle. | Documenter séparément application locale, éventuel registre central, support et télémétrie. Un futur hébergement de messages ou de journaux modifierait le périmètre. |
| Cryptologie française | Utilisation libre ; fourniture soumise à formalités sauf exception selon les caractéristiques et opérations. | Qualification et exemptions à vérifier auprès de l'ANSSI ou d'un spécialiste. Dépendre de bibliothèques standard ou d'un coffre tiers ne constitue pas, à lui seul, une exemption. |
| États-Unis | Les exigences dépendent notamment de l'activité commerciale, des données et des clients ciblés. | Pas de promesse FTC/FIPS/secteur public. Examiner export et exigences contractuelles avant distribution ciblée ou marché réglementé. |

Sources primaires consultées le 9 octobre 2026 :
- Commission européenne, CRA et open source : https://digital-strategy.ec.europa.eu/en/policies/cra-open-source
- Règlement d'exécution (UE) 2025/2392, annexe I : https://eur-lex.europa.eu/eli/reg_impl/2025/2392/oj
- Commission, résumé du CRA : https://digital-strategy.ec.europa.eu/en/policies/cra-summary
- CNIL, rôles responsable/sous-traitant : https://www.cnil.fr/fr/responsable-de-traitement-et-sous-traitant-6-bonnes-pratiques-pour-respecter-les-donnees
- ANSSI, contrôle des moyens de cryptologie : https://cyber.gouv.fr/reglementation/reglementation-identite-confiance-numerique/controles-reglementaires-cryptographie/controle-moyen-de-cryptologie/
- FTC, Start with Security : https://www.ftc.gov/business-guidance/resources/start-security-guide-business

## Contrôles techniques et preuves

Les exigences MFA, sessions et chiffrement sont détaillées dans [Authentification et connexion aux coffres](authentication-vault-security.md). Ce document distingue les décisions de conception des protections réellement implémentées.

| Exigence de projet | État / preuve | Limite |
|---|---|---|
| Aucun changement sans autorisation | Moteur refusant par défaut ; politique exacte compte/site/motif. Tests `rotation-policy.test.js`. | La politique est injectée par un appelant de confiance, pas acceptée depuis le corps HTTP. Gestion persistante des consentements de production et UI à intégrer. |
| Pas de rotation périodique par défaut | Motif périodique interdit sans activation et justification explicites. | Aucun ordonnanceur de production n'existe encore. La justification est une donnée exigée, pas une validation juridique automatique. |
| Modes de test explicitement autorisés | Runner forums/CMS et parcours courriel exigent `CRO_SIT_ROTATION_APPROVED=true`. Simulation fixe autorisée pour le seul compte de démonstration. | Les lanceurs distants existants ne sont pas modifiés par ce commit. |
| Pas de second essai après refus | Garde persistante partagée, voir `site-authentication-lock.md`. | Provisionnement du répertoire commun et regroupement d'alias DNS encore à intégrer. |
| Reprise sans perte silencieuse | Journal chiffré, relecture et logique de reprise testées. | Fournisseur de clé natif, gestion contrôlée des verrous abandonnés et chaîne réelle NAS non qualifiés. |
| Intégrité des mises à jour et templates | Signature, SHA-256 et tests déjà présents. | Une signature ne prouve ni innocuité ni conformité ; l'autorité de publication et son exploitation restent à auditer. |
| Protection des données | Séparation des secrets et journaux publics ; fonctionnement local prévu. | Inventaire complet, rétention, effacement, captures navigateur, support et futur service central à auditer. |
| Maintenance et vulnérabilités | `SECURITY.md` explicite les limites et le signalement sans secrets publics. | Canal privé opérationnel, support annoncé, SBOM par livraison et procédure d'incident restent des critères avant diffusion générale. |

63 tests locaux réussis après ces changements. Les tests du moteur/politique n'utilisent aucun compte de production. Les vérifications de syntaxe couvrent le serveur et les runners modifiés. Aucun audit indépendant, certification ou qualification de bout en bout du nouveau parcours NAS n'est revendiqué.

## Référentiels retenus et prochains critères de livraison

OWASP ASVS 5.0 comme grille technique avec sélection motivée des exigences pertinentes ; NIST SSDF SP 800-218 pour le cycle de développement. Une matrice détaillée identifiant exigences, preuves et écarts reste à établir avant de parler d'alignement complet.

La rotation est une remédiation motivée, pas une opération calendaire systématique. NIST SP 800-63B-4 (§3.1.1.2) écarte le renouvellement périodique imposé des mots de passe utilisateurs ; sa portée principale est celle des vérificateurs d'identité, pas directement un client de rotation. Les exigences du site cible et les politiques particulières de comptes privilégiés restent à considérer explicitement.

- ASVS : https://owasp.org/www-project-application-security-verification-standard/
- SSDF : https://csrc.nist.gov/projects/ssdf
- NIST mots de passe : https://pages.nist.gov/800-63-4/sp800-63b.html

La prochaine livraison signée doit vérifier le moteur avec ses politiques, les chemins de lancement et le provisionnement de la garde, les données existantes, l'installation et le retour arrière. Ce dossier est conservé avec le code et doit évoluer avec chaque preuve ; il ne transforme pas le prototype en produit conforme.
