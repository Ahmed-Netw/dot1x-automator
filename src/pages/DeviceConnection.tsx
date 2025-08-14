import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Terminal, Network, Lock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
    
    // Étape 1: Connexion au serveur Robont
    setConnectionStep(`Connexion au serveur Robont ${robontServerIp}...`);
    
    setTimeout(() => {
      setConnectionStep("✓ Connexion établie avec le serveur Robont - Création du shell interactif...");
      
      setTimeout(() => {
        setConnectionStep(`Shell initialisé - Connexion SSH au switch ${switchIp}...`);
        
        setTimeout(() => {
          setConnectionStep("✓ Connexion au switch réussie - Entrée en mode CLI...");
          
          setTimeout(() => {
            setConnectionStep("Exécution: show configuration | display set | no-more");
            
            setTimeout(() => {
              // Configuration complète et réaliste basée sur le script Python
              const hostname = `SW-${switchIp.replace(/\./g, '-')}`;
              const timestamp = new Date().toLocaleString('fr-FR');
              
              const mockConfig = `# Configuration récupérée le ${timestamp}
# Serveur Robont: ${robontServerIp}
# Switch IP: ${switchIp}
# Switch Hostname: ${hostname}
# Commande: show configuration | display set | no-more
#==================================================

set version 20.4R3.8
set system host-name ${hostname}
set system root-authentication encrypted-password "$6$randomhash$encrypted"
set system login user ${switchUsername} uid 2000
set system login user ${switchUsername} class super-user
set system login user ${switchUsername} authentication encrypted-password "$6$userhash$encrypted"
set system services ssh
set system services netconf ssh
set system services web-management http interface ge-0/0/0.0
set system services dhcp-local-server dhcpv6 group jdhcp-group interface ge-0/0/0.0
set system syslog user * any emergency
set system syslog file messages any notice
set system syslog file messages authorization info
set system syslog file interactive-commands interactive-commands any
set system archival configuration transfer-on-commit
set system archival configuration archive-sites "scp://user@backup-server/configs/"
set system ntp server 0.pool.ntp.org
set system ntp server 1.pool.ntp.org
set system ntp source-address ${switchIp}

set chassis aggregated-devices ethernet device-count 8
set chassis alarm management-ethernet link-down ignore
set chassis auto-image-upgrade

set interfaces ge-0/0/0 description "Access Port - VLAN 10"
set interfaces ge-0/0/0 unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/0 unit 0 family ethernet-switching vlan members vlan-10
set interfaces ge-0/0/0 unit 0 family ethernet-switching storm-control default
set interfaces ge-0/0/1 description "Access Port - VLAN 20"
set interfaces ge-0/0/1 unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/1 unit 0 family ethernet-switching vlan members vlan-20
set interfaces ge-0/0/1 unit 0 family ethernet-switching storm-control default
set interfaces ge-0/0/2 description "Trunk Port - All VLANs"
set interfaces ge-0/0/2 unit 0 family ethernet-switching interface-mode trunk
set interfaces ge-0/0/2 unit 0 family ethernet-switching vlan members [vlan-10 vlan-20 vlan-30]
set interfaces ge-0/0/3 description "Uplink to Core Switch"
set interfaces ge-0/0/3 unit 0 family ethernet-switching interface-mode trunk
set interfaces ge-0/0/3 unit 0 family ethernet-switching vlan members all
set interfaces ge-0/0/4 disable
set interfaces ge-0/0/5 disable
set interfaces ge-0/0/6 disable
set interfaces ge-0/0/7 disable
set interfaces ge-0/0/8 description "Management Access"
set interfaces ge-0/0/8 unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/8 unit 0 family ethernet-switching vlan members mgmt-vlan
set interfaces vlan unit 10 description "User VLAN"
set interfaces vlan unit 10 family inet address 192.168.10.1/24
set interfaces vlan unit 20 description "Guest VLAN"
set interfaces vlan unit 20 family inet address 192.168.20.1/24
set interfaces vlan unit 30 description "Server VLAN"
set interfaces vlan unit 30 family inet address 192.168.30.1/24
set interfaces vlan unit 100 description "Management VLAN"
set interfaces vlan unit 100 family inet address 10.148.62.${switchIp.split('.')[3]}/24
set interfaces me0 unit 0 family inet address ${switchIp}/24
set interfaces me0 unit 0 family inet address ${switchIp}/24 primary

set snmp description "${hostname} - Juniper Switch"
set snmp location "Data Center - Rack A12"
set snmp contact "admin@company.com"
set snmp community public authorization read-only
set snmp community private authorization read-write
set snmp trap-options source-address ${switchIp}

set vlans vlan-10 description "User Network"
set vlans vlan-10 vlan-id 10
set vlans vlan-10 l3-interface vlan.10
set vlans vlan-20 description "Guest Network"
set vlans vlan-20 vlan-id 20
set vlans vlan-20 l3-interface vlan.20
set vlans vlan-30 description "Server Network"
set vlans vlan-30 vlan-id 30
set vlans vlan-30 l3-interface vlan.30
set vlans mgmt-vlan description "Management Network"
set vlans mgmt-vlan vlan-id 100
set vlans mgmt-vlan l3-interface vlan.100

set protocols igmp-snooping vlan vlan-10
set protocols igmp-snooping vlan vlan-20
set protocols igmp-snooping vlan vlan-30
set protocols lldp interface all
set protocols lldp-med interface all

set ethernet-switching-options storm-control interface all
set ethernet-switching-options bpdu-block interface all
set ethernet-switching-options secure-access-port interface ge-0/0/0.0 dhcp-trusted
set ethernet-switching-options secure-access-port interface ge-0/0/1.0 dhcp-trusted

set security zones security-zone trust host-inbound-traffic system-services all
set security zones security-zone trust host-inbound-traffic protocols all
set security zones security-zone trust interfaces vlan.10
set security zones security-zone trust interfaces vlan.20
set security zones security-zone trust interfaces vlan.30
set security zones security-zone trust interfaces vlan.100

set routing-options static route 0.0.0.0/0 next-hop 192.168.1.1
set routing-options router-id ${switchIp}

set poe interface all
set poe management class 0
set poe management class 1
set poe management class 2
set poe management class 3

set forwarding-options storm-control-profiles default all
set forwarding-options dhcp-relay server-group dhcp-servers 192.168.1.10
set forwarding-options dhcp-relay server-group dhcp-servers 192.168.1.11
set forwarding-options dhcp-relay active-server-group dhcp-servers
set forwarding-options dhcp-relay group relay-group interface vlan.10
set forwarding-options dhcp-relay group relay-group interface vlan.20

set event-options policy link-down events snmp_trap_link_down
set event-options policy link-down then execute-commands commands "show interfaces terse"
set event-options policy link-down then execute-commands output-filename /var/log/link-events

set access radius-server 192.168.1.100 port 1812
set access radius-server 192.168.1.100 secret "$9$PTQnhclvMX-VwgJDjqmfz/AtO"
set access radius-server 192.168.1.100 source-address ${switchIp}
set access radius-server 192.168.1.101 port 1812
set access radius-server 192.168.1.101 secret "$9$PTQnhclvMX-VwgJDjqmfz/AtO"
set access radius-server 192.168.1.101 source-address ${switchIp}`;
              
              // Utiliser ConfigurationParser pour extraire le hostname proprement
              const extractedHostnameFromConfig = extractHostname(mockConfig);

              setConfiguration(mockConfig);
              setExtractedHostname(extractedHostnameFromConfig);
              setConnectionStatus({ isConnected: true });
              setIsConnecting(false);
              setConnectionStep('');
              
              toast({
                title: "Configuration complète récupérée",
                description: `✓ Hostname: ${extractedHostnameFromConfig} - Fichier prêt pour téléchargement`,
                duration: 5000
              });
            }, 4000);
          }, 1500);
        }, 2000);
      }, 1500);
    }, 1000);
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-tech-primary">Connexion SSH aux Équipements</h1>
          <p className="text-muted-foreground">
            Connexion via serveur Robont (6.91.128.111) vers switches réseau
          </p>
        </header>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Architecture:</strong> Serveur Robont (6.91.128.111) → Switch cible<br/>
            <strong>Commande exécutée:</strong> show configuration | display set | no-more<br/>
            <strong>Note:</strong> Cette interface simule le processus de connexion SSH en cascade.
            Une implémentation réelle nécessiterait un backend avec paramiko.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulaire de connexion */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-tech-primary" />
                Connexion via Serveur Robont
              </CardTitle>
              <CardDescription>
                Connexion SSH : Serveur Robont (6.91.128.111) → Switch cible
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Section Serveur Robont */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-tech-secondary">
                  <div className="w-2 h-2 rounded-full bg-tech-secondary"></div>
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
                <div className="flex items-center gap-2 text-sm font-medium text-tech-primary">
                  <div className="w-2 h-2 rounded-full bg-tech-primary"></div>
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

              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Connexion SSH sécurisée via serveur Robont → show configuration | display set | no-more
                </span>
              </div>

              {/* Statut de connexion */}
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
                  <Badge variant="outline" className="bg-tech-success/10 text-tech-success border-tech-success/30">
                    Robont: {robontServerIp}
                  </Badge>
                  <Badge variant="outline" className="bg-tech-primary/10 text-tech-primary border-tech-primary/30">
                    Switch: {switchIp}
                  </Badge>
                  {extractedHostname && (
                    <Badge variant="outline" className="bg-tech-secondary/10 text-tech-secondary border-tech-secondary/30">
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
                <Terminal className="h-5 w-5 text-tech-secondary" />
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
                    className="min-h-96 font-mono text-sm bg-code-bg text-code-text"
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
      </div>
    </div>
  );
}