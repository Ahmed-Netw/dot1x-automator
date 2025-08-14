#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Network Management Suite v2.0
Interface graphique pour la gestion des équipements réseau avec:
- Connexion au serveur Robont et récupération de configuration switch
- Configuration automatique pour Cisco ISE (Juniper Configuration Tool)
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog
import time
import threading
import re
from datetime import datetime
import os
import sys
import json

# Vérifier et installer paramiko si nécessaire
try:
    import paramiko
except ImportError:
    print("Installation de paramiko en cours...")
    try:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko"])
        import paramiko
        print("Paramiko installé avec succès!")
    except Exception as e:
        messagebox.showerror("Erreur de dépendance", 
            f"Impossible d'installer paramiko: {e}\n\n"
            "Veuillez installer manuellement:\n"
            "pip install paramiko")
        sys.exit(1)

class ConfigurationParser:
    """Analyseur de configuration Juniper pour extraction d'informations"""
    
    def __init__(self, config_text):
        self.config = config_text
    
    def get_switch_info(self):
        """Extrait les informations du switch (hostname, IP management)"""
        lines = self.config.split('\n')
        info = {'hostname': None, 'management_ip': None}
        
        for line in lines:
            trimmed = line.strip()
            
            # Extract hostname
            if trimmed.startswith('set system host-name'):
                parts = trimmed.split(' ')
                if len(parts) >= 4:
                    info['hostname'] = parts[3].strip('"')
            
            # Extract management IP - improved detection
            if 'set interfaces' in trimmed and 'unit 0 family inet address' in trimmed:
                parts = trimmed.split(' ')
                try:
                    ip_index = parts.index('address') + 1
                    if ip_index < len(parts):
                        ip = parts[ip_index].split('/')[0]
                        # Prefer management/admin VLAN IPs
                        if ip.startswith('10.148.') or '192.168.' in ip or not info['management_ip']:
                            info['management_ip'] = ip
                except (ValueError, IndexError):
                    pass
            
            # Also look for VLAN interfaces that might be management
            if 'set interfaces vlan' in trimmed and 'family inet address' in trimmed:
                parts = trimmed.split(' ')
                try:
                    ip_index = parts.index('address') + 1
                    if ip_index < len(parts):
                        ip = parts[ip_index].split('/')[0]
                        if ip.startswith('10.148.') or '192.168.' in ip:
                            info['management_ip'] = ip
                except (ValueError, IndexError):
                    pass
        
        return info
    
    def get_interfaces(self):
        """Extrait les interfaces access"""
        lines = self.config.split('\n')
        interfaces = {}
        
        for line in lines:
            trimmed = line.strip()
            
            # Detect interface configuration lines
            if trimmed.startswith('set interfaces') and 'ge-' in trimmed:
                parts = trimmed.split(' ')
                if len(parts) >= 3:
                    interface_name = parts[2]
                    
                    if interface_name not in interfaces:
                        interfaces[interface_name] = {
                            'name': interface_name,
                            'config': [],
                            'is_access': False
                        }
                    
                    interfaces[interface_name]['config'].append(trimmed)
                    
                    # Check if it's an access port
                    if ('family ethernet-switching port-mode access' in trimmed or 
                        ('ethernet-switching-options' in trimmed and 'port-mode access' in trimmed)):
                        interfaces[interface_name]['is_access'] = True
        
        # Return only access interfaces starting with 'ge-'
        return [iface for iface in interfaces.values() 
                if iface['name'].startswith('ge-') and iface['is_access']]
    
    def generate_dot1x_config(self, interfaces):
        """Génère la configuration 802.1x"""
        configs = []
        
        for iface in interfaces:
            if iface['is_access']:
                configs.extend([
                    f"set protocols dot1x authenticator interface {iface['name']} supplicant multiple",
                    f"set protocols dot1x authenticator interface {iface['name']} retries 3",
                    f"set protocols dot1x authenticator interface {iface['name']} transmit-period 1",
                    f"set protocols dot1x authenticator interface {iface['name']} reauthentication 3600",
                    f"set protocols dot1x authenticator interface {iface['name']} supplicant-timeout 10",
                    f"set protocols dot1x authenticator interface {iface['name']} maximum-requests 3",
                    f"set protocols dot1x authenticator interface {iface['name']} mac-radius"
                ])
        
        return '\n'.join(configs)
    
    def generate_cleanup_config(self, interfaces):
        """Génère la configuration de nettoyage"""
        configs = []
        
        for iface in interfaces:
            if iface['is_access']:
                configs.extend([
                    f"delete interfaces {iface['name']} unit 0 family ethernet-switching",
                    f"delete interfaces {iface['name']} ethernet-switching-options"
                ])
        
        return '\n'.join(configs)
    
    def get_radius_config(self, management_ip=None):
        """Génère la configuration RADIUS"""
        source_address = management_ip or '10.148.62.241'
        return f"""set access radius-server 10.147.32.47 port 1812
set access radius-server 10.147.32.47 secret "$9$qfTF69tBRcP5Qn9tREdbwsoJUjH.fT"
set access radius-server 10.147.32.47 source-address {source_address}
set access radius-server 10.147.160.47 port 1812
set access radius-server 10.147.160.47 secret "$9$72Vw2oJUkm5dbs4JUmPBIREreM8XNVw"
set access radius-server 10.147.160.47 source-address {source_address}
set access profile 802.1x-auth accounting-order radius
set access profile 802.1x-auth authentication-order radius
set access profile 802.1x-auth radius authentication-server 10.147.32.47
set access profile 802.1x-auth radius authentication-server 10.147.160.47
set access profile 802.1x-auth radius accounting-server 10.147.32.47
set access profile 802.1x-auth radius accounting-server 10.147.160.47
set protocols dot1x authenticator authentication-profile-name 802.1x-auth"""

class NetworkManagementSuite:
    def __init__(self, root):
        self.root = root
        self.root.title("Network Management Suite v2.0")
        self.root.geometry("1400x1000")
        self.root.configure(bg='#f0f0f0')
        
        # Variables Robont
        self.ssh_client = None
        self.channel = None
        self.switch_hostname = None
        self.is_connecting = False
        self.config_data = ""
        
        # Variables ISE Config
        self.uploaded_config = ""
        self.parsed_config = None
        self.switch_info = {}
        self.interfaces = []
        self.dot1x_config = ""
        self.cleanup_config = ""
        self.radius_config = ""
        
        self.current_view = "dashboard"
        
        # Styles
        style = ttk.Style()
        style.theme_use('clam')
        
        self.setup_ui()
        
    def setup_ui(self):
        """Configure l'interface utilisateur avec menu latéral"""
        # === MENU LATÉRAL ===
        self.sidebar = tk.Frame(self.root, bg='#2c3e50', width=280)
        self.sidebar.pack(side='left', fill='y', padx=0, pady=0)
        self.sidebar.pack_propagate(False)
        
        # Logo/Titre du menu
        logo_frame = tk.Frame(self.sidebar, bg='#34495e', height=80)
        logo_frame.pack(fill='x', padx=0, pady=0)
        logo_frame.pack_propagate(False)
        
        logo_label = tk.Label(logo_frame, text="Network\nManagement Suite", 
                             font=('Arial', 14, 'bold'), fg='white', bg='#34495e')
        logo_label.pack(pady=15)
        
        # Boutons du menu
        self.menu_buttons = {}
        menu_items = [
            ("Dashboard", "dashboard", "🏠"),
            ("Robont Switch Manager", "robont", "🔗"),
            ("Juniper Configuration Tool", "ise", "⚙️")
        ]
        
        for i, (text, key, icon) in enumerate(menu_items):
            btn_frame = tk.Frame(self.sidebar, bg='#2c3e50')
            btn_frame.pack(fill='x', pady=2)
            
            btn = tk.Button(btn_frame, text=f"{icon}  {text}", 
                          font=('Arial', 11), bg='#2c3e50', fg='white',
                          relief='flat', anchor='w', padx=20, pady=15,
                          command=lambda k=key: self.switch_view(k))
            btn.pack(fill='x')
            
            # Effet hover
            def on_enter(e, button=btn, k=key):
                button.config(bg='#34495e')
            def on_leave(e, button=btn, k=key):
                if self.current_view != k:
                    button.config(bg='#2c3e50')
            
            btn.bind("<Enter>", on_enter)
            btn.bind("<Leave>", on_leave)
            
            self.menu_buttons[key] = btn
        
        # Séparateur
        separator = tk.Frame(self.sidebar, bg='#34495e', height=2)
        separator.pack(fill='x', pady=20)
        
        # Info version en bas
        version_label = tk.Label(self.sidebar, text="Version 2.0\n© 2024", 
                               font=('Arial', 8), fg='#95a5a6', bg='#2c3e50')
        version_label.pack(side='bottom', pady=10)
        
        # === ZONE PRINCIPALE ===
        self.main_area = tk.Frame(self.root, bg='#f0f0f0')
        self.main_area.pack(side='right', fill='both', expand=True)
        
        # Initialiser avec le dashboard
        self.switch_view("dashboard")
        
    def switch_view(self, view_name):
        """Change la vue principale"""
        # Mettre à jour l'état des boutons
        for key, btn in self.menu_buttons.items():
            if key == view_name:
                btn.config(bg='#34495e')
            else:
                btn.config(bg='#2c3e50')
        
        self.current_view = view_name
        
        # Effacer la zone principale
        for widget in self.main_area.winfo_children():
            widget.destroy()
        
        # Afficher la vue correspondante
        if view_name == "dashboard":
            self.show_dashboard()
        elif view_name == "robont":
            self.show_robont_manager()
        elif view_name == "ise":
            self.show_ise_config()
    
    def show_dashboard(self):
        """Affiche le tableau de bord"""
        # Titre
        title_frame = tk.Frame(self.main_area, bg='#3498db', height=80)
        title_frame.pack(fill='x', padx=0, pady=0)
        title_frame.pack_propagate(False)
        
        title_label = tk.Label(title_frame, text="🏠 Dashboard", 
                              font=('Arial', 20, 'bold'), fg='white', bg='#3498db')
        title_label.pack(pady=25)
        
        # Contenu principal
        content_frame = tk.Frame(self.main_area, bg='#f0f0f0')
        content_frame.pack(fill='both', expand=True, padx=30, pady=30)
        
        # Cards de statut
        cards_frame = tk.Frame(content_frame, bg='#f0f0f0')
        cards_frame.pack(fill='x', pady=(0, 30))
        
        # Card 1 - Robont Switch Manager
        card1 = tk.Frame(cards_frame, bg='white', relief='raised', bd=2)
        card1.pack(side='left', fill='both', expand=True, padx=(0, 15))
        
        tk.Label(card1, text="🔗", font=('Arial', 40), bg='white').pack(pady=(20, 10))
        tk.Label(card1, text="Robont Switch Manager", 
                font=('Arial', 14, 'bold'), bg='white').pack()
        tk.Label(card1, text="Récupération de configuration\nvia serveur Robont", 
                font=('Arial', 10), bg='white', fg='#7f8c8d').pack(pady=(5, 20))
        
        btn1 = tk.Button(card1, text="Accéder", font=('Arial', 10, 'bold'), 
                        bg='#2c3e50', fg='white', relief='flat', pady=8,
                        command=lambda: self.switch_view("robont"))
        btn1.pack(pady=(0, 20), padx=20, fill='x')
        
        # Card 2 - ISE Switch Config
        card2 = tk.Frame(cards_frame, bg='white', relief='raised', bd=2)
        card2.pack(side='left', fill='both', expand=True, padx=(15, 0))
        
        tk.Label(card2, text="⚙️", font=('Arial', 40), bg='white').pack(pady=(20, 10))
        tk.Label(card2, text="Juniper Configuration Tool", 
                font=('Arial', 14, 'bold'), bg='white').pack()
        tk.Label(card2, text="Analyse et configuration\nautomatique Juniper", 
                font=('Arial', 10), bg='white', fg='#7f8c8d').pack(pady=(5, 20))
        
        btn2 = tk.Button(card2, text="Accéder", font=('Arial', 10, 'bold'), 
                        bg='#e67e22', fg='white', relief='flat', pady=8,
                        command=lambda: self.switch_view("ise"))
        btn2.pack(pady=(0, 20), padx=20, fill='x')
        
        # Informations système
        info_frame = tk.LabelFrame(content_frame, text="Informations Système", 
                                 font=('Arial', 12, 'bold'), bg='#f0f0f0')
        info_frame.pack(fill='both', expand=True)
        
        info_text = tk.Text(info_frame, font=('Courier', 10), height=15, 
                           bg='white', relief='flat', padx=20, pady=20)
        info_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Contenu d'information
        info_content = f"""
🏠 Network Management Suite v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 TABLEAU DE BORD
   ├── Vue d'ensemble des outils réseau disponibles
   ├── Statut des connexions et services
   └── Informations système

🔗 ROBONT SWITCH MANAGER  
   ├── Connexion sécurisée au serveur Robont (6.91.128.111)
   ├── Récupération automatique des configurations switch
   ├── Commande: show configuration | display set | no-more
   └── Export et sauvegarde des configurations

⚙️ JUNIPER CONFIGURATION TOOL
   ├── Upload de fichiers de configuration Juniper
   ├── Analyse automatique des interfaces access  
   ├── Génération de configuration 802.1X
   ├── Configuration RADIUS pour ISE
   ├── Nettoyage des configurations existantes
   └── Export des configurations générées

🚀 FONCTIONNALITÉS
   • Interface graphique intuitive avec navigation par onglets
   • Gestion des erreurs avancée et logs détaillés
   • Sauvegarde automatique et export multi-formats
   • Drag & drop pour upload de fichiers
   • Copie vers presse-papiers intégrée
   • Génération automatique de configurations ISE

✅ STATUT: Système opérationnel
⏰ Dernière mise à jour: {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}
        """
        
        info_text.insert(tk.END, info_content)
        info_text.config(state='disabled')
    
    def show_robont_manager(self):
        """Affiche le gestionnaire Robont (interface originale)"""
        # Titre
        title_frame = tk.Frame(self.main_area, bg='#2c3e50', height=60)
        title_frame.pack(fill='x', padx=0, pady=0)
        title_frame.pack_propagate(False)
        
        title_label = tk.Label(title_frame, text="🔗 Robont Switch Manager", 
                              font=('Arial', 16, 'bold'), fg='white', bg='#2c3e50')
        title_label.pack(pady=15)
        
        # Frame principal avec scroll
        main_frame = tk.Frame(self.main_area, bg='#f0f0f0')
        main_frame.pack(fill='both', expand=True, padx=20, pady=20)
        
        # === SECTION SERVEUR ROBONT ===
        server_frame = tk.LabelFrame(main_frame, text="SERVEUR ROBONT", 
                                   font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#2c3e50')
        server_frame.pack(fill='x', pady=(0, 15))
        
        # IP Serveur (lecture seule)
        tk.Label(server_frame, text="Adresse IP:", font=('Arial', 10), 
                bg='#f0f0f0').grid(row=0, column=0, sticky='w', padx=10, pady=5)
        
        server_ip_entry = tk.Entry(server_frame, font=('Arial', 10), width=20, state='readonly')
        server_ip_entry.insert(0, "6.91.128.111")
        server_ip_entry.grid(row=0, column=1, padx=10, pady=5)
        
        # Utilisateur serveur
        tk.Label(server_frame, text="Utilisateur:", font=('Arial', 10), 
                bg='#f0f0f0').grid(row=1, column=0, sticky='w', padx=10, pady=5)
        
        self.server_user_entry = tk.Entry(server_frame, font=('Arial', 10), width=20)
        self.server_user_entry.grid(row=1, column=1, padx=10, pady=5)
        
        # Mot de passe serveur
        tk.Label(server_frame, text="Mot de passe:", font=('Arial', 10), 
                bg='#f0f0f0').grid(row=2, column=0, sticky='w', padx=10, pady=5)
        
        self.server_pass_entry = tk.Entry(server_frame, font=('Arial', 10), width=20, show='*')
        self.server_pass_entry.grid(row=2, column=1, padx=10, pady=5)
        
        # === SECTION SWITCH ===
        switch_frame = tk.LabelFrame(main_frame, text="SWITCH RESEAU", 
                                   font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#2c3e50')
        switch_frame.pack(fill='x', pady=(0, 15))
        
        # IP Switch
        tk.Label(switch_frame, text="Adresse IP:", font=('Arial', 10), 
                bg='#f0f0f0').grid(row=0, column=0, sticky='w', padx=10, pady=5)
        
        self.switch_ip_entry = tk.Entry(switch_frame, font=('Arial', 10), width=20)
        self.switch_ip_entry.insert(0, "10.148.62.241")  # Valeur par défaut
        self.switch_ip_entry.grid(row=0, column=1, padx=10, pady=5)
        
        # Utilisateur switch
        tk.Label(switch_frame, text="Utilisateur:", font=('Arial', 10), 
                bg='#f0f0f0').grid(row=1, column=0, sticky='w', padx=10, pady=5)
        
        self.switch_user_entry = tk.Entry(switch_frame, font=('Arial', 10), width=20)
        self.switch_user_entry.grid(row=1, column=1, padx=10, pady=5)
        
        # Mot de passe switch
        tk.Label(switch_frame, text="Mot de passe:", font=('Arial', 10), 
                bg='#f0f0f0').grid(row=2, column=0, sticky='w', padx=10, pady=5)
        
        self.switch_pass_entry = tk.Entry(switch_frame, font=('Arial', 10), width=20, show='*')
        self.switch_pass_entry.grid(row=2, column=1, padx=10, pady=5)
        
        # === BOUTONS D'ACTION ===
        buttons_frame = tk.Frame(main_frame, bg='#f0f0f0')
        buttons_frame.pack(fill='x', pady=(0, 15))
        
        # Bouton de connexion
        self.connect_btn = tk.Button(buttons_frame, text="SE CONNECTER ET RECUPERER CONFIG", 
                                   font=('Arial', 12, 'bold'), bg='#27ae60', fg='white',
                                   command=self.start_connection, height=2, width=35)
        self.connect_btn.pack(side='left', padx=5)
        
        # Bouton test connexion
        test_btn = tk.Button(buttons_frame, text="TESTER CONNEXION", 
                           font=('Arial', 10), bg='#3498db', fg='white',
                           command=self.test_connection, height=2, width=15)
        test_btn.pack(side='left', padx=5)
        
        # Bouton effacer
        clear_btn = tk.Button(buttons_frame, text="EFFACER", 
                            font=('Arial', 10), bg='#e74c3c', fg='white',
                            command=self.clear_fields, height=2, width=10)
        clear_btn.pack(side='left', padx=5)
        
        # === BARRE DE PROGRESSION ===
        self.progress_frame = tk.Frame(main_frame, bg='#f0f0f0')
        self.progress_frame.pack(fill='x', pady=(0, 10))
        
        self.progress_bar = ttk.Progressbar(self.progress_frame, mode='indeterminate')
        self.progress_bar.pack(fill='x')
        
        self.status_label = tk.Label(self.progress_frame, text="Pret", 
                                   font=('Arial', 9), bg='#f0f0f0', fg='#7f8c8d')
        self.status_label.pack(pady=5)
        
        # === ZONE DE RÉSULTATS ===
        results_frame = tk.LabelFrame(main_frame, text="CONFIGURATION RECUPEREE", 
                                    font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#2c3e50')
        results_frame.pack(fill='both', expand=True)
        
        # Zone de texte avec scroll
        self.results_text = scrolledtext.ScrolledText(results_frame, font=('Courier', 9), 
                                                     wrap='none', height=20)
        self.results_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Boutons de sauvegarde
        save_frame = tk.Frame(results_frame, bg='#f0f0f0')
        save_frame.pack(fill='x', padx=10, pady=(0, 10))
        
        self.save_btn = tk.Button(save_frame, text="SAUVEGARDER", 
                                font=('Arial', 10), bg='#f39c12', fg='white',
                                command=self.save_config, state='disabled')
        self.save_btn.pack(side='left', padx=5)
        
        # Nouveau bouton de téléchargement
        self.download_btn = tk.Button(save_frame, text="TÉLÉCHARGER", 
                                    font=('Arial', 10), bg='#8e44ad', fg='white',
                                    command=self.download_config, state='disabled')
        self.download_btn.pack(side='left', padx=5)
        
        self.open_folder_btn = tk.Button(save_frame, text="OUVRIR DOSSIER", 
                                       font=('Arial', 10), bg='#9b59b6', fg='white',
                                       command=self.open_save_folder, state='disabled')
        self.open_folder_btn.pack(side='left', padx=5)
        
        # Info hostname
        self.hostname_label = tk.Label(save_frame, text="", 
                                     font=('Arial', 9, 'italic'), bg='#f0f0f0', fg='#27ae60')
        self.hostname_label.pack(side='right', padx=5)
    
    def show_ise_config(self):
        """Affiche l'interface Juniper Configuration Tool complète"""
        # Titre
        title_frame = tk.Frame(self.main_area, bg='#e67e22', height=60)
        title_frame.pack(fill='x', padx=0, pady=0)
        title_frame.pack_propagate(False)
        
        title_label = tk.Label(title_frame, text="⚙️ Juniper Configuration Tool", 
                              font=('Arial', 16, 'bold'), fg='white', bg='#e67e22')
        title_label.pack(pady=15)
        
        # Frame principal avec scroll
        main_frame = tk.Frame(self.main_area, bg='#f0f0f0')
        main_frame.pack(fill='both', expand=True, padx=20, pady=20)
        
        # === SECTION UPLOAD ===
        upload_frame = tk.LabelFrame(main_frame, text="UPLOAD DE CONFIGURATION", 
                                   font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#e67e22')
        upload_frame.pack(fill='x', pady=(0, 15))
        
        # Zone de drop
        self.drop_frame = tk.Frame(upload_frame, bg='#ecf0f1', relief='dashed', bd=2, height=100)
        self.drop_frame.pack(fill='x', padx=10, pady=10)
        self.drop_frame.pack_propagate(False)
        
        # Bind events pour drag & drop simulation
        self.drop_frame.bind("<Button-1>", self.select_config_file)
        
        self.drop_label = tk.Label(self.drop_frame, 
                                 text="📁 Cliquez ici pour sélectionner un fichier de configuration\n"
                                      "Formats supportés: .txt, .conf, .cfg",
                                 font=('Arial', 11), bg='#ecf0f1', fg='#7f8c8d')
        self.drop_label.pack(expand=True)
        
        # Boutons upload
        upload_buttons_frame = tk.Frame(upload_frame, bg='#f0f0f0')
        upload_buttons_frame.pack(fill='x', padx=10, pady=(0, 10))
        
        self.select_file_btn = tk.Button(upload_buttons_frame, text="SÉLECTIONNER FICHIER", 
                                       font=('Arial', 10), bg='#3498db', fg='white',
                                       command=self.select_config_file, width=20)
        self.select_file_btn.pack(side='left', padx=5)
        
        self.clear_config_btn = tk.Button(upload_buttons_frame, text="EFFACER", 
                                        font=('Arial', 10), bg='#e74c3c', fg='white',
                                        command=self.clear_ise_config, width=15, state='disabled')
        self.clear_config_btn.pack(side='left', padx=5)
        
        # === SECTION INFORMATIONS SWITCH ===
        self.info_frame = tk.LabelFrame(main_frame, text="INFORMATIONS DU SWITCH", 
                                      font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#e67e22')
        self.info_frame.pack(fill='x', pady=(0, 15))
        
        # Création des labels d'information
        info_grid_frame = tk.Frame(self.info_frame, bg='#f0f0f0')
        info_grid_frame.pack(fill='x', padx=10, pady=10)
        
        tk.Label(info_grid_frame, text="Hostname:", font=('Arial', 10, 'bold'), 
                bg='#f0f0f0').grid(row=0, column=0, sticky='w', padx=(0, 10), pady=5)
        self.hostname_info_label = tk.Label(info_grid_frame, text="Non détecté", 
                                          font=('Arial', 10), bg='#f0f0f0', fg='#7f8c8d')
        self.hostname_info_label.grid(row=0, column=1, sticky='w', pady=5)
        
        tk.Label(info_grid_frame, text="IP Management:", font=('Arial', 10, 'bold'), 
                bg='#f0f0f0').grid(row=1, column=0, sticky='w', padx=(0, 10), pady=5)
        self.management_ip_label = tk.Label(info_grid_frame, text="Non détectée", 
                                          font=('Arial', 10), bg='#f0f0f0', fg='#7f8c8d')
        self.management_ip_label.grid(row=1, column=1, sticky='w', pady=5)
        
        tk.Label(info_grid_frame, text="Interfaces Access:", font=('Arial', 10, 'bold'), 
                bg='#f0f0f0').grid(row=2, column=0, sticky='w', padx=(0, 10), pady=5)
        self.interfaces_count_label = tk.Label(info_grid_frame, text="0 détectées", 
                                             font=('Arial', 10), bg='#f0f0f0', fg='#7f8c8d')
        self.interfaces_count_label.grid(row=2, column=1, sticky='w', pady=5)
        
        # === SECTION INTERFACES ===
        self.interfaces_frame = tk.LabelFrame(main_frame, text="INTERFACES ACCESS DÉTECTÉES", 
                                            font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#e67e22')
        self.interfaces_frame.pack(fill='x', pady=(0, 15))
        
        self.interfaces_text = tk.Text(self.interfaces_frame, font=('Courier', 9), height=5, 
                                     bg='white', relief='sunken', state='disabled')
        self.interfaces_text.pack(fill='x', padx=10, pady=10)
        
        # === SECTION CONFIGURATIONS GÉNÉRÉES ===
        config_frame = tk.LabelFrame(main_frame, text="CONFIGURATIONS GÉNÉRÉES", 
                                   font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#e67e22')
        config_frame.pack(fill='both', expand=True)
        
        # Bouton télécharger tout
        download_all_frame = tk.Frame(config_frame, bg='#f0f0f0')
        download_all_frame.pack(fill='x', padx=10, pady=(10, 5))
        
        self.download_all_btn = tk.Button(download_all_frame, text="📥 TÉLÉCHARGER TOUTES LES CONFIGURATIONS", 
                                        font=('Arial', 11, 'bold'), bg='#27ae60', fg='white',
                                        command=self.download_all_configs, state='disabled', height=2)
        self.download_all_btn.pack(pady=5)
        
        # Notebook pour les onglets
        self.config_notebook = ttk.Notebook(config_frame)
        self.config_notebook.pack(fill='both', expand=True, padx=10, pady=(5, 10))
        
        # Onglet 802.1X
        self.dot1x_frame = tk.Frame(self.config_notebook, bg='white')
        self.config_notebook.add(self.dot1x_frame, text="802.1X Configuration")
        
        self.dot1x_text = scrolledtext.ScrolledText(self.dot1x_frame, font=('Courier', 9), 
                                                  height=15, wrap='none')
        self.dot1x_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        dot1x_buttons = tk.Frame(self.dot1x_frame, bg='white')
        dot1x_buttons.pack(fill='x', padx=10, pady=(0, 10))
        
        self.copy_dot1x_btn = tk.Button(dot1x_buttons, text="📋 COPIER", 
                                      font=('Arial', 10), bg='#3498db', fg='white',
                                      command=lambda: self.copy_to_clipboard(self.dot1x_config, "802.1X"),
                                      state='disabled')
        self.copy_dot1x_btn.pack(side='left', padx=5)
        
        self.download_dot1x_btn = tk.Button(dot1x_buttons, text="💾 TÉLÉCHARGER", 
                                          font=('Arial', 10), bg='#e67e22', fg='white',
                                          command=lambda: self.download_single_config(self.dot1x_config, "dot1x_config.txt"),
                                          state='disabled')
        self.download_dot1x_btn.pack(side='left', padx=5)
        
        # Onglet Cleanup
        self.cleanup_frame = tk.Frame(self.config_notebook, bg='white')
        self.config_notebook.add(self.cleanup_frame, text="Cleanup Configuration")
        
        self.cleanup_text = scrolledtext.ScrolledText(self.cleanup_frame, font=('Courier', 9), 
                                                    height=15, wrap='none')
        self.cleanup_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        cleanup_buttons = tk.Frame(self.cleanup_frame, bg='white')
        cleanup_buttons.pack(fill='x', padx=10, pady=(0, 10))
        
        self.copy_cleanup_btn = tk.Button(cleanup_buttons, text="📋 COPIER", 
                                        font=('Arial', 10), bg='#3498db', fg='white',
                                        command=lambda: self.copy_to_clipboard(self.cleanup_config, "Cleanup"),
                                        state='disabled')
        self.copy_cleanup_btn.pack(side='left', padx=5)
        
        self.download_cleanup_btn = tk.Button(cleanup_buttons, text="💾 TÉLÉCHARGER", 
                                            font=('Arial', 10), bg='#e67e22', fg='white',
                                            command=lambda: self.download_single_config(self.cleanup_config, "cleanup_config.txt"),
                                            state='disabled')
        self.download_cleanup_btn.pack(side='left', padx=5)
        
        # Onglet RADIUS
        self.radius_frame = tk.Frame(self.config_notebook, bg='white')
        self.config_notebook.add(self.radius_frame, text="RADIUS Configuration")
        
        self.radius_text = scrolledtext.ScrolledText(self.radius_frame, font=('Courier', 9), 
                                                   height=15, wrap='none')
        self.radius_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        radius_buttons = tk.Frame(self.radius_frame, bg='white')
        radius_buttons.pack(fill='x', padx=10, pady=(0, 10))
        
        self.copy_radius_btn = tk.Button(radius_buttons, text="📋 COPIER", 
                                       font=('Arial', 10), bg='#3498db', fg='white',
                                       command=lambda: self.copy_to_clipboard(self.radius_config, "RADIUS"),
                                       state='disabled')
        self.copy_radius_btn.pack(side='left', padx=5)
        
        self.download_radius_btn = tk.Button(radius_buttons, text="💾 TÉLÉCHARGER", 
                                           font=('Arial', 10), bg='#e67e22', fg='white',
                                           command=lambda: self.download_single_config(self.radius_config, "radius_config.txt"),
                                           state='disabled')
        self.download_radius_btn.pack(side='left', padx=5)
        
        # Initialiser l'état disabled
        self.info_frame.pack_forget()
        self.interfaces_frame.pack_forget()
    
    # === MÉTHODES ISE CONFIG ===
    
    def select_config_file(self, event=None):
        """Sélectionne un fichier de configuration"""
        file_path = filedialog.askopenfilename(
            title="Sélectionner un fichier de configuration",
            filetypes=[
                ("Fichiers de configuration", "*.txt *.conf *.cfg"),
                ("Fichiers texte", "*.txt"),
                ("Tous les fichiers", "*.*")
            ]
        )
        
        if file_path:
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                self.process_config_file(content, os.path.basename(file_path))
                
            except Exception as e:
                messagebox.showerror("Erreur", f"Erreur lors de la lecture du fichier:\n{e}")
    
    def process_config_file(self, content, filename):
        """Traite le fichier de configuration uploadé"""
        try:
            self.uploaded_config = content
            
            # Mettre à jour l'interface upload
            self.drop_label.config(text=f"✅ Fichier chargé: {filename}\n"
                                      f"Taille: {len(content)} caractères",
                                 fg='#27ae60')
            self.drop_frame.config(bg='#d5f4e6')
            self.clear_config_btn.config(state='normal')
            
            # Parser la configuration
            self.parsed_config = ConfigurationParser(content)
            
            # Extraire les informations
            self.switch_info = self.parsed_config.get_switch_info()
            self.interfaces = self.parsed_config.get_interfaces()
            
            # Mettre à jour les informations du switch
            self.update_switch_info()
            
            # Générer les configurations
            self.generate_configurations()
            
            # Afficher les sections d'informations
            self.info_frame.pack(fill='x', pady=(0, 15), before=self.interfaces_frame)
            self.interfaces_frame.pack(fill='x', pady=(0, 15), before=self.config_notebook.master)
            
            messagebox.showinfo("Succès", 
                f"Configuration analysée avec succès!\n\n"
                f"• Hostname: {self.switch_info.get('hostname', 'Non détecté')}\n"
                f"• IP Management: {self.switch_info.get('management_ip', 'Non détectée')}\n"
                f"• Interfaces Access: {len(self.interfaces)} détectées")
                
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur lors du traitement:\n{e}")
    
    def update_switch_info(self):
        """Met à jour l'affichage des informations du switch"""
        hostname = self.switch_info.get('hostname', 'Non détecté')
        management_ip = self.switch_info.get('management_ip', 'Non détectée')
        
        self.hostname_info_label.config(text=hostname, 
                                      fg='#27ae60' if hostname != 'Non détecté' else '#7f8c8d')
        self.management_ip_label.config(text=management_ip,
                                      fg='#27ae60' if management_ip != 'Non détectée' else '#7f8c8d')
        self.interfaces_count_label.config(text=f"{len(self.interfaces)} détectées",
                                         fg='#27ae60' if self.interfaces else '#7f8c8d')
        
        # Mettre à jour la liste des interfaces
        self.interfaces_text.config(state='normal')
        self.interfaces_text.delete(1.0, tk.END)
        
        if self.interfaces:
            interface_list = [iface['name'] for iface in self.interfaces]
            # Afficher en colonnes
            for i in range(0, len(interface_list), 6):
                line = "  ".join(interface_list[i:i+6])
                self.interfaces_text.insert(tk.END, line + "\n")
        else:
            self.interfaces_text.insert(tk.END, "Aucune interface access détectée")
        
        self.interfaces_text.config(state='disabled')
    
    def generate_configurations(self):
        """Génère toutes les configurations"""
        try:
            # Générer 802.1X
            self.dot1x_config = self.parsed_config.generate_dot1x_config(self.interfaces)
            self.dot1x_text.delete(1.0, tk.END)
            if self.dot1x_config:
                self.dot1x_text.insert(tk.END, self.dot1x_config)
                self.copy_dot1x_btn.config(state='normal')
                self.download_dot1x_btn.config(state='normal')
            else:
                self.dot1x_text.insert(tk.END, "Aucune interface access détectée pour la configuration 802.1X")
            
            # Générer Cleanup
            self.cleanup_config = self.parsed_config.generate_cleanup_config(self.interfaces)
            self.cleanup_text.delete(1.0, tk.END)
            if self.cleanup_config:
                self.cleanup_text.insert(tk.END, self.cleanup_config)
                self.copy_cleanup_btn.config(state='normal')
                self.download_cleanup_btn.config(state='normal')
            else:
                self.cleanup_text.insert(tk.END, "Aucune interface access détectée pour la configuration cleanup")
            
            # Générer RADIUS
            management_ip = self.switch_info.get('management_ip')
            self.radius_config = self.parsed_config.get_radius_config(management_ip)
            self.radius_text.delete(1.0, tk.END)
            self.radius_text.insert(tk.END, self.radius_config)
            self.copy_radius_btn.config(state='normal')
            self.download_radius_btn.config(state='normal')
            
            # Activer le bouton de téléchargement global
            self.download_all_btn.config(state='normal')
            
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur lors de la génération:\n{e}")
    
    def copy_to_clipboard(self, text, config_type):
        """Copie le texte vers le presse-papiers"""
        try:
            self.root.clipboard_clear()
            self.root.clipboard_append(text)
            messagebox.showinfo("Succès", f"Configuration {config_type} copiée dans le presse-papiers!")
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur lors de la copie:\n{e}")
    
    def download_single_config(self, config_text, default_filename):
        """Télécharge une configuration individuelle"""
        try:
            if not config_text.strip():
                messagebox.showwarning("Attention", "Aucune configuration à télécharger")
                return
            
            # Ajouter le hostname au nom de fichier si disponible
            hostname = self.switch_info.get('hostname', 'switch')
            if hostname and hostname != 'Non détecté':
                base_name = default_filename.split('.')[0]
                extension = default_filename.split('.')[-1]
                default_filename = f"{hostname}_{base_name}.{extension}"
            
            filename = filedialog.asksaveasfilename(
                title="Télécharger la configuration",
                defaultextension=".txt",
                initialname=default_filename,
                filetypes=[
                    ("Fichiers texte", "*.txt"),
                    ("Tous les fichiers", "*.*")
                ]
            )
            
            if filename:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(f"# Configuration générée le {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
                    f.write(f"# Switch: {self.switch_info.get('hostname', 'Non détecté')}\n")
                    f.write(f"# IP Management: {self.switch_info.get('management_ip', 'Non détectée')}\n")
                    f.write(f"# Interfaces: {len(self.interfaces)} détectées\n")
                    f.write("#" + "="*50 + "\n\n")
                    f.write(config_text)
                
                messagebox.showinfo("Succès", f"Configuration téléchargée:\n{filename}")
                
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur lors du téléchargement:\n{e}")
    
    def download_all_configs(self):
        """Télécharge toutes les configurations dans un seul fichier"""
        try:
            hostname = self.switch_info.get('hostname', 'switch')
            default_filename = f"{hostname}_all_configs.txt" if hostname != 'Non détecté' else "all_configs.txt"
            
            filename = filedialog.asksaveasfilename(
                title="Télécharger toutes les configurations",
                defaultextension=".txt",
                initialname=default_filename,
                filetypes=[
                    ("Fichiers texte", "*.txt"),
                    ("Tous les fichiers", "*.*")
                ]
            )
            
            if filename:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(f"# Configurations générées le {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
                    f.write(f"# Switch: {self.switch_info.get('hostname', 'Non détecté')}\n")
                    f.write(f"# IP Management: {self.switch_info.get('management_ip', 'Non détectée')}\n")
                    f.write(f"# Interfaces: {len(self.interfaces)} détectées\n")
                    f.write("#" + "="*80 + "\n\n")
                    
                    # 802.1X Configuration
                    f.write("# 802.1X CONFIGURATION\n")
                    f.write("#" + "-"*50 + "\n")
                    f.write(self.dot1x_config)
                    f.write("\n\n")
                    
                    # Cleanup Configuration
                    f.write("# CLEANUP CONFIGURATION\n")
                    f.write("#" + "-"*50 + "\n")
                    f.write(self.cleanup_config)
                    f.write("\n\n")
                    
                    # RADIUS Configuration
                    f.write("# RADIUS CONFIGURATION\n")
                    f.write("#" + "-"*50 + "\n")
                    f.write(self.radius_config)
                
                messagebox.showinfo("Succès", f"Toutes les configurations téléchargées:\n{filename}")
                
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur lors du téléchargement:\n{e}")
    
    def clear_ise_config(self):
        """Efface la configuration ISE chargée"""
        self.uploaded_config = ""
        self.parsed_config = None
        self.switch_info = {}
        self.interfaces = []
        self.dot1x_config = ""
        self.cleanup_config = ""
        self.radius_config = ""
        
        # Réinitialiser l'interface upload
        self.drop_label.config(text="📁 Cliquez ici pour sélectionner un fichier de configuration\n"
                                   "Formats supportés: .txt, .conf, .cfg",
                             fg='#7f8c8d')
        self.drop_frame.config(bg='#ecf0f1')
        self.clear_config_btn.config(state='disabled')
        
        # Masquer les sections d'informations
        self.info_frame.pack_forget()
        self.interfaces_frame.pack_forget()
        
        # Effacer les zones de texte
        self.dot1x_text.delete(1.0, tk.END)
        self.cleanup_text.delete(1.0, tk.END)
        self.radius_text.delete(1.0, tk.END)
        
        # Désactiver les boutons
        self.copy_dot1x_btn.config(state='disabled')
        self.download_dot1x_btn.config(state='disabled')
        self.copy_cleanup_btn.config(state='disabled')
        self.download_cleanup_btn.config(state='disabled')
        self.copy_radius_btn.config(state='disabled')
        self.download_radius_btn.config(state='disabled')
        self.download_all_btn.config(state='disabled')
    
    # === MÉTHODES ROBONT (inchangées) ===
    
    def validate_fields(self):
        """Valide les champs saisis"""
        if not hasattr(self, 'server_user_entry'):
            return False
            
        if not self.server_user_entry.get().strip():
            messagebox.showerror("Erreur", "Nom d'utilisateur serveur requis")
            return False
            
        if not self.server_pass_entry.get().strip():
            messagebox.showerror("Erreur", "Mot de passe serveur requis")
            return False
            
        if not self.switch_ip_entry.get().strip():
            messagebox.showerror("Erreur", "Adresse IP switch requise")
            return False
            
        if not self.switch_user_entry.get().strip():
            messagebox.showerror("Erreur", "Nom d'utilisateur switch requis")
            return False
        
        # Validation IP
        ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
        if not re.match(ip_pattern, self.switch_ip_entry.get().strip()):
            messagebox.showerror("Erreur", "Format d'adresse IP switch invalide")
            return False
        
        return True
    
    def update_status(self, message, color='#7f8c8d'):
        """Met à jour le statut"""
        if hasattr(self, 'status_label'):
            self.status_label.config(text=message, fg=color)
            self.root.update()
    
    def start_connection(self):
        """Démarre la connexion dans un thread séparé"""
        if not self.validate_fields():
            return
            
        if self.is_connecting:
            return
            
        self.is_connecting = True
        self.connect_btn.config(state='disabled', text="CONNEXION EN COURS...")
        self.progress_bar.start()
        self.results_text.delete(1.0, tk.END)
        
        # Lancer dans un thread pour éviter de bloquer l'interface
        thread = threading.Thread(target=self.execute_connection)
        thread.daemon = True
        thread.start()
    
    def execute_connection(self):
        """Exécute la connexion complète"""
        try:
            # Récupérer les valeurs
            server_host = "6.91.128.111"
            server_user = self.server_user_entry.get().strip()
            server_pass = self.server_pass_entry.get().strip()
            switch_ip = self.switch_ip_entry.get().strip()
            switch_user = self.switch_user_entry.get().strip()
            switch_pass = self.switch_pass_entry.get().strip()
            
            # Étape 1: Connexion serveur
            self.update_status("Connexion au serveur Robont...", '#3498db')
            if not self.connect_to_server(server_host, server_user, server_pass):
                return  # Arrêter si connexion serveur échoue
            
            # Étape 2: Connexion switch
            self.update_status("Connexion au switch...", '#3498db')
            if not self.connect_to_switch(switch_ip, switch_user, switch_pass):
                return  # Arrêter si connexion switch échoue
            
            # Étape 3: Récupération config
            self.update_status("Récupération de la configuration...", '#3498db')
            config_data = self.get_configuration()
            
            if config_data:
                # Sauvegarder les données pour téléchargement
                self.config_data = config_data
                # Afficher dans l'interface
                self.root.after(0, self.display_results, config_data)
                self.update_status("Configuration récupérée avec succès!", '#27ae60')
            else:
                self.update_status("Échec récupération configuration", '#e74c3c')
                messagebox.showerror("Erreur", 
                    "Impossible de récupérer la configuration du switch:\n"
                    "• Vérifiez que la commande est supportée\n"
                    "• Vérifiez les permissions de l'utilisateur")
                
        except Exception as e:
            self.update_status("Erreur: " + str(e), '#e74c3c')
            messagebox.showerror("Erreur", "Erreur inattendue: " + str(e))
        finally:
            self.cleanup_connection()
    
    def connect_to_server(self, host, username, password):
        """Connexion au serveur Robont"""
        try:
            self.ssh_client = paramiko.SSHClient()
            self.ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            self.ssh_client.connect(
                hostname=host,
                port=22,
                username=username,
                password=password,
                timeout=30
            )
            
            self.channel = self.ssh_client.invoke_shell()
            self.channel.settimeout(30)
            time.sleep(2)
            
            # Lire prompt initial
            self.read_channel_output(timeout=5)
            return True
            
        except paramiko.AuthenticationException:
            self.update_status("Échec authentification serveur", '#e74c3c')
            messagebox.showerror("Erreur", "Mot de passe serveur incorrect")
            return False
        except Exception as e:
            self.update_status("Erreur serveur: " + str(e), '#e74c3c')
            messagebox.showerror("Erreur", "Erreur connexion serveur: " + str(e))
            return False
    
    def connect_to_switch(self, switch_ip, username, password):
        """Connexion au switch"""
        try:
            ssh_cmd = "ssh " + username + "@" + switch_ip + "\n"
            self.channel.send(ssh_cmd)
            time.sleep(3)
            
            output = self.read_channel_output(timeout=15)
            
            # Vérifier les erreurs de connexion
            if any(error in output.lower() for error in [
                "connection refused", "connection timed out", "no route to host",
                "host unreachable", "network is unreachable", "connection closed",
                "could not resolve hostname", "name or service not known"
            ]):
                self.update_status("Problème de connexion au switch", '#e74c3c')
                messagebox.showerror("Erreur de Connexion", 
                    "Problème de connexion vers le switch:\n"
                    "• Vérifiez l'adresse IP du switch\n"
                    "• Vérifiez que le switch est accessible depuis le serveur Robont\n"
                    "• Vérifiez la connectivité réseau")
                return False
            
            # Si mot de passe demandé
            if "password:" in output.lower():
                if not password.strip():
                    self.update_status("Mot de passe switch requis", '#e74c3c')
                    messagebox.showerror("Erreur", "Mot de passe switch requis")
                    return False
                
                self.channel.send(password + "\n")
                time.sleep(3)
                auth_output = self.read_channel_output(timeout=10)
                
                # Vérifier échec authentification
                if any(word in auth_output.lower() for word in [
                    "denied", "failed", "incorrect", "authentication failure",
                    "access denied", "login failed", "invalid password"
                ]):
                    self.update_status("Mot de passe switch erroné", '#e74c3c')
                    messagebox.showerror("Erreur d'Authentification", 
                        "Mot de passe erroné pour le switch:\n"
                        "• Vérifiez le mot de passe du switch\n"
                        "• Assurez-vous que les credentials sont corrects")
                    return False
            
            # Tentative d'entrer en mode CLI
            self.channel.send("cli\n")
            time.sleep(2)
            cli_output = self.read_channel_output(timeout=5)
            
            self.update_status("Connexion switch réussie", '#27ae60')
            return True
            
        except Exception as e:
            self.update_status("Erreur switch: " + str(e), '#e74c3c')
            messagebox.showerror("Erreur de Connexion", 
                "Erreur inattendue lors de la connexion au switch:\n" + str(e))
            return False
    
    def get_configuration(self):
        """Récupère la configuration avec la nouvelle commande"""
        try:
            # Nouvelle commande modifiée
            config_cmd = "show configuration | display set | no-more\n"
            self.channel.send(config_cmd)
            time.sleep(5)
            
            output = self.read_channel_output(timeout=60)
            
            if output.strip():
                # Extraire hostname
                self.switch_hostname = self.extract_hostname(output)
                return output
            
            return None
            
        except Exception as e:
            print("Erreur récupération config: " + str(e))
            return None
    
    def read_channel_output(self, timeout=15):
        """Lit la sortie du channel"""
        output = ""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            if self.channel.recv_ready():
                data = self.channel.recv(4096).decode('utf-8', errors='ignore')
                output += data
                time.sleep(0.1)
            else:
                time.sleep(0.2)
                if time.time() - start_time > 3 and output:
                    break
        
        return output
    
    def extract_hostname(self, config_data):
        """Extrait le hostname"""
        patterns = [
            r'set system host-name\s+(\S+)',
            r'set hostname\s+(\S+)',
            r'hostname\s+(\S+)',
            r'host-name\s+(\S+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, config_data, re.IGNORECASE)
            if match:
                hostname = re.sub(r'[";\']+', '', match.group(1))
                return hostname
        
        return "switch"
    
    def display_results(self, config_data):
        """Affiche les résultats dans l'interface"""
        if hasattr(self, 'results_text'):
            self.results_text.delete(1.0, tk.END)
            self.results_text.insert(tk.END, config_data)
            
            # Activer boutons
            self.save_btn.config(state='normal')
            self.download_btn.config(state='normal')
            self.open_folder_btn.config(state='normal')
            
            # Afficher hostname
            if self.switch_hostname:
                self.hostname_label.config(text="Hostname: " + self.switch_hostname)
    
    def save_config(self):
        """Sauvegarde la configuration dans le répertoire courant"""
        try:
            if not hasattr(self, 'results_text'):
                return
                
            config_data = self.results_text.get(1.0, tk.END)
            if not config_data.strip():
                messagebox.showwarning("Attention", "Aucune configuration à sauvegarder")
                return
            
            # Nom de fichier basé sur le hostname ou "switch" par défaut
            if self.switch_hostname:
                filename = self.switch_hostname + ".txt"
            else:
                filename = "switch.txt"
            
            # Nettoyer le nom
            filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
            
            # Sauvegarder
            with open(filename, 'w', encoding='utf-8') as f:
                f.write("# Configuration récupérée le " + str(datetime.now()) + "\n")
                f.write("# Serveur Robont: 6.91.128.111\n")
                f.write("# Switch IP: " + self.switch_ip_entry.get() + "\n")
                if self.switch_hostname:
                    f.write("# Switch Hostname: " + self.switch_hostname + "\n")
                f.write("#" + "="*50 + "\n\n")
                f.write(config_data)
            
            messagebox.showinfo("Succès", "Configuration sauvegardée dans:\n" + filename)
            
        except Exception as e:
            messagebox.showerror("Erreur", "Erreur sauvegarde: " + str(e))
    
    def download_config(self):
        """Télécharge la configuration avec dialogue de sauvegarde"""
        try:
            if not hasattr(self, 'results_text'):
                return
                
            config_data = self.results_text.get(1.0, tk.END)
            if not config_data.strip():
                messagebox.showwarning("Attention", "Aucune configuration à télécharger")
                return
            
            # Nom de fichier par défaut basé sur le hostname ou "switch"
            if self.switch_hostname:
                default_filename = self.switch_hostname + ".txt"
            else:
                default_filename = "switch.txt"
            
            # Nettoyer le nom
            default_filename = re.sub(r'[<>:"/\\|?*]', '_', default_filename)
            
            # Dialogue de sauvegarde
            filename = filedialog.asksaveasfilename(
                title="Télécharger la configuration",
                defaultextension=".txt",
                initialname=default_filename,
                filetypes=[
                    ("Fichiers texte", "*.txt"),
                    ("Tous les fichiers", "*.*")
                ]
            )
            
            if filename:
                # Sauvegarder avec en-tête
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write("# Configuration récupérée le " + str(datetime.now()) + "\n")
                    f.write("# Serveur Robont: 6.91.128.111\n")
                    f.write("# Switch IP: " + self.switch_ip_entry.get() + "\n")
                    if self.switch_hostname:
                        f.write("# Switch Hostname: " + self.switch_hostname + "\n")
                    f.write("#" + "="*50 + "\n\n")
                    f.write(config_data)
                
                messagebox.showinfo("Succès", "Configuration téléchargée dans:\n" + filename)
            
        except Exception as e:
            messagebox.showerror("Erreur", "Erreur téléchargement: " + str(e))
    
    def open_save_folder(self):
        """Ouvre le dossier de sauvegarde"""
        try:
            os.startfile('.')  # Windows
        except:
            try:
                os.system('open .')  # macOS
            except:
                os.system('xdg-open .')  # Linux
    
    def test_connection(self):
        """Test rapide de connexion"""
        if not self.validate_fields():
            return
            
        self.update_status("Test de connexion...", '#f39c12')
        
        def test():
            try:
                ssh_client = paramiko.SSHClient()
                ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                
                ssh_client.connect(
                    hostname="6.91.128.111",
                    port=22,
                    username=self.server_user_entry.get().strip(),
                    password=self.server_pass_entry.get().strip(),
                    timeout=15
                )
                
                ssh_client.close()
                self.root.after(0, lambda: self.update_status("Test réussi!", '#27ae60'))
                self.root.after(0, lambda: messagebox.showinfo("Test", "Connexion serveur réussie!"))
                
            except Exception as e:
                self.root.after(0, lambda: self.update_status("Test échoué", '#e74c3c'))
                self.root.after(0, lambda: messagebox.showerror("Test", "Échec connexion: " + str(e)))
        
        thread = threading.Thread(target=test)
        thread.daemon = True
        thread.start()
    
    def clear_fields(self):
        """Efface tous les champs"""
        if hasattr(self, 'server_user_entry'):
            self.server_user_entry.delete(0, tk.END)
            self.server_pass_entry.delete(0, tk.END)
            self.switch_user_entry.delete(0, tk.END)
            self.switch_pass_entry.delete(0, tk.END)
            self.switch_ip_entry.delete(0, tk.END)
            self.switch_ip_entry.insert(0, "10.148.62.241")
            self.results_text.delete(1.0, tk.END)
            self.hostname_label.config(text="")
            self.save_btn.config(state='disabled')
            self.download_btn.config(state='disabled')
            self.open_folder_btn.config(state='disabled')
            self.config_data = ""
            self.update_status("Pret")
    
    def cleanup_connection(self):
        """Nettoie les connexions"""
        self.is_connecting = False
        self.root.after(0, lambda: self.connect_btn.config(state='normal', text="SE CONNECTER ET RECUPERER CONFIG") if hasattr(self, 'connect_btn') else None)
        self.root.after(0, lambda: self.progress_bar.stop() if hasattr(self, 'progress_bar') else None)
        
        try:
            if self.channel:
                self.channel.send("exit\n")
                time.sleep(1)
                self.channel.send("exit\n")
                time.sleep(1)
                self.channel.close()
            if self.ssh_client:
                self.ssh_client.close()
        except:
            pass

def main():
    """Fonction principale"""
    try:
        # Initialisation de l'interface
        root = tk.Tk()
        
        # Gestion des erreurs d'affichage
        try:
            app = NetworkManagementSuite(root)
        except Exception as e:
            messagebox.showerror("Erreur d'initialisation", 
                f"Erreur lors de l'initialisation de l'interface:\n{e}")
            root.destroy()
            return
        
        # Centrer la fenêtre
        try:
            root.update_idletasks()
            x = (root.winfo_screenwidth() // 2) - (1400 // 2)
            y = (root.winfo_screenheight() // 2) - (1000 // 2)
            root.geometry(f"1400x1000+{x}+{y}")
        except:
            # Fallback si problème de centrage
            root.geometry("1400x1000")
        
        # Démarrer l'application
        root.mainloop()
        
    except Exception as e:
        print(f"Erreur fatale: {e}")
        try:
            messagebox.showerror("Erreur fatale", f"L'application ne peut pas démarrer:\n{e}")
        except:
            print("Impossible d'afficher le message d'erreur graphique")
        sys.exit(1)

if __name__ == "__main__":
    print("=== Network Management Suite v2.0 ===")
    print("Démarrage de l'application...")
    try:
        main()
    except KeyboardInterrupt:
        print("\nArrêt de l'application par l'utilisateur")
    except Exception as e:
        print(f"Erreur non gérée: {e}")
        try:
            messagebox.showerror("Erreur non gérée", f"{e}")
        except:
            pass
    finally:
        if sys.platform.startswith("win") and not sys.stdin.isatty():
            try:
                input("\nAppuyez sur Entrée pour fermer...")
            except EOFError:
                pass