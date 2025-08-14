import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Download, Shield, Trash2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConfigurationOutputProps {
  dot1xConfig: string;
  cleanupConfig: string;
  radiusConfig: string;
}

export const ConfigurationOutput = ({ dot1xConfig, cleanupConfig, radiusConfig }: ConfigurationOutputProps) => {
  const { toast } = useToast();

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié !",
      description: `Configuration ${type} copiée dans le presse-papier`,
    });
  };

  const downloadConfig = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const ConfigurationCard = ({ 
    title, 
    description, 
    config, 
    icon: Icon, 
    filename,
    type 
  }: { 
    title: string; 
    description: string; 
    config: string; 
    icon: any; 
    filename: string;
    type: string;
  }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-tech-primary" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(config, type)}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copier
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadConfig(config, filename)}
          >
            <Download className="h-4 w-4 mr-1" />
            Télécharger
          </Button>
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground">{description}</p>
      
      <div className="bg-code-bg rounded-lg p-4 max-h-64 overflow-y-auto">
        <pre className="text-code-text font-mono text-sm whitespace-pre-wrap">
          {config}
        </pre>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-tech-primary" />
          Configuration Générée
        </CardTitle>
        <CardDescription>
          Configurations à appliquer sur votre switch Juniper
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="dot1x" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dot1x">802.1X</TabsTrigger>
            <TabsTrigger value="cleanup">Nettoyage</TabsTrigger>
            <TabsTrigger value="radius">RADIUS</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dot1x" className="mt-6">
            <ConfigurationCard
              title="Configuration 802.1X"
              description="Configuration à ajouter pour activer 802.1X sur les interfaces access"
              config={dot1xConfig}
              icon={Shield}
              filename="dot1x-config.txt"
              type="802.1X"
            />
          </TabsContent>
          
          <TabsContent value="cleanup" className="mt-6">
            <ConfigurationCard
              title="Nettoyage des interfaces"
              description="Commandes pour supprimer la configuration ethernet-switching-options"
              config={cleanupConfig}
              icon={Trash2}
              filename="cleanup-config.txt"
              type="nettoyage"
            />
          </TabsContent>
          
          <TabsContent value="radius" className="mt-6">
            <ConfigurationCard
              title="Configuration RADIUS"
              description="Configuration des serveurs RADIUS pour l'authentification 802.1X"
              config={radiusConfig}
              icon={Shield}
              filename="radius-config.txt"
              type="RADIUS"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};