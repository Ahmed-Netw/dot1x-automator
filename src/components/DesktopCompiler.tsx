import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Terminal, 
  Download, 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  Copy,
  ExternalLink,
  Folder
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DesktopCompilerProps {
  isDesktopApp: boolean;
}

const DesktopCompiler: React.FC<DesktopCompilerProps> = ({ isDesktopApp }) => {
  const [compilationStep, setCompilationStep] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationComplete, setCompilationComplete] = useState(false);
  const { toast } = useToast();

  // Si c'est déjà l'app desktop, on n'affiche rien
  if (isDesktopApp) return null;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copié !",
        description: "Commande copiée dans le presse-papiers",
      });
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible de copier la commande",
        variant: "destructive",
      });
    }
  };

  const simulateCompilation = () => {
    setIsCompiling(true);
    setProgress(0);
    setCompilationComplete(false);

    const steps = [
      { name: "Vérification des dépendances Rust...", duration: 1000 },
      { name: "Installation des dépendances NPM...", duration: 2000 },
      { name: "Compilation du backend Rust...", duration: 3000 },
      { name: "Bundling de l'interface React...", duration: 1500 },
      { name: "Création de l'exécutable...", duration: 2000 },
      { name: "Finalisation...", duration: 500 }
    ];

    let currentProgress = 0;
    let stepIndex = 0;

    const runNextStep = () => {
      if (stepIndex < steps.length) {
        const step = steps[stepIndex];
        setCompilationStep(step.name);
        
        setTimeout(() => {
          currentProgress += (100 / steps.length);
          setProgress(currentProgress);
          stepIndex++;
          
          if (stepIndex < steps.length) {
            runNextStep();
          } else {
            setCompilationStep("Compilation terminée !");
            setIsCompiling(false);
            setCompilationComplete(true);
            toast({
              title: "Compilation simulée terminée !",
              description: "Exécutez réellement 'npm run tauri:build' dans votre terminal",
            });
          }
        }, step.duration);
      }
    };

    runNextStep();
  };

  const openFileExplorer = () => {
    toast({
      title: "Localisation de l'exécutable",
      description: "Recherchez le fichier dans src-tauri/target/release/",
    });
  };

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <Terminal className="h-5 w-5" />
          Compilation Application Desktop
          <Badge variant="outline" className="ml-auto">SSH Réel</Badge>
        </CardTitle>
        <CardDescription className="text-amber-700 dark:text-amber-300">
          Compilez l'application desktop pour utiliser de vraies connexions SSH sans simulation
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Prérequis */}
        <div className="space-y-3">
          <h4 className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Prérequis
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 bg-amber-100 dark:bg-amber-900 rounded-md">
              <span className="text-sm text-amber-900 dark:text-amber-100">Rust + Cargo</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open('https://rustup.rs/', '_blank')}
                className="h-6 text-amber-700 dark:text-amber-300"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-100 dark:bg-amber-900 rounded-md">
              <span className="text-sm text-amber-900 dark:text-amber-100">Node.js + NPM</span>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </div>
        </div>

        {/* Étapes de compilation */}
        <div className="space-y-4">
          <h4 className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <Play className="h-4 w-4" />
            Compilation
          </h4>

          {/* Commande principale */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-amber-100 dark:bg-amber-900 rounded-md">
              <code className="text-sm text-amber-900 dark:text-amber-100 font-mono">
                npm run tauri:build
              </code>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => copyToClipboard('npm run tauri:build')}
                  className="h-6 text-amber-700 dark:text-amber-300"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={simulateCompilation}
                  disabled={isCompiling}
                  className="h-6 text-amber-700 dark:text-amber-300"
                >
                  <Play className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            {/* Mode développement alternatif */}
            <div className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
              <div>
                <code className="text-xs text-amber-800 dark:text-amber-200 font-mono">
                  npm run tauri:dev
                </code>
                <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">(mode développement)</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => copyToClipboard('npm run tauri:dev')}
                className="h-5 text-amber-600 dark:text-amber-400"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Barre de progression */}
          {(isCompiling || compilationComplete) && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {compilationStep}
              </p>
            </div>
          )}
        </div>

        {/* Localisation de l'exécutable */}
        <div className="space-y-3">
          <h4 className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Localisation de l'exécutable
          </h4>
          
          <div className="grid gap-2">
            <div className="flex items-center justify-between p-2 bg-amber-100 dark:bg-amber-900 rounded-md">
              <div>
                <span className="text-sm font-medium text-amber-900 dark:text-amber-100">Windows:</span>
                <code className="text-xs text-amber-700 dark:text-amber-300 ml-2">
                  src-tauri/target/release/dot1x-automator.exe
                </code>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-amber-100 dark:bg-amber-900 rounded-md">
              <div>
                <span className="text-sm font-medium text-amber-900 dark:text-amber-100">Linux:</span>
                <code className="text-xs text-amber-700 dark:text-amber-300 ml-2">
                  src-tauri/target/release/dot1x-automator
                </code>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-amber-100 dark:bg-amber-900 rounded-md">
              <div>
                <span className="text-sm font-medium text-amber-900 dark:text-amber-100">macOS:</span>
                <code className="text-xs text-amber-700 dark:text-amber-300 ml-2">
                  src-tauri/target/release/bundle/macos/
                </code>
              </div>
            </div>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={openFileExplorer}
            className="w-full border-amber-300 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
            disabled={!compilationComplete}
          >
            <Download className="h-4 w-4 mr-2" />
            Ouvrir le dossier de sortie
          </Button>
        </div>

        {/* Avantages */}
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>Avantages de l'application desktop :</strong><br/>
            • SSH natif sans limitations navigateur<br/>
            • Sécurité renforcée, aucun transit par serveurs tiers<br/>
            • Ping et connexions réels vers les équipements réseau<br/>
            • Configuration authentique récupérée directement
          </AlertDescription>
        </Alert>

        {compilationComplete && (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Prochaine étape :</strong> Fermez le navigateur et lancez l'exécutable compilé pour utiliser les vraies connexions SSH.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default DesktopCompiler;