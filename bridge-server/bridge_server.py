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
import sys

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Network Management Bridge Server", version="1.0.0")

# Configuration CORS pour permettre les requetes depuis l'app web
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*\.lovable\.(app|dev)$|^null$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modeles de donnees
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

# Etat global
server_status = {
    "status": "ok",
    "version": "1.0.0",
    "active_connections": 0
}

@app.get("/health")
async def health_check():
    """Verification de sante du serveur bridge"""
    return server_status

@app.post("/ping-device")
async def ping_device(request: PingRequest):
    """Ping un peripherique reseau"""
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
            "message": "Ping reussi" if success else "Ping echoue",
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
    """Test de connexion SSH vers un peripherique"""
    try:
        logger.info(f"Test connexion SSH vers {request.host}")
        
        # Import conditionnel de paramiko
        try:
            import paramiko
        except ImportError:
            raise HTTPException(
                status_code=500, 
                detail="Paramiko non installe. Executez: pip install paramiko"
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
            
            # Test d'execution d'une commande simple
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
                "message": f"Connexion SSH reussie vers {hostname}"
            }
            
        except paramiko.AuthenticationException:
            raise HTTPException(status_code=401, detail="Authentification SSH echouee")
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
    """Recuperation de configuration via serveur Rebond"""
    try:
        logger.info(f"Recuperation config via Rebond {request.rebond_ip} -> {request.switch_ip}")
        
        # Verifier que le script rebond_fetch_config.py existe
        script_path = os.path.join(os.path.dirname(__file__), "rebond_fetch_config.py")
        if not os.path.exists(script_path):
            raise HTTPException(
                status_code=500, 
                detail="Script rebond_fetch_config.py non trouve dans le dossier bridge-server"
            )
        
        # Preparer la commande
        cmd = [
            sys.executable, script_path,
            request.rebond_ip,
            request.rebond_username,
            request.rebond_password,
            request.switch_ip,
            request.switch_username,
            request.switch_password
        ]
        
        # Executer le script avec timeout
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=180,  # 3 minutes de timeout pour les multi-IPs
            cwd=os.path.dirname(__file__),
            env=env
        )
        
        if result.returncode == 0:
            # Succes - parser la sortie
            output = result.stdout
            
            # Parse les fichiers sauvegardes individuellement
            saved_files = []
            config_errors = []
            
            for line in output.split('\n'):
                if line.startswith("CONFIG_SAVED:"):
                    saved_files.append(line.replace("CONFIG_SAVED:", "").strip())
                elif line.startswith("CONFIG_ERROR:"):
                    config_errors.append(line.replace("CONFIG_ERROR:", "").strip())
            
            # Collecter toutes les configurations
            all_configurations = []
            hostnames = []
            
            for config_file in saved_files:
                if os.path.exists(config_file):
                    with open(config_file, 'r', encoding='utf-8') as f:
                        file_content = f.read()
                        all_configurations.append(file_content)
                        
                        # Extraire le hostname du fichier
                        for line in file_content.split('\n'):
                            if line.startswith("# Hostname:"):
                                hostname = line.split(":")[1].strip()
                                if hostname != "Non detecte":
                                    hostnames.append(hostname)
                                break
            
            # Combiner toutes les configurations
            combined_config = "\n\n".join(all_configurations) if all_configurations else ""
            combined_hostname = ", ".join(hostnames) if hostnames else "Multiple switches"
            
            # Preparer le message de statut
            success_count = len(saved_files)
            error_count = len(config_errors)
            
            status_message = f"Configurations recuperees avec succes: {success_count}"
            if error_count > 0:
                status_message += f", echecs: {error_count}"
            
            return {
                "success": True,
                "configuration": combined_config,
                "hostname": combined_hostname,
                "logs": output,
                "message": status_message,
                "saved_files": saved_files,
                "errors": config_errors
            }
        else:
            # Erreur
            error_output = result.stderr or ""
            stdout_output = result.stdout or ""
            diagnostic = (
                f"ReturnCode={result.returncode}\n"
                f"STDERR:\n{error_output}\n"
                f"STDOUT:\n{stdout_output}"
            )
            logger.error(f"Erreur script rebond: {diagnostic}")
            raise HTTPException(
                status_code=500, 
                detail=f"Erreur script rebond_fetch_config.py\n{diagnostic}"
            )
            
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Timeout lors de la recuperation (3min)")
    except Exception as e:
        logger.error(f"Erreur recuperation config: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@app.get("/")
async def root():
    """Page d'accueil du serveur bridge"""
    return {
        "message": "Network Management Bridge Server",
        "version": server_status["version"],
        "status": server_status["status"],
        "endpoints": {
            "/health": "Verification de sante",
            "/ping-device": "Ping d'un peripherique",
            "/test-connection": "Test de connexion SSH",
            "/get-configuration": "Recuperation de configuration via Rebond"
        }
    }

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 50)
    print("ðŸŒ‰ Network Management Bridge Server")
    print("=" * 50)
    print("ðŸ“ Serveur: http://127.0.0.1:5001")
    print("ðŸ“š Documentation: http://127.0.0.1:5001/docs")
    print("ðŸ”§ Endpoints disponibles:")
    print("   â€¢ GET  /health - VÃ©rification de santÃ©")
    print("   â€¢ POST /ping-device - Ping d'un pÃ©riphÃ©rique")
    print("   â€¢ POST /test-connection - Test connexion SSH")
    print("   â€¢ POST /get-configuration - RÃ©cupÃ©ration config")
    print("=" * 50)
    print("ðŸ’¡ Utilisez Ctrl+C pour arrÃªter le serveur")
    print("=" * 50)
    
    uvicorn.run(
        "bridge_server:app", 
        host="127.0.0.1", 
        port=5001, 
        reload=True,
        log_level="info"
    )
