# CRO est un produit autonome

CRO possède son frontend, son processus Node.js, son stockage local et ses versions. SER5 et le NAS utilisés pendant les essais sont des hôtes du banc SIT, pas des prérequis du produit.

La livraison `SER5_Update_0.5.9.199_to_0.5.9.200_CRO-CMS-SIT.ser5upd` proposée pour CRO est **retirée comme mode de distribution de ce projet**. Ne pas l'installer pour obtenir CRO. Aucun nouveau numéro de version SER5 n'est nécessaire pour mettre à jour CRO.

## Installer l'archive indépendante

Prérequis : Node.js 22 ou supérieur avec npm. Aucun module npm tiers n'est requis pour l'interface, les signatures et les simulations.

```sh
npm install --global --ignore-scripts ./credential-rotation-orchestrator-0.3.0.tgz
cro
```

L'installation globale s'effectue dans le préfixe npm de l'utilisateur. Si ce préfixe n'est pas accessible sans droits administrateur, utiliser l'extraction ci-dessous, sans sudo.

Alternative sans installation globale : extraire l'archive dans un dossier choisi puis exécuter :

```sh
node package/bin/cro.js
```

Ouvrir `http://127.0.0.1:8787`. Le frontend fourni est celui de CRO, sans iframe, proxy ou authentification du dashboard SER5. Arrêt : Ctrl+C. Aucun service système, règle réseau ni tâche au démarrage n'est créé.

Options : `--port 8787`, `--data-dir /chemin/prive`, `--help`, `--version`.

## Données et mises à jour

Par défaut, le lanceur place les données hors du répertoire logiciel :

- Linux : `$XDG_DATA_HOME/credential-rotation-orchestrator`, ou `~/.local/share/credential-rotation-orchestrator`.
- macOS : `~/Library/Application Support/CredentialRotationOrchestrator`.
- Windows : `%LOCALAPPDATA%/CredentialRotationOrchestrator`.

Les chemins macOS et Windows sont prévus par le lanceur ; leur exécution native et la protection par ACL Windows ne sont pas encore qualifiées. La distribution extraite a été testée sur Linux. Un ancien checkout contenant `.cro-data` conserve ce dossier : aucune migration ni régénération de clé n'est faite silencieusement. `CRO_DATA_DIR` et `--data-dir` restent prioritaires.

Pour une mise à jour : arrêter CRO, sauvegarder son dossier de données privé, vérifier l'empreinte de la nouvelle archive, remplacer uniquement le logiciel, puis relancer avec le même dossier de données. Conserver l'archive précédente. Une migration future du format des données devra préciser son propre rollback ; rétrograder le code seul ne suffira pas nécessairement.

L'endpoint `/api/health` indique le nom du produit, sa version et son mode, sans identité de signature ni secret. Un HTTP 200 ne prouve pas la disponibilité du coffre : celle-ci nécessite une validation spécifique.

## Ce qui est réellement portable aujourd'hui

Le paquet démarre sans SER5, NAS, SSH, Docker, PHP, Playwright ni configuration privée. Il fournit l'interface CRO, l'atelier de templates, les signatures/importations et les simulations. L'identité locale et le catalogue persistent entre redémarrages et indépendamment de l'emplacement du logiciel.

Les rotations réelles des six fixtures ont été qualifiées dans le banc SIT existant. **Leur adaptateur de coffre reste expérimental et utilise la passerelle SSH de ce banc.** Cela ne constitue pas encore un connecteur Vaultwarden universel ni un installeur des six sites sur une machine neuve. L'assistant de configuration du coffre, la gestion complète des sites et l'ordonnanceur restent à développer avant une diffusion destinée à des utilisateurs non techniques.

Les sources du banc et ses guides restent sous `sit/`. Les outils qui modifient l'hôte, les bases, les sessions, les clés et la configuration privée sont exclus de l'archive applicative. Les recettes et le runner optionnels sont inclus pour conserver le mode de qualification explicite ; ils ne sont pas activés au lancement normal.

## Construire la distribution

```sh
npm ci --ignore-scripts
npm run check
npm pack --ignore-scripts
```

La liste `files` du manifeste npm limite le contenu distribué. Le dépôt reste marqué `private` pour prévenir une publication accidentelle au registre npm ; cela n'empêche ni la distribution de l'archive ni son installation locale. Une publication au registre sera une décision distincte.
