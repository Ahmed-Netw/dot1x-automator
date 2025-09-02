# Bridge Server pour Network Management Tools

Ce serveur bridge permet aux applications web d'exécuter des connexions SSH réelles via une API locale.

## Installation et Démarrage

### Méthode automatique (recommandée)

**Windows:**
```bash
./start.bat
```

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

### Méthode manuelle

1. **Installer les dépendances:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Démarrer le serveur:**
   ```bash
   python bridge_server.py
   ```

## Utilisation

Une fois démarré, le serveur sera accessible sur:
- **API:** http://127.0.0.1:5001
- **Documentation:** http://127.0.0.1:5001/docs

## Endpoints disponibles

- `GET /health` - Vérification de santé
- `POST /ping-device` - Ping d'un périphérique
- `POST /test-connection` - Test de connexion SSH
- `POST /get-configuration` - Récupération de configuration via Rebond

## Sécurité

⚠️ **Important:** Ce serveur est conçu pour un usage local uniquement. Ne l'exposez jamais sur internet.

## Dépendances

- FastAPI - Framework web
- Uvicorn - Serveur ASGI
- Paramiko - Client SSH
- python-multipart - Support multipart

## Intégration

L'application web détecte automatiquement si le bridge server est disponible et bascule entre:
1. **Mode Desktop** (Tauri) - Connexions SSH natives
2. **Mode Bridge** - Connexions SSH via serveur local
3. **Mode Simulation** - Configurations simulées