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
          <div className="space-y-4">
            {interfaces.map((iface, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{iface.name}</h3>
                    <Badge variant="outline" className="bg-tech-success/10 text-tech-success border-tech-success/30">
                      Access
                    </Badge>
                  </div>
                </div>
                
                <div className="bg-code-bg rounded-md p-3 text-sm">
                  <div className="text-code-text font-mono space-y-1">
                    {iface.config.map((line, lineIndex) => (
                      <div key={lineIndex} className="break-all">
                        <span className="text-code-keyword">set</span>{' '}
                        <span className="text-code-text">{line.replace('set ', '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};