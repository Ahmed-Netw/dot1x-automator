interface Interface {
  name: string;
  config: string[];
  isAccess: boolean;
  description?: string;
}

interface SwitchInfo {
  hostname?: string;
  managementIp?: string;
  vlan160Ip?: string;
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
      
      // PRIORITY: Extract VLAN 160 (VL160_ADMIN) IP address - both syntaxes
      const vlan160Match = trimmed.match(/^set interfaces vlan(?:\.| unit )160 .*family inet address (\S+)/);
      if (vlan160Match) {
        const ip = vlan160Match[1].split('/')[0];
        info.vlan160Ip = ip;
        info.managementIp = ip; // VLAN 160 is the management IP
        continue;
      }
      
      // Extract other management IPs only if VLAN 160 not found yet
      if (!info.managementIp && trimmed.includes('set interfaces') && trimmed.includes('unit 0 family inet address')) {
        const parts = trimmed.split(' ');
        const ipIndex = parts.findIndex(part => part === 'address') + 1;
        if (ipIndex > 0 && parts[ipIndex]) {
          const ip = parts[ipIndex].split('/')[0];
          // Prefer management/admin VLAN IPs
          if (ip.startsWith('10.148.') || ip.includes('192.168.') || !info.managementIp) {
            info.managementIp = ip;
          }
        }
      }
      
      // Also look for other VLAN interfaces only if management IP not set
      if (!info.managementIp && trimmed.includes('set interfaces vlan') && trimmed.includes('family inet address')) {
        const parts = trimmed.split(' ');
        const ipIndex = parts.findIndex(part => part === 'address') + 1;
        if (ipIndex > 0 && parts[ipIndex]) {
          const ip = parts[ipIndex].split('/')[0];
          if (ip.startsWith('10.148.') || ip.includes('192.168.')) {
            info.managementIp = ip;
          }
        }
      }
    }

    return info;
  }

  getInterfaces(): Interface[] {
    const lines = this.config.split('\n');
    const interfaces: Map<string, Interface> = new Map();
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Detect interface configuration lines
      if (trimmed.startsWith('set interfaces') && trimmed.includes('ge-')) {
        const parts = trimmed.split(' ');
        if (parts.length >= 3) {
          const interfaceName = parts[2];
          
          if (!interfaces.has(interfaceName)) {
            interfaces.set(interfaceName, {
              name: interfaceName,
              config: [],
              isAccess: false
            });
          }
          
          const iface = interfaces.get(interfaceName)!;
          iface.config.push(trimmed);
          
          // Extract description if present
          if (trimmed.includes('description')) {
            const descMatch = trimmed.match(/description\s+"([^"]+)"/);
            if (descMatch) {
              iface.description = descMatch[1];
            } else {
              // Handle description without quotes
              const descIndex = parts.findIndex(part => part === 'description') + 1;
              if (descIndex > 0 && parts[descIndex]) {
                iface.description = parts.slice(descIndex).join(' ').replace(/"/g, '');
              }
            }
          }
          
          // Check if it's an access port - improved detection
          if (trimmed.includes('family ethernet-switching port-mode access') || 
              (trimmed.includes('ethernet-switching-options') && trimmed.includes('port-mode access'))) {
            iface.isAccess = true;
          }
        }
      }
    }

    return Array.from(interfaces.values()).filter(iface => 
      iface.name.startsWith('ge-') && iface.isAccess
    );
  }

  private parsePort(interfaceName: string): { fpc: number; pic: number; port: number } | null {
    const match = interfaceName.match(/ge-(\d+)\/(\d+)\/(\d+)/);
    if (!match) return null;
    
    return {
      fpc: parseInt(match[1]),
      pic: parseInt(match[2]),
      port: parseInt(match[3])
    };
  }

  private groupConsecutive(interfaces: Interface[]): Array<{fpc: number, pic: number, ranges: Array<{start: number, end: number}>}> {
    const groups: Map<string, number[]> = new Map();
    
    // Group interfaces by fpc/pic
    for (const iface of interfaces) {
      if (!iface.isAccess) continue;
      
      const parsed = this.parsePort(iface.name);
      if (!parsed) continue;
      
      const key = `${parsed.fpc}/${parsed.pic}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(parsed.port);
    }
    
    // Convert to ranges
    const result: Array<{fpc: number, pic: number, ranges: Array<{start: number, end: number}>}> = [];
    
    for (const [key, ports] of groups.entries()) {
      const [fpc, pic] = key.split('/').map(Number);
      ports.sort((a, b) => a - b);
      
      const ranges: Array<{start: number, end: number}> = [];
      let start = ports[0];
      let end = ports[0];
      
      for (let i = 1; i < ports.length; i++) {
        if (ports[i] === end + 1) {
          end = ports[i];
        } else {
          ranges.push({ start, end });
          start = ports[i];
          end = ports[i];
        }
      }
      ranges.push({ start, end });
      
      result.push({ fpc, pic, ranges });
    }
    
    return result;
  }

  generateDot1xConfig(interfaces: Interface[]): string {
    const configs: string[] = [];
    
    for (const iface of interfaces) {
      if (iface.isAccess) {
        // Set description based on existing description
        if (iface.description) {
          configs.push(`set interfaces ${iface.name} description "802.1x ${iface.description}"`);
        } else {
          configs.push(`set interfaces ${iface.name} description "802.1x PC-TEL"`);
        }
        
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

  generateDot1xConfigWildcard(interfaces: Interface[]): string {
    const configs: string[] = [];
    const groups = this.groupConsecutive(interfaces);
    
    for (const group of groups) {
      for (const range of group.ranges) {
        const rangeStr = range.start === range.end 
          ? `${range.start}` 
          : `${range.start}-${range.end}`;
        
        const interfacePattern = `ge-${group.fpc}/${group.pic}/[${rangeStr}]`;
        
        configs.push(`wildcard range set interfaces ${interfacePattern} description "802.1x PC-TEL"`);
        configs.push(`wildcard range set interfaces ${interfacePattern} unit 0 family ethernet-switching vlan members VL2_BUREAUTIQUE_Filaire-Wifi`);
        configs.push(`wildcard range set protocols dot1x authenticator interface ${interfacePattern} supplicant multiple`);
        configs.push(`wildcard range set protocols dot1x authenticator interface ${interfacePattern} retries 3`);
        configs.push(`wildcard range set protocols dot1x authenticator interface ${interfacePattern} transmit-period 1`);
        configs.push(`wildcard range set protocols dot1x authenticator interface ${interfacePattern} reauthentication 3600`);
        configs.push(`wildcard range set protocols dot1x authenticator interface ${interfacePattern} supplicant-timeout 10`);
        configs.push(`wildcard range set protocols dot1x authenticator interface ${interfacePattern} maximum-requests 3`);
        configs.push('');
      }
    }
    
    return configs.join('\n');
  }

  generateCleanupConfig(interfaces: Interface[]): string {
    const configs: string[] = [];
    
    for (const iface of interfaces) {
      if (iface.isAccess) {
        // Remove MAC limit configurations
        configs.push(`delete ethernet-switching-options secure-access-port interface ${iface.name} mac-limit 3`);
        configs.push(`delete ethernet-switching-options secure-access-port interface ${iface.name} mac-limit action`);
      }
    }
    
    return configs.join('\n');
  }

  generateCleanupConfigWildcard(interfaces: Interface[]): string {
    const configs: string[] = [];
    const groups = this.groupConsecutive(interfaces);
    
    for (const group of groups) {
      for (const range of group.ranges) {
        const rangeStr = range.start === range.end 
          ? `${range.start}` 
          : `${range.start}-${range.end}`;
        
        const interfacePattern = `ge-${group.fpc}/${group.pic}/[${rangeStr}]`;
        
        configs.push(`wildcard range delete ethernet-switching-options secure-access-port interface ${interfacePattern} mac-limit 3`);
        configs.push(`wildcard range delete ethernet-switching-options secure-access-port interface ${interfacePattern} mac-limit action drop`);
        configs.push('');
      }
    }
    
    return configs.join('\n');
  }

  getRadiusConfig(managementIp?: string): string {
    const sourceAddress = managementIp || '10.148.62.241';
    return `set access radius-server 10.147.32.47 port 1812
set access radius-server 10.147.32.47 secret "$9$qfTF69tBRcP5Qn9tREdbwsoJUjH.fT"
set access radius-server 10.147.32.47 source-address ${sourceAddress}
set access radius-server 10.147.160.47 port 1812
set access radius-server 10.147.160.47 secret "$9$72Vw2oJUkm5dbs4JUmPBIREreM8XNVw"
set access radius-server 10.147.160.47 source-address ${sourceAddress}
set access profile 802.1x-auth accounting-order radius
set access profile 802.1x-auth authentication-order radius
set access profile 802.1x-auth radius authentication-server 10.147.32.47
set access profile 802.1x-auth radius authentication-server 10.147.160.47
set access profile 802.1x-auth radius accounting-server 10.147.32.47
set access profile 802.1x-auth radius accounting-server 10.147.160.47
set protocols dot1x authenticator authentication-profile-name 802.1x-auth`;
  }
}