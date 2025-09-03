import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, Copy, Trash2, Plus, Wifi, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { bridgeClient } from '@/lib/bridge';

// Import conditionnel pour Tauri
let tauriInvoke: any = null;
try {
  tauriInvoke = (window as any).__TAURI__ ? require('@tauri-apps/api/tauri').invoke : null;
} catch (e) {
  console.log('Tauri non disponible, mode web');
}

type SwitchStatus = 'idle' | 'running' | 'success' | 'error';

interface SwitchRow {
  id: string;
  ip: string;
  username?: string;
  password?: string;
  status: SwitchStatus;
  hostname?: string;
  configuration?: string;
  error?: string;
}

interface MultiSwitchBatchProps {
  rebondServerIp: string;
  rebondUsername: string;
  rebondPassword: string;
  isDesktopApp: boolean;
  bridgeServerAvailable: boolean;
}

export default function MultiSwitchBatch({
  rebondServerIp,
  rebondUsername,
  rebondPassword,
  isDesktopApp,
  bridgeServerAvailable
}: MultiSwitchBatchProps) {
  const [defaultUsername, setDefaultUsername] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('');
  const [ipTextarea, setIpTextarea] = useState('');
  const [rows, setRows] = useState<SwitchRow[]>([]);
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | undefined>();
  
  const { toast } = useToast();

  const addIPsFromTextarea = () => {
    if (!ipTextarea.trim()) {
      toast({
        title: "Aucune IP",
        description: "Veuillez saisir au moins une adresse IP",
        variant: "destructive"
      });
      return;
    }

    const ips = ipTextarea
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .filter(ip => {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        return ipRegex.test(ip);
      });

    if (ips.length === 0) {
      toast({
        title: "Aucune IP valide",
        description: "Aucune adresse IP valide trouvée",
        variant: "destructive"
      });
      return;
    }

    const existingIps = new Set(rows.map(row => row.ip));
    const newRows: SwitchRow[] = ips
      .filter(ip => !existingIps.has(ip))
      .map(ip => ({
        id: `switch-${Date.now()}-${Math.random()}`,
        ip,
        status: 'idle' as SwitchStatus
      }));

    if (newRows.length === 0) {
      toast({
        title: "Aucune nouvelle IP",
        description: "Toutes les IP sont déjà dans la liste",
        variant: "destructive"
      });
      return;
    }

    setRows(prev => [...prev, ...newRows]);
    setIpTextarea('');
    toast({
      title: "IP ajoutées",
      description: `${newRows.length} adresse(s) IP ajoutée(s) à la liste`
    });
  };

  const removeRow = (id: string) => {
    setRows(prev => prev.filter(row => row.id !== id));
  };

  const updateRow = (id: string, updates: Partial<SwitchRow>) => {
    setRows(prev => prev.map(row => 
      row.id === id ? { ...row, ...updates } : row
    ));
  };

  const generateMockConfiguration = (switchIp: string, username: string): string => {
    const timestamp = new Date().toLocaleString('fr-FR');
    const hostname = `SW-${switchIp.replace(/\./g, '-')}`;
    return `# Configuration simulée récupérée le ${timestamp}
# Serveur Rebond: ${rebondServerIp}
# Switch IP: ${switchIp}
# Switch Hostname: ${hostname}
# Mode: Simulation multi-switch

set version 20.4R3.8
set system host-name ${hostname}
set system domain-name company.local
set system time-zone Europe/Paris
set system root-authentication encrypted-password "$6$randomhash$encrypted.password"
set system login user ${username} uid 2000
set system login user ${username} class super-user
set system services ssh root-login allow
set system services netconf ssh
set interfaces me0 unit 0 family inet address ${switchIp}/24
set interfaces ge-0/0/0 description "Access Port - VLAN 10"
set interfaces ge-0/0/0 unit 0 family ethernet-switching interface-mode access
set vlans vlan-10 vlan-id 10
set vlans vlan-10 description "Production Network"
set snmp description "${hostname} - Juniper EX Series Switch"
set snmp location "Datacenter - Rack A"
set snmp contact "admin@company.local"`;
  };

  const pingAll = async () => {
    if (!bridgeServerAvailable) {
      toast({
        title: "Bridge indisponible",
        description: "Le bridge server n'est pas disponible pour les tests de ping",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Test de ping",
      description: "Test de connectivité en cours..."
    });

    for (const row of rows) {
      try {
        const result = await bridgeClient.pingDevice(row.ip);
        updateRow(row.id, { 
          status: result.success ? 'success' : 'error',
          error: result.success ? undefined : result.error || 'Ping échoué'
        });
      } catch (error: any) {
        updateRow(row.id, { 
          status: 'error',
          error: error.message || 'Erreur ping'
        });
      }
    }

    toast({
      title: "Ping terminé",
      description: "Test de connectivité terminé pour tous les switches"
    });
  };

  const runBatch = async () => {
    if (!rebondUsername || !rebondPassword) {
      toast({
        title: "Identifiants Rebond manquants",
        description: "Veuillez saisir les identifiants du serveur Rebond ci-dessus",
        variant: "destructive"
      });
      return;
    }

    if (rows.length === 0) {
      toast({
        title: "Aucun switch",
        description: "Veuillez ajouter au moins un switch à la liste",
        variant: "destructive"
      });
      return;
    }

    // Vérifier que chaque ligne a un username effectif
    const invalidRows = rows.filter(row => !row.username && !defaultUsername);
    if (invalidRows.length > 0) {
      toast({
        title: "Identifiants manquants",
        description: `${invalidRows.length} switch(es) n'ont pas d'identifiants (ni spécifiques ni par défaut)`,
        variant: "destructive"
      });
      return;
    }

    setRunning(true);
    let successCount = 0;

    // Réinitialiser les statuts
    setRows(prev => prev.map(row => ({ ...row, status: 'idle' as SwitchStatus, error: undefined, hostname: undefined, configuration: undefined })));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setCurrentIndex(i);
      
      const effectiveUsername = row.username || defaultUsername;
      const effectivePassword = row.password || defaultPassword;

      updateRow(row.id, { status: 'running' });

      try {
        if (tauriInvoke) {
          // Mode Desktop - Tauri
          const result = await tauriInvoke('run_rebond_script', {
            rebond_ip: rebondServerIp,
            rebond_username: rebondUsername,
            rebond_password: rebondPassword,
            switch_ip: row.ip,
            switch_username: effectiveUsername,
            switch_password: effectivePassword
          }) as {
            success: boolean;
            message: string;
            configuration?: string;
            hostname?: string;
          };

          if (result.success && result.configuration) {
            updateRow(row.id, {
              status: 'success',
              hostname: result.hostname || `SW-${row.ip.replace(/\./g, '-')}`,
              configuration: result.configuration
            });
            successCount++;
          } else {
            updateRow(row.id, {
              status: 'error',
              error: result.message || 'Connexion échouée'
            });
          }
        } else if (bridgeServerAvailable) {
          // Mode Bridge Server
          const result = await bridgeClient.getConfiguration(
            rebondServerIp,
            rebondUsername,
            rebondPassword,
            row.ip,
            effectiveUsername,
            effectivePassword
          );

          if (result.success && result.data) {
            updateRow(row.id, {
              status: 'success',
              hostname: result.data.hostname,
              configuration: result.data.configuration
            });
            successCount++;
          } else {
            updateRow(row.id, {
              status: 'error',
              error: result.error || 'Récupération échouée'
            });
          }
        } else {
          // Mode Simulation
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
          const mockConfig = generateMockConfiguration(row.ip, effectiveUsername);
          const hostname = `SW-${row.ip.replace(/\./g, '-')}`;
          
          updateRow(row.id, {
            status: 'success',
            hostname,
            configuration: mockConfig
          });
          successCount++;
        }
      } catch (error: any) {
        updateRow(row.id, {
          status: 'error',
          error: error.message || 'Erreur inconnue'
        });
      }

      // Petite pause entre chaque switch
      if (i < rows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setRunning(false);
    setCurrentIndex(undefined);

    toast({
      title: "Traitement terminé",
      description: `${successCount}/${rows.length} switch(es) traité(s) avec succès`,
      variant: successCount === rows.length ? "default" : "destructive"
    });
  };

  const downloadConfiguration = (row: SwitchRow) => {
    if (!row.configuration) return;

    const filename = `${row.hostname || `switch_${row.ip.replace(/\./g, '_')}`}.txt`;
    const blob = new Blob([row.configuration], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Configuration téléchargée",
      description: `Fichier ${filename} téléchargé`
    });
  };

  const copyConfiguration = (row: SwitchRow) => {
    if (!row.configuration) return;

    navigator.clipboard.writeText(row.configuration).then(() => {
      toast({
        title: "Configuration copiée",
        description: `Configuration du switch ${row.hostname || row.ip} copiée`
      });
    });
  };

  const getStatusIcon = (status: SwitchStatus) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: SwitchStatus) => {
    switch (status) {
      case 'running':
        return <Badge variant="secondary">En cours</Badge>;
      case 'success':
        return <Badge variant="default">Réussi</Badge>;
      case 'error':
        return <Badge variant="destructive">Erreur</Badge>;
      default:
        return <Badge variant="outline">En attente</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Mode Multi-Switch
        </CardTitle>
        <CardDescription>
          Récupération en lot des configurations de plusieurs switches via le serveur Rebond
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Ce mode utilise les identifiants Rebond saisis ci-dessus. Assurez-vous qu'ils sont corrects avant de continuer.
          </AlertDescription>
        </Alert>

        {/* Identifiants par défaut pour les switches */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Identifiants par défaut pour les switches</h4>
          <p className="text-sm text-muted-foreground">
            Ces identifiants seront utilisés pour tous les switches qui n'ont pas d'identifiants spécifiques.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default-username">Nom d'utilisateur par défaut</Label>
              <Input
                id="default-username"
                type="text"
                placeholder="admin"
                value={defaultUsername}
                onChange={(e) => setDefaultUsername(e.target.value)}
                disabled={running}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-password">Mot de passe par défaut</Label>
              <Input
                id="default-password"
                type="password"
                placeholder="••••••••"
                value={defaultPassword}
                onChange={(e) => setDefaultPassword(e.target.value)}
                disabled={running}
              />
            </div>
          </div>
        </div>

        {/* Ajout d'IP */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Ajouter des switches</h4>
          <div className="space-y-2">
            <Label htmlFor="ip-list">Liste d'adresses IP (une par ligne)</Label>
            <Textarea
              id="ip-list"
              placeholder={`192.168.1.10
192.168.1.11
192.168.1.12
# Commentaires possibles`}
              value={ipTextarea}
              onChange={(e) => setIpTextarea(e.target.value)}
              disabled={running}
              rows={4}
            />
          </div>
          <Button 
            onClick={addIPsFromTextarea} 
            disabled={running || !ipTextarea.trim()}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter à la liste
          </Button>
        </div>

        {/* Actions globales */}
        {rows.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {bridgeServerAvailable && (
              <Button 
                variant="outline" 
                onClick={pingAll}
                disabled={running}
              >
                <Wifi className="h-4 w-4 mr-2" />
                Ping tous
              </Button>
            )}
            <Button 
              onClick={runBatch}
              disabled={running || rows.length === 0}
              className="flex-1 min-w-[200px]"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Traitement en cours... ({(currentIndex || 0) + 1}/{rows.length})
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Récupérer toutes les configurations
                </>
              )}
            </Button>
          </div>
        )}

        {/* Tableau des switches */}
        {rows.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Switches ({rows.length})</h4>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statut</TableHead>
                    <TableHead>Adresse IP</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Mot de passe</TableHead>
                    <TableHead>Hostname</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={row.id} className={currentIndex === index ? "bg-blue-50" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(row.status)}
                          {getStatusBadge(row.status)}
                        </div>
                        {row.error && (
                          <div className="text-xs text-red-600 mt-1">
                            {row.error}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{row.ip}</TableCell>
                      <TableCell>
                        <Input
                          placeholder={defaultUsername || "Par défaut"}
                          value={row.username || ''}
                          onChange={(e) => updateRow(row.id, { username: e.target.value })}
                          disabled={running}
                          className="min-w-[120px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="password"
                          placeholder={defaultPassword ? "••••••••" : "Par défaut"}
                          value={row.password || ''}
                          onChange={(e) => updateRow(row.id, { password: e.target.value })}
                          disabled={running}
                          className="min-w-[120px]"
                        />
                      </TableCell>
                      <TableCell>
                        {row.hostname ? (
                          <span className="font-mono text-sm">{row.hostname}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {row.configuration && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyConfiguration(row)}
                                title="Copier la configuration"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadConfiguration(row)}
                                title="Télécharger la configuration"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeRow(row.id)}
                            disabled={running}
                            title="Supprimer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Récapitulatif */}
            <div className="text-sm text-muted-foreground flex gap-4">
              <span>Total: {rows.length}</span>
              <span>Réussis: {rows.filter(r => r.status === 'success').length}</span>
              <span>Erreurs: {rows.filter(r => r.status === 'error').length}</span>
              <span>En attente: {rows.filter(r => r.status === 'idle').length}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}