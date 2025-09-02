#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de recuperation de configuration via serveur Rebond
Auteur: Equipe Network Tools
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
    """Installe paramiko si pas deja installe"""
    try:
        import paramiko
        return True
    except ImportError:
        print("?? Installation de paramiko...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko"])
            print("? Paramiko installe avec succes")
            import paramiko
            return True
        except subprocess.CalledProcessError as e:
            print(f"? Erreur lors de l'installation de paramiko: {e}")
            return False

def print_help():
    """Affiche l'aide du script"""
    print("Script de recuperation de configuration Juniper via serveur Rebond")
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
    print("    output_dir     Dossier de sauvegarde (sera cree si inexistant)")
    print()
    print("PREREQUIS:")
    print("    - Python 3 avec paramiko (installe automatiquement)")
    print("    - sshpass installe sur le serveur Rebond")
    print("    - Connectivite reseau Rebond ? Switch")
    print()
    print("EXEMPLE:")
    print('    python rebond_fetch_config.py 6.91.128.111 rebond_user "mon_pass" 192.168.1.10 admin "sw_pass" "C:\\Configurations"')

def get_interactive_input():
    """Collecte les parametres en mode interactif"""
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
    
    # Le fichier sera sauvegarde dans le repertoire du script
    output_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("?? Recapitulatif:")
    print(f"   Rebond: {rebond_user}@{rebond_ip}")
    print(f"   Switch: {switch_user}@{switch_ip}")
    print(f"   Sortie: {output_dir}")
    print()
    
    confirm = input("Continuer? [O/n]: ").strip().lower()
    if confirm and confirm not in ['o', 'oui', 'y', 'yes']:
        print("? Operation annulee")
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

def is_valid_juniper_config(config_text):
    """Verifie si c'est une vraie configuration Juniper"""
    if not config_text or len(config_text.strip()) < 50:
        return False
    
    # Patterns typiques des configurations Juniper
    juniper_patterns = [
        r'set\s+system\s+host-name',
        r'set\s+interfaces\s+',
        r'set\s+protocols\s+',
        r'set\s+policy-options\s+',
        r'set\s+security\s+',
        r'set\s+routing-options\s+'
    ]
    
    # Au moins 2 patterns doivent correspondre
    matches = sum(1 for pattern in juniper_patterns if re.search(pattern, config_text, re.IGNORECASE))
    return matches >= 2

def is_valid_cisco_config(config_text):
    """Verifie si c'est une vraie configuration Cisco/Aruba"""
    if not config_text or len(config_text.strip()) < 50:
        return False
    
    # Patterns typiques des configurations Cisco
    cisco_patterns = [
        r'hostname\s+\S+',
        r'interface\s+\S+',
        r'ip\s+address\s+',
        r'router\s+\S+',
        r'vlan\s+\d+',
        r'switchport\s+'
    ]
    
    # Au moins 2 patterns doivent correspondre
    matches = sum(1 for pattern in cisco_patterns if re.search(pattern, config_text, re.IGNORECASE))
    return matches >= 2

def connect_via_rebond(rebond_ip, rebond_user, rebond_pass, switch_ip, switch_user, switch_pass):
    """Connexion via serveur Rebond vers switch avec validation robuste"""
    try:
        import paramiko
        
        print(f"?? Connexion au serveur Rebond {rebond_ip}...")
        
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
        
        print(f"? Connecte au serveur Rebond")
        print(f"?? Execution de la commande via SSH vers le switch {switch_ip}...")
        
        # Options SSH robustes avec TTY allocation
        ssh_options = [
            "-tt",  # Force TTY allocation
            "-o StrictHostKeyChecking=no",
            "-o UserKnownHostsFile=/dev/null",
            "-o ConnectTimeout=30",
            "-o ServerAliveInterval=10",
            "-o ServerAliveCountMax=3",
            "-o Ciphers=aes128-cbc,3des-cbc,aes192-cbc,aes256-cbc,aes128-ctr,aes192-ctr,aes256-ctr",
            "-o KexAlgorithms=diffie-hellman-group14-sha1,diffie-hellman-group1-sha1,diffie-hellman-group-exchange-sha1,diffie-hellman-group-exchange-sha256",
            "-o HostKeyAlgorithms=ssh-rsa,ssh-dss",
            "-o MACs=hmac-md5,hmac-sha1,hmac-sha2-256"
        ]
        ssh_opts = " ".join(ssh_options)
        
        # Commandes specialisees par type d'equipement avec validation stricte
        command_sets = [
            {
                "name": "Juniper CLI (format set)",
                "commands": [
                    f"sshpass -p '{switch_pass}' ssh {ssh_opts} {switch_user}@{switch_ip} 'show configuration | display set | no-more'",
                    f"sshpass -p '{switch_pass}' ssh {ssh_opts} {switch_user}@{switch_ip} 'cli -c \"show configuration | display set | no-more\"'"
                ],
                "validator": is_valid_juniper_config
            },
            {
                "name": "Juniper CLI (format standard)",
                "commands": [
                    f"sshpass -p '{switch_pass}' ssh {ssh_opts} {switch_user}@{switch_ip} 'show configuration | no-more'",
                    f"sshpass -p '{switch_pass}' ssh {ssh_opts} {switch_user}@{switch_ip} 'cli -c \"show configuration | no-more\"'"
                ],
                "validator": is_valid_juniper_config
            },
            {
                "name": "Cisco/Aruba running-config",
                "commands": [
                    f"sshpass -p '{switch_pass}' ssh {ssh_opts} {switch_user}@{switch_ip} 'terminal length 0; show running-config'",
                    f"sshpass -p '{switch_pass}' ssh {ssh_opts} {switch_user}@{switch_ip} 'show running-config'"
                ],
                "validator": is_valid_cisco_config
            }
        ]
        
        print("?? Recuperation de la configuration...")
        
        # Essayer chaque set de commandes
        for cmd_set in command_sets:
            print(f"?? Test {cmd_set['name']}...")
            
            for i, command in enumerate(cmd_set["commands"]):
                print(f"   Tentative {i+1}/{len(cmd_set['commands'])}")
                try:
                    # Executer la commande avec un timeout plus long
                    stdin, stdout, stderr = rebond_client.exec_command(command, timeout=90)
                    
                    # Lire la sortie
                    config_output = stdout.read().decode('utf-8', errors='ignore')
                    error_output = stderr.read().decode('utf-8', errors='ignore')
                    exit_status = stdout.channel.recv_exit_status()
                    
                    print(f"   Exit status: {exit_status}, Output size: {len(config_output)} chars")
                    
                    # Verifications de base
                    if exit_status != 0:
                        print(f"   ? Commande echouee (exit {exit_status})")
                        continue
                    
                    if len(config_output.strip()) < 50:
                        print(f"   ? Sortie trop courte ({len(config_output)} chars)")
                        continue
                    
                    # Verifier les erreurs SSH critiques
                    critical_errors = [
                        "no matching cipher",
                        "connection refused",
                        "permission denied",
                        "host key verification failed",
                        "could not resolve hostname"
                    ]
                    
                    if any(error.lower() in error_output.lower() for error in critical_errors):
                        print(f"   ? Erreur SSH critique: {error_output}")
                        continue
                    
                    # Valider le contenu avec le validateur specialise
                    if cmd_set["validator"](config_output):
                        print(f"   ? Configuration valide detectee!")
                        print(f"   ?? Taille: {len(config_output)} caracteres")
                        
                        # Fermer la connexion
                        rebond_client.close()
                        
                        # Nettoyer la configuration (supprimer les prompts parasites)
                        cleaned_config = clean_configuration_output(config_output)
                        return cleaned_config
                    else:
                        print(f"   ? Contenu non valide pour {cmd_set['name']}")
                        # Afficher un echantillon pour debug
                        sample = config_output[:200].replace('\n', '\\n')
                        print(f"   ?? echantillon: {sample}...")
                        
                except Exception as e:
                    print(f"   ? Erreur d'execution: {str(e)}")
                    continue
        
        # Fermer la connexion
        rebond_client.close()
        
        raise Exception("Aucune configuration valide recuperee. Verifiez les credentials et la connectivite.")
        
    except Exception as e:
        raise Exception(f"Erreur lors de la connexion: {str(e)}")

def clean_configuration_output(config_text):
    """Nettoie la sortie de configuration des prompts parasites"""
    lines = config_text.split('\n')
    cleaned_lines = []
    
    for line in lines:
        # Supprimer les prompts SSH et les messages parasites
        if any(prompt in line for prompt in [
            '$ ', '> ', '# ', 'user@', 'Last login:', 
            'Welcome to', 'Warning:', 'Connection to', 'Authenticated to'
        ]):
            continue
        
        # Garder les lignes de configuration
        cleaned_lines.append(line)
    
    return '\n'.join(cleaned_lines).strip()

def save_configuration(config_text, switch_ip, output_dir):
    """Sauvegarde la configuration dans un fichier .txt"""
    try:
        # Le dossier de sortie est toujours le repertoire du script
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Extraire le hostname
        hostname = extract_hostname(config_text)
        
        # Generer le nom de fichier (sans timestamp, juste le nom du switch)
        if hostname:
            filename = f"{hostname}.txt"
        else:
            filename = f"switch_{switch_ip.replace('.', '_')}.txt"
        
        filepath = os.path.join(output_dir, filename)
        
        # Ajouter l'en-tête au fichier
        header = f"""# Configuration recuperee le {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
# Switch IP: {switch_ip}
# Hostname: {hostname or 'Non detecte'}
# Commande: show configuration | display set | no-more
# Recupere via serveur Rebond
#==================================================

"""
        
        # ecrire le fichier (remplace le fichier existant s'il y en a un)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(header + config_text)
        
        print(f"?? Configuration sauvegardee: {filepath}")
        return filepath
        
    except Exception as e:
        raise Exception(f"Erreur lors de la sauvegarde: {str(e)}")

def main():
    """Fonction principale"""
    print("?? Script de recuperation de configuration Juniper via Rebond")
    print("=" * 60)
    
    # Verifier les arguments ou --help
    if len(sys.argv) == 2 and sys.argv[1] in ['-h', '--help']:
        print_help()
        sys.exit(0)
    
    # Mode interactif si aucun argument
    if len(sys.argv) == 1:
        print("?? Mode interactif - Saisie des parametres:")
        print()
        rebond_ip, rebond_user, rebond_pass, switch_ip, switch_user, switch_pass, output_dir = get_interactive_input()
    elif len(sys.argv) != 7:
        print("? Usage incorrect!")
        print(f"Usage: {sys.argv[0]} <rebond_ip> <rebond_user> <rebond_pass> <switch_ip> <switch_user> <switch_pass>")
        print(f"   ou: {sys.argv[0]} --help")
        print("\nExemple:")
        print(f"python {sys.argv[0]} 6.91.128.111 rebond_user rebond_pass 192.168.1.10 switch_user switch_pass")
        print("Note: Le fichier sera sauvegarde dans le repertoire du script sous le nom <hostname>.txt")
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
        # Installer paramiko si necessaire
        if not install_paramiko():
            print("? Impossible d'installer paramiko. Veuillez l'installer manuellement:")
            print("pip install paramiko")
            sys.exit(1)
        
        # Se connecter et recuperer la configuration
        print(f"?? Cible: {switch_ip} via Rebond {rebond_ip}")
        config = connect_via_rebond(rebond_ip, rebond_user, rebond_pass, switch_ip, switch_user, switch_pass)
        
        # Sauvegarder la configuration
        filepath = save_configuration(config, switch_ip, output_dir)
        
        print("? Recuperation terminee avec succes!")
        print(f"?? Fichier genere: {filepath}")
        
    except KeyboardInterrupt:
        print("\n??  Operation annulee par l'utilisateur")
        sys.exit(1)
    except Exception as e:
        print(f"? Erreur: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
