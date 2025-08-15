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
        """Affiche le gestionnaire Robont complet"""
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
        
        # === SECTION CONNEXION ===
        conn_frame = tk.LabelFrame(main_frame, text="CONNEXION SERVEUR ROBONT", 
                                 font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#2c3e50')
        conn_frame.pack(fill='x', pady=(0, 20))
        
        # Formulaire de connexion
        form_frame = tk.Frame(conn_frame, bg='#f0f0f0')
        form_frame.pack(fill='x', padx=20, pady=20)
        
        # Serveur
        tk.Label(form_frame, text="Serveur:", font=('Arial', 10, 'bold'), bg='#f0f0f0').grid(row=0, column=0, sticky='w', pady=5)
        self.server_entry = tk.Entry(form_frame, font=('Arial', 10), width=20)
        self.server_entry.insert(0, "6.91.128.111")
        self.server_entry.grid(row=0, column=1, padx=(10, 20), pady=5, sticky='w')
        
        # Port
        tk.Label(form_frame, text="Port:", font=('Arial', 10, 'bold'), bg='#f0f0f0').grid(row=0, column=2, sticky='w', pady=5)
        self.port_entry = tk.Entry(form_frame, font=('Arial', 10), width=8)
        self.port_entry.insert(0, "22")
        self.port_entry.grid(row=0, column=3, padx=(10, 0), pady=5, sticky='w')
        
        # Username
        tk.Label(form_frame, text="Utilisateur:", font=('Arial', 10, 'bold'), bg='#f0f0f0').grid(row=1, column=0, sticky='w', pady=5)
        self.username_entry = tk.Entry(form_frame, font=('Arial', 10), width=20)
        self.username_entry.grid(row=1, column=1, padx=(10, 20), pady=5, sticky='w')
        
        # Password
        tk.Label(form_frame, text="Mot de passe:", font=('Arial', 10, 'bold'), bg='#f0f0f0').grid(row=1, column=2, sticky='w', pady=5)
        self.password_entry = tk.Entry(form_frame, font=('Arial', 10), width=20, show='*')
        self.password_entry.grid(row=1, column=3, padx=(10, 0), pady=5, sticky='w')
        
        # Switch hostname
        tk.Label(form_frame, text="Hostname Switch:", font=('Arial', 10, 'bold'), bg='#f0f0f0').grid(row=2, column=0, sticky='w', pady=5)
        self.switch_entry = tk.Entry(form_frame, font=('Arial', 10), width=30)
        self.switch_entry.grid(row=2, column=1, columnspan=2, padx=(10, 0), pady=5, sticky='w')
        
        # Boutons d'action
        btn_frame = tk.Frame(conn_frame, bg='#f0f0f0')
        btn_frame.pack(fill='x', padx=20, pady=(0, 20))
        
        self.connect_btn = tk.Button(btn_frame, text="Connexion & Récupération", 
                                   font=('Arial', 10, 'bold'), bg='#27ae60', fg='white',
                                   relief='flat', pady=8, command=self.connect_and_retrieve)
        self.connect_btn.pack(side='left', padx=(0, 10))
        
        self.clear_btn = tk.Button(btn_frame, text="Effacer", 
                                 font=('Arial', 10), bg='#95a5a6', fg='white',
                                 relief='flat', pady=8, command=self.clear_robont_fields)
        self.clear_btn.pack(side='left', padx=10)
        
        # Status bar
        self.status_frame = tk.Frame(conn_frame, bg='#ecf0f1', relief='sunken', bd=1)
        self.status_frame.pack(fill='x', padx=20, pady=(0, 10))
        
        self.status_label = tk.Label(self.status_frame, text="Prêt", 
                                   font=('Arial', 9), bg='#ecf0f1', fg='#2c3e50')
        self.status_label.pack(side='left', padx=10, pady=5)
        
        # === SECTION RÉSULTATS ===
        result_frame = tk.LabelFrame(main_frame, text="CONFIGURATION RÉCUPÉRÉE", 
                                   font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#2c3e50')
        result_frame.pack(fill='both', expand=True)
        
        # Zone de texte avec scroll
        text_frame = tk.Frame(result_frame, bg='#f0f0f0')
        text_frame.pack(fill='both', expand=True, padx=20, pady=20)
        
        self.config_text = scrolledtext.ScrolledText(text_frame, font=('Courier', 9), 
                                                   bg='white', fg='black',
                                                   wrap=tk.WORD, height=25)
        self.config_text.pack(fill='both', expand=True)
        
        # Boutons d'export
        export_frame = tk.Frame(result_frame, bg='#f0f0f0')
        export_frame.pack(fill='x', padx=20, pady=(0, 20))
        
        self.save_btn = tk.Button(export_frame, text="💾 Sauvegarder", 
                                font=('Arial', 10, 'bold'), bg='#3498db', fg='white',
                                relief='flat', pady=8, command=self.save_config_file,
                                state='disabled')
        self.save_btn.pack(side='left', padx=(0, 10))
        
        self.copy_btn = tk.Button(export_frame, text="📋 Copier", 
                                font=('Arial', 10), bg='#9b59b6', fg='white',
                                relief='flat', pady=8, command=self.copy_to_clipboard,
                                state='disabled')
        self.copy_btn.pack(side='left', padx=10)
    
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
        upload_frame.pack(fill='x', pady=(0, 20))
        
        # Zone de drop
        drop_frame = tk.Frame(upload_frame, bg='#f8f9fa', relief='dashed', bd=2)
        drop_frame.pack(fill='x', padx=20, pady=20)
        
        drop_label = tk.Label(drop_frame, text="📁 Glissez-déposez votre fichier de configuration ici\nou cliquez pour parcourir", 
                            font=('Arial', 12), bg='#f8f9fa', fg='#6c757d')
        drop_label.pack(pady=40)
        
        # Boutons d'upload
        upload_btn_frame = tk.Frame(upload_frame, bg='#f0f0f0')
        upload_btn_frame.pack(fill='x', padx=20, pady=(0, 20))
        
        self.browse_btn = tk.Button(upload_btn_frame, text="📂 Parcourir", 
                                  font=('Arial', 10, 'bold'), bg='#e67e22', fg='white',
                                  relief='flat', pady=8, command=self.browse_config_file)
        self.browse_btn.pack(side='left', padx=(0, 10))
        
        self.analyze_btn = tk.Button(upload_btn_frame, text="🔍 Analyser", 
                                   font=('Arial', 10, 'bold'), bg='#27ae60', fg='white',
                                   relief='flat', pady=8, command=self.analyze_config,
                                   state='disabled')
        self.analyze_btn.pack(side='left', padx=10)
        
        # Affichage du fichier uploadé
        self.file_label = tk.Label(upload_frame, text="Aucun fichier sélectionné", 
                                 font=('Arial', 9), bg='#f0f0f0', fg='#7f8c8d')
        self.file_label.pack(padx=20, pady=(0, 10))
        
        # === SECTION INFORMATIONS SWITCH ===
        info_frame = tk.LabelFrame(main_frame, text="INFORMATIONS DU SWITCH", 
                                 font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#3498db')
        info_frame.pack(fill='x', pady=(0, 20))
        
        info_content = tk.Frame(info_frame, bg='#f0f0f0')
        info_content.pack(fill='x', padx=20, pady=20)
        
        # Hostname
        tk.Label(info_content, text="Hostname:", font=('Arial', 10, 'bold'), bg='#f0f0f0').grid(row=0, column=0, sticky='w', pady=5)
        self.hostname_label = tk.Label(info_content, text="-", font=('Arial', 10), bg='#f0f0f0', fg='#2c3e50')
        self.hostname_label.grid(row=0, column=1, padx=(10, 0), pady=5, sticky='w')
        
        # IP de management
        tk.Label(info_content, text="IP Management:", font=('Arial', 10, 'bold'), bg='#f0f0f0').grid(row=1, column=0, sticky='w', pady=5)
        self.mgmt_ip_label = tk.Label(info_content, text="-", font=('Arial', 10), bg='#f0f0f0', fg='#2c3e50')
        self.mgmt_ip_label.grid(row=1, column=1, padx=(10, 0), pady=5, sticky='w')
        
        # Nombre d'interfaces access
        tk.Label(info_content, text="Interfaces Access:", font=('Arial', 10, 'bold'), bg='#f0f0f0').grid(row=2, column=0, sticky='w', pady=5)
        self.access_count_label = tk.Label(info_content, text="-", font=('Arial', 10), bg='#f0f0f0', fg='#2c3e50')
        self.access_count_label.grid(row=2, column=1, padx=(10, 0), pady=5, sticky='w')
        
        # === SECTION GÉNÉRATION ===
        generate_frame = tk.LabelFrame(main_frame, text="GÉNÉRATION DE CONFIGURATION", 
                                     font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#9b59b6')
        generate_frame.pack(fill='x', pady=(0, 20))
        
        gen_btn_frame = tk.Frame(generate_frame, bg='#f0f0f0')
        gen_btn_frame.pack(fill='x', padx=20, pady=20)
        
        self.gen_dot1x_btn = tk.Button(gen_btn_frame, text="🔐 Générer 802.1X", 
                                     font=('Arial', 10, 'bold'), bg='#9b59b6', fg='white',
                                     relief='flat', pady=8, command=self.generate_dot1x,
                                     state='disabled')
        self.gen_dot1x_btn.pack(side='left', padx=(0, 10))
        
        self.gen_radius_btn = tk.Button(gen_btn_frame, text="📡 Générer RADIUS", 
                                      font=('Arial', 10, 'bold'), bg='#e74c3c', fg='white',
                                      relief='flat', pady=8, command=self.generate_radius,
                                      state='disabled')
        self.gen_radius_btn.pack(side='left', padx=10)
        
        self.gen_cleanup_btn = tk.Button(gen_btn_frame, text="🧹 Générer Cleanup", 
                                       font=('Arial', 10, 'bold'), bg='#f39c12', fg='white',
                                       relief='flat', pady=8, command=self.generate_cleanup,
                                       state='disabled')
        self.gen_cleanup_btn.pack(side='left', padx=10)
        
        # === SECTION RÉSULTATS ===
        output_frame = tk.LabelFrame(main_frame, text="CONFIGURATION GÉNÉRÉE", 
                                   font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#27ae60')
        output_frame.pack(fill='both', expand=True)
        
        # Notebook pour les onglets
        self.notebook = ttk.Notebook(output_frame)
        self.notebook.pack(fill='both', expand=True, padx=20, pady=20)
        
        # Onglet 802.1X
        self.dot1x_frame = tk.Frame(self.notebook, bg='white')
        self.notebook.add(self.dot1x_frame, text="🔐 Configuration 802.1X")
        
        self.dot1x_text = scrolledtext.ScrolledText(self.dot1x_frame, font=('Courier', 9), 
                                                  bg='white', fg='black', wrap=tk.WORD, height=15)
        self.dot1x_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Onglet RADIUS
        self.radius_frame = tk.Frame(self.notebook, bg='white')
        self.notebook.add(self.radius_frame, text="📡 Configuration RADIUS")
        
        self.radius_text = scrolledtext.ScrolledText(self.radius_frame, font=('Courier', 9), 
                                                   bg='white', fg='black', wrap=tk.WORD, height=15)
        self.radius_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Onglet Cleanup
        self.cleanup_frame = tk.Frame(self.notebook, bg='white')
        self.notebook.add(self.cleanup_frame, text="🧹 Configuration Cleanup")
        
        self.cleanup_text = scrolledtext.ScrolledText(self.cleanup_frame, font=('Courier', 9), 
                                                    bg='white', fg='black', wrap=tk.WORD, height=15)
        self.cleanup_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Boutons d'export finaux
        final_export_frame = tk.Frame(output_frame, bg='#f0f0f0')
        final_export_frame.pack(fill='x', padx=20, pady=(0, 20))
        
        self.export_all_btn = tk.Button(final_export_frame, text="💾 Exporter Tout", 
                                      font=('Arial', 10, 'bold'), bg='#27ae60', fg='white',
                                      relief='flat', pady=8, command=self.export_all_configs,
                                      state='disabled')
        self.export_all_btn.pack(side='left', padx=(0, 10))
        
        self.copy_current_btn = tk.Button(final_export_frame, text="📋 Copier Onglet Actuel", 
                                        font=('Arial', 10), bg='#3498db', fg='white',
                                        relief='flat', pady=8, command=self.copy_current_tab,
                                        state='disabled')
        self.copy_current_btn.pack(side='left', padx=10)
    
    # === MÉTHODES ROBONT ===
    def connect_and_retrieve(self):
        """Connexion et récupération de configuration en thread séparé"""
        if self.is_connecting:
            messagebox.showwarning("Attention", "Une connexion est déjà en cours!")
            return
        
        # Validation des champs
        if not self.validate_robont_fields():
            return
        
        # Démarrer la connexion en thread séparé
        self.is_connecting = True
        self.connect_btn.config(state='disabled', text='Connexion en cours...')
        self.update_status("Connexion en cours...", '#f39c12')
        
        thread = threading.Thread(target=self._connect_and_retrieve_thread)
        thread.daemon = True
        thread.start()
    
    def _connect_and_retrieve_thread(self):
        """Thread de connexion et récupération"""
        try:
            # Paramètres de connexion
            server = self.server_entry.get().strip()
            port = int(self.port_entry.get().strip())
            username = self.username_entry.get().strip()
            password = self.password_entry.get()
            switch_hostname = self.switch_entry.get().strip()
            
            # Connexion SSH
            self.root.after(0, lambda: self.update_status("Connexion SSH...", '#f39c12'))
            
            self.ssh_client = paramiko.SSHClient()
            self.ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            self.ssh_client.connect(server, port=port, username=username, password=password, timeout=30)
            
            # Ouvrir shell interactif
            self.root.after(0, lambda: self.update_status("Ouverture du shell...", '#f39c12'))
            self.channel = self.ssh_client.invoke_shell()
            time.sleep(2)
            
            # Nettoyer le buffer initial
            if self.channel.recv_ready():
                self.channel.recv(1024)
            
            # Commande de connexion au switch
            self.root.after(0, lambda: self.update_status(f"Connexion au switch {switch_hostname}...", '#f39c12'))
            cmd = f"ssh {switch_hostname}\n"
            self.channel.send(cmd)
            time.sleep(3)
            
            # Attendre la connexion
            output = ""
            timeout = 30
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                if self.channel.recv_ready():
                    data = self.channel.recv(1024).decode('utf-8', errors='ignore')
                    output += data
                    
                    if ">" in output or "#" in output or "$" in output:
                        break
                time.sleep(0.5)
            
            if not (">" in output or "#" in output or "$" in output):
                raise Exception("Impossible de se connecter au switch")
            
            # Commande de récupération de configuration
            self.root.after(0, lambda: self.update_status("Récupération de la configuration...", '#f39c12'))
            config_cmd = "show configuration | display set | no-more\n"
            self.channel.send(config_cmd)
            time.sleep(2)
            
            # Récupérer la configuration
            config_output = ""
            timeout = 60
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                if self.channel.recv_ready():
                    data = self.channel.recv(4096).decode('utf-8', errors='ignore')
                    config_output += data
                    
                    # Détecter la fin de la commande
                    if ">" in data[-50:] or "#" in data[-50:] or "$" in data[-50:]:
                        break
                time.sleep(0.5)
            
            # Nettoyer et traiter la configuration
            lines = config_output.split('\n')
            clean_config = []
            capture = False
            
            for line in lines:
                line = line.strip()
                if line.startswith('set '):
                    capture = True
                    clean_config.append(line)
                elif capture and (line.endswith('>') or line.endswith('#') or line.endswith('$')):
                    break
                elif capture and line.startswith('set '):
                    clean_config.append(line)
            
            self.config_data = '\n'.join(clean_config)
            
            # Fermer les connexions
            if self.channel:
                self.channel.close()
            if self.ssh_client:
                self.ssh_client.close()
            
            # Mettre à jour l'interface dans le thread principal
            self.root.after(0, self._update_robont_success)
            
        except Exception as e:
            error_msg = f"Erreur de connexion: {str(e)}"
            self.root.after(0, lambda: self._update_robont_error(error_msg))
        finally:
            self.is_connecting = False
    
    def _update_robont_success(self):
        """Met à jour l'interface après succès"""
        self.config_text.delete('1.0', tk.END)
        self.config_text.insert('1.0', self.config_data)
        
        self.save_btn.config(state='normal')
        self.copy_btn.config(state='normal')
        self.connect_btn.config(state='normal', text='Connexion & Récupération')
        
        lines_count = len(self.config_data.split('\n'))
        self.update_status(f"Configuration récupérée ({lines_count} lignes)", '#27ae60')
        
        messagebox.showinfo("Succès", f"Configuration récupérée avec succès!\n{lines_count} lignes de configuration")
    
    def _update_robont_error(self, error_msg):
        """Met à jour l'interface après erreur"""
        self.connect_btn.config(state='normal', text='Connexion & Récupération')
        self.update_status("Erreur de connexion", '#e74c3c')
        messagebox.showerror("Erreur", error_msg)
    
    def validate_robont_fields(self):
        """Valide les champs de connexion Robont"""
        if not self.server_entry.get().strip():
            messagebox.showerror("Erreur", "Veuillez saisir l'adresse du serveur")
            return False
        
        try:
            int(self.port_entry.get().strip())
        except ValueError:
            messagebox.showerror("Erreur", "Le port doit être un nombre")
            return False
        
        if not self.username_entry.get().strip():
            messagebox.showerror("Erreur", "Veuillez saisir le nom d'utilisateur")
            return False
        
        if not self.password_entry.get():
            messagebox.showerror("Erreur", "Veuillez saisir le mot de passe")
            return False
        
        if not self.switch_entry.get().strip():
            messagebox.showerror("Erreur", "Veuillez saisir le hostname du switch")
            return False
        
        # Validation pattern IP
        ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
        if not re.match(ip_pattern, self.server_entry.get().strip()):
            messagebox.showerror("Erreur", "Format d'adresse IP invalide")
            return False
        
        return True
    
    def clear_robont_fields(self):
        """Efface les champs du formulaire Robont"""
        self.username_entry.delete(0, tk.END)
        self.password_entry.delete(0, tk.END)
        self.switch_entry.delete(0, tk.END)
        self.config_text.delete('1.0', tk.END)
        self.config_data = ""
        
        self.save_btn.config(state='disabled')
        self.copy_btn.config(state='disabled')
        self.update_status("Prêt", '#2c3e50')
    
    def save_config_file(self):
        """Sauvegarde la configuration récupérée"""
        if not self.config_data:
            messagebox.showwarning("Attention", "Aucune configuration à sauvegarder")
            return
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"config_{self.switch_entry.get()}_{timestamp}.txt"
        
        file_path = filedialog.asksaveasfilename(
            title="Sauvegarder la configuration",
            defaultextension=".txt",
            initialname=filename,
            filetypes=[("Fichiers texte", "*.txt"), ("Tous les fichiers", "*.*")]
        )
        
        if file_path:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(self.config_data)
                messagebox.showinfo("Succès", f"Configuration sauvegardée:\n{file_path}")
            except Exception as e:
                messagebox.showerror("Erreur", f"Erreur lors de la sauvegarde:\n{str(e)}")
    
    def copy_to_clipboard(self):
        """Copie la configuration vers le presse-papiers"""
        if not self.config_data:
            messagebox.showwarning("Attention", "Aucune configuration à copier")
            return
        
        self.root.clipboard_clear()
        self.root.clipboard_append(self.config_data)
        self.update_status("Configuration copiée vers le presse-papiers", '#27ae60')
        messagebox.showinfo("Succès", "Configuration copiée vers le presse-papiers")
    
    def update_status(self, message, color='#2c3e50'):
        """Met à jour le message de statut"""
        self.status_label.config(text=message, fg=color)
    
    # === MÉTHODES JUNIPER ===
    def browse_config_file(self):
        """Parcourir et sélectionner un fichier de configuration"""
        file_path = filedialog.askopenfilename(
            title="Sélectionner fichier de configuration Juniper",
            filetypes=[("Fichiers texte", "*.txt"), ("Fichiers config", "*.cfg"), ("Tous les fichiers", "*.*")]
        )
        
        if file_path:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    self.uploaded_config = f.read()
                
                # Afficher le nom du fichier
                filename = os.path.basename(file_path)
                self.file_label.config(text=f"Fichier: {filename}", fg='#27ae60')
                
                # Activer le bouton d'analyse
                self.analyze_btn.config(state='normal')
                
                messagebox.showinfo("Succès", f"Fichier chargé: {filename}")
                
            except Exception as e:
                messagebox.showerror("Erreur", f"Erreur lors du chargement:\n{str(e)}")
    
    def analyze_config(self):
        """Analyser la configuration uploadée"""
        if not self.uploaded_config:
            messagebox.showwarning("Attention", "Aucune configuration à analyser")
            return
        
        try:
            # Créer l'analyseur
            self.parsed_config = ConfigurationParser(self.uploaded_config)
            
            # Extraire les informations
            self.switch_info = self.parsed_config.get_switch_info()
            self.interfaces = self.parsed_config.get_interfaces()
            
            # Mettre à jour l'affichage
            self.hostname_label.config(text=self.switch_info.get('hostname', 'Non trouvé'))
            self.mgmt_ip_label.config(text=self.switch_info.get('management_ip', 'Non trouvé'))
            self.access_count_label.config(text=str(len(self.interfaces)))
            
            # Activer les boutons de génération
            if self.interfaces:
                self.gen_dot1x_btn.config(state='normal')
                self.gen_radius_btn.config(state='normal')
                self.gen_cleanup_btn.config(state='normal')
            
            messagebox.showinfo("Analyse terminée", 
                              f"Analyse terminée avec succès!\n\n"
                              f"Hostname: {self.switch_info.get('hostname', 'Non trouvé')}\n"
                              f"IP Management: {self.switch_info.get('management_ip', 'Non trouvé')}\n"
                              f"Interfaces Access: {len(self.interfaces)}")
            
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur lors de l'analyse:\n{str(e)}")
    
    def generate_dot1x(self):
        """Générer la configuration 802.1X"""
        if not self.interfaces:
            messagebox.showwarning("Attention", "Aucune interface à configurer")
            return
        
        try:
            self.dot1x_config = self.parsed_config.generate_dot1x_config(self.interfaces)
            self.dot1x_text.delete('1.0', tk.END)
            self.dot1x_text.insert('1.0', self.dot1x_config)
            
            self.export_all_btn.config(state='normal')
            self.copy_current_btn.config(state='normal')
            
            messagebox.showinfo("Succès", "Configuration 802.1X générée!")
            
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur lors de la génération:\n{str(e)}")
    
    def generate_radius(self):
        """Générer la configuration RADIUS"""
        try:
            mgmt_ip = self.switch_info.get('management_ip')
            self.radius_config = self.parsed_config.get_radius_config(mgmt_ip)
            self.radius_text.delete('1.0', tk.END)
            self.radius_text.insert('1.0', self.radius_config)
            
            self.export_all_btn.config(state='normal')
            self.copy_current_btn.config(state='normal')
            
            messagebox.showinfo("Succès", "Configuration RADIUS générée!")
            
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur lors de la génération:\n{str(e)}")
    
    def generate_cleanup(self):
        """Générer la configuration de nettoyage"""
        if not self.interfaces:
            messagebox.showwarning("Attention", "Aucune interface à nettoyer")
            return
        
        try:
            self.cleanup_config = self.parsed_config.generate_cleanup_config(self.interfaces)
            self.cleanup_text.delete('1.0', tk.END)
            self.cleanup_text.insert('1.0', self.cleanup_config)
            
            self.export_all_btn.config(state='normal')
            self.copy_current_btn.config(state='normal')
            
            messagebox.showinfo("Succès", "Configuration de nettoyage générée!")
            
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur lors de la génération:\n{str(e)}")
    
    def export_all_configs(self):
        """Exporter toutes les configurations générées"""
        if not any([self.dot1x_config, self.radius_config, self.cleanup_config]):
            messagebox.showwarning("Attention", "Aucune configuration à exporter")
            return
        
        # Demander le dossier de destination
        folder_path = filedialog.askdirectory(title="Sélectionner le dossier de destination")
        
        if folder_path:
            try:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                hostname = self.switch_info.get('hostname', 'switch')
                
                files_created = []
                
                # Exporter 802.1X
                if self.dot1x_config:
                    dot1x_path = os.path.join(folder_path, f"{hostname}_dot1x_{timestamp}.txt")
                    with open(dot1x_path, 'w', encoding='utf-8') as f:
                        f.write(self.dot1x_config)
                    files_created.append(dot1x_path)
                
                # Exporter RADIUS
                if self.radius_config:
                    radius_path = os.path.join(folder_path, f"{hostname}_radius_{timestamp}.txt")
                    with open(radius_path, 'w', encoding='utf-8') as f:
                        f.write(self.radius_config)
                    files_created.append(radius_path)
                
                # Exporter Cleanup
                if self.cleanup_config:
                    cleanup_path = os.path.join(folder_path, f"{hostname}_cleanup_{timestamp}.txt")
                    with open(cleanup_path, 'w', encoding='utf-8') as f:
                        f.write(self.cleanup_config)
                    files_created.append(cleanup_path)
                
                messagebox.showinfo("Succès", 
                                  f"Fichiers exportés avec succès:\n\n" + 
                                  "\n".join([os.path.basename(f) for f in files_created]))
                
            except Exception as e:
                messagebox.showerror("Erreur", f"Erreur lors de l'export:\n{str(e)}")
    
    def copy_current_tab(self):
        """Copier le contenu de l'onglet actuel vers le presse-papiers"""
        current_tab = self.notebook.select()
        tab_text = self.notebook.tab(current_tab, "text")
        
        content = ""
        if "802.1X" in tab_text:
            content = self.dot1x_config
        elif "RADIUS" in tab_text:
            content = self.radius_config
        elif "Cleanup" in tab_text:
            content = self.cleanup_config
        
        if content:
            self.root.clipboard_clear()
            self.root.clipboard_append(content)
            messagebox.showinfo("Succès", f"Configuration {tab_text} copiée vers le presse-papiers")
        else:
            messagebox.showwarning("Attention", "Aucun contenu à copier dans cet onglet")

def main():
    """Fonction principale de lancement"""
    root = tk.Tk()
    app = NetworkManagementSuite(root)
    root.mainloop()

if __name__ == "__main__":
    main()