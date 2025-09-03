import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Terminal, Network, Lock, AlertTriangle, Download, FolderOpen, FileText, RefreshCw, Code, Copy, TestTube, Loader2, ChevronDown, ChevronRight, ExternalLink, Server, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DesktopCompiler from '@/components/DesktopCompiler';
import { FileUpload } from '@/components/FileUpload';
import MultiSwitchBatch from '@/components/MultiSwitchBatch';
import { bridgeClient } from '@/lib/bridge';

// Import conditionnel pour Tauri (ne fonctionnera que dans l'app desktop)
let tauriInvoke: any = null;
try {
  tauriInvoke = (window as any).__TAURI__ ? require('@tauri-apps/api/tauri').invoke : null;
} catch (e) {
  console.log('Tauri non disponible, mode web');
}
interface ConnectionStatus {
  isConnected: boolean;
  error?: string;
  message?: string;
}
export default function DeviceConnection() {
  // Force recompilation - all "robont" references changed to "rebond"
  console.log('DeviceConnection loaded with rebond variables');

  // Serveur rebond (IP fixe selon le script)
  const [rebondServerIp] = useState('6.91.128.111');
  const [rebondUsername, setRebondUsername] = useState('');
  const [rebondPassword, setRebondPassword] = useState('');

  // Switch cible
  const [switchIp, setSwitchIp] = useState('');
  const [switchUsername, setSwitchUsername] = useState('');
  const [switchPassword, setSwitchPassword] = useState('');
  const [configuration, setConfiguration] = useState('');
  const [extractedHostname, setExtractedHostname] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStep, setConnectionStep] = useState<string>('');

  // État pour le script externe
  const [scriptConfigPath, setScriptConfigPath] = useState('C:\\Configurations');
  const [availableConfigs, setAvailableConfigs] = useState<string[]>([]);
  const [selectedConfigFile, setSelectedConfigFile] = useState<string>('');
  const [configFileContent, setConfigFileContent] = useState<string>('');
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<string>('');
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);

  // État pour le bridge server local
  const [bridgeServerAvailable, setBridgeServerAvailable] = useState(false);
  const [checkingBridge, setCheckingBridge] = useState(false);
  const {
    toast
  } = useToast();

  // Vérification périodique du bridge server
  useEffect(() => {
    checkBridgeServer();

    // Vérification toutes les 30 secondes
    const interval = setInterval(checkBridgeServer, 30000);
    return () => clearInterval(interval);
  }, []);
  const checkBridgeServer = async () => {
    setCheckingBridge(true);
    try {
      const available = await bridgeClient.checkAvailability();
      setBridgeServerAvailable(available);
    } catch (error) {
      setBridgeServerAvailable(false);
    } finally {
      setCheckingBridge(false);
    }
  };

  // Fonction pour extraire le hostname de la configuration
  const extractHostname = (configData: string): string => {
    const patterns = [/set system host-name\s+(\S+)/i, /set hostname\s+(\S+)/i, /hostname\s+(\S+)/i, /host-name\s+(\S+)/i];
    for (const pattern of patterns) {
      const match = configData.match(pattern);
      if (match) {
        const hostname = match[1].replace(/[";']+/g, '');
        return hostname;
      }
    }

    // Si aucun hostname trouvé, utiliser l'IP
    return `switch_${switchIp.replace(/\./g, '_')}`;
  };
  const generateMockConfiguration = (switchIp: string): string => {
    const timestamp = new Date().toLocaleString('fr-FR');
    const hostname = `SW-${switchIp.replace(/\./g, '-')}`;
    return `# Configuration récupérée le ${timestamp}
# Serveur Rebond: ${rebondServerIp}
# Switch IP: ${switchIp}
# Switch Hostname: ${hostname}
# Commande: show configuration | display set | no-more
#==================================================

set version 20.4R3.8
set system host-name ${hostname}
set system domain-name company.local
set system domain-search company.local
set system time-zone Europe/Paris
set system name-server 8.8.8.8
set system name-server 8.8.4.4
set system name-server 1.1.1.1
set system root-authentication encrypted-password "$6$randomhash$encrypted.password.hash.for.root.user"
set system login user ${switchUsername} uid 2000
set system login user ${switchUsername} class super-user
set system login user ${switchUsername} authentication encrypted-password "$6$userhash$encrypted.password.hash.for.user"
set system services ssh root-login allow
set system services ssh protocol-version v2
set system services netconf ssh
set system services web-management https system-generated-certificate
set system syslog user * any emergency
set system syslog host 192.168.1.200 any notice
set system ntp server 0.pool.ntp.org prefer
set system ntp server 1.pool.ntp.org
set system ntp source-address ${switchIp}

set interfaces me0 unit 0 description "Management Interface - Out of Band"
set interfaces me0 unit 0 family inet address ${switchIp}/24

# Configuration des ports d'accès
set interfaces ge-0/0/0 description "Access Port 0 - VLAN 10 - User Access"
set interfaces ge-0/0/0 unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/0 unit 0 family ethernet-switching vlan members vlan-10
set interfaces ge-0/0/1 description "Access Port 1 - VLAN 20 - Guest Access"
set interfaces ge-0/0/1 unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/1 unit 0 family ethernet-switching vlan members vlan-20
set interfaces ge-0/0/2 description "Access Port 2 - VLAN 30 - Server Access"
set interfaces ge-0/0/2 unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/2 unit 0 family ethernet-switching vlan members vlan-30

# Configuration des VLANs
set interfaces vlan unit 10 description "End User Network"
set interfaces vlan unit 10 family inet address 192.168.10.1/24
set vlans vlan-10 description "End User Network"
set vlans vlan-10 vlan-id 10
set vlans vlan-10 l3-interface vlan.10

set interfaces vlan unit 20 description "Guest Network - Limited Access"
set interfaces vlan unit 20 family inet address 192.168.20.1/24
set vlans vlan-20 description "Guest Network - Limited Access"
set vlans vlan-20 vlan-id 20
set vlans vlan-20 l3-interface vlan.20

set interfaces vlan unit 30 description "Server Network - Production"
set interfaces vlan unit 30 family inet address 192.168.30.1/24
set vlans vlan-30 description "Server Network - Production"
set vlans vlan-30 vlan-id 30
set vlans vlan-30 l3-interface vlan.30

# Configuration SNMP
set snmp description "${hostname} - Juniper EX Series Switch"
set snmp location "Building A - Floor 3 - Network Room 301"
set snmp contact "Network Operations Center - noc@company.local"
set snmp community public authorization read-only
set snmp trap-options source-address ${switchIp}

# Configuration des protocoles
set protocols igmp-snooping vlan vlan-10
set protocols igmp-snooping vlan vlan-20
set protocols igmp-snooping vlan vlan-30
set protocols lldp port-id-subtype interface-name
set protocols lldp interface all enable
set protocols rstp bridge-priority 32768

# Configuration RADIUS pour 802.1x
set access radius-server 10.147.32.47 port 1812
set access radius-server 10.147.32.47 secret "$9$qfTF69tBRcP5Qn9tREdbwsoJUjH.fT3n/9AtOIEcylv"
set access radius-server 10.147.32.47 source-address ${switchIp}
set access radius-server 10.147.32.47 accounting-port 1813
set access radius-server 10.147.160.47 port 1812
set access radius-server 10.147.160.47 secret "$9$72Vw2oJUkm5dbs4JUmPBIREreM8XNVwgaZUjq"
set access radius-server 10.147.160.47 source-address ${switchIp}
set access radius-server 10.147.160.47 accounting-port 1813

set access profile dot1x-profile accounting-order radius
set access profile dot1x-profile authentication-order radius
set access profile dot1x-profile radius authentication-server 10.147.32.47
set access profile dot1x-profile radius authentication-server 10.147.160.47
set access profile dot1x-profile radius accounting-server 10.147.32.47
set access profile dot1x-profile radius accounting-server 10.147.160.47

set protocols dot1x authenticator authentication-profile-name dot1x-profile

# Configuration terminée - Switch ${hostname}
# Timestamp de fin: ${new Date().toLocaleString('fr-FR')}`;
  };
  const handlePing = async (target: 'rebond' | 'switch') => {
    const ip = target === 'rebond' ? rebondServerIp : switchIp;
    if (!ip) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir une adresse IP",
        variant: "destructive"
      });
      return;
    }
    try {
      if (tauriInvoke) {
        // Mode desktop - utiliser Tauri
        const isReachable = (await tauriInvoke('ping_host', {
          ip
        })) as boolean;
        toast({
          title: `Ping ${target}`,
          description: isReachable ? `✓ ${ip} est accessible (port 22 ouvert)` : `✗ ${ip} n'est pas accessible`,
          variant: isReachable ? "default" : "destructive"
        });
      } else if (bridgeServerAvailable) {
        // Mode bridge - utiliser le serveur local
        const result = await bridgeClient.pingDevice(ip);
        toast({
          title: `Ping ${target}`,
          description: result.success ? `✓ ${ip} est accessible` : `✗ ${result.error || 'Ping échoué'}`,
          variant: result.success ? "default" : "destructive"
        });
      } else {
        // Mode simulation
        toast({
          title: "Mode simulation",
          description: `Ping vers ${ip} - démarrez le bridge server pour un vrai test`
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur de ping",
        description: error.message || 'Erreur lors du test de connectivité',
        variant: "destructive"
      });
    }
  };
  const handleTestRebond = async () => {
    if (!rebondUsername || !rebondPassword) {
      toast({
        title: "Champs manquants",
        description: "Veuillez saisir les identifiants du serveur Rebond",
        variant: "destructive"
      });
      return;
    }
    try {
      if (tauriInvoke) {
        // Mode desktop - utiliser Tauri
        const result = (await tauriInvoke('test_rebond_connection', {
          ip: rebondServerIp,
          username: rebondUsername,
          password: rebondPassword
        })) as string;
        toast({
          title: "Test de connexion",
          description: result
        });
      } else if (bridgeServerAvailable) {
        // Mode bridge - utiliser le serveur local
        const result = await bridgeClient.testConnection(rebondServerIp, rebondUsername, rebondPassword, 'juniper');
        toast({
          title: "Test de connexion",
          description: result.success ? `✓ Connexion réussie vers ${result.data?.hostname || rebondServerIp}` : `✗ ${result.error || 'Test échoué'}`,
          variant: result.success ? "default" : "destructive"
        });
      } else {
        toast({
          title: "Mode simulation",
          description: "Test de connexion Rebond - démarrez le bridge server pour un vrai test"
        });
      }
    } catch (error: any) {
      toast({
        title: "Test échoué",
        description: error.message || 'Erreur lors du test de connexion',
        variant: "destructive"
      });
    }
  };
  const handleConnect = async () => {
    // Validation des champs même en mode simulation
    if (!rebondUsername || !rebondPassword || !switchIp || !switchUsername) {
      toast({
        title: "Erreur de saisie",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    // 1. Mode Desktop (Tauri) - connexion réelle via Tauri
    if (tauriInvoke) {
      // ... keep existing code (desktop mode implementation)
      setIsConnecting(true);
      setConnectionStatus({
        isConnected: false
      });
      setConnectionStep(`Connexion au serveur Rebond ${rebondServerIp}...`);
      try {
        setConnectionStep("📦 Préparation du script Python...");
        const result = (await tauriInvoke('run_rebond_script', {
          rebond_ip: rebondServerIp,
          rebond_username: rebondUsername,
          rebond_password: rebondPassword,
          switch_ip: switchIp,
          switch_username: switchUsername,
          switch_password: switchPassword
        })) as {
          success: boolean;
          message: string;
          configuration?: string;
          hostname?: string;
          execution_logs?: string;
        };
        if (result.success && result.configuration) {
          setConfiguration(result.configuration);
          setExtractedHostname(result.hostname || 'Unknown');
          setExecutionLogs(result.execution_logs || '');
          setConnectionStep("✓ Configuration récupérée avec succès");
          setConnectionStatus({
            isConnected: true
          });
          toast({
            title: "Connexion réussie",
            description: `Configuration du switch ${result.hostname} récupérée`
          });
        } else {
          setExecutionLogs(result.execution_logs || result.message || '');
          throw new Error(result.message || 'Connexion échouée');
        }
      } catch (error: any) {
        setConnectionStep(`❌ ${error.message || 'Erreur de connexion'}`);
        setConnectionStatus({
          isConnected: false,
          error: error.message || 'Erreur de connexion inconnue'
        });
        toast({
          title: "Connexion échouée",
          description: error.message || 'Erreur de connexion',
          variant: "destructive"
        });
      } finally {
        setIsConnecting(false);
      }
      return;
    }

    // 2. Mode Bridge Server - connexion réelle via serveur local
    if (bridgeServerAvailable) {
      setIsConnecting(true);
      setConnectionStatus({
        isConnected: false
      });
      try {
        setConnectionStep("🌉 Connexion via Bridge Server...");
        await new Promise(resolve => setTimeout(resolve, 500));
        setConnectionStep("🔗 Récupération de la configuration...");
        const result = await bridgeClient.getConfiguration(rebondServerIp, rebondUsername, rebondPassword, switchIp, switchUsername, switchPassword);
        if (result.success && result.data) {
          setConfiguration(result.data.configuration);
          setExtractedHostname(result.data.hostname);
          setExecutionLogs(result.data.logs);
          setConnectionStep("✓ Configuration récupérée avec succès via Bridge");
          setConnectionStatus({
            isConnected: true,
            message: "✅ Connexion réussie via Bridge Server"
          });
          toast({
            title: "Connexion réussie",
            description: `Configuration récupérée via Bridge Server`
          });
        } else {
          throw new Error(result.error || 'Récupération échouée');
        }
      } catch (error: any) {
        setConnectionStep(`❌ ${error.message || 'Erreur Bridge'}`);
        setConnectionStatus({
          isConnected: false,
          error: error.message || 'Erreur Bridge Server'
        });
        toast({
          title: "Erreur Bridge",
          description: error.message || 'Erreur Bridge Server',
          variant: "destructive"
        });
      } finally {
        setIsConnecting(false);
      }
      return;
    }

    // 3. Mode Simulation - pas de connexion réelle
    if (!tauriInvoke && !bridgeServerAvailable) {
      setIsConnecting(true);
      setConnectionStatus({
        isConnected: false
      });

      // Simuler les étapes de connexion
      setConnectionStep("🌐 Mode simulation - Connexion au serveur Rebond...");
      await new Promise(resolve => setTimeout(resolve, 1500));
      setConnectionStep("🔑 Simulation - Authentification SSH...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      setConnectionStep("📡 Simulation - Connexion au switch...");
      await new Promise(resolve => setTimeout(resolve, 1500));
      setConnectionStep("📋 Simulation - Récupération de la configuration...");
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Configuration simulée
      const simulatedConfig = `# Configuration simulée pour ${switchIp}
interfaces {
    ge-0/0/1 {
        description "Port d'accès simulé";
        unit 0 {
            family ethernet-switching {
                port-mode access;
                vlan {
                    members default;
                }
            }
        }
    }
    ge-0/0/2 {
        description "Port trunk simulé";
        unit 0 {
            family ethernet-switching {
                port-mode trunk;
                vlan {
                    members [ vlan10 vlan20 ];
                }
            }
        }
    }
}
vlans {
    vlan10 {
        vlan-id 10;
        description "VLAN Production";
    }
    vlan20 {
        vlan-id 20;
        description "VLAN Invités";
    }
}`;
      setConfiguration(simulatedConfig);
      setConnectionStatus({
        isConnected: true,
        message: "✅ Connexion simulée réussie - Utilisez l'app desktop pour une vraie connexion"
      });
      setConnectionStep("");
      setIsConnecting(false);
      toast({
        title: "Mode simulation",
        description: "Configuration simulée générée avec succès"
      });
      return;
    }

    // Validation IP basique
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!rebondUsername || !rebondPassword || !switchIp || !switchUsername) {
      toast({
        title: "Erreur de saisie",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }
    if (!ipPattern.test(switchIp)) {
      toast({
        title: "Erreur IP",
        description: "Format d'adresse IP invalide pour le switch",
        variant: "destructive"
      });
      return;
    }
    setIsConnecting(true);
    setConnectionStatus({
      isConnected: false
    });
    setConnectionStep(`Connexion au serveur Rebond ${rebondServerIp}...`);
    try {
      setConnectionStep("📦 Préparation du script Python...");
      const result = (await tauriInvoke('run_rebond_script', {
        rebond_ip: rebondServerIp,
        rebond_username: rebondUsername,
        rebond_password: rebondPassword,
        switch_ip: switchIp,
        switch_username: switchUsername,
        switch_password: switchPassword
      })) as {
        success: boolean;
        message: string;
        configuration?: string;
        hostname?: string;
        execution_logs?: string;
      };
      if (result.success && result.configuration) {
        setConfiguration(result.configuration);
        setExtractedHostname(result.hostname || 'Unknown');
        setExecutionLogs(result.execution_logs || '');
        setConnectionStep("✓ Configuration récupérée avec succès");
        setConnectionStatus({
          isConnected: true
        });
        toast({
          title: "Connexion réussie",
          description: `Configuration du switch ${result.hostname} récupérée`
        });
      } else {
        setExecutionLogs(result.execution_logs || result.message || '');
        throw new Error(result.message || 'Connexion échouée');
      }
    } catch (error: any) {
      setConnectionStep(`❌ ${error.message || 'Erreur de connexion'}`);
      setConnectionStatus({
        isConnected: false,
        error: error.message || 'Erreur de connexion inconnue'
      });
      toast({
        title: "Connexion échouée",
        description: error.message || 'Erreur de connexion',
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };
  const handleDisconnect = () => {
    setConnectionStatus({
      isConnected: false
    });
    setConfiguration('');
    setExtractedHostname('');
    setConnectionStep('');
    setExecutionLogs('');
    toast({
      title: "Déconnecté",
      description: "Sessions fermées (serveur Rebond et switch)"
    });
  };
  const downloadConfiguration = () => {
    if (!configuration) return;
    const filename = extractedHostname ? `${extractedHostname}.txt` : `switch_${switchIp.replace(/\./g, '_')}.txt`;
    const blob = new Blob([configuration], {
      type: 'text/plain'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Téléchargement",
      description: `Configuration sauvegardée dans ${filename}`
    });
  };

  // Fonctions pour le script externe
  const downloadPythonScript = () => {
    const scriptContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de récupération de configuration via serveur Rebond
Téléchargé depuis l'application Network Management Tools
"""
# Le contenu complet du script est disponible dans public/scripts/rebond_fetch_config.py
`;

    // Télécharger le script depuis le dossier public
    fetch('/scripts/rebond_fetch_config.py').then(response => {
      if (!response.ok) {
        throw new Error('Script non trouvé');
      }
      return response.text();
    }).then(content => {
      const blob = new Blob([content], {
        type: 'text/plain'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rebond_fetch_config.py';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Script téléchargé",
        description: "rebond_fetch_config.py sauvegardé sur votre ordinateur"
      });
    }).catch(error => {
      toast({
        title: "Erreur de téléchargement",
        description: "Impossible de télécharger le script Python",
        variant: "destructive"
      });
    });
  };
  const browseFolderForConfigs = async () => {
    if (!tauriInvoke) {
      toast({
        title: "Fonction desktop uniquement",
        description: "La sélection de dossier nécessite l'application desktop",
        variant: "destructive"
      });
      return;
    }
    try {
      const folderPath = await tauriInvoke('select_folder');
      if (folderPath) {
        setScriptConfigPath(folderPath);
        toast({
          title: "Dossier sélectionné",
          description: `Dossier: ${folderPath}`
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sélectionner le dossier",
        variant: "destructive"
      });
    }
  };
  const listTxtFiles = async () => {
    setIsLoadingConfigs(true);
    try {
      if (tauriInvoke) {
        // Mode desktop - lister les fichiers réels
        const files = (await tauriInvoke('list_txt_files', {
          path: scriptConfigPath
        })) as string[];
        setAvailableConfigs(files);
        toast({
          title: "Fichiers listés",
          description: `${files.length} fichier(s) .txt trouvé(s)`
        });
      } else {
        // Mode web - simulation
        const simulatedFiles = ['SW-192-168-1-10_20241201_143022.txt', 'SW-Core-Main_20241201_142055.txt', 'switch_10_0_1_1_20241201_141230.txt'];
        setAvailableConfigs(simulatedFiles);
        toast({
          title: "Mode simulation",
          description: `${simulatedFiles.length} fichiers simulés affichés`
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de lister les fichiers",
        variant: "destructive"
      });
    } finally {
      setIsLoadingConfigs(false);
    }
  };
  const loadConfigFile = async (filename: string) => {
    if (!filename) return;
    try {
      if (tauriInvoke) {
        // Mode desktop - lire le fichier réel
        const content = (await tauriInvoke('read_txt_file', {
          path: scriptConfigPath,
          filename: filename
        })) as string;
        setConfigFileContent(content);
        setSelectedConfigFile(filename);
        toast({
          title: "Fichier chargé",
          description: `Configuration de ${filename}`
        });
      } else {
        // Mode web - contenu simulé
        const mockContent = `# Configuration récupérée le 2024-12-01 14:30:22
# Switch IP: 192.168.1.10
# Hostname: ${filename.split('_')[0]}
# Commande: show configuration | display set | no-more
# Récupéré via serveur Rebond
#==================================================

set version 20.4R3.8
set system host-name ${filename.split('_')[0]}
set system domain-name company.local
set system time-zone Europe/Paris
set interfaces me0 unit 0 family inet address 192.168.1.10/24
set interfaces ge-0/0/0 unit 0 family ethernet-switching interface-mode access
set vlans default vlan-id 1`;
        setConfigFileContent(mockContent);
        setSelectedConfigFile(filename);
        toast({
          title: "Mode simulation",
          description: `Contenu simulé pour ${filename}`
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de lire le fichier",
        variant: "destructive"
      });
    }
  };
  const handleFileUpload = (content: string, filename: string) => {
    if (!filename.toLowerCase().endsWith('.txt')) {
      toast({
        title: "Format non supporté",
        description: "Seuls les fichiers .txt sont acceptés",
        variant: "destructive"
      });
      return;
    }
    setConfigFileContent(content);
    setSelectedConfigFile(filename);
    toast({
      title: "Fichier importé",
      description: `Configuration de ${filename} importée`
    });
  };
  const isDesktopApp = Boolean((window as any).__TAURI__);
  return <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary">Connexion SSH aux Équipements</h1>
          <p className="text-muted-foreground">
            Connexion via serveur Rebond (6.91.128.111) vers switches réseau
          </p>
        </header>

        {/* Alert d'information sur le mode */}
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={isDesktopApp ? "default" : "secondary"}>
                {isDesktopApp ? '🖥️ Mode Desktop - SSH Réel' : '🌐 Mode Web - Simulation uniquement'}
              </Badge>
            </div>
            <strong>Architecture:</strong> Serveur Rebond (6.91.128.111) → Switch cible<br />
            <strong>Commande exécutée:</strong> show configuration | display set | no-more
            {!isDesktopApp && <>
                <br /><strong>Note:</strong> Pour récupérer de vraies configurations, utilisez l'application desktop avec <code>cargo tauri dev</code>
              </>}
          </AlertDescription>
        </Alert>

        <DesktopCompiler isDesktopApp={isDesktopApp} />

        {/* Bridge Server Local */}
        {!isDesktopApp && <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                Serveur Bridge Local
                <Badge variant={bridgeServerAvailable ? "default" : "destructive"} className="ml-auto">
                  {checkingBridge ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <div className={`h-2 w-2 rounded-full mr-1 ${bridgeServerAvailable ? 'bg-green-500' : 'bg-red-500'}`} />}
                  {bridgeServerAvailable ? 'Online' : 'Offline'}
                </Badge>
              </CardTitle>
              <CardDescription>
                {bridgeServerAvailable ? "Bridge Server actif - Connexions SSH réelles disponibles" : "Démarrez le Bridge Server pour activer les connexions SSH réelles"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!bridgeServerAvailable ? <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-warning" />
                    <strong>Configuration du Bridge Server</strong>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <p><strong>1. Ouvrir un terminal et naviguer vers le dossier du projet</strong></p>
                    <code className="block bg-background p-2 rounded border text-xs font-mono">
                      cd bridge-server
                    </code>
                    
                    <p><strong>2. Installer les dépendances Python</strong></p>
                    <code className="block bg-background p-2 rounded border text-xs font-mono">
                      pip install -r requirements.txt
                    </code>
                    
                    <p><strong>3. Démarrer le serveur bridge</strong></p>
                    <code className="block bg-background p-2 rounded border text-xs font-mono">
                      python bridge_server.py
                    </code>
                    
                    <p className="text-muted-foreground">
                      Le serveur sera accessible sur <strong>http://127.0.0.1:5001</strong>
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={checkBridgeServer} disabled={checkingBridge}>
                      {checkingBridge ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Vérifier
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open('http://127.0.0.1:5001/docs', '_blank')}>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      API Docs
                    </Button>
                  </div>
                </div> : <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <strong>Bridge Server actif</strong>
                  </div>
                  <p className="text-sm text-green-600">
                    Connexions SSH réelles activées via http://127.0.0.1:5001
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" onClick={() => window.open('http://127.0.0.1:5001/docs', '_blank')}>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      API Docs
                    </Button>
                  </div>
                </div>}
            </CardContent>
          </Card>}

        <div className="grid grid-cols-1 gap-6">
          {/* Script externe */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-accent-foreground" />
                Script externe
              </CardTitle>
              <CardDescription>
                Télécharger le script Python et gérer les fichiers de configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {/* Téléchargement du script */}
              <div className="space-y-2">
                <Label>Script Python</Label>
                <Button variant="outline" onClick={downloadPythonScript} className="w-full justify-start gap-2">
                  <Download className="h-4 w-4" />
                  Télécharger rebond_fetch_config.py
                </Button>
                <p className="text-xs text-muted-foreground">
                  Usage: python rebond_fetch_config.py rebond_ip rebond_user rebond_pass switch_ip switch_user switch_pass output_dir
                </p>
              </div>

              {/* Configuration du dossier de sortie */}
              <div className="space-y-2">
                <Label htmlFor="config-path">Dossier des configurations .txt</Label>
                <div className="flex gap-2">
                  <Input id="config-path" value={scriptConfigPath} onChange={e => setScriptConfigPath(e.target.value)} placeholder="C:\Configurations" />
                  {isDesktopApp && <Button variant="outline" size="icon" onClick={browseFolderForConfigs} title="Parcourir...">
                      <FolderOpen className="h-4 w-4" />
                    </Button>}
                </div>
              </div>

              {/* Lister les fichiers .txt */}
              <Button variant="outline" onClick={listTxtFiles} disabled={isLoadingConfigs} className="w-full justify-start gap-2">
                {isLoadingConfigs ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {isLoadingConfigs ? "Chargement..." : "Lister les fichiers .txt"}
              </Button>

              {/* Sélection de fichier */}
              {availableConfigs.length > 0 && <div className="space-y-2">
                  <Label>Fichiers de configuration disponibles</Label>
                  <Select value={selectedConfigFile} onValueChange={loadConfigFile}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un fichier .txt" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableConfigs.map((file, index) => <SelectItem key={index} value={file}>
                          {file}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>}

              {/* Import manuel en mode web */}
              {!isDesktopApp && <div className="space-y-2">
                  
                  <FileUpload onFileRead={handleFileUpload} />
                </div>}

              {/* Affichage du contenu du fichier sélectionné */}
              {configFileContent && <div className="space-y-2">
                  <Label>Contenu de {selectedConfigFile}</Label>
                  <Textarea value={configFileContent} readOnly className="min-h-48 font-mono text-xs bg-muted/50" />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(configFileContent);
                  toast({
                    title: "Copié !",
                    description: "Configuration copiée dans le presse-papiers"
                  });
                }}>
                      Copier
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                  const blob = new Blob([configFileContent], {
                    type: 'text/plain'
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = selectedConfigFile || 'configuration.txt';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}>
                      Télécharger
                    </Button>
                  </div>
                </div>}

              {/* Guide d'installation et d'utilisation locale */}
              <div className="border-t pt-4 mt-6">
                <Collapsible open={isInstallGuideOpen} onOpenChange={setIsInstallGuideOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-muted/50 p-2 rounded transition-colors">
                    {isInstallGuideOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium text-sm">Guide d'installation et d'utilisation locale</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-6 pt-4">
                    {/* Section Exécutable Portable */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        🖥️ Exécutable Portable (Windows)
                      </h4>
                      <div className="bg-muted/30 p-3 rounded-lg space-y-3 text-sm">
                        <div>
                          <h5 className="font-medium mb-2">Prérequis :</h5>
                          <ul className="list-disc ml-4 space-y-1 text-xs">
                            <li>Node.js (https://nodejs.org)</li>
                            <li>Rust : <code>winget install Rustlang.Rustup</code></li>
                            <li>Visual Studio Build Tools</li>
                            <li>WebView2 (pré-installé sur Windows 11)</li>
                          </ul>
                        </div>
                        
                        <div>
                          <h5 className="font-medium mb-2">Étapes de construction :</h5>
                          <div className="space-y-2">
                            {['npm install', 'cargo install tauri-cli --version ^1.5', 'npm run build', '.\\src-tauri\\target\\release\\dot1x-automator.exe'].map((cmd, index) => <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border">
                                <code className="flex-1 text-xs font-mono">{cmd}</code>
                                <Button variant="ghost" size="sm" onClick={() => {
                              navigator.clipboard.writeText(cmd);
                              toast({
                                title: "Copié !",
                                description: "Commande copiée dans le presse-papiers"
                              });
                            }}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
                          <span className="text-xs">✅ Aucune installation requise - Copiez simplement le .exe!</span>
                          <Button variant="ghost" size="sm" onClick={() => window.open('/BUILD-GUIDE.md', '_blank')}>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Section Script Python */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        🐍 Script Python (Windows/Mac/Linux)
                      </h4>
                      <div className="bg-muted/30 p-3 rounded-lg space-y-3 text-sm">
                        <div>
                          <h5 className="font-medium mb-2">Prérequis :</h5>
                          <div className="flex items-center gap-2 p-2 bg-background rounded border">
                            <code className="flex-1 text-xs font-mono">python --version</code>
                            <span className="text-xs text-muted-foreground">(Python 3.6+)</span>
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="font-medium mb-2">Utilisation interactive :</h5>
                          <div className="flex items-center gap-2 p-2 bg-background rounded border">
                            <code className="flex-1 text-xs font-mono">python .\\rebond_fetch_config.py</code>
                            <Button variant="ghost" size="sm" onClick={() => {
                            navigator.clipboard.writeText('python .\\rebond_fetch_config.py');
                            toast({
                              title: "Copié !",
                              description: "Commande copiée dans le presse-papiers"
                            });
                          }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Le script demandera les paramètres interactivement</p>
                        </div>

                        <div>
                          <h5 className="font-medium mb-2">Avec arguments :</h5>
                          {rebondUsername && rebondPassword && switchIp && switchUsername ? <div className="flex items-center gap-2 p-2 bg-background rounded border">
                              <code className="flex-1 text-xs font-mono break-all">
                                python rebond_fetch_config.py {rebondServerIp} "{rebondUsername}" "***" {switchIp} "{switchUsername}" "{switchPassword ? '***' : ''}"
                              </code>
                              <Button variant="ghost" size="sm" onClick={() => {
                            const fullCmd = `python rebond_fetch_config.py ${rebondServerIp} "${rebondUsername}" "${rebondPassword}" ${switchIp} "${switchUsername}" "${switchPassword}"`;
                            navigator.clipboard.writeText(fullCmd);
                            toast({
                              title: "Commande complète copiée !",
                              description: "Commande avec vos paramètres copiée"
                            });
                          }}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div> : <div className="p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded border border-yellow-200 dark:border-yellow-800">
                              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                                ⚠️ Remplissez les champs Rebond et Switch pour générer la commande complète
                              </p>
                            </div>}
                        </div>

                        <div className="space-y-2">
                          <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                              💡 <strong>Important :</strong> sshpass doit être installé sur le serveur Rebond
                            </p>
                          </div>
                          <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
                            <p className="text-xs text-green-800 dark:text-green-200">
                              📁 Le fichier .txt sera sauvé dans le même dossier que le script
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
          </Card>

          {/* Formulaire de connexion */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                Connexion via Serveur Rebond
              </CardTitle>
              <CardDescription>
                Connexion SSH : Serveur Rebond (6.91.128.111) → Switch cible
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-6">
              {/* Section Serveur Rebond */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-secondary-foreground">
                  <div className="w-2 h-2 rounded-full bg-secondary-foreground"></div>
                  Serveur Rebond (IP fixe)
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rebond-ip">Adresse IP</Label>
                    <Input id="rebond-ip" value={rebondServerIp} disabled className="bg-muted" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="rebond-username">Utilisateur *</Label>
                    <Input id="rebond-username" placeholder="Nom d'utilisateur serveur" value={rebondUsername} onChange={e => setRebondUsername(e.target.value)} disabled={connectionStatus.isConnected} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="rebond-password">Mot de passe *</Label>
                    <Input id="rebond-password" type="password" placeholder="Mot de passe serveur Rebond" value={rebondPassword} onChange={e => setRebondPassword(e.target.value)} disabled={connectionStatus.isConnected} />
                  </div>
                </div>
              </div>

              {/* Section Switch */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  Switch Cible
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="switch-ip">Adresse IP *</Label>
                    <Input id="switch-ip" placeholder="192.168.1.10" value={switchIp} onChange={e => setSwitchIp(e.target.value)} disabled={connectionStatus.isConnected} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="switch-username">Utilisateur *</Label>
                    <Input id="switch-username" placeholder="root" value={switchUsername} onChange={e => setSwitchUsername(e.target.value)} disabled={connectionStatus.isConnected} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="switch-password">Mot de passe</Label>
                    <Input id="switch-password" type="password" placeholder="Optionnel si clés SSH" value={switchPassword} onChange={e => setSwitchPassword(e.target.value)} disabled={connectionStatus.isConnected} />
                  </div>
                </div>
              </div>

              {/* Boutons de test */}
              <div className="space-y-2">
                <Button variant="outline" size="sm" onClick={handleTestRebond} className="w-full">
                  Test Connexion
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePing('switch')} className="w-full" disabled={!switchIp}>
                  Ping Switch ({switchIp || 'IP non saisie'})
                </Button>
                
                <Button variant="outline" size="sm" onClick={() => {
                const command = `python rebond_fetch_config.py ${rebondServerIp} "${rebondUsername}" "${rebondPassword}" ${switchIp} "${switchUsername}" "${switchPassword}"`;
                navigator.clipboard.writeText(command);
                toast({
                  title: "Commande copiée",
                  description: "La commande CLI a été copiée dans le presse-papier (le fichier sera sauvé dans le répertoire du script)"
                });
              }} disabled={!rebondUsername || !rebondPassword || !switchIp || !switchUsername} className="w-full">
                  <Copy className="mr-2 h-4 w-4" />
                  Copier la commande CLI
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Prérequis:</strong> sshpass doit être installé sur le serveur Rebond
                </p>
              </div>

              
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Connexion SSH sécurisée via serveur Rebond → show configuration | display set | no-more
                </span>
              </div>
              {isConnecting && connectionStep && <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">{connectionStep}</p>
                </div>}

              <div className="flex gap-2">
                {!connectionStatus.isConnected ? <Button onClick={handleConnect} disabled={isConnecting} className="flex-1">
                    {isConnecting ? "Connexion en cours..." : isDesktopApp ? "Se connecter (Desktop SSH)" : bridgeServerAvailable ? "Se connecter (Bridge SSH)" : "Mode simulation (web)"}
                  </Button> : <Button onClick={handleDisconnect} variant="destructive" className="flex-1">
                    Se déconnecter
                  </Button>}
              </div>

              {connectionStatus.isConnected && <div className="space-y-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                    Rebond: {rebondServerIp}
                  </Badge>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    Switch: {switchIp}
                  </Badge>
                  {extractedHostname && <Badge variant="outline" className="bg-secondary/10 text-secondary-foreground border-secondary/30">
                      Hostname: {extractedHostname}
                    </Badge>}
                </div>}
            </CardContent>
          </Card>

          {/* Mode Multi-Switch */}
          <MultiSwitchBatch
            rebondServerIp={rebondServerIp}
            rebondUsername={rebondUsername}
            rebondPassword={rebondPassword}
            isDesktopApp={isDesktopApp}
            bridgeServerAvailable={bridgeServerAvailable}
          />

          {/* Affichage de la configuration */}
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-secondary-foreground" />
                Configuration du Switch
              </CardTitle>
              <CardDescription>
                Résultat de "show configuration | display set | no-more"
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {configuration ? <div className="space-y-4">
                  <Textarea value={configuration} readOnly className="min-h-96 font-mono text-sm bg-muted/50" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => {
                  navigator.clipboard.writeText(configuration);
                  toast({
                    title: "Copié !",
                    description: "Configuration copiée dans le presse-papiers"
                  });
                }}>
                      Copier la configuration
                    </Button>
                    <Button variant="outline" onClick={downloadConfiguration}>
                      Télécharger ({extractedHostname || 'switch'}.txt)
                    </Button>
                  </div>
                </div> : <div className="text-center py-12 text-muted-foreground">
                  <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{isDesktopApp ? "Connectez-vous pour afficher la configuration" : "Mode web - La configuration réelle n'est disponible qu'en mode desktop"}</p>
                </div>}
            </CardContent>
          </Card>

          {/* Logs d'exécution (mode desktop uniquement) */}
          {isDesktopApp && executionLogs && <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-accent-foreground" />
                  Logs d'exécution Python
                </CardTitle>
                <CardDescription>
                  Sortie détaillée du script rebond_fetch_config.py
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <Textarea value={executionLogs} readOnly className="min-h-64 font-mono text-xs bg-muted/50" />
                <Button variant="outline" size="sm" className="mt-2" onClick={() => {
              navigator.clipboard.writeText(executionLogs);
              toast({
                title: "Copié !",
                description: "Logs copiés dans le presse-papiers"
              });
            }}>
                  Copier les logs
                </Button>
              </CardContent>
            </Card>}

        </div>
      </div>
    </div>;
}