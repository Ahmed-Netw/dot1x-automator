import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network, Settings } from 'lucide-react';

interface Interface {
  name: string;
  config: string[];
  isAccess: boolean;
}

interface InterfaceListProps {
  interfaces: Interface[];
}

export const InterfaceList = ({ interfaces }: InterfaceListProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5 text-tech-secondary" />
          Interfaces Access Détectées
        </CardTitle>
        <CardDescription>
          Liste des interfaces configurées en mode access
        </CardDescription>
      </CardHeader>
      <CardContent>
        {interfaces.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucune interface access détectée</p>
            <p className="text-sm">Vérifiez votre fichier de configuration</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {interfaces.map((iface, index) => (
              <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                <div className="w-2 h-2 rounded-full bg-tech-success"></div>
                <span className="font-mono text-sm font-medium">{iface.name}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};