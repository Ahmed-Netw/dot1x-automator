interface Interface {
  name: string;
  config: string[];
  isAccess: boolean;
}

interface SwitchInfo {
  hostname?: string;
  managementIp?: string;
}

export class ConfigurationParser {
  private config: string;
  
  constructor(config: string) {
    this.config = config;
  }

  getSwitchInfo(): SwitchInfo {
    const lines = this.config.split('\n');
    const info: SwitchInfo = {};

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Extract hostname
      if (trimmed.startsWith('set system host-name')) {
        info.hostname = trimmed.split(' ')[3];
      }
      
      // Extract management IP (looking for management interface)
      if (trimmed.includes('set interfaces') && trimmed.includes('unit 0 family inet address')) {
        const parts = trimmed.split(' ');
        const ipIndex = parts.findIndex(part => part === 'address') + 1;
        if (ipIndex > 0 && parts[ipIndex]) {
          info.managementIp = parts[ipIndex].split('/')[0];
        }
      }
    }

    return info;
  }

  getInterfaces(): Interface[] {
    const lines = this.config.split('\n');
    const interfaces: Map<string, Interface> = new Map();

    let currentInterface = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Detect interface configuration lines
      if (trimmed.startsWith('set interfaces')) {
        const parts = trimmed.split(' ');
        if (parts.length >= 3) {
          const interfaceName = parts[2];
          currentInterface = interfaceName;
          
          if (!interfaces.has(interfaceName)) {
            interfaces.set(interfaceName, {
              name: interfaceName,
              config: [],
              isAccess: false
            });
          }
          
          const iface = interfaces.get(interfaceName)!;
          iface.config.push(trimmed);
          
          // Check if it's an access port
          if (trimmed.includes('ethernet-switching-options') && 
              (trimmed.includes('port-mode access') || trimmed.includes('access'))) {
            iface.isAccess = true;
          }
        }
      }
    }

    return Array.from(interfaces.values()).filter(iface => 
      iface.name.startsWith('ge-') && iface.isAccess
    );
  }

  generateDot1xConfig(interfaces: Interface[]): string {
    const configs: string[] = [];
    
    for (const iface of interfaces) {
      if (iface.isAccess) {
        configs.push(`set protocols dot1x authenticator interface ${iface.name} supplicant multiple`);
        configs.push(`set protocols dot1x authenticator interface ${iface.name} retries 3`);
        configs.push(`set protocols dot1x authenticator interface ${iface.name} transmit-period 1`);
        configs.push(`set protocols dot1x authenticator interface ${iface.name} reauthentication 3600`);
        configs.push(`set protocols dot1x authenticator interface ${iface.name} supplicant-timeout 10`);
        configs.push(`set protocols dot1x authenticator interface ${iface.name} maximum-requests 3`);
        configs.push(`set protocols dot1x authenticator interface ${iface.name} mac-radius`);
      }
    }
    
    return configs.join('\n');
  }

  generateCleanupConfig(interfaces: Interface[]): string {
    const configs: string[] = [];
    
    for (const iface of interfaces) {
      if (iface.isAccess) {
        configs.push(`delete interfaces ${iface.name} ethernet-switching-options`);
      }
    }
    
    return configs.join('\n');
  }

  getRadiusConfig(): string {
    return `set access radius-server 10.147.32.47 port 1812
set access radius-server 10.147.32.47 secret "$9$qfTF69tBRcP5Qn9tREdbwsoJUjH.fT"
set access radius-server 10.147.32.47 source-address 10.148.62.185
set access radius-server 10.147.160.47 port 1812
set access radius-server 10.147.160.47 secret "$9$72Vw2oJUkm5dbs4JUmPBIREreM8XNVw"
set access radius-server 10.147.160.47 source-address 10.148.62.185
set access profile 802.1x-auth accounting-order radius
set access profile 802.1x-auth authentication-order radius
set access profile 802.1x-auth radius authentication-server 10.147.32.47
set access profile 802.1x-auth radius authentication-server 10.147.160.47
set access profile 802.1x-auth radius accounting-server 10.147.32.47
set access profile 802.1x-auth radius accounting-server 10.147.160.47
set protocols dot1x authenticator authentication-profile-name 802.1x-auth`;
  }
}