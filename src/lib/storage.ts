// Session storage utility for configuration persistence

export interface DeviceConnectionForm {
  rebondUsername: string;
  rebondPassword: string;
  switchIp: string;
  switchUsername: string;
  switchPassword: string;
  customRows: Array<{
    id: string;
    ip: string;
    username: string;
    password: string;
  }>;
}

export interface SingleConfiguration {
  configuration: string;
  extractedHostname: string;
}

export interface SwitchResult {
  id: string;
  ip: string;
  username: string;
  hostname?: string;
  configuration?: string;
  status: 'idle' | 'running' | 'success' | 'error';
  error?: string;
}

export interface JuniperUpload {
  configContent: string;
  filename: string;
}

export interface JuniperMultiUpload {
  files: Array<{
    configContent: string;
    filename: string;
  }>;
}

const STORAGE_KEYS = {
  DC_FORM: 'dc_form',
  DC_SINGLE: 'dc_single', 
  DC_RESULTS: 'dc_results',
  JUNIPER_UPLOAD: 'juniper_last_upload',
  JUNIPER_MULTI_UPLOAD: 'juniper_multi_upload'
} as const;

// Generic storage functions
export const saveToStorage = <T>(key: string, data: T): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to sessionStorage:', error);
  }
};

export const loadFromStorage = <T>(key: string): T | null => {
  try {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Error loading from sessionStorage:', error);
    return null;
  }
};

export const removeFromStorage = (key: string): void => {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing from sessionStorage:', error);
  }
};

export const clearAllStorage = (): void => {
  Object.values(STORAGE_KEYS).forEach(key => {
    removeFromStorage(key);
  });
};

// Specific storage functions
export const saveDeviceConnectionForm = (data: DeviceConnectionForm): void => {
  saveToStorage(STORAGE_KEYS.DC_FORM, data);
};

export const loadDeviceConnectionForm = (): DeviceConnectionForm | null => {
  return loadFromStorage<DeviceConnectionForm>(STORAGE_KEYS.DC_FORM);
};

export const saveSingleConfiguration = (data: SingleConfiguration): void => {
  saveToStorage(STORAGE_KEYS.DC_SINGLE, data);
};

export const loadSingleConfiguration = (): SingleConfiguration | null => {
  return loadFromStorage<SingleConfiguration>(STORAGE_KEYS.DC_SINGLE);
};

export const saveMultiSwitchResults = (data: SwitchResult[]): void => {
  saveToStorage(STORAGE_KEYS.DC_RESULTS, data);
};

export const loadMultiSwitchResults = (): SwitchResult[] | null => {
  return loadFromStorage<SwitchResult[]>(STORAGE_KEYS.DC_RESULTS);
};

export const saveJuniperUpload = (data: JuniperUpload): void => {
  saveToStorage(STORAGE_KEYS.JUNIPER_UPLOAD, data);
};

export const loadJuniperUpload = (): JuniperUpload | null => {
  return loadFromStorage<JuniperUpload>(STORAGE_KEYS.JUNIPER_UPLOAD);
};

export const saveJuniperMultiUpload = (data: JuniperMultiUpload): void => {
  saveToStorage(STORAGE_KEYS.JUNIPER_MULTI_UPLOAD, data);
};

export const loadJuniperMultiUpload = (): JuniperMultiUpload | null => {
  return loadFromStorage<JuniperMultiUpload>(STORAGE_KEYS.JUNIPER_MULTI_UPLOAD);
};