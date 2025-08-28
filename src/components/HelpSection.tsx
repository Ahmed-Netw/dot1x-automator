import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HelpCircle, Download, ExternalLink, Terminal, Network, Shield, Wrench, AlertTriangle } from 'lucide-react';

interface HelpSectionProps {
  onClose: () => void;
}

export default function HelpSection({ onClose }: HelpSectionProps) {
  const troubleshootingSteps = [
    {
      issue: 'Connexion SSH échouée',
      solutions: [
        'Vérifier la connectivité réseau vers 6.91.128.111',
        'Valider les credentials du serveur Robont',
        'S\'assurer que le port 22 est ouvert',
        'Désactiver temporairement le proxy SSH'
      ]
    },
    {
      issue: 'Switch non accessible',
      solutions: [
        'Vérifier que le switch est accessible depuis Robont',
        'Valider les credentials du switch cible',
        'S\'assurer que SSH est activé sur le switch',
        'Vérifier la configuration réseau du switch'
      ]
    },
    {
      issue: 'Erreur de compilation',
      solutions: [
        'Installer les dépendances Rust : `rustup update`',
        'Installer Tauri CLI : `cargo install tauri-cli --version ^1.0`',
        'Vérifier les permissions d\'exécution',
        'Nettoyer et rebuilder : `cargo clean && cargo tauri build`'
      ]
    }
  ];

  const platformInstructions = {
    windows: {
      prerequisites: [
        'Node.js 18+ depuis nodejs.org',
        'Rust via rustup.rs',
        'Visual Studio Build Tools 2022',
        'WebView2 Runtime (généralement déjà installé)'
      ],
      commands: [
        'cd C:\\chemin\\vers\\votre\\projet',
        'npm install',
        'cargo tauri build',
        '.\\src-tauri\\target\\release\\dot1x-automator.exe'
      ]
    },
    linux: {
      prerequisites: [
        'Node.js 18+ : `sudo apt install nodejs npm`',
        'Rust : `curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh`',
        'Build essentials : `sudo apt install build-essential`',
        'WebkitGTK : `sudo apt install libwebkit2gtk-4.0-dev`'
      ],
      commands: [
        'cd /chemin/vers/votre/projet',
        'npm install',
        'cargo tauri build',
        './src-tauri/target/release/dot1x-automator'
      ]
    },
    macos: {
      prerequisites: [
        'Node.js 18+ via Homebrew : `brew install node`',
        'Rust : `curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh`',
        'Xcode Command Line Tools : `xcode-select --install`'
      ],
      commands: [
        'cd /chemin/vers/votre/projet',
        'npm install',
        'cargo tauri build',
        './src-tauri/target/release/dot1x-automator'
      ]
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Centre d'Aide & Documentation
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
          </CardTitle>
          <CardDescription>
            Documentation complète pour l'installation et l'utilisation de l'application
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="installation">Installation</TabsTrigger>
              <TabsTrigger value="usage">Utilisation</TabsTrigger>
              <TabsTrigger value="troubleshooting">Dépannage</TabsTrigger>
              <TabsTrigger value="security">Sécurité</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Alert>
                <Network className="h-4 w-4" />
                <AlertDescription>
                  <strong>Architecture de connexion :</strong><br/>
                  Application Desktop → Serveur Robont (6.91.128.111) → Switch Cible<br/>
                  <strong>Commande exécutée :</strong> show configuration | display set | no-more
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Terminal className="h-4 w-4" />
                      Application Desktop
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• <strong>SSH natif</strong> - Vraies connexions SSH</li>
                      <li>• <strong>Sécurité</strong> - Pas de transit par des serveurs tiers</li>
                      <li>• <strong>Performance</strong> - Exécution native, plus rapide</li>
                      <li>• <strong>Hors ligne</strong> - Fonctionne sans internet</li>
                      <li>• <strong>Portable</strong> - Exécutable unique</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Network className="h-4 w-4" />
                      Prérequis Réseau
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• <strong>Accès TCP/22</strong> vers 6.91.128.111</li>
                      <li>• <strong>Credentials Robont</strong> valides</li>
                      <li>• <strong>Credentials Switch</strong> avec droits config</li>
                      <li>• <strong>Pas de proxy SSH</strong> intermédiaire</li>
                      <li>• <strong>Pare-feu</strong> autorisant SSH sortant</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="installation" className="space-y-4">
              <Tabs defaultValue="windows" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="windows">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
                      Windows
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="linux">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-500 rounded-sm"></div>
                      Linux
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="macos">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-800 rounded-sm"></div>
                      macOS
                    </div>
                  </TabsTrigger>
                </TabsList>

                {Object.entries(platformInstructions).map(([platform, instructions]) => (
                  <TabsContent key={platform} value={platform} className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Prérequis pour {platform === 'windows' ? 'Windows' : platform === 'linux' ? 'Linux' : 'macOS'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ol className="space-y-2">
                          {instructions.prerequisites.map((prereq, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <Badge variant="outline" className="min-w-fit">
                                {index + 1}
                              </Badge>
                              <span className="text-sm">{prereq}</span>
                            </li>
                          ))}
                        </ol>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Terminal className="h-4 w-4" />
                          Commandes de compilation
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {instructions.commands.map((command, index) => (
                            <div key={index} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{index + 1}</Badge>
                                <span className="text-sm font-medium">
                                  {index === 0 ? 'Navigation' : 
                                   index === 1 ? 'Installation' :
                                   index === 2 ? 'Compilation' : 'Exécution'}
                                </span>
                              </div>
                              <code className="block bg-muted p-2 rounded text-sm">
                                {command}
                              </code>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            </TabsContent>

            <TabsContent value="usage" className="space-y-4">
              <Alert>
                <Terminal className="h-4 w-4" />
                <AlertDescription>
                  <strong>Guide d'utilisation étape par étape</strong><br/>
                  Suivez ces étapes pour vous connecter et récupérer la configuration d'un switch
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                {[
                  {
                    step: 1,
                    title: 'Lancement de l\'application',
                    description: 'Double-cliquez sur dot1x-automator.exe ou lancez depuis le terminal',
                    details: 'L\'application se lance en mode desktop avec accès SSH natif'
                  },
                  {
                    step: 2,
                    title: 'Configuration Serveur Robont',
                    description: 'Renseignez vos identifiants pour le serveur Robont (6.91.128.111)',
                    details: 'Utilisez vos credentials habituels d\'accès au serveur'
                  },
                  {
                    step: 3,
                    title: 'Configuration Switch Cible',
                    description: 'Saisissez l\'IP et les credentials du switch à configurer',
                    details: 'Le compte doit avoir les droits pour exécuter "show configuration"'
                  },
                  {
                    step: 4,
                    title: 'Tests de connectivité',
                    description: 'Utilisez les boutons de test pour vérifier la connectivité',
                    details: 'Ping Robont, Test SSH, puis connexion finale'
                  },
                  {
                    step: 5,
                    title: 'Connexion et récupération',
                    description: 'Cliquez sur "Se connecter" pour établir la connexion SSH',
                    details: 'La configuration est automatiquement récupérée et affichée'
                  },
                  {
                    step: 6,
                    title: 'Sauvegarde',
                    description: 'Téléchargez ou copiez la configuration récupérée',
                    details: 'Le fichier est nommé automatiquement avec le hostname du switch'
                  }
                ].map((item) => (
                  <Card key={item.step}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-4">
                        <Badge variant="default" className="text-lg font-bold min-w-fit">
                          {item.step}
                        </Badge>
                        <div className="space-y-1 flex-1">
                          <h4 className="font-semibold">{item.title}</h4>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                          <p className="text-xs text-muted-foreground italic">{item.details}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="troubleshooting" className="space-y-4">
              <Alert>
                <Wrench className="h-4 w-4" />
                <AlertDescription>
                  <strong>Solutions aux problèmes courants</strong><br/>
                  Guide de dépannage pour résoudre les erreurs les plus fréquentes
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                {troubleshootingSteps.map((item, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {item.issue}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Solutions recommandées :</p>
                        <ol className="space-y-1">
                          {item.solutions.map((solution, solutionIndex) => (
                            <li key={solutionIndex} className="flex items-start gap-2 text-sm">
                              <Badge variant="outline" className="min-w-fit text-xs">
                                {solutionIndex + 1}
                              </Badge>
                              <span>{solution}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Commandes de diagnostic
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-1">Test de connectivité réseau :</p>
                      <code className="block bg-muted p-2 rounded text-sm">
                        ping 6.91.128.111
                      </code>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Test du port SSH :</p>
                      <code className="block bg-muted p-2 rounded text-sm">
                        telnet 6.91.128.111 22
                      </code>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Vérification des dépendances :</p>
                      <code className="block bg-muted p-2 rounded text-sm">
                        node --version && cargo --version && cargo tauri --version
                      </code>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Informations de sécurité</strong><br/>
                  Cette application respecte les meilleures pratiques de sécurité
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      Sécurité des données
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• <strong>Credentials temporaires</strong> - Stockés en mémoire uniquement</li>
                      <li>• <strong>Chiffrement SSH</strong> - Standard industrie</li>
                      <li>• <strong>Pas de télémétrie</strong> - Aucun envoi de données externes</li>
                      <li>• <strong>Code auditable</strong> - Source ouverte et vérifiable</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Network className="h-4 w-4 text-blue-600" />
                      Sécurité réseau
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• <strong>Connexions directes</strong> - Pas de serveurs intermédiaires</li>
                      <li>• <strong>Authentification forte</strong> - SSH avec clés ou mots de passe</li>
                      <li>• <strong>Timeout automatique</strong> - Sessions fermées automatiquement</li>
                      <li>• <strong>Logs locaux</strong> - Traçabilité complète</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Recommandations de sécurité
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 border-l-4 border-green-500 bg-green-50">
                      <p className="text-sm"><strong>Recommandé :</strong> Utilisez des comptes dédiés avec privilèges limités pour les connexions aux switches</p>
                    </div>
                    <div className="p-3 border-l-4 border-yellow-500 bg-yellow-50">
                      <p className="text-sm"><strong>Attention :</strong> Ne partagez jamais vos credentials avec d'autres utilisateurs</p>
                    </div>
                    <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
                      <p className="text-sm"><strong>Conseil :</strong> Vérifiez régulièrement les logs de connexion sur vos équipements</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}