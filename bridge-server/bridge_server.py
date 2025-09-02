#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bridge Server pour Network Management Tools
Serveur FastAPI local pour permettre les connexions SSH depuis le navigateur
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import os
import asyncio
import json
import logging
from typing import Optional, Dict, Any

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Network Management Bridge Server", version="1.0.0")

# Configuration CORS pour permettre les requêtes depuis l'app web
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*\.lovable\.(app|dev)$|^null$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modèles de données
class PingRequest(BaseModel):
    host: str

class ConnectionRequest(BaseModel):
    host: str
    username: str
    password: str
    device_type: str = "juniper"

class ConfigurationRequest(BaseModel):
    rebond_ip: str
    rebond_username: str
    rebond_password: str
    switch_ip: str
    switch_username: str
    switch_password: str

# État global
server_status = {
    "status": "ok",
    "version": "1.0.0",
    "active_connections": 0
}

@app.get("/health")
async def health_check():
    """Vérification de santé du serveur bridge"""
    return server_status

@app.post("/ping-device")
async def ping_device(request: PingRequest):
    """Ping un périphérique réseau"""
    try:
        logger.info(f"Ping vers {request.host}")
        
        # Test de ping selon l'OS
        import platform
        param = "-n" if platform.system().lower() == "windows" else "-c"
        
        # Ping avec timeout de 3 secondes
        if platform.system().lower() == "windows":
            result = subprocess.run(
                ["ping", param, "1", "-w", "3000", request.host],  # -w en millisecondes sur Windows
                capture_output=True,
                text=True,
                timeout=10
            )
        else:
            result = subprocess.run(
                ["ping", param, "1", "-w", "3", request.host],  # -w en secondes sur Linux/Mac
                capture_output=True,
                text=True,
                timeout=10
            )
        
        success = result.returncode == 0
        
        return {
            "success": success,
            "host": request.host,
            "message": "Ping réussi" if success else "Ping échoué",
            "details": result.stdout if success else result.stderr
        }
        
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "host": request.host,
            "error": "Timeout du ping (3s)"
        }
    except Exception as e:
        logger.error(f"Erreur ping {request.host}: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur ping: {str(e)}")

@app.post("/test-connection")
async def test_connection(request: ConnectionRequest):
    """Test de connexion SSH vers un périphérique"""
    try:
        logger.info(f"Test connexion SSH vers {request.host}")
        
        # Import conditionnel de paramiko
        try:
            import paramiko
        except ImportError:
            raise HTTPException(
                status_code=500, 
                detail="Paramiko non installé. Exécutez: pip install paramiko"
            )
        
        # Tentative de connexion SSH
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        try:
            ssh.connect(
                hostname=request.host,
                username=request.username,
                password=request.password,
                timeout=10,
                allow_agent=False,
                look_for_keys=False
            )
            
            # Test d'exécution d'une commande simple
            stdin, stdout, stderr = ssh.exec_command("show version | no-more" if request.device_type == "juniper" else "show version")
            output = stdout.read().decode('utf-8', errors='ignore')
            
            # Extraction du hostname
            hostname = "Unknown"
            if "juniper" in request.device_type.lower():
                if "Hostname:" in output:
                    hostname = output.split("Hostname:")[1].split()[0].strip()
            
            ssh.close()
            
            return {
                "success": True,
                "host": request.host,
                "hostname": hostname,
                "device_info": {
                    "type": request.device_type,
                    "host": request.host,
                    "username": request.username
                },
                "message": f"Connexion SSH réussie vers {hostname}"
            }
            
        except paramiko.AuthenticationException:
            raise HTTPException(status_code=401, detail="Authentification SSH échouée")
        except paramiko.SSHException as e:
            raise HTTPException(status_code=500, detail=f"Erreur SSH: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erreur connexion: {str(e)}")
        finally:
            ssh.close()
            
    except Exception as e:
        logger.error(f"Erreur test connexion {request.host}: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@app.post("/get-configuration")
async def get_configuration(request: ConfigurationRequest):
    """Récupération de configuration via serveur Rebond"""
    try:
        logger.info(f"Récupération config via Rebond {request.rebond_ip} -> {request.switch_ip}")
        
        # Vérifier que le script rebond_fetch_config.py existe
        script_path = os.path.join(os.path.dirname(__file__), "rebond_fetch_config.py")
        if not os.path.exists(script_path):
            raise HTTPException(
                status_code=500, 
                detail="Script rebond_fetch_config.py non trouvé dans le dossier bridge-server"
            )
        
        # Préparer la commande
        cmd = [
            "python3", script_path,
            request.rebond_ip,
            request.rebond_username,
            request.rebond_password,
            request.switch_ip,
            request.switch_username,
            request.switch_password
        ]
        
        # Exécuter le script avec timeout
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,  # 2 minutes de timeout
            cwd=os.path.dirname(__file__)
        )
        
        if result.returncode == 0:
            # Succès - parser la sortie
            output = result.stdout
            
            # Chercher le fichier de configuration généré
            config_file = None
            for line in output.split('\n'):
                if "Fichier sauvegardé:" in line:
                    config_file = line.split("Fichier sauvegardé:")[1].strip()
                    break
            
            configuration = ""
            if config_file and os.path.exists(config_file):
                with open(config_file, 'r', encoding='utf-8') as f:
                    configuration = f.read()
            else:
                # Fallback: utiliser la sortie directe si pas de fichier
                configuration = output
            
            # Extraire le hostname
            hostname = "Unknown"
            if "hostname:" in output.lower():
                for line in output.split('\n'):
                    if "hostname:" in line.lower():
                        hostname = line.split(':')[1].strip()
                        break
            
            return {
                "success": True,
                "configuration": configuration,
                "hostname": hostname,
                "logs": output,
                "message": "Configuration récupérée avec succès"
            }
        else:
            # Erreur
            error_output = result.stderr or result.stdout
            logger.error(f"Erreur script rebond: {error_output}")
            raise HTTPException(
                status_code=500, 
                detail=f"Erreur script: {error_output}"
            )
            
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Timeout lors de la récupération (2min)")
    except Exception as e:
        logger.error(f"Erreur récupération config: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@app.get("/")
async def root():
    """Page d'accueil du serveur bridge"""
    return {
        "message": "Network Management Bridge Server",
        "version": server_status["version"],
        "status": server_status["status"],
        "endpoints": {
            "/health": "Vérification de santé",
            "/ping-device": "Ping d'un périphérique",
            "/test-connection": "Test de connexion SSH",
            "/get-configuration": "Récupération de configuration via Rebond"
        }
    }

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 50)
    print("🌉 Network Management Bridge Server")
    print("=" * 50)
    print("📍 Serveur: http://127.0.0.1:5001")
    print("📚 Documentation: http://127.0.0.1:5001/docs")
    print("🔧 Endpoints disponibles:")
    print("   • GET  /health - Vérification de santé")
    print("   • POST /ping-device - Ping d'un périphérique")
    print("   • POST /test-connection - Test connexion SSH")
    print("   • POST /get-configuration - Récupération config")
    print("=" * 50)
    print("💡 Utilisez Ctrl+C pour arrêter le serveur")
    print("=" * 50)
    
    uvicorn.run(
        "bridge_server:app", 
        host="127.0.0.1", 
        port=5001, 
        reload=True,
        log_level="info"
    )