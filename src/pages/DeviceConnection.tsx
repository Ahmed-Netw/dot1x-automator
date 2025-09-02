import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Terminal, Network, Lock, AlertTriangle, HelpCircle, Settings, CheckCircle2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DesktopCompiler from '@/components/DesktopCompiler';
import PrerequisitesWizard from '@/components/PrerequisitesWizard';
import SystemPrechecks from '@/components/SystemPrechecks';
import HelpSection from '@/components/HelpSection';
import DetailedLogger from '@/components/DetailedLogger';

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
}

export default function DeviceConnection() {
  // Serveur robont (IP fixe selon le script)
  const [robontServerIp] = useState('6.91.128.111');
  const [robontUsername, setRobontUsername] = useState('');
  const [robontPassword, setRobontPassword] = useState('');
  
  // Switch cible
  const [switchIp, setSwitchIp] = useState('');
  const [switchUsername, setSwitchUsername] = useState('');
  const [switchPassword, setSwitchPassword] = useState('');
  
  const [configuration, setConfiguration] = useState('');
  const [extractedHostname, setExtractedHostname] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ isConnected: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStep, setConnectionStep] = useState<string>('');
  const { toast } = useToast();
  
  // États pour les nouveaux composants
  const [showPrerequisitesWizard, setShowPrerequisitesWizard] = useState(false);
  const [showHelpSection, setShowHelpSection] = useState(false);
  const [showDetailedLogger, setShowDetailedLogger] = useState(false);

  // Fonction pour extraire le hostname de la configuration
  const extractHostname = (configData: string): string => {
    const patterns = [
      /set system host-name\s+(\S+)/i,
      /set hostname\s+(\S+)/i,
      /hostname\s+(\S+)/i,
      /host-name\s+(\S+)/i
    ];

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
# Serveur Robont: ${robontServerIp}
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

  const handlePing = async (target: 'robont' | 'switch') => {
    const ip = target === 'robont' ? robontServerIp : switchIp;
    
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
        const isReachable = await tauriInvoke('ping_host', { ip }) as boolean;
        toast({
          title: `Ping ${target}`,
          description: isReachable ? 
            `✓ ${ip} est accessible (port 22 ouvert)` : 
            `✗ ${ip} n'est pas accessible`,
          variant: isReachable ? "default" : "destructive"
        });
      } else {
        // Mode web - simulation basique
        toast({
          title: "Mode simulation",
          description: `Ping vers ${ip} - utilisez l'app desktop pour un vrai test`,
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

  const handleTestRobont = async () => {
    if (!robontUsername || !robontPassword) {
      toast({
        title: "Champs manquants",
        description: "Veuillez saisir les identifiants du serveur Robont",
        variant: "destructive"
      });
      return;
    }

    try {
      if (tauriInvoke) {
        const result = await tauriInvoke('test_robont_connection', {
          ip: robontServerIp,
          username: robontUsername,
          password: robontPassword
        }) as string;
        
        toast({
          title: "Test de connexion",
          description: result,
        });
      } else {
        toast({
          title: "Mode simulation",
          description: "Test de connexion Robont - utilisez l'app desktop pour un vrai test",
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
    // Validation IP basique
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    if (!robontUsername || !robontPassword || !switchIp || !switchUsername) {
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
    setConnectionStatus({ isConnected: false });
    setConnectionStep(`Connexion au serveur Robont ${robontServerIp}...`);

    try {
      // Essayer d'utiliser Tauri si disponible, sinon mode simulation
      if (tauriInvoke) {
        const result = await tauriInvoke('connect_to_device', {
          credentials: {
            robont_ip: robontServerIp,
            robont_username: robontUsername,
            robont_password: robontPassword,
            switch_ip: switchIp,
            switch_username: switchUsername,
            switch_password: switchPassword,
          }
        }) as { success: boolean; message: string; configuration?: string; hostname?: string };

        if (result.success && result.configuration) {
          setConfiguration(result.configuration);
          setExtractedHostname(result.hostname || 'Unknown');
          setConnectionStep("✓ Configuration récupérée avec succès");
          setConnectionStatus({ isConnected: true });
          
          toast({
            title: "Connexion réussie",
            description: `Configuration du switch ${result.hostname} récupérée`,
          });
        } else {
          throw new Error(result.message || 'Connexion échouée');
        }
      } else {
        // Mode simulation pour le navigateur web
        setConnectionStep("✓ Connexion établie avec le serveur Robont");
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setConnectionStep(`Connexion SSH au switch ${switchIp}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setConnectionStep("✓ Connexion au switch réussie");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setConnectionStep("Exécution: show configuration | display set | no-more");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Générer la configuration simulée
        const mockConfig = generateMockConfiguration(switchIp);
        const hostname = extractHostname(mockConfig);
        
        setConfiguration(mockConfig);
        setExtractedHostname(hostname);
        setConnectionStep("✓ Configuration récupérée avec succès");
        setConnectionStatus({ isConnected: true });
        
        toast({
          title: "Connexion simulée réussie",
          description: `Configuration du switch ${hostname} récupérée`,
        });
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
    setConnectionStatus({ isConnected: false });
    setConfiguration('');
    setExtractedHostname('');
    setConnectionStep('');
    toast({
      title: "Déconnecté",
      description: "Sessions fermées (serveur Robont et switch)",
    });
  };

  const downloadConfiguration = () => {
    if (!configuration) return;

    const filename = extractedHostname ? `${extractedHostname}.txt` : `switch_${switchIp.replace(/\./g, '_')}.txt`;
    const blob = new Blob([configuration], { type: 'text/plain' });
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
      description: `Configuration sauvegardée dans ${filename}`,
    });
  };

  const isDesktopApp = Boolean((window as any).__TAURI__);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary">Connexion SSH aux Équipements</h1>
          <p className="text-muted-foreground">
            Connexion via serveur Robont (6.91.128.111) vers switches réseau
          </p>
        </header>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Mode:</strong> {isDesktopApp ? 'Application Desktop Native - SSH Réel' : 'Application Web - Mode Simulation'}<br/>
            <strong>Architecture:</strong> Serveur Robont (6.91.128.111) → Switch cible<br/>
            <strong>Commande exécutée:</strong> show configuration | display set | no-more
          </AlertDescription>
        </Alert>

        <DesktopCompiler isDesktopApp={isDesktopApp} />

        {/* Boutons d'assistance */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Button 
            variant="outline" 
            onClick={() => setShowPrerequisitesWizard(true)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Assistant d'Installation
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => setShowHelpSection(true)}
            className="flex items-center gap-2"
          >
            <HelpCircle className="h-4 w-4" />
            Centre d'Aide
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => setShowDetailedLogger(!showDetailedLogger)}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Journal d'Activité
          </Button>
        </div>

        {/* Journal d'activité détaillé */}
        {showDetailedLogger && (
          <DetailedLogger 
            isVisible={showDetailedLogger}
            onToggle={() => setShowDetailedLogger(!showDetailedLogger)}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Composant de pré-vérifications */}
          <SystemPrechecks 
            isDesktopApp={isDesktopApp}
            robontServerIp={robontServerIp}
            switchIp={switchIp}
          />
          {/* Formulaire de connexion */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                Connexion via Serveur Robont
              </CardTitle>
              <CardDescription>
                Connexion SSH : Serveur Robont (6.91.128.111) → Switch cible
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Section Serveur Robont */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-secondary-foreground">
                  <div className="w-2 h-2 rounded-full bg-secondary-foreground"></div>
                  Serveur Robont (IP fixe)
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="robont-ip">Adresse IP</Label>
                    <Input
                      id="robont-ip"
                      value={robontServerIp}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="robont-username">Utilisateur *</Label>
                    <Input
                      id="robont-username"
                      placeholder="Nom d'utilisateur serveur"
                      value={robontUsername}
                      onChange={(e) => setRobontUsername(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="robont-password">Mot de passe *</Label>
                    <Input
                      id="robont-password"
                      type="password"
                      placeholder="Mot de passe serveur Robont"
                      value={robontPassword}
                      onChange={(e) => setRobontPassword(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
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
                    <Input
                      id="switch-ip"
                      placeholder="192.168.1.10"
                      value={switchIp}
                      onChange={(e) => setSwitchIp(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="switch-username">Utilisateur *</Label>
                    <Input
                      id="switch-username"
                      placeholder="root"
                      value={switchUsername}
                      onChange={(e) => setSwitchUsername(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="switch-password">Mot de passe</Label>
                    <Input
                      id="switch-password"
                      type="password"
                      placeholder="Optionnel si clés SSH"
                      value={switchPassword}
                      onChange={(e) => setSwitchPassword(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
                  </div>
                </div>
              </div>

              {/* Boutons de test */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handlePing('robont')}
                    className="flex-1"
                  >
                    Ping Robont
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleTestRobont}
                    className="flex-1"
                  >
                    Test Connexion
                  </Button>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handlePing('switch')}
                  className="w-full"
                  disabled={!switchIp}
                >
                  Ping Switch ({switchIp || 'IP non saisie'})
                </Button>
              </div>

              
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Connexion SSH sécurisée via serveur Robont → show configuration | display set | no-more
                </span>
              </div>
              {isConnecting && connectionStep && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">{connectionStep}</p>
                </div>
              )}

              <div className="flex gap-2">
                {!connectionStatus.isConnected ? (
                  <Button 
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="flex-1"
                  >
                    {isConnecting ? "Connexion en cours..." : "Se connecter"}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleDisconnect}
                    variant="destructive"
                    className="flex-1"
                  >
                    Se déconnecter
                  </Button>
                )}
              </div>

              {connectionStatus.isConnected && (
                <div className="space-y-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                    Robont: {robontServerIp}
                  </Badge>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    Switch: {switchIp}
                  </Badge>
                  {extractedHostname && (
                    <Badge variant="outline" className="bg-secondary/10 text-secondary-foreground border-secondary/30">
                      Hostname: {extractedHostname}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Affichage de la configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-secondary-foreground" />
                Configuration du Switch
              </CardTitle>
              <CardDescription>
                Résultat de "show configuration | display set | no-more"
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configuration ? (
                <div className="space-y-4">
                  <Textarea
                    value={configuration}
                    readOnly
                    className="min-h-96 font-mono text-sm bg-muted/50"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(configuration);
                        toast({
                          title: "Copié !",
                          description: "Configuration copiée dans le presse-papiers",
                        });
                      }}
                    >
                      Copier la configuration
                    </Button>
                    <Button
                      variant="outline"
                      onClick={downloadConfiguration}
                    >
                      Télécharger ({extractedHostname || 'switch'}.txt)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Connectez-vous pour afficher la configuration</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modales */}
        {showPrerequisitesWizard && (
          <PrerequisitesWizard
            isDesktopApp={isDesktopApp}
            onClose={() => setShowPrerequisitesWizard(false)}
          />
        )}
        
        {showHelpSection && (
          <HelpSection
            onClose={() => setShowHelpSection(false)}
          />
        )}
      </div>
    </div>
  );
}