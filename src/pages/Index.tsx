import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

import { SwitchInfo } from '@/components/SwitchInfo';
import { InterfaceList } from '@/components/InterfaceList';
import { ConfigurationOutput } from '@/components/ConfigurationOutput';
import { ConfigurationParser } from '@/components/ConfigurationParser';
import { FileUpload } from '@/components/FileUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Router, Network, Bug, ChevronDown } from 'lucide-react';

const Index = () => {
  const [configContent, setConfigContent] = useState<string>('');
  const [filename, setFilename] = useState<string>('');
  const [parser, setParser] = useState<ConfigurationParser | null>(null);
  const location = useLocation();

  const handleFileRead = (content: string, name: string) => {
    setConfigContent(content);
    setFilename(name);
    setParser(new ConfigurationParser(content));
  };

  // Vérifier si un fichier a été envoyé depuis DeviceConnection
  useEffect(() => {
    if (location.state && location.state.content && location.state.filename) {
      handleFileRead(location.state.content, location.state.filename);
    }
  }, [location.state]);

  const switchInfo = parser?.getSwitchInfo();
  const interfaces = parser?.getInterfaces() || [];
  const dot1xConfig = parser?.generateDot1xConfigWildcard(interfaces) || '';
  const cleanupConfig = parser?.generateCleanupConfigWildcard(interfaces) || '';
  const radiusConfig = parser?.getRadiusConfig(switchInfo?.managementIp) || '';

  // Debug information
  const debugInfo = parser ? (() => {
    const lines = configContent.split('\n');
    const vlan160Lines = lines.filter(line => line.includes('irb.160') || line.includes('vlan.160') || line.includes('vlan unit 160'));
    const accessLines = lines.filter(line => 
      line.includes('ethernet-switching') && 
      (line.includes('port-mode access') || line.includes('interface-mode access'))
    );
    const interfaceLines = lines.filter(line => 
      line.match(/^set interfaces (ge|xe|et)-\d+\/\d+\/\d+/)
    );
    
    return {
      totalLines: lines.length,
      vlan160Matches: vlan160Lines.length,
      vlan160Samples: vlan160Lines.slice(0, 3),
      accessMatches: accessLines.length,
      accessSamples: accessLines.slice(0, 5),
      interfaceMatches: interfaceLines.length,
      interfaceTypes: {
        ge: interfaceLines.filter(l => l.includes('ge-')).length,
        xe: interfaceLines.filter(l => l.includes('xe-')).length,
        et: interfaceLines.filter(l => l.includes('et-')).length,
      }
    };
  })() : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Router className="h-8 w-8 text-tech-primary" />
            <h1 className="text-3xl font-bold">Juniper Configuration Tool</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Outil de configuration automatique pour switches Juniper - 
            Ajout de 802.1X et configuration RADIUS
          </p>
          
          <div className="flex justify-center gap-4 mt-6">
            <Link to="/connection">
              <Button variant="outline" className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                Connexion SSH aux Équipements
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-8">
          {/* File Upload */}
          <FileUpload onFileRead={handleFileRead} />

          {/* Show results only if file is uploaded */}
          {parser && (
            <>
              {/* Debug Panel */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Bug className="h-4 w-4 text-orange-500" />
                          Debug Parsing ({debugInfo?.totalLines} lignes analysées)
                        </div>
                        <ChevronDown className="h-4 w-4" />
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-semibold mb-2">VLAN 160 Detection</h4>
                          <p>Lignes trouvées: <span className="font-mono">{debugInfo?.vlan160Matches}</span></p>
                          {debugInfo?.vlan160Samples.map((line, i) => (
                            <p key={i} className="font-mono text-xs bg-muted p-1 rounded mt-1 truncate">
                              {line.trim()}
                            </p>
                          ))}
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Access Ports Detection</h4>
                          <p>Lignes access trouvées: <span className="font-mono">{debugInfo?.accessMatches}</span></p>
                          {debugInfo?.accessSamples.map((line, i) => (
                            <p key={i} className="font-mono text-xs bg-muted p-1 rounded mt-1 truncate">
                              {line.trim()}
                            </p>
                          ))}
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Interfaces Types</h4>
                          <p>GE: <span className="font-mono">{debugInfo?.interfaceTypes.ge}</span></p>
                          <p>XE: <span className="font-mono">{debugInfo?.interfaceTypes.xe}</span></p>
                          <p>ET: <span className="font-mono">{debugInfo?.interfaceTypes.et}</span></p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Parsing Results</h4>
                          <p>Hostname: <span className="font-mono">{switchInfo?.hostname || 'Non trouvé'}</span></p>
                          <p>Management IP: <span className="font-mono">{switchInfo?.managementIp || 'Non trouvé'}</span></p>
                          <p>VLAN 160 IP: <span className="font-mono">{switchInfo?.vlan160Ip || 'Non trouvé'}</span></p>
                          <p>Interfaces access: <span className="font-mono">{interfaces.length}</span></p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>

              {/* Switch Information */}
              <SwitchInfo 
                hostname={switchInfo?.hostname}
                managementIp={switchInfo?.managementIp}
                vlan160Ip={switchInfo?.vlan160Ip}
                interfaceCount={interfaces.length}
              />

              {/* Interface List */}
              <InterfaceList interfaces={interfaces} />

              {/* Configuration Output */}
              {interfaces.length > 0 && (
                <ConfigurationOutput
                  dot1xConfig={dot1xConfig}
                  cleanupConfig={cleanupConfig}
                  radiusConfig={radiusConfig}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
