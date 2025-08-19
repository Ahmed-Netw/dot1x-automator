import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/FileUpload';
import { SwitchInfo } from '@/components/SwitchInfo';
import { InterfaceList } from '@/components/InterfaceList';
import { ConfigurationOutput } from '@/components/ConfigurationOutput';
import { ConfigurationParser } from '@/components/ConfigurationParser';
import { Router, Network } from 'lucide-react';

const Index = () => {
  const [configContent, setConfigContent] = useState<string>('');
  const [filename, setFilename] = useState<string>('');
  const [parser, setParser] = useState<ConfigurationParser | null>(null);

  const handleFileRead = (content: string, name: string) => {
    setConfigContent(content);
    setFilename(name);
    setParser(new ConfigurationParser(content));
  };

  const switchInfo = parser?.getSwitchInfo();
  const interfaces = parser?.getInterfaces() || [];
  const dot1xConfig = parser?.generateDot1xConfigWildcard(interfaces) || '';
  const cleanupConfig = parser?.generateCleanupConfigWildcard(interfaces) || '';
  const radiusConfig = parser?.getRadiusConfig(switchInfo?.managementIp) || '';

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
