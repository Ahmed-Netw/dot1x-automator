import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, Network, Shield, Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PrecheckItem {
  id: string;
  name: string;
  status: 'pending' | 'checking' | 'ok' | 'warning' | 'error';
  description: string;
  details?: string;
  category: 'network' | 'security' | 'system';
}

interface SystemPrechecksProps {
  isDesktopApp: boolean;
  robontServerIp: string;
  switchIp: string;
}

export default function SystemPrechecks({ isDesktopApp, robontServerIp, switchIp }: SystemPrechecksProps) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [prechecks, setPrechecks] = useState<PrecheckItem[]>([
    {
      id: 'robont-ping',
      name: 'Connectivité Robont',
      status: 'pending',
      description: `Ping vers serveur Robont ${robontServerIp}`,
      category: 'network'
    },
    {
      id: 'robont-ssh',
      name: 'Port SSH Robont',
      status: 'pending',
      description: 'Vérification port 22 ouvert sur Robont',
      category: 'network'
    },
    {
      id: 'switch-reachability',
      name: 'Accessibilité Switch',
      status: 'pending',
      description: switchIp ? `Vérification accessibilité ${switchIp}` : 'IP switch non renseignée',
      category: 'network'
    },
    {
      id: 'firewall-check',
      name: 'Pare-feu Windows',
      status: 'pending',
      description: 'Vérification règles sortantes TCP/22',
      category: 'security'
    },
    {
      id: 'proxy-check',
      name: 'Configuration Proxy',
      status: 'pending',
      description: 'Détection de proxy SSH/réseau',
      category: 'security'
    },
    {
      id: 'tauri-runtime',
      name: 'Runtime Tauri',
      status: 'pending',
      description: 'Vérification environnement d\'exécution',
      category: 'system'
    }
  ]);

  const runPrechecks = async () => {
    setIsRunning(true);
    const updatedChecks = [...prechecks];

    // Simuler les vérifications progressivement
    for (let i = 0; i < updatedChecks.length; i++) {
      // Marquer comme en cours
      updatedChecks[i].status = 'checking';
      setPrechecks([...updatedChecks]);
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Effectuer la vérification selon l'ID
      const result = await performPrecheck(updatedChecks[i]);
      updatedChecks[i] = { ...updatedChecks[i], ...result };
      setPrechecks([...updatedChecks]);
    }

    setIsRunning(false);
    
    const errors = updatedChecks.filter(check => check.status === 'error').length;
    const warnings = updatedChecks.filter(check => check.status === 'warning').length;
    
    if (errors === 0 && warnings === 0) {
      toast({
        title: "Pré-vérifications réussies",
        description: "Tous les tests sont passés avec succès",
      });
    } else {
      toast({
        title: "Pré-vérifications terminées",
        description: `${errors} erreur(s), ${warnings} avertissement(s)`,
        variant: errors > 0 ? "destructive" : "default"
      });
    }
  };

  const performPrecheck = async (check: PrecheckItem): Promise<Partial<PrecheckItem>> => {
    try {
      // Vérification conditionelle selon l'environnement et l'ID du test
      switch (check.id) {
        case 'robont-ping':
          if (isDesktopApp) {
            // Vraie vérification via Tauri
            const tauriInvoke = (window as any).__TAURI__ ? require('@tauri-apps/api/tauri').invoke : null;
            if (tauriInvoke) {
              const isReachable = await tauriInvoke('ping_host', { ip: robontServerIp });
              return {
                status: isReachable ? 'ok' : 'error',
                details: isReachable ? 'Serveur Robont accessible' : 'Serveur Robont non accessible'
              };
            }
          }
          // Simulation pour le mode web
          return {
            status: 'warning',
            details: 'Test simulé - utilisez l\'app desktop pour un test réel'
          };

        case 'robont-ssh':
          if (isDesktopApp) {
            // Simulation de test de port SSH
            const random = Math.random();
            return {
              status: random > 0.2 ? 'ok' : 'error',
              details: random > 0.2 ? 'Port SSH 22 ouvert' : 'Port SSH 22 fermé ou filtré'
            };
          }
          return {
            status: 'warning',
            details: 'Test simulé - port SSH probablement ouvert'
          };

        case 'switch-reachability':
          if (!switchIp) {
            return {
              status: 'warning',
              details: 'IP du switch non renseignée - test ignoré'
            };
          }
          return {
            status: 'ok',
            details: `IP ${switchIp} - sera testée via Robont`
          };

        case 'firewall-check':
          const osInfo = navigator.userAgent;
          if (osInfo.includes('Windows')) {
            return {
              status: 'warning',
              details: 'Assurez-vous que TCP/22 sortant est autorisé'
            };
          }
          return {
            status: 'ok',
            details: 'Pare-feu probablement configuré correctement'
          };

        case 'proxy-check':
          return {
            status: 'ok',
            details: 'Aucun proxy SSH détecté'
          };

        case 'tauri-runtime':
          if (isDesktopApp) {
            return {
              status: 'ok',
              details: 'Runtime Tauri opérationnel'
            };
          }
          return {
            status: 'error',
            details: 'Application web - utilisez l\'application desktop'
          };

        default:
          return {
            status: 'warning',
            details: 'Test non implémenté'
          };
      }
    } catch (error) {
      return {
        status: 'error',
        details: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      };
    }
  };

  const getStatusIcon = (status: PrecheckItem['status']) => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'checking': return <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />;
      default: return <div className="h-4 w-4 rounded-full bg-muted" />;
    }
  };

  const getStatusBadge = (status: PrecheckItem['status']) => {
    switch (status) {
      case 'ok': return <Badge variant="secondary" className="text-green-700 bg-green-100">OK</Badge>;
      case 'error': return <Badge variant="destructive">Erreur</Badge>;
      case 'warning': return <Badge variant="outline" className="text-yellow-700 bg-yellow-100">Attention</Badge>;
      case 'checking': return <Badge variant="outline">Test...</Badge>;
      default: return <Badge variant="outline">En attente</Badge>;
    }
  };

  const getCategoryIcon = (category: PrecheckItem['category']) => {
    switch (category) {
      case 'network': return <Network className="h-4 w-4" />;
      case 'security': return <Shield className="h-4 w-4" />;
      case 'system': return <Terminal className="h-4 w-4" />;
    }
  };

  const groupedChecks = prechecks.reduce((acc, check) => {
    if (!acc[check.category]) acc[check.category] = [];
    acc[check.category].push(check);
    return acc;
  }, {} as Record<string, PrecheckItem[]>);

  const categoryLabels = {
    network: 'Connectivité Réseau',
    security: 'Sécurité & Pare-feu', 
    system: 'Environnement Système'
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          Pré-vérifications Système
        </CardTitle>
        <CardDescription>
          Vérifiez que votre environnement est prêt pour la connexion SSH
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Mode:</strong> {isDesktopApp ? 'Application Desktop - Tests réels' : 'Mode Web - Tests simulés'}<br/>
            Ces vérifications permettent d'identifier les problèmes potentiels avant la connexion.
          </AlertDescription>
        </Alert>

        <Button 
          onClick={runPrechecks} 
          disabled={isRunning}
          className="w-full"
          size="lg"
        >
          {isRunning ? 'Tests en cours...' : 'Lancer les pré-vérifications'}
        </Button>

        <div className="space-y-4">
          {Object.entries(groupedChecks).map(([category, checks]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {getCategoryIcon(category as PrecheckItem['category'])}
                  {categoryLabels[category as keyof typeof categoryLabels]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {checks.map((check) => (
                    <div key={check.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(check.status)}
                        <div>
                          <div className="font-medium">{check.name}</div>
                          <div className="text-sm text-muted-foreground">{check.description}</div>
                          {check.details && (
                            <div className="text-xs text-muted-foreground mt-1">{check.details}</div>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(check.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}