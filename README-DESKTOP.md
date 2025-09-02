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
- Rust et Cargo (https://rustup.rs/)
- WebView2 Runtime (Windows 10/11)
- C++ Build Tools (Visual Studio Build Tools)

### Installation rapide
```bash
# 1. Installer les dépendances frontend
npm install

# 2. Installer Tauri CLI v1
cargo install tauri-cli --version ^1.5

# 3. Construire l'application
npm run build

# 4. Exécuter l'application
.\src-tauri\target\release\dot1x-automator.exe
```

### Mode développement
```bash
# Développement avec hot reload
npm run dev
```

### Compilation pour production
```bash
# Build optimisé pour production
npm run build

# Build debug (plus rapide pour tests)
npm run build:debug
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