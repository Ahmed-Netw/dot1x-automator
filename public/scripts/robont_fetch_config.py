#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de récupération de configuration via serveur Robont
Auteur: Équipe Network Tools
Version: 1.0
Date: 2024

Usage:
    python robont_fetch_config.py <robont_ip> <robont_user> <robont_pass> <switch_ip> <switch_user> <switch_pass> <output_dir>

Exemple:
    python robont_fetch_config.py 6.91.128.111 robont_user robont_pass 192.168.1.10 switch_user switch_pass "C:\\Configurations"
"""

import sys
import os
import subprocess
import datetime
import re
from pathlib import Path

def install_paramiko():
    """Installe paramiko si pas déjà installé"""
    try:
        import paramiko
        return True
    except ImportError:
        print("📦 Installation de paramiko...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko"])
            print("✅ Paramiko installé avec succès")
            import paramiko
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Erreur lors de l'installation de paramiko: {e}")
            return False

def extract_hostname(config_text):
    """Extrait le hostname de la configuration"""
    patterns = [
        r'set system host-name\s+(\S+)',
        r'set hostname\s+(\S+)',
        r'hostname\s+(\S+)',
        r'host-name\s+(\S+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, config_text, re.IGNORECASE)
        if match:
            hostname = match.group(1).replace('"', '').replace("'", "").replace(';', '')
            return hostname
    
    return None

def connect_via_robont(robont_ip, robont_user, robont_pass, switch_ip, switch_user, switch_pass):
    """Connexion via serveur Robont vers switch"""
    try:
        import paramiko
        
        print(f"🔗 Connexion au serveur Robont {robont_ip}...")
        
        # Connexion SSH au serveur Robont
        robont_client = paramiko.SSHClient()
        robont_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        robont_client.connect(
            hostname=robont_ip,
            username=robont_user,
            password=robont_pass,
            timeout=30,
            look_for_keys=False,
            allow_agent=False
        )
        
        print(f"✅ Connecté au serveur Robont")
        print(f"🔗 Connexion SSH vers le switch {switch_ip}...")
        
        # Commande SSH pour se connecter au switch via Robont
        ssh_command = f"sshpass -p '{switch_pass}' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {switch_user}@{switch_ip}"
        
        # Ouverture d'un canal pour l'interaction
        channel = robont_client.invoke_shell()
        
        # Attendre le prompt du Robont
        import time
        time.sleep(2)
        
        # Envoyer la commande de connexion SSH
        channel.send(ssh_command + '\n')
        time.sleep(3)
        
        # Envoyer la commande de configuration Juniper
        juniper_command = "show configuration | display set | no-more\n"
        channel.send(juniper_command)
        time.sleep(5)
        
        # Lire la réponse
        output = ""
        while channel.recv_ready():
            output += channel.recv(4096).decode('utf-8', errors='ignore')
            time.sleep(0.1)
        
        # Fermer les connexions
        channel.close()
        robont_client.close()
        
        print(f"✅ Configuration récupérée depuis {switch_ip}")
        
        # Nettoyer la sortie
        lines = output.split('\n')
        config_lines = []
        capture = False
        
        for line in lines:
            # Commencer à capturer après la commande
            if 'show configuration' in line.lower():
                capture = True
                continue
            # Arrêter si on trouve un nouveau prompt
            if capture and (line.strip().endswith('> ') or line.strip().endswith('$ ') or line.strip().endswith('# ')):
                break
            # Capturer les lignes set
            if capture and line.strip().startswith('set '):
                config_lines.append(line.strip())
        
        if not config_lines:
            raise Exception("Aucune ligne de configuration 'set' trouvée dans la sortie")
        
        return '\n'.join(config_lines)
        
    except Exception as e:
        raise Exception(f"Erreur lors de la connexion: {str(e)}")

def save_configuration(config_text, switch_ip, output_dir):
    """Sauvegarde la configuration dans un fichier .txt"""
    try:
        # Créer le dossier de sortie s'il n'existe pas
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Extraire le hostname
        hostname = extract_hostname(config_text)
        
        # Générer le nom de fichier
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        if hostname:
            filename = f"{hostname}_{timestamp}.txt"
        else:
            filename = f"switch_{switch_ip.replace('.', '_')}_{timestamp}.txt"
        
        filepath = os.path.join(output_dir, filename)
        
        # Ajouter l'en-tête au fichier
        header = f"""# Configuration récupérée le {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
# Switch IP: {switch_ip}
# Hostname: {hostname or 'Non détecté'}
# Commande: show configuration | display set | no-more
# Récupéré via serveur Robont
#==================================================

"""
        
        # Écrire le fichier
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(header + config_text)
        
        print(f"📁 Configuration sauvegardée: {filepath}")
        return filepath
        
    except Exception as e:
        raise Exception(f"Erreur lors de la sauvegarde: {str(e)}")

def main():
    """Fonction principale"""
    print("🚀 Script de récupération de configuration Juniper via Robont")
    print("=" * 60)
    
    # Vérifier les arguments
    if len(sys.argv) != 8:
        print("❌ Usage incorrect!")
        print(f"Usage: {sys.argv[0]} <robont_ip> <robont_user> <robont_pass> <switch_ip> <switch_user> <switch_pass> <output_dir>")
        print("\nExemple:")
        print(f"python {sys.argv[0]} 6.91.128.111 robont_user robont_pass 192.168.1.10 switch_user switch_pass \"C:\\Configurations\"")
        sys.exit(1)
    
    robont_ip = sys.argv[1]
    robont_user = sys.argv[2] 
    robont_pass = sys.argv[3]
    switch_ip = sys.argv[4]
    switch_user = sys.argv[5]
    switch_pass = sys.argv[6]
    output_dir = sys.argv[7]
    
    try:
        # Installer paramiko si nécessaire
        if not install_paramiko():
            print("❌ Impossible d'installer paramiko. Veuillez l'installer manuellement:")
            print("pip install paramiko")
            sys.exit(1)
        
        # Se connecter et récupérer la configuration
        print(f"🎯 Cible: {switch_ip} via Robont {robont_ip}")
        config = connect_via_robont(robont_ip, robont_user, robont_pass, switch_ip, switch_user, switch_pass)
        
        # Sauvegarder la configuration
        filepath = save_configuration(config, switch_ip, output_dir)
        
        print("✅ Récupération terminée avec succès!")
        print(f"📄 Fichier généré: {filepath}")
        
    except KeyboardInterrupt:
        print("\n⚠️  Opération annulée par l'utilisateur")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Erreur: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()