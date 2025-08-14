#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Network Management Suite v2.0
Interface graphique pour la gestion des equipements reseau avec:
- Connexion au serveur Robont et recuperation de configuration switch
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

# Verifier et installer paramiko si necessaire
try:
    import paramiko
except ImportError:
    print("Installation de paramiko en cours...")
    try:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko"])
        import paramiko
        print("Paramiko installe avec succes!")
    except Exception as e:
        messagebox.showerror("Erreur de dependance", 
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
        """Genere la configuration 802.1x"""
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
        """Genere la configuration de nettoyage"""
        configs = []
        
        for iface in interfaces:
            if iface['is_access']:
                configs.extend([
                    f"delete interfaces {iface['name']} unit 0 family ethernet-switching",
                    f"delete interfaces {iface['name']} ethernet-switching-options"
                ])
        
        return '\n'.join(configs)
    
    def get_radius_config(self, management_ip=None):
        """Genere la configuration RADIUS"""
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
        """Configure l'interface utilisateur avec menu lateral"""
        # === MENU LATERAL ===
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
            ("ISE Switch Config", "ise", "⚙️")
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
        
        # Separateur
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
        # Mettre a jour l'etat des boutons
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
        tk.Label(card1, text="Recuperation de configuration\nvia serveur Robont", 
                font=('Arial', 10), bg='white', fg='#7f8c8d').pack(pady=(5, 20))
        
        btn1 = tk.Button(card1, text="Acceder", font=('Arial', 10, 'bold'), 
                        bg='#2c3e50', fg='white', relief='flat', pady=8,
                        command=lambda: self.switch_view("robont"))
        btn1.pack(pady=(0, 20), padx=20, fill='x')
        
        # Card 2 - ISE Switch Config
        card2 = tk.Frame(cards_frame, bg='white', relief='raised', bd=2)
        card2.pack(side='left', fill='both', expand=True, padx=(15, 0))
        
        tk.Label(card2, text="⚙️", font=('Arial', 40), bg='white').pack(pady=(20, 10))
        tk.Label(card2, text="ISE Switch Config", 
                font=('Arial', 14, 'bold'), bg='white').pack()
        tk.Label(card2, text="Configuration des switchs\npour Cisco ISE", 
                font=('Arial', 10), bg='white', fg='#7f8c8d').pack(pady=(5, 20))
        
        btn2 = tk.Button(card2, text="Acceder", font=('Arial', 10, 'bold'), 
                        bg='#e67e22', fg='white', relief='flat', pady=8,
                        command=lambda: self.switch_view("ise"))
        btn2.pack(pady=(0, 20), padx=20, fill='x')
        
        # Informations système
        info_frame = tk.LabelFrame(content_frame, text="Informations Systeme", 
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
   ├── Vue d'ensemble des outils reseau disponibles
   ├── Statut des connexions et services
   └── Informations systeme

🔗 ROBONT SWITCH MANAGER  
   ├── Connexion securisee au serveur Robont (6.91.128.111)
   ├── Recuperation automatique des configurations switch
   ├── Commande: show configuration | display set | no-more
   └── Export et sauvegarde des configurations

⚙️ ISE SWITCH CONFIG (NOUVEAU!)
   ├── Upload de fichiers de configuration Juniper
   ├── Analyse automatique des interfaces access
   ├── Generation de configuration 802.1X
   ├── Configuration RADIUS pour ISE
   ├── Nettoyage des configurations existantes
   └── Export des configurations generees

🚀 FONCTIONNALITES
   • Interface graphique intuitive avec navigation par onglets
   • Gestion des erreurs avancee et logs detailles
   • Sauvegarde automatique et export multi-formats
   • Drag & drop pour upload de fichiers
   • Copie vers presse-papiers integree
   • Generation automatique de configurations ISE

✅ STATUT: Systeme operationnel
⏰ Derniere mise a jour: {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}
        """
        
        info_text.insert(tk.END, info_content)
        info_text.config(state='disabled')

    # ... keep existing code (rest of the methods remain the same)

if __name__ == "__main__":
    root = tk.Tk()
    app = NetworkManagementSuite(root)
    root.mainloop()