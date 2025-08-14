import { Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePWA } from '@/hooks/usePWA';
import { useToast } from '@/hooks/use-toast';

export const PWAInstallPrompt = () => {
  const { canInstall, isStandalone, installApp } = usePWA();
  const { toast } = useToast();

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      toast({
        title: "Installation réussie",
        description: "L'application a été ajoutée à votre bureau",
      });
    }
  };

  // Ne pas afficher si déjà installé ou en mode standalone
  if (isStandalone || !canInstall) return null;

  return (
    <Card className="mb-6 border-tech-primary/30 bg-tech-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-tech-primary">
          <Smartphone className="h-5 w-5" />
          Installer l'application
        </CardTitle>
        <CardDescription>
          Installez Network Tools sur votre PC pour un accès rapide et hors ligne
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            • Accès depuis le bureau<br/>
            • Fonctionne hors ligne<br/>
            • Interface native
          </div>
          <Button onClick={handleInstall} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Installer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};