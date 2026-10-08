# Roadmap

## 0.1 — Safe simulation

- [x] standalone local interface
- [x] Ed25519 manifest verification
- [x] SHA-256 payload binding
- [x] declarative action allowlist
- [x] exact HTTPS origin checks
- [x] transaction state machine
- [x] secret-redacted CloudEvents
- [x] failure simulations and unit tests

## 0.2 — Local template workshop

- [x] persistent local template store with atomic writes
- [x] encrypted filesystem-backed local signing identity
- [ ] operating-system keychain-backed local signing identity
- [x] import/export bundles with expected SHA-256 verification
- [x] explicit public-key trust by independently verified fingerprint
- [x] template editor and static validator
- [x] strict Playwright action-fragment ingestion with fill-value removal
- [ ] full Codegen locator support and recorder integration
- [ ] replay against a purpose-built test website

## 0.3 — Vaultwarden integration

- [ ] explicit read-only connection test
- [ ] ephemeral unlock session
- [ ] scoped entry selection
- [ ] verified update with synchronization checks
- [ ] encrypted recovery store
- [ ] integration tests against an isolated disposable Vaultwarden instance

## 0.4 — Isolated browser runner

- [ ] Playwright worker
- [ ] per-run browser context
- [ ] network allowlist enforcement
- [ ] MFA/manual checkpoints
- [ ] fresh-session verification
- [ ] resource and time limits

## 0.5 — Registry and integrations

- [ ] signed repository metadata and revocation
- [ ] provenance and transparency records
- [ ] outbound HMAC webhooks
- [ ] MQTT transport
- [ ] Home Assistant and Node-RED examples

## 1.0 criteria

- independent security review;
- stable template schema;
- recovery drills passing under forced failures;
- no known secret leakage paths;
- documented key rotation and registry compromise procedure;
- at least three maintained site templates with compatibility tests.

## Distribution indépendante — 0.2.3

- [x] commande `cro`, archive npm locale, version propre au produit
- [x] stockage utilisateur séparé du logiciel ; identité conservée après déplacement
- [x] démarrage sans SER5, NAS ou configuration SIT
- [ ] assistant de première installation et connecteur Vaultwarden portable
- [ ] qualification native Windows/macOS et protection des secrets par le système

## Validation par courriel — étude ouverte le 8 octobre 2026

- [ ] conserver l'adresse déjà associée au compte, sans imposer une boîte générique
- [ ] checkpoint manuel : suspendre, notifier localement et reprendre après validation
- [ ] étudier un connecteur de messagerie facultatif avec consentement et droits minimaux
- [ ] lier chaque code/lien à une seule opération, au site et à une durée de validité
- [ ] vérifier le résultat côté site avant de confirmer la mise à jour du coffre
- [ ] tests SIT : code expiré, messages simultanés, lien déjà consommé, mauvaise origine

Le cas impots.gouv.fr signalé par l'utilisateur reste à vérifier sur des sources officielles : aucune compatibilité n'est revendiquée. Aucun essai sur un compte fiscal réel n'est prévu. Le mode assisté est le premier objectif ; l'automatisation de la lecture des courriels est une intégration distincte.

### Piste utilisateur — client mail léger (8 octobre 2026)

Prévoir un client mail facultatif intégré à CRO, configuré par l'utilisateur, qui ne collecte que les messages de validation et peut les traiter automatiquement selon une politique explicite par site et par compte. Conserver l'adresse personnelle existante ; ne pas imposer de boîte générique.

Distinguer les codes à saisir, les liens à ouvrir et les validations exigeant réellement une réponse par courriel. L'envoi automatique de réponses est une option distincte, désactivée par défaut et activable par l'utilisateur pour les parcours autorisés. La corrélation doit porter sur une opération en attente, son compte, son origine et son délai ; les messages inattendus ou ambigus restent en attente humaine. Ne pas suivre les instructions libres du contenu d'un message.

Étudier OAuth et les permissions minimales, les filtres côté serveur lorsque disponibles, la conservation limitée des métadonnées, la protection des jetons et l'absence de secrets dans les alertes. Certains fournisseurs accordent une permission de lecture plus large que le filtre applicatif : l'interface devra expliquer cette différence. Une validation par mail ne prouve jamais à elle seule le changement du mot de passe : vérifier ensuite une nouvelle connexion et la relecture du coffre.

Cette piste est documentée, pas implémentée. Le lecteur Mailpit SIT en développement est limité à l'observation locale : aucun envoi, aucune réponse automatique et aucun accès à une messagerie personnelle.

Plan hybride retenu le 8 octobre 2026 : [gestionnaire d’interventions](interventions.md). Les installations du catalogue sont organisées en lots isolés et qualifiés, sans modification des instances de production.
