import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, XCircle, Download, ExternalLink, Terminal, Wrench, Globe } from 'lucide-react';

interface PrerequisiteItem {
  name: string;
  status: 'checking' | 'ok' | 'missing' | 'unknown';
  description: string;
  installUrl?: string;
  command?: string;
}

interface PrerequisitesWizardProps {
  isDesktopApp: boolean;
  onClose: () => void;
}

export default function PrerequisitesWizard({ isDesktopApp, onClose }: PrerequisitesWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  
  const [prerequisites, setPrerequisites] = useState<PrerequisiteItem[]>([
    {
      name: 'Node.js (v18+)',
      status: 'unknown',
      description: 'Runtime JavaScript requis pour le build',
      installUrl: 'https://nodejs.org/',
      command: 'node --version'
    },
    {
      name: 'Rust & Cargo',
      status: 'unknown', 
      description: 'Compilateur Rust pour Tauri',
      installUrl: 'https://rustup.rs/',
      command: 'cargo --version'
    },
    {
      name: 'Tauri CLI v1',
      status: 'unknown',
      description: 'Interface de ligne de commande Tauri',
      installUrl: 'https://tauri.app/v1/guides/getting-started/prerequisites',
      command: 'cargo tauri --version'
    },
    {
      name: 'Build Tools C++',
      status: 'unknown',
      description: 'Outils de compilation natifs',
      installUrl: 'https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022'
    },
    {
      name: 'WebView2 Runtime',
      status: 'unknown',
      description: 'Runtime d\'affichage Windows',
      installUrl: 'https://developer.microsoft.com/en-us/microsoft-edge/webview2/'
    }
  ]);

  const steps = [
    { id: 'overview', title: 'Vue d\'ensemble', icon: Globe },
    { id: 'install', title: 'Installation', icon: Download },
    { id: 'verify', title: 'Vérification', icon: CheckCircle2 },
    { id: 'build', title: 'Compilation', icon: Wrench }
  ];

  const checkPrerequisites = async () => {
    setIsChecking(true);
    const newPrereqs = [...prerequisites];
    
    // Simuler la vérification (remplacer par de vraies vérifications via Tauri commands)
    for (let i = 0; i < newPrereqs.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      // Simulation - vous pouvez implémenter de vraies vérifications ici
      newPrereqs[i].status = Math.random() > 0.3 ? 'ok' : 'missing';
      setPrerequisites([...newPrereqs]);
    }
    
    setIsChecking(false);
  };

  const getStatusIcon = (status: PrerequisiteItem['status']) => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'missing': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'checking': return <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />;
      default: return <div className="h-4 w-4 rounded-full bg-muted" />;
    }
  };

  const getStatusBadge = (status: PrerequisiteItem['status']) => {
    switch (status) {
      case 'ok': return <Badge variant="secondary" className="text-green-700 bg-green-100">Installé</Badge>;
      case 'missing': return <Badge variant="destructive">Manquant</Badge>;
      case 'checking': return <Badge variant="outline">Vérification...</Badge>;
      default: return <Badge variant="outline">Non vérifié</Badge>;
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Assistant d'Installation</span>
            <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
          </CardTitle>
          <CardDescription>
            {isDesktopApp ? 
              'Vérifiez que votre environnement est prêt pour utiliser l\'application desktop' :
              'Configurez votre environnement pour compiler l\'application desktop'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={steps[currentStep].id} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              {steps.map((step, index) => (
                <TabsTrigger 
                  key={step.id} 
                  value={step.id}
                  onClick={() => setCurrentStep(index)}
                  className="flex items-center gap-2"
                >
                  <step.icon className="h-4 w-4" />
                  {step.title}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Alert>
                <Terminal className="h-4 w-4" />
                <AlertDescription>
                  <strong>Prérequis pour l'application desktop :</strong><br/>
                  • Connexions SSH réelles vers le serveur Robont<br/>
                  • Fonctionnement 100% hors ligne<br/>
                  • Performance native optimisée
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Mode Web (Actuel)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• Simulation uniquement</li>
                      <li>• Pas de vraies connexions SSH</li>
                      <li>• Dépendant du navigateur</li>
                    </ul>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Mode Desktop (Cible)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• SSH natif vers Robont</li>
                      <li>• Configuration réelle des switches</li>
                      <li>• Performance optimisée</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="install" className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Installation étape par étape</h3>
                
                {prerequisites.map((prereq, index) => (
                  <Card key={prereq.name}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(prereq.status)}
                          <div>
                            <h4 className="font-medium">{prereq.name}</h4>
                            <p className="text-sm text-muted-foreground">{prereq.description}</p>
                            {prereq.command && (
                              <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block">
                                {prereq.command}
                              </code>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(prereq.status)}
                          {prereq.installUrl && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(prereq.installUrl, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Télécharger
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="verify" className="space-y-4">
              <div className="text-center space-y-4">
                <h3 className="text-lg font-semibold">Vérification des prérequis</h3>
                <p className="text-muted-foreground">
                  Cliquez pour vérifier que tous les outils sont correctement installés
                </p>
                
                <Button 
                  onClick={checkPrerequisites} 
                  disabled={isChecking}
                  size="lg"
                >
                  {isChecking ? 'Vérification en cours...' : 'Vérifier les prérequis'}
                </Button>
                
                <div className="grid gap-2 mt-6">
                  {prerequisites.map((prereq) => (
                    <div key={prereq.name} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(prereq.status)}
                        <span>{prereq.name}</span>
                      </div>
                      {getStatusBadge(prereq.status)}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="build" className="space-y-4">
              <Alert>
                <Terminal className="h-4 w-4" />
                <AlertDescription>
                  <strong>Commandes de compilation :</strong><br/>
                  Une fois tous les prérequis installés, utilisez ces commandes dans le dossier du projet
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">1. Navigation vers le projet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <code className="block bg-muted p-3 rounded text-sm">
                      cd C:\chemin\vers\votre\dot1x-automator-main
                    </code>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">2. Installation des dépendances</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <code className="block bg-muted p-3 rounded text-sm">
                      npm install
                    </code>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">3. Compilation de l'application</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <code className="block bg-muted p-3 rounded text-sm">
                      cargo tauri build
                    </code>
                    <p className="text-sm text-muted-foreground mt-2">
                      L'exécutable sera créé dans <code>src-tauri/target/release/</code>
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">4. Lancement de l'application</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <code className="block bg-muted p-3 rounded text-sm">
                      .\src-tauri\target\release\dot1x-automator.exe
                    </code>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-between mt-6">
            <Button 
              variant="outline" 
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              Précédent
            </Button>
            
            <Button 
              onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
              disabled={currentStep === steps.length - 1}
            >
              Suivant
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}