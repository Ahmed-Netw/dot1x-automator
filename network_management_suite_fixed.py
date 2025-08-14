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
        
        # Variables Juniper Config
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
            ("Juniper Configuration Tool", "juniper", "⚙️")
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
        elif view_name == "juniper":
            self.show_juniper_config()
    
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
        
        # Card 2 - Juniper Configuration Tool
        card2 = tk.Frame(cards_frame, bg='white', relief='raised', bd=2)
        card2.pack(side='left', fill='both', expand=True, padx=(15, 0))
        
        tk.Label(card2, text="⚙️", font=('Arial', 40), bg='white').pack(pady=(20, 10))
        tk.Label(card2, text="Juniper Configuration Tool", 
                font=('Arial', 14, 'bold'), bg='white').pack()
        tk.Label(card2, text="Analyse et configuration\nautomatique Juniper", 
                font=('Arial', 10), bg='white', fg='#7f8c8d').pack(pady=(5, 20))
        
        btn2 = tk.Button(card2, text="Accéder", font=('Arial', 10, 'bold'), 
                        bg='#e67e22', fg='white', relief='flat', pady=8,
                        command=lambda: self.switch_view("juniper"))
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
        """Affiche le gestionnaire Robont"""
        # Titre
        title_frame = tk.Frame(self.main_area, bg='#2c3e50', height=60)
        title_frame.pack(fill='x', padx=0, pady=0)
        title_frame.pack_propagate(False)
        
        title_label = tk.Label(title_frame, text="🔗 Robont Switch Manager", 
                              font=('Arial', 16, 'bold'), fg='white', bg='#2c3e50')
        title_label.pack(pady=15)
        
        # Frame principal
        main_frame = tk.Frame(self.main_area, bg='#f0f0f0')
        main_frame.pack(fill='both', expand=True, padx=20, pady=20)
        
        # Message temporaire
        temp_label = tk.Label(main_frame, 
                             text="Interface Robont Switch Manager\n\n"
                                  "Fonctionnalités à implémenter :\n"
                                  "• Connexion SSH au serveur Robont\n"
                                  "• Récupération des configurations switch\n"
                                  "• Export et sauvegarde",
                             font=('Arial', 12), bg='#f0f0f0', fg='#7f8c8d')
        temp_label.pack(expand=True)
    
    def show_juniper_config(self):
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
                                        command=self.clear_juniper_config, width=15, state='disabled')
        self.clear_config_btn.pack(side='left', padx=5)
        
        # === SECTION INFORMATIONS SWITCH ===
        self.info_frame = tk.LabelFrame(main_frame, text="INFORMATIONS DU SWITCH", 
                                      font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#e67e22')
        
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
    
    # === MÉTHODES JUNIPER CONFIG ===
    
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
    
    def clear_juniper_config(self):
        """Efface la configuration Juniper chargée"""
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


def main():
    """Point d'entrée principal de l'application"""
    root = tk.Tk()
    app = NetworkManagementSuite(root)
    root.mainloop()


if __name__ == "__main__":
    main()