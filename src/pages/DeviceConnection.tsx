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
  // Serveur rebond
  const [jumpServerIp, setJumpServerIp] = useState('');
  const [jumpUsername, setJumpUsername] = useState('');
  const [jumpPassword, setJumpPassword] = useState('');
  
  // Switch cible
  const [switchIp, setSwitchIp] = useState('');
  const [switchUsername, setSwitchUsername] = useState('');
  const [switchPassword, setSwitchPassword] = useState('');
  
  const [configuration, setConfiguration] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ isConnected: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStep, setConnectionStep] = useState<string>('');
  const { toast } = useToast();

  const handleConnect = async () => {
    if (!jumpServerIp || !jumpUsername || !jumpPassword || !switchIp || !switchUsername || !switchPassword) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs (serveur rebond et switch)",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);
    
    // Simulation du processus de connexion en 2 étapes
    setConnectionStep("Connexion au serveur rebond...");
    
    setTimeout(() => {
      setConnectionStep(`Connecté à ${jumpServerIp} - Connexion au switch...`);
      setTimeout(() => {
        setConnectionStep(`Exécution de 'show configuration' sur ${switchIp}...`);
        
        setTimeout(() => {
          // Simulation d'une configuration de switch
          const mockConfig = `# Configuration récupérée via serveur rebond
# =============================================
# Serveur rebond: ${jumpServerIp} (utilisateur: ${jumpUsername})
# Switch cible: ${switchIp} (utilisateur: ${switchUsername})
# =============================================
# ATTENTION: Ceci est une simulation
# Une vraie connexion SSH nécessite un backend
# =============================================

version 20.4R3.8;
system {
    host-name ${switchIp.replace(/\./g, '-')}-switch;
    root-authentication {
        encrypted-password "******************";
    }
    login {
        user ${switchUsername} {
            uid 2000;
            class super-user;
            authentication {
                encrypted-password "******************";
            }
        }
    }
    services {
        ssh;
        netconf {
            ssh;
        }
    }
}
interfaces {
    ge-0/0/0 {
        unit 0 {
            family ethernet-switching {
                interface-mode access;
                vlan {
                    members 10;
                }
            }
        }
    }
    ge-0/0/1 {
        unit 0 {
            family ethernet-switching {
                interface-mode access;
                vlan {
                    members 20;
                }
            }
        }
    }
    vlan {
        unit 10 {
            family inet {
                address 192.168.10.1/24;
            }
        }
    }
}
vlans {
    vlan-10 {
        vlan-id 10;
        l3-interface vlan.10;
    }
    vlan-20 {
        vlan-id 20;
    }
}`;

          setConfiguration(mockConfig);
          setConnectionStatus({ isConnected: true });
          setIsConnecting(false);
          setConnectionStep('');
          
          toast({
            title: "Connexion réussie",
            description: `Connecté à ${switchIp} via ${jumpServerIp}`,
          });
        }, 1500);
      }, 2000);
    }, 1500);
  };

  const handleDisconnect = () => {
    setConnectionStatus({ isConnected: false });
    setConfiguration('');
    setConnectionStep('');
    toast({
      title: "Déconnecté",
      description: "Sessions fermées (serveur rebond et switch)",
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-tech-primary">Connexion SSH aux Équipements</h1>
          <p className="text-muted-foreground">
            Interface de connexion aux switches et routeurs
          </p>
        </header>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Architecture de connexion:</strong> Serveur rebond → Switch cible<br/>
            <strong>Note technique:</strong> Cette interface simule la connexion SSH en 2 étapes. 
            Une implémentation réelle nécessiterait un backend pour gérer les connexions SSH en cascade.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulaire de connexion */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-tech-primary" />
                Connexion via Serveur Rebond
              </CardTitle>
              <CardDescription>
                Connexion SSH : Serveur rebond → Switch cible
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Section Serveur Rebond */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-tech-secondary">
                  <div className="w-2 h-2 rounded-full bg-tech-secondary"></div>
                  Serveur Rebond (Jump Server)
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jump-ip">Adresse IP</Label>
                    <Input
                      id="jump-ip"
                      placeholder="10.0.0.1"
                      value={jumpServerIp}
                      onChange={(e) => setJumpServerIp(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="jump-username">Utilisateur</Label>
                    <Input
                      id="jump-username"
                      placeholder="admin"
                      value={jumpUsername}
                      onChange={(e) => setJumpUsername(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="jump-password">Mot de passe</Label>
                    <Input
                      id="jump-password"
                      type="password"
                      value={jumpPassword}
                      onChange={(e) => setJumpPassword(e.target.value)}
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
                    <Label htmlFor="switch-ip">Adresse IP</Label>
                    <Input
                      id="switch-ip"
                      placeholder="192.168.1.10"
                      value={switchIp}
                      onChange={(e) => setSwitchIp(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="switch-username">Utilisateur</Label>
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
                  Connexion SSH sécurisée via serveur rebond
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
                    Serveur rebond: {jumpServerIp}
                  </Badge>
                  <Badge variant="outline" className="bg-tech-primary/10 text-tech-primary border-tech-primary/30">
                    Switch: {switchIp}
                  </Badge>
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
                Résultat de la commande "show configuration"
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
                  <Button 
                    variant="outline" 
                    className="w-full"
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