// src/renderer/electron.d.ts
export interface IElectronAPI {
  ipcRenderer: {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    once: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    send: (channel: string, ...args: any[]) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    removeListener: (channel: string, listener: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
  // Add other Electron APIs you expose (like versions, platform, etc.)
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}