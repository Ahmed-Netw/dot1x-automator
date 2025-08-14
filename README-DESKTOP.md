# Application Desktop Native - SSH Réel

Cette application a été transformée en application desktop native utilisant Tauri, permettant des vraies connexions SSH.

## Fonctionnalités

- **Connexions SSH réelles** vers le serveur Robont (6.91.128.111)
- **Tunnel SSH** automatique vers le switch cible
- **Exécution native** de `show configuration | display set | no-more`
- **Stockage local** des configurations récupérées
- **Interface identique** à l'application web
- **Fonctionnement 100% hors ligne**

## Installation et Compilation

### Prérequis
- Node.js et npm
- Rust et Cargo
- Tauri CLI

### Installation des dépendances
```bash
npm install
```

### Mode développement
```bash
npm run tauri:dev
```

### Compilation pour production
```bash
npm run tauri:build
```

Ceci génère un exécutable dans `src-tauri/target/release/`

## Déploiement

### Windows
L'exécutable `.exe` peut être copié et distribué directement.

### Linux
Les paquets `.deb` et `.rpm` sont générés automatiquement.

### macOS
Un bundle `.app` est créé pour macOS.

## Utilisation

1. **Lancer l'application** (double-clic sur l'exécutable)
2. **Remplir les credentials** pour le serveur Robont et le switch cible
3. **Se connecter** - l'application établit une vraie connexion SSH
4. **Récupérer la configuration** automatiquement
5. **Télécharger ou copier** la configuration récupérée

## Architecture Technique

```
Desktop App (Tauri)
├── Frontend (React + TypeScript)
├── Backend (Rust)
├── SSH Client (thrussh)
└── Local Storage (fichiers locaux)
```

### Avantages par rapport à l'application web
- **SSH natif** : Vraies connexions SSH sans limitations du navigateur
- **Sécurité** : Pas de transit par des serveurs tiers
- **Performance** : Exécution native, plus rapide
- **Hors ligne** : Fonctionne sans connexion internet
- **Portabilité** : Exécutable unique, pas d'installation complexe

### Sécurité
- Credentials stockés temporairement en mémoire uniquement
- Chiffrement des connexions SSH standard
- Pas de télémétrie ou envoi de données externes
- Code source auditable

## Support

Cette application fonctionne sur :
- Windows 10/11 (x64)
- macOS 10.15+ (Intel et Apple Silicon)
- Linux (Ubuntu, Debian, CentOS, etc.)

## Troubleshooting

### Erreurs de connexion SSH
- Vérifier la connectivité réseau vers 6.91.128.111
- Valider les credentials du serveur Robont
- S'assurer que le switch cible est accessible depuis Robont

### Problèmes de compilation
- Installer les dépendances Rust : `rustup update`
- Installer Tauri CLI : `cargo install tauri-cli`
- Vérifier les permissions d'exécution