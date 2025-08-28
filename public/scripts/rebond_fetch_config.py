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
    
    # Le fichier sera sauvegardé dans le répertoire du script
    output_dir = os.path.dirname(os.path.abspath(__file__))
    
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
        print(f"🔗 Exécution de la commande via SSH vers le switch {switch_ip}...")
        
        # Commande complète pour exécuter directement dans le CLI Juniper
        # Note: Les lignes 'set' sont le FORMAT de sortie de la commande, pas des commandes exécutées
        full_command = f"sshpass -p '{switch_pass}' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {switch_user}@{switch_ip} 'cli -c \"show configuration | display set | no-more\"'"
        
        print("📋 Exécution de: show configuration | display set | no-more")
        print("ℹ️  Note: Les lignes 'set' sont le format d'affichage de Junos, pas des commandes exécutées")
        
        # Exécuter la commande directement
        stdin, stdout, stderr = rebond_client.exec_command(full_command, timeout=60)
        
        # Lire la sortie
        config_output = stdout.read().decode('utf-8', errors='ignore')
        error_output = stderr.read().decode('utf-8', errors='ignore')
        
        # Fermer la connexion
        rebond_client.close()
        
        print(f"✅ Configuration récupérée depuis {switch_ip}")
        print(f"📊 Taille de la sortie: {len(config_output)} caractères")
        
        # Vérifier s'il y a des erreurs
        if error_output and "warning" not in error_output.lower():
            print(f"⚠️  Erreurs détectées: {error_output}")
        
        # Analyser et nettoyer la sortie
        lines = config_output.strip().split('\n')
        config_lines = []
        
        for line in lines:
            stripped_line = line.strip()
            # Capturer toutes les lignes qui commencent par 'set '
            if stripped_line.startswith('set ') and len(stripped_line) > 10:
                config_lines.append(stripped_line)
        
        if not config_lines:
            # Sauvegarder la sortie brute pour débogage
            script_dir = os.path.dirname(os.path.abspath(__file__))
            debug_file = os.path.join(script_dir, "debug_output.txt")
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write("=== SORTIE BRUTE ===\n")
                f.write(config_output)
                f.write("\n=== ERREURS ===\n")
                f.write(error_output)
            print(f"🐛 Sortie brute sauvegardée dans {debug_file} pour débogage")
            
            # Message d'aide plus clair
            print("❌ Aucune ligne de configuration 'set' trouvée.")
            print("💡 Ceci peut indiquer que:")
            print("   • La commande a été exécutée dans le shell FreeBSD au lieu du CLI Junos")
            print("   • Le switch n'est pas un équipement Juniper")
            print("   • Il y a un problème d'authentification ou de connectivité")
            print(f"   • Vérifiez le fichier debug_output.txt pour plus de détails")
            
            raise Exception("Aucune ligne de configuration 'set' trouvée dans la sortie")
        
        print(f"📋 {len(config_lines)} lignes de configuration extraites")
        return '\n'.join(config_lines)
        
    except Exception as e:
        raise Exception(f"Erreur lors de la connexion: {str(e)}")

def save_configuration(config_text, switch_ip, output_dir):
    """Sauvegarde la configuration dans un fichier .txt"""
    try:
        # Le dossier de sortie est toujours le répertoire du script
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Extraire le hostname
        hostname = extract_hostname(config_text)
        
        # Générer le nom de fichier (sans timestamp, juste le nom du switch)
        if hostname:
            filename = f"{hostname}.txt"
        else:
            filename = f"switch_{switch_ip.replace('.', '_')}.txt"
        
        filepath = os.path.join(output_dir, filename)
        
        # Ajouter l'en-tête au fichier
        header = f"""# Configuration récupérée le {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
# Switch IP: {switch_ip}
# Hostname: {hostname or 'Non détecté'}
# Commande: show configuration | display set | no-more
# Récupéré via serveur Rebond
#==================================================

"""
        
        # Écrire le fichier (remplace le fichier existant s'il y en a un)
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
    elif len(sys.argv) != 7:
        print("❌ Usage incorrect!")
        print(f"Usage: {sys.argv[0]} <rebond_ip> <rebond_user> <rebond_pass> <switch_ip> <switch_user> <switch_pass>")
        print(f"   ou: {sys.argv[0]} --help")
        print("\nExemple:")
        print(f"python {sys.argv[0]} 6.91.128.111 rebond_user rebond_pass 192.168.1.10 switch_user switch_pass")
        print("Note: Le fichier sera sauvegardé dans le répertoire du script sous le nom <hostname>.txt")
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
        output_dir = os.path.dirname(os.path.abspath(__file__))
    
    
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