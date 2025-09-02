# Guide de Construction - Dot1x Automator

## Solution Rapide - Commandes PowerShell

Exécutez ces commandes dans PowerShell depuis le dossier racine du projet :

```powershell
# 1. Installer les dépendances
npm install

# 2. Installer Tauri CLI v1 (si pas déjà fait)
cargo install tauri-cli --version ^1.5

# 3. Construire l'exécutable portable
npm run build

# 4. Lancer l'exécutable portable (aucune installation requise)
.\src-tauri\target\release\dot1x-automator.exe
```

**L'exécutable portable sera créé dans :** `src-tauri\target\release\`
**Nom du fichier :** `dot1x-automator.exe`

✅ **Aucune installation requise** - Copiez simplement le `.exe` sur n'importe quel PC Windows et lancez-le directement!

## Prérequis Détaillés

### Windows 10/11
1. **Node.js** : Télécharger depuis https://nodejs.org
2. **Rust** : Installer avec `winget install Rustlang.Rustup`
3. **C++ Build Tools** : Visual Studio Build Tools ou Visual Studio Community
4. **WebView2** : Pré-installé sur Windows 11, télécharger pour Windows 10

### Vérification des Prérequis
```powershell
# Vérifier Node.js
node --version
npm --version

# Vérifier Rust
rustc --version
cargo --version

# Vérifier Tauri CLI
cargo tauri --version
```

## Résolution des Problèmes Courants

### "link.exe introuvable"
```powershell
# Installer Visual Studio Build Tools
winget install Microsoft.VisualStudio.2022.BuildTools
```

### "tauri command not found"
```powershell
# Réinstaller Tauri CLI v1
cargo install tauri-cli --version ^1.5 --force
```

### L'application ne démarre pas
1. Vérifier WebView2 : `.\src-tauri\target\release\dot1x-automator.exe --version`
2. Exécuter en mode debug : `npm run build:debug`
3. Consulter les logs dans le terminal

## Scripts Disponibles

- `npm run dev` : Mode développement avec hot reload
- `npm run build` : Construction optimisée pour production
- `npm run build:debug` : Construction debug (plus rapide)

## Structure des Fichiers

```
dot1x-automator/
├── src/                    # Code React/TypeScript
├── src-tauri/             # Code Rust backend
│   ├── src/main.rs        # Logique SSH
│   ├── Cargo.toml         # Dépendances Rust
│   └── target/release/    # Exécutables générés
├── package.json           # Dépendances npm
└── package-scripts.json   # Scripts npm personnalisés
```

## Support

Si vous rencontrez des problèmes :
1. Vérifiez que tous les prérequis sont installés
2. Consultez ce guide de construction
3. Utilisez `npm run build:debug` pour plus d'informations