#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de récupération de configuration via serveur Rebond
Auteur: Équipe Network Tools
Version: 1.0
Date: 2024

Usage:
    python rebond_fetch_config.py <rebond_ip> <rebond_user> <rebond_pass> <switch_ip> <switch_user> <switch_pass> <output_dir>

Exemple:
    python rebond_fetch_config.py 6.91.128.111 rebond_user rebond_pass 192.168.1.10 switch_user switch_pass "C:\\Configurations"
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

def print_help():
    """Affiche l'aide du script"""
    print("Script de récupération de configuration Juniper via serveur Rebond")
    print()
    print("USAGE:")
    print("    python rebond_fetch_config.py <rebond_ip> <rebond_user> <rebond_pass> <switch_ip> <switch_user> <switch_pass> <output_dir>")
    print("    python rebond_fetch_config.py --help")
    print("    python rebond_fetch_config.py          # Mode interactif")
    print()
    print("ARGUMENTS:")
    print("    rebond_ip      IP du serveur Rebond (ex: 6.91.128.111)")
    print("    rebond_user    Nom d'utilisateur Rebond")
    print("    rebond_pass    Mot de passe Rebond")
    print("    switch_ip      IP du switch Juniper cible")
    print("    switch_user    Nom d'utilisateur du switch")
    print("    switch_pass    Mot de passe du switch")
    print("    output_dir     Dossier de sauvegarde (sera créé si inexistant)")
    print()
    print("PRÉREQUIS:")
    print("    • Python 3 avec paramiko (installé automatiquement)")
    print("    • sshpass installé sur le serveur Rebond")
    print("    • Connectivité réseau Rebond → Switch")
    print()
    print("EXEMPLE:")
    print('    python rebond_fetch_config.py 6.91.128.111 rebond_user "mon_pass" 192.168.1.10 admin "sw_pass" "C:\\Configurations"')

def get_interactive_input():
    """Collecte les paramètres en mode interactif"""
    import getpass
    
    print("Saisissez les informations de connexion:")
    print()
    
    # Serveur Rebond
    rebond_ip = input(f"IP du serveur Rebond [6.91.128.111]: ").strip() or "6.91.128.111"
    rebond_user = input("Utilisateur Rebond: ").strip()
    rebond_pass = getpass.getpass("Mot de passe Rebond: ")
    
    print()
    
    # Switch cible
    switch_ip = input("IP du switch Juniper: ").strip()
    switch_user = input("Utilisateur switch: ").strip()
    switch_pass = getpass.getpass("Mot de passe switch: ")
    
    print()
    
    # Dossier de sortie
    import os
    default_output = os.path.join(os.path.expanduser("~"), "Desktop", "Configurations")
    output_dir = input(f"Dossier de sauvegarde [{default_output}]: ").strip() or default_output
    
    print()
    print("📋 Récapitulatif:")
    print(f"   Rebond: {rebond_user}@{rebond_ip}")
    print(f"   Switch: {switch_user}@{switch_ip}")
    print(f"   Sortie: {output_dir}")
    print()
    
    confirm = input("Continuer? [O/n]: ").strip().lower()
    if confirm and confirm not in ['o', 'oui', 'y', 'yes']:
        print("❌ Opération annulée")
        sys.exit(0)
    
    return rebond_ip, rebond_user, rebond_pass, switch_ip, switch_user, switch_pass, output_dir

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

def connect_via_rebond(rebond_ip, rebond_user, rebond_pass, switch_ip, switch_user, switch_pass):
    """Connexion via serveur Rebond vers switch"""
    try:
        import paramiko
        import time
        
        print(f"🔗 Connexion au serveur Rebond {rebond_ip}...")
        
        # Connexion SSH au serveur Rebond
        rebond_client = paramiko.SSHClient()
        rebond_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        rebond_client.connect(
            hostname=rebond_ip,
            username=rebond_user,
            password=rebond_pass,
            timeout=30,
            look_for_keys=False,
            allow_agent=False
        )
        
        print(f"✅ Connecté au serveur Rebond")
        print(f"🔗 Connexion SSH vers le switch {switch_ip}...")
        
        # Commande SSH pour se connecter au switch via Rebond
        ssh_command = f"sshpass -p '{switch_pass}' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {switch_user}@{switch_ip}"
        
        # Ouverture d'un canal pour l'interaction
        channel = rebond_client.invoke_shell()
        channel.settimeout(60)
        
        # Fonction pour lire la sortie du canal
        def read_until_prompt(channel, timeout=30):
            output = ""
            start_time = time.time()
            while time.time() - start_time < timeout:
                if channel.recv_ready():
                    data = channel.recv(4096).decode('utf-8', errors='ignore')
                    output += data
                    # Vérifier si on a un prompt
                    if output.strip().endswith('$ ') or output.strip().endswith('> ') or output.strip().endswith('# '):
                        break
                time.sleep(0.1)
            return output
        
        # Attendre le prompt du Rebond
        initial_output = read_until_prompt(channel, 5)
        print("🔍 Prompt Rebond détecté")
        
        # Envoyer la commande de connexion SSH au switch
        channel.send(ssh_command + '\n')
        ssh_output = read_until_prompt(channel, 10)
        
        # Vérifier si la connexion SSH a réussi
        if "permission denied" in ssh_output.lower() or "authentication failed" in ssh_output.lower():
            raise Exception("Échec de l'authentification SSH vers le switch")
        
        print("✅ Connecté au switch Juniper")
        
        # Envoyer la commande pour récupérer la configuration
        print("📋 Exécution de: show configuration | display set | no-more")
        channel.send("show configuration | display set | no-more\n")
        
        # Attendre plus longtemps pour la récupération de la configuration (peut être volumineuse)
        time.sleep(2)
        config_output = ""
        
        # Lire la sortie de la configuration avec un timeout plus long
        start_time = time.time()
        while time.time() - start_time < 45:  # Timeout de 45 secondes
            if channel.recv_ready():
                data = channel.recv(8192).decode('utf-8', errors='ignore')
                config_output += data
                
                # Vérifier si on a fini de recevoir la configuration
                lines = config_output.split('\n')
                if len(lines) > 5:  # Au moins quelques lignes
                    last_lines = lines[-5:]
                    # Chercher un prompt à la fin
                    for line in last_lines:
                        if line.strip().endswith('> ') or line.strip().endswith('$ ') or line.strip().endswith('# '):
                            break
                    else:
                        time.sleep(0.2)
                        continue
                    break
            time.sleep(0.1)
        
        # Fermer les connexions
        channel.close()
        rebond_client.close()
        
        print(f"✅ Configuration récupérée depuis {switch_ip}")
        print(f"📊 Taille de la sortie: {len(config_output)} caractères")
        
        # Analyser et nettoyer la sortie
        lines = config_output.split('\n')
        config_lines = []
        in_config = False
        
        for line in lines:
            stripped_line = line.strip()
            
            # Détecter le début de la configuration
            if 'show configuration' in line.lower() and 'display set' in line.lower():
                in_config = True
                continue
                
            # Arrêter si on trouve un prompt après avoir commencé
            if in_config and (stripped_line.endswith('> ') or stripped_line.endswith('$ ') or stripped_line.endswith('# ')):
                break
                
            # Capturer les lignes set
            if in_config and stripped_line.startswith('set '):
                config_lines.append(stripped_line)
        
        # Si pas de lignes trouvées avec la méthode stricte, essayer une approche plus permissive
        if not config_lines:
            print("🔍 Recherche alternative des lignes de configuration...")
            for line in lines:
                stripped_line = line.strip()
                if stripped_line.startswith('set ') and len(stripped_line) > 10:
                    config_lines.append(stripped_line)
        
        if not config_lines:
            # Sauvegarder la sortie brute pour débogage
            debug_file = "debug_output.txt"
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write("=== SORTIE BRUTE ===\n")
                f.write(config_output)
            print(f"🐛 Sortie brute sauvegardée dans {debug_file} pour débogage")
            raise Exception("Aucune ligne de configuration 'set' trouvée dans la sortie")
        
        print(f"📋 {len(config_lines)} lignes de configuration extraites")
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
# Récupéré via serveur Rebond
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
    print("🚀 Script de récupération de configuration Juniper via Rebond")
    print("=" * 60)
    
    # Vérifier les arguments ou --help
    if len(sys.argv) == 2 and sys.argv[1] in ['-h', '--help']:
        print_help()
        sys.exit(0)
    
    # Mode interactif si aucun argument
    if len(sys.argv) == 1:
        print("📝 Mode interactif - Saisie des paramètres:")
        print()
        rebond_ip, rebond_user, rebond_pass, switch_ip, switch_user, switch_pass, output_dir = get_interactive_input()
    elif len(sys.argv) != 8:
        print("❌ Usage incorrect!")
        print(f"Usage: {sys.argv[0]} <rebond_ip> <rebond_user> <rebond_pass> <switch_ip> <switch_user> <switch_pass> <output_dir>")
        print(f"   ou: {sys.argv[0]} --help")
        print("\nExemple:")
        print(f"python {sys.argv[0]} 6.91.128.111 rebond_user rebond_pass 192.168.1.10 switch_user switch_pass \"C:\\Configurations\"")
        print("\nOu lancez sans arguments pour le mode interactif:")
        print(f"python {sys.argv[0]}")
        sys.exit(1)
    else:
        rebond_ip = sys.argv[1]
        rebond_user = sys.argv[2] 
        rebond_pass = sys.argv[3]
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
        print(f"🎯 Cible: {switch_ip} via Rebond {rebond_ip}")
        config = connect_via_rebond(rebond_ip, rebond_user, rebond_pass, switch_ip, switch_user, switch_pass)
        
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