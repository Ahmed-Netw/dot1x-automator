#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Interface graphique pour la connexion au serveur Robont et récupération de configuration switch
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog
import time
import threading
import re
from datetime import datetime
import os
import sys

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

class RobontSwitchGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Network Management Suite")
        self.root.geometry("1200x900")
        self.root.configure(bg='#f0f0f0')
        
        # Variables
        self.ssh_client = None
        self.channel = None
        self.switch_hostname = None
        self.is_connecting = False
        self.config_data = ""
        self.current_view = "dashboard"
        self.access_interfaces = []
        self.ise_config_generated = ""
        
        # Styles
        style = ttk.Style()
        style.theme_use('clam')
        
        self.setup_ui()
        
    def setup_ui(self):
        """Configure l'interface utilisateur avec menu latéral"""
        # === MENU LATÉRAL ===
        self.sidebar = tk.Frame(self.root, bg='#2c3e50', width=250)
        self.sidebar.pack(side='left', fill='y', padx=0, pady=0)
        self.sidebar.pack_propagate(False)
        
        # Logo/Titre du menu
        logo_frame = tk.Frame(self.sidebar, bg='#34495e', height=80)
        logo_frame.pack(fill='x', padx=0, pady=0)
        logo_frame.pack_propagate(False)
        
        logo_label = tk.Label(logo_frame, text="Network\nManagement", 
                             font=('Arial', 14, 'bold'), fg='white', bg='#34495e')
        logo_label.pack(pady=15)
        
        # Boutons du menu
        self.menu_buttons = {}
        menu_items = [
            ("Dashboard", "dashboard", "??"),
            ("Robont Switch Manager", "robont", "??"),
            ("ISE Switch Config", "ise", "???")
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
            def on_enter(e, button=btn):
                button.config(bg='#34495e')
            def on_leave(e, button=btn):
                if self.current_view != key:
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
        
        title_label = tk.Label(title_frame, text="?? Dashboard", 
                              font=('Arial', 20, 'bold'), fg='white', bg='#3498db')
        title_label.pack(pady=25)
        
        # Contenu principal
        content_frame = tk.Frame(self.main_area, bg='#f0f0f0')
        content_frame.pack(fill='both', expand=True, padx=30, pady=30)
        
        # Cards de statut
        cards_frame = tk.Frame(content_frame, bg='#f0f0f0')
        cards_frame.pack(fill='x', pady=(0, 30))
        
        # Card 1 - Robont Switch Manager
        card1 = tk.Frame(cards_frame, bg='white', relief='raised', bd=1)
        card1.pack(side='left', fill='both', expand=True, padx=(0, 15))
        
        tk.Label(card1, text="??", font=('Arial', 30), bg='white').pack(pady=(20, 5))
        tk.Label(card1, text="Robont Switch Manager", 
                font=('Arial', 14, 'bold'), bg='white').pack()
        tk.Label(card1, text="Récupération de configuration\nvia serveur Robont", 
                font=('Arial', 10), bg='white', fg='#7f8c8d').pack(pady=(5, 20))
        
        # Card 2 - ISE Switch Config
        card2 = tk.Frame(cards_frame, bg='white', relief='raised', bd=1)
        card2.pack(side='left', fill='both', expand=True, padx=(15, 0))
        
        tk.Label(card2, text="???", font=('Arial', 30), bg='white').pack(pady=(20, 5))
        tk.Label(card2, text="ISE Switch Config", 
                font=('Arial', 14, 'bold'), bg='white').pack()
        tk.Label(card2, text="Configuration des switchs\npour Cisco ISE", 
                font=('Arial', 10), bg='white', fg='#7f8c8d').pack(pady=(5, 20))
        
        # Informations système
        info_frame = tk.LabelFrame(content_frame, text="Informations Système", 
                                 font=('Arial', 12, 'bold'), bg='#f0f0f0')
        info_frame.pack(fill='both', expand=True)
        
        info_text = tk.Text(info_frame, font=('Courier', 10), height=15, 
                           bg='white', relief='flat', padx=20, pady=20)
        info_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Contenu d'information
        info_content = f"""
?? Network Management Suite v2.0
+-------------------------------------------------------------------------------+
¦                                                                               ¦
¦ TABLEAU DE BORD                                                               ¦
¦   +-- Vue d'ensemble des outils réseau disponibles                           ¦
¦   +-- Statut des connexions et services                                      ¦
¦   +-- Informations système                                                   ¦
¦                                                                               ¦
¦ ?? ROBONT SWITCH MANAGER                                                      ¦
¦   +-- Connexion sécurisée au serveur Robont (6.91.128.111)                  ¦
¦   +-- Récupération automatique des configurations switch                     ¦
¦   +-- Commande: show configuration | display set | no-more                   ¦
¦   +-- Export et sauvegarde des configurations                                ¦
¦                                                                               ¦
¦ ??? ISE SWITCH CONFIG                                                          ¦
¦   +-- Configuration RADIUS et authentification 802.1x                        ¦
¦   +-- Identification automatique des interfaces access                       ¦
¦   +-- Génération des configurations dot1x par interface                      ¦
¦   +-- Suppression des configurations secure-access-port                      ¦
¦                                                                               ¦
¦ ? FONCTIONNALITÉS                                                           ¦
¦   • Interface graphique intuitive                                            ¦
¦   • Analyse automatique des configurations                                   ¦
¦   • Génération de configurations ISE                                         ¦
¦   • Export et téléchargement des fichiers                                    ¦
¦   • Gestion des erreurs avancée                                              ¦
¦                                                                               ¦
¦ ? STATUT: Système opérationnel                                              ¦
¦ ?? Dernière mise à jour: {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}     ¦
+-------------------------------------------------------------------------------+
        """
        
        info_text.insert(tk.END, info_content)
        info_text.config(state='disabled')
    
    def show_robont_manager(self):
        """Affiche le gestionnaire Robont (interface originale)"""
        # Titre
        title_frame = tk.Frame(self.main_area, bg='#2c3e50', height=60)
        title_frame.pack(fill='x', padx=0, pady=0)
        title_frame.pack_propagate(False)
        
        title_label = tk.Label(title_frame, text="?? Robont Switch Manager", 
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
        """Affiche l'interface ISE Switch Config avec fonctionnalités complètes"""
        # Titre
        title_frame = tk.Frame(self.main_area, bg='#e67e22', height=60)
        title_frame.pack(fill='x', padx=0, pady=0)
        title_frame.pack_propagate(False)
        
        title_label = tk.Label(title_frame, text="??? ISE Switch Config", 
                              font=('Arial', 16, 'bold'), fg='white', bg='#e67e22')
        title_label.pack(pady=15)
        
        # Frame principal
        main_frame = tk.Frame(self.main_area, bg='#f0f0f0')
        main_frame.pack(fill='both', expand=True, padx=20, pady=20)
        
        # === SECTION STATUT ===
        status_frame = tk.LabelFrame(main_frame, text="STATUT DE CONFIGURATION", 
                                   font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#e67e22')
        status_frame.pack(fill='x', pady=(0, 15))
        
        self.ise_status_label = tk.Label(status_frame, 
            text="?? Aucune configuration Robont trouvée. Veuillez d'abord récupérer une configuration via 'Robont Switch Manager'.", 
            font=('Arial', 10), bg='#f0f0f0', fg='#e74c3c', wraplength=800)
        self.ise_status_label.pack(padx=10, pady=10)
        
        # === SECTION INTERFACES ACCESS ===
        interfaces_frame = tk.LabelFrame(main_frame, text="INTERFACES EN MODE ACCESS DÉTECTÉES", 
                                       font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#e67e22')
        interfaces_frame.pack(fill='x', pady=(0, 15))
        
        # Liste des interfaces avec scrollbar
        list_frame = tk.Frame(interfaces_frame, bg='#f0f0f0')
        list_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Listbox avec scrollbar
        scrollbar = tk.Scrollbar(list_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.interfaces_listbox = tk.Listbox(list_frame, yscrollcommand=scrollbar.set, 
                                           font=('Courier', 10), height=6)
        self.interfaces_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.interfaces_listbox.yview)
        
        # === BOUTONS D'ACTION ===
        buttons_frame = tk.Frame(main_frame, bg='#f0f0f0')
        buttons_frame.pack(fill='x', pady=(0, 15))
        
        self.analyze_btn = tk.Button(buttons_frame, text="ANALYSER CONFIGURATION ROBONT", 
                                   font=('Arial', 11, 'bold'), bg='#3498db', fg='white',
                                   command=self.analyze_robont_config, width=25)
        self.analyze_btn.pack(side='left', padx=5)
        
        self.generate_btn = tk.Button(buttons_frame, text="GÉNÉRER CONFIG ISE", 
                                    font=('Arial', 11, 'bold'), bg='#e67e22', fg='white',
                                    command=self.generate_ise_config, width=20, state='disabled')
        self.generate_btn.pack(side='left', padx=5)
        
        # === ZONE DE RÉSULTATS ===
        results_frame = tk.LabelFrame(main_frame, text="CONFIGURATION ISE GÉNÉRÉE", 
                                    font=('Arial', 12, 'bold'), bg='#f0f0f0', fg='#e67e22')
        results_frame.pack(fill='both', expand=True)
        
        # Zone de texte avec scroll
        self.ise_results_text = scrolledtext.ScrolledText(results_frame, font=('Courier', 9), 
                                                        wrap='none', height=15)
        self.ise_results_text.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Boutons de sauvegarde ISE
        ise_save_frame = tk.Frame(results_frame, bg='#f0f0f0')
        ise_save_frame.pack(fill='x', padx=10, pady=(0, 10))
        
        self.ise_save_btn = tk.Button(ise_save_frame, text="SAUVEGARDER CONFIG ISE", 
                                    font=('Arial', 10), bg='#f39c12', fg='white',
                                    command=self.save_ise_config, state='disabled')
        self.ise_save_btn.pack(side='left', padx=5)
        
        self.ise_download_btn = tk.Button(ise_save_frame, text="TÉLÉCHARGER CONFIG ISE", 
                                        font=('Arial', 10), bg='#8e44ad', fg='white',
                                        command=self.download_ise_config, state='disabled')
        self.ise_download_btn.pack(side='left', padx=5)
        
        # Info nombre d'interfaces
        self.interfaces_count_label = tk.Label(ise_save_frame, text="", 
                                             font=('Arial', 9, 'italic'), bg='#f0f0f0', fg='#27ae60')
        self.interfaces_count_label.pack(side='right', padx=5)
        
        # Analyser automatiquement si configuration disponible
        self.root.after(100, self.analyze_robont_config)
    
    def analyze_robont_config(self):
        """Analyse la configuration récupérée de Robont pour trouver les interfaces access"""
        try:
            if not self.config_data.strip():
                self.ise_status_label.config(
                    text="?? Aucune configuration Robont trouvée. Veuillez d'abord récupérer une configuration via 'Robont Switch Manager'.",
                    fg='#e74c3c'
                )
                self.generate_btn.config(state='disabled')
                return
            
            # Analyser les interfaces en mode access
            self.access_interfaces = self.find_access_interfaces(self.config_data)
            
            # Mettre à jour l'interface
            self.interfaces_listbox.delete(0, tk.END)
            
            if self.access_interfaces:
                for interface in self.access_interfaces:
                    self.interfaces_listbox.insert(tk.END, f"?? {interface}")
                
                self.ise_status_label.config(
                    text="? Configuration Robont analysée avec succès! Interfaces access détectées.",
                    fg='#27ae60'
                )
                self.generate_btn.config(state='normal')
                self.interfaces_count_label.config(
                    text=f"Interfaces détectées: {len(self.access_interfaces)}"
                )
            else:
                self.interfaces_listbox.insert(tk.END, "? Aucune interface en mode access trouvée")
                self.ise_status_label.config(
                    text="?? Aucune interface en mode access trouvée dans la configuration.",
                    fg='#f39c12'
                )
                self.generate_btn.config(state='disabled')
                self.interfaces_count_label.config(text="")
            
        except Exception as e:
            self.ise_status_label.config(
                text=f"? Erreur lors de l'analyse: {str(e)}",
                fg='#e74c3c'
            )
    
    def find_access_interfaces(self, config_data):
        """Trouve les interfaces configurées en mode access"""
        access_interfaces = []
        
        try:
            lines = config_data.split('\n')
            interface_configs = {}
            
            # Analyser chaque ligne de configuration
            for line in lines:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                # Rechercher les configurations d'interface
                interface_match = re.search(r'set interfaces (ge-\d+/\d+/\d+)', line)
                if interface_match:
                    interface = interface_match.group(1)
                    if interface not in interface_configs:
                        interface_configs[interface] = []
                    interface_configs[interface].append(line)
            
            # Identifier les interfaces en mode access
            for interface, configs in interface_configs.items():
                is_access = False
                has_vlan = False
                is_trunk = False
                
                for config in configs:
                    # Vérifier si c'est un port access
                    if 'interface-mode access' in config:
                        is_access = True
                    elif 'interface-mode trunk' in config:
                        is_trunk = True
                    elif 'vlan members' in config and 'interface-mode' not in config:
                        has_vlan = True
                
                # Une interface est access si elle a le mode access explicite
                # ou si elle a un VLAN assigné sans être trunk
                if is_access or (has_vlan and not is_trunk):
                    access_interfaces.append(interface)
            
            # Trier les interfaces
            access_interfaces.sort(key=lambda x: [int(i) for i in re.findall(r'\d+', x)])
            
        except Exception as e:
            print(f"Erreur analyse interfaces: {e}")
        
        return access_interfaces
    
    def generate_ise_config(self):
        """Génère la configuration ISE complète"""
        try:
            if not self.access_interfaces:
                messagebox.showwarning("Attention", "Aucune interface access disponible pour générer la configuration ISE")
                return
            
            # Générer la configuration ISE
            ise_config = self.create_ise_configuration()
            
            # Stocker la configuration générée
            self.ise_config_generated = ise_config
            
            # Afficher dans la zone de texte
            self.ise_results_text.delete(1.0, tk.END)
            self.ise_results_text.insert(tk.END, ise_config)
            
            # Activer les boutons de sauvegarde
            self.ise_save_btn.config(state='normal')
            self.ise_download_btn.config(state='normal')
            
            # Mettre à jour le statut
            self.ise_status_label.config(
                text="? Configuration ISE générée avec succès!",
                fg='#27ae60'
            )
            
            messagebox.showinfo("Succès", 
                f"Configuration ISE générée avec succès!\n\n"
                f"• Configuration RADIUS ajoutée\n"
                f"• {len(self.access_interfaces)} interfaces configurées\n"
                f"• Commandes secure-access-port supprimées")
            
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur lors de la génération de la configuration ISE: {str(e)}")
    
    def create_ise_configuration(self):
        """Crée la configuration ISE complète"""
        config_lines = []
        
        # En-tête
        config_lines.append("# Configuration ISE générée automatiquement")
        config_lines.append(f"# Générée le: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
        if self.switch_hostname:
            config_lines.append(f"# Switch: {self.switch_hostname}")
        config_lines.append(f"# Nombre d'interfaces configurées: {len(self.access_interfaces)}")
        config_lines.append("#" + "="*60)
        config_lines.append("")
        
        # 1. Configuration RADIUS
        config_lines.append("# ===== CONFIGURATION RADIUS =====")
        config_lines.append("")
        
        radius_config = [
            "set access radius-server 10.147.32.47 port 1812",
            "set access radius-server 10.147.32.47 secret \"$9$qfTF69tBRcP5Qn9tREdbwsoJUjH.fT\"",
            "set access radius-server 10.147.32.47 source-address 10.148.62.185",
            "set access radius-server 10.147.160.47 port 1812",
            "set access radius-server 10.147.160.47 secret \"$9$72Vw2oJUkm5dbs4JUmPBIREreM8XNVw\"",
            "set access radius-server 10.147.160.47 source-address 10.148.62.185",
            "set access profile 802.1x-auth accounting-order radius",
            "set access profile 802.1x-auth authentication-order radius",
            "set access profile 802.1x-auth radius authentication-server 10.147.32.47",
            "set access profile 802.1x-auth radius authentication-server 10.147.160.47",
            "set access profile 802.1x-auth radius accounting-server 10.147.32.47",
            "set access profile 802.1x-auth radius accounting-server 10.147.160.47",
            "set protocols dot1x authenticator authentication-profile-name 802.1x-auth"
        ]
        
        config_lines.extend(radius_config)
        config_lines.append("")
        
        # 2. Configuration des interfaces access
        config_lines.append("# ===== CONFIGURATION DOT1X PAR INTERFACE =====")
        config_lines.append("")
        
        for interface in self.access_interfaces:
            config_lines.append(f"# Configuration pour {interface}")
            dot1x_config = [
                f"set protocols dot1x authenticator interface {interface} supplicant multiple",
                f"set protocols dot1x authenticator interface {interface} retries 3",
                f"set protocols dot1x authenticator interface {interface} transmit-period 1",
                f"set protocols dot1x authenticator interface {interface} reauthentication 3600",
                f"set protocols dot1x authenticator interface {interface} supplicant-timeout 10",
                f"set protocols dot1x authenticator interface {interface} maximum-requests 3",
                f"set protocols dot1x authenticator interface {interface} mac-radius"
            ]
            config_lines.extend(dot1x_config)
            config_lines.append("")
        
        # 3. Suppression des configurations secure-access-port
        config_lines.append("# ===== SUPPRESSION DES CONFIGURATIONS SECURE-ACCESS-PORT =====")
        config_lines.append("")
        
        for interface in self.access_interfaces:
            config_lines.append(f"# Suppression secure-access-port pour {interface}")
            delete_config = [
                f"delete ethernet-switching-options secure-access-port interface {interface} mac-limit 3",
                f"delete ethernet-switching-options secure-access-port interface {interface} mac-limit action drop"
            ]
            config_lines.extend(delete_config)
            config_lines.append("")
        
        # 4. Résumé
        config_lines.append("# ===== RÉSUMÉ DE LA CONFIGURATION =====")
        config_lines.append("#")
        config_lines.append("# Configuration appliquée:")
        config_lines.append("# • Serveurs RADIUS: 10.147.32.47 et 10.147.160.47")
        config_lines.append("# • Profil d'accès: 802.1x-auth")
        config_lines.append(f"# • Interfaces configurées: {len(self.access_interfaces)}")
        config_lines.append("# • Authentification dot1x activée sur toutes les interfaces access")
        config_lines.append("# • Configurations secure-access-port supprimées")
        config_lines.append("#")
        config_lines.append(f"# Interfaces concernées: {', '.join(self.access_interfaces)}")
        
        return "\n".join(config_lines)
    
    def save_ise_config(self):
        """Sauvegarde la configuration ISE dans le répertoire courant"""
        try:
            if not self.ise_config_generated.strip():
                messagebox.showwarning("Attention", "Aucune configuration ISE à sauvegarder")
                return
            
            # Nom de fichier basé sur le hostname
            if self.switch_hostname:
                filename = f"{self.switch_hostname}_ISE_config.txt"
            else:
                filename = "switch_ISE_config.txt"
            
            # Nettoyer le nom
            filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
            
            # Sauvegarder
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(self.ise_config_generated)
            
            messagebox.showinfo("Succès", f"Configuration ISE sauvegardée dans:\n{filename}")
            
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur sauvegarde ISE: {str(e)}")
    
    def download_ise_config(self):
        """Télécharge la configuration ISE avec dialogue de sauvegarde"""
        try:
            if not self.ise_config_generated.strip():
                messagebox.showwarning("Attention", "Aucune configuration ISE à télécharger")
                return
            
            # Nom de fichier par défaut
            if self.switch_hostname:
                default_filename = f"{self.switch_hostname}_ISE_config.txt"
            else:
                default_filename = "switch_ISE_config.txt"
            
            # Nettoyer le nom
            default_filename = re.sub(r'[<>:"/\\|?*]', '_', default_filename)
            
            # Dialogue de sauvegarde
            filename = filedialog.asksaveasfilename(
                title="Télécharger la configuration ISE",
                defaultextension=".txt",
                initialname=default_filename,
                filetypes=[
                    ("Fichiers texte", "*.txt"),
                    ("Fichiers de configuration", "*.cfg"),
                    ("Tous les fichiers", "*.*")
                ]
            )
            
            if filename:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(self.ise_config_generated)
                
                messagebox.showinfo("Succès", f"Configuration ISE téléchargée dans:\n{filename}")
            
        except Exception as e:
            messagebox.showerror("Erreur", f"Erreur téléchargement ISE: {str(e)}")
    
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
        
        # Validation IP (CORRIGÉ)
        ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}
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
                # Sauvegarder les données
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
            
            # Vérifier si un nom d'utilisateur invalide
            if any(error in output.lower() for error in [
                "invalid user", "user unknown", "no such user", "login incorrect"
            ]):
                self.update_status("Login switch erroné", '#e74c3c')
                messagebox.showerror("Erreur d'Authentification", 
                    "Login erroné pour le switch:\n"
                    "• Vérifiez le nom d'utilisateur du switch\n"
                    "• Assurez-vous que l'utilisateur existe sur le switch")
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
            
            # Nom de fichier basé sur le hostname
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
            
            # Nom de fichier par défaut
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
            app = RobontSwitchGUI(root)
        except Exception as e:
            messagebox.showerror("Erreur d'initialisation", 
                f"Erreur lors de l'initialisation de l'interface:\n{e}")
            root.destroy()
            return
        
        # Centrer la fenêtre
        try:
            root.update_idletasks()
            x = (root.winfo_screenwidth() // 2) - (1200 // 2)
            y = (root.winfo_screenheight() // 2) - (900 // 2)
            root.geometry(f"1200x900+{x}+{y}")
        except:
            # Fallback si problème de centrage
            root.geometry("1200x900")
        
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