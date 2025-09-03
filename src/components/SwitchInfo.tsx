import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Router, Globe, Server } from 'lucide-react';

interface SwitchInfoProps {
  hostname?: string;
  managementIp?: string;
  vlan160Ip?: string;
  vlan160NetworkCidr?: string;
  interfaceCount: number;
}

export const SwitchInfo = ({ hostname, managementIp, vlan160Ip, vlan160NetworkCidr, interfaceCount }: SwitchInfoProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Router className="h-5 w-5 text-tech-primary" />
          Informations du Switch
        </CardTitle>
        <CardDescription>
          Détails de configuration du switch Juniper
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Server className="h-4 w-4 text-tech-primary" />
            <div>
              <p className="text-sm font-medium">Hostname</p>
              <p className="text-lg">{hostname || 'Non défini'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Globe className="h-4 w-4 text-tech-secondary" />
            <div>
              <p className="text-sm font-medium">IP Management</p>
              <p className="text-lg">{managementIp || 'Non trouvé'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Globe className="h-4 w-4 text-tech-accent" />
            <div>
              <p className="text-sm font-medium">VLAN 160 Admin</p>
              <p className="text-lg">{vlan160Ip || 'Non trouvé'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Globe className="h-4 w-4 text-tech-warning" />
            <div>
              <p className="text-sm font-medium">Adresse réseau</p>
              <p className="text-lg">{vlan160NetworkCidr || 'Non trouvé'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Router className="h-4 w-4 text-tech-success" />
            <div>
              <p className="text-sm font-medium">Interfaces Access</p>
              <div className="flex items-center gap-2">
                <p className="text-lg">{interfaceCount}</p>
                <Badge variant="secondary" className="text-xs">
                  détectées
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};