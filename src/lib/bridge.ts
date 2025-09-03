/**
 * Bridge API Client for Local Network Management Server
 * Provides functions to communicate with the local Python bridge server
 */

const BRIDGE_SERVER_URL = 'http://127.0.0.1:5001';

export interface BridgeResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DeviceInfo {
  type: string;
  host: string;
  username: string;
  hostname?: string;
}

export interface ConfigurationData {
  configuration: string;
  hostname: string;
  logs: string;
  message: string;
}

export class BridgeClient {
  private baseURL: string;
  private isAvailable: boolean = false;

  constructor(baseURL: string = BRIDGE_SERVER_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Vérifie si le serveur bridge est disponible
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        mode: 'cors',
      });

      const data = await response.json();
      this.isAvailable = response.ok && data.status === 'ok';
      return this.isAvailable;
    } catch (error) {
      console.warn('Bridge server non disponible:', error);
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Ping d'un périphérique
   */
  async pingDevice(host: string): Promise<BridgeResponse> {
    if (!this.isAvailable) {
      throw new Error('Bridge server non disponible');
    }

    try {
      const response = await fetch(`${this.baseURL}/ping-device`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ host }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.detail || 'Erreur ping'
        };
      }

      return {
        success: data.success,
        data: data,
        message: data.message
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur réseau: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      };
    }
  }

  /**
   * Test de connexion SSH
   */
  async testConnection(
    host: string, 
    username: string, 
    password: string, 
    deviceType: string = 'juniper'
  ): Promise<BridgeResponse<DeviceInfo>> {
    if (!this.isAvailable) {
      throw new Error('Bridge server non disponible');
    }

    try {
      const response = await fetch(`${this.baseURL}/test-connection`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host,
          username,
          password,
          device_type: deviceType
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.detail || 'Erreur test connexion'
        };
      }

      return {
        success: data.success,
        data: data.device_info,
        message: data.message
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur réseau: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      };
    }
  }

  /**
   * Récupération de configuration via serveur Rebond
   */
  async getConfiguration(
    rebondIp: string,
    rebondUsername: string, 
    rebondPassword: string,
    switchIp: string,
    switchUsername: string,
    switchPassword: string,
    switchCommand?: string
  ): Promise<BridgeResponse<ConfigurationData>> {
    if (!this.isAvailable) {
      throw new Error('Bridge server non disponible');
    }

    try {
      const response = await fetch(`${this.baseURL}/get-configuration`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rebond_ip: rebondIp,
          rebond_username: rebondUsername,
          rebond_password: rebondPassword,
          switch_ip: switchIp,
          switch_username: switchUsername,
          switch_password: switchPassword,
          switch_command: switchCommand || 'show configuration | display set | no-more'
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.detail || 'Erreur récupération configuration'
        };
      }

      return {
        success: data.success,
        data: {
          configuration: data.configuration,
          hostname: data.hostname,
          logs: data.logs,
          message: data.message
        },
        message: data.message
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur réseau: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      };
    }
  }

  /**
   * Getter pour le statut de disponibilité
   */
  get available(): boolean {
    return this.isAvailable;
  }

  /**
   * Getter pour l'URL du serveur
   */
  get serverURL(): string {
    return this.baseURL;
  }
}

// Instance par défaut
export const bridgeClient = new BridgeClient();

// Hook pour utiliser dans les composants React
export const useBridge = () => {
  return {
    client: bridgeClient,
    checkAvailability: () => bridgeClient.checkAvailability(),
    pingDevice: (host: string) => bridgeClient.pingDevice(host),
    testConnection: (host: string, username: string, password: string, deviceType?: string) =>
      bridgeClient.testConnection(host, username, password, deviceType),
    getConfiguration: (
      rebondIp: string,
      rebondUsername: string, 
      rebondPassword: string,
      switchIp: string,
      switchUsername: string,
      switchPassword: string,
      switchCommand?: string
    ) => bridgeClient.getConfiguration(rebondIp, rebondUsername, rebondPassword, switchIp, switchUsername, switchPassword, switchCommand),
    get available() {
      return bridgeClient.available;
    },
    get serverURL() {
      return bridgeClient.serverURL;
    }
  };
};