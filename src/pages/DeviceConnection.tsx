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
  const [ipAddress, setIpAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [configuration, setConfiguration] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ isConnected: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    if (!ipAddress || !username || !password) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);
    
    // Simulation de connexion SSH (impossible en réalité dans le navigateur)
    setTimeout(() => {
      // Simulation d'une configuration de switch
      const mockConfig = `# Simulation de configuration Juniper
# =====================================
# ATTENTION: Ceci est une simulation
# Une vraie connexion SSH nécessite un backend
# =====================================

version 20.4R3.8;
system {
    host-name ${ipAddress.replace(/\./g, '-')}-switch;
    root-authentication {
        encrypted-password "******************";
    }
    login {
        user ${username} {
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
      
      toast({
        title: "Connexion simulée",
        description: "Configuration récupérée (simulation)",
      });
    }, 2000);
  };

  const handleDisconnect = () => {
    setConnectionStatus({ isConnected: false });
    setConfiguration('');
    toast({
      title: "Déconnecté",
      description: "Session terminée",
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
            <strong>Important:</strong> Cette interface est une simulation. Une vraie connexion SSH nécessite 
            un backend sécurisé car les navigateurs web ne peuvent pas établir de connexions SSH directes.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulaire de connexion */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-tech-primary" />
                Connexion SSH
              </CardTitle>
              <CardDescription>
                Connectez-vous à votre équipement réseau
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ip">Adresse IP</Label>
                <Input
                  id="ip"
                  placeholder="192.168.1.1"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  disabled={connectionStatus.isConnected}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Nom d'utilisateur</Label>
                <Input
                  id="username"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={connectionStatus.isConnected}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={connectionStatus.isConnected}
                />
              </div>

              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Connexion sécurisée SSH (simulation)
                </span>
              </div>

              <div className="flex gap-2">
                {!connectionStatus.isConnected ? (
                  <Button 
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="flex-1"
                  >
                    {isConnecting ? "Connexion..." : "Se connecter"}
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
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-tech-success/10 text-tech-success border-tech-success/30">
                    Connecté à {ipAddress}
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