import { create } from 'zustand';

interface AppState {
  ppm: number;
  hasCalibrated: boolean;
  setPpm: (ppm: number) => void;
  
  premiumThreshold: number;
  setPremiumThreshold: (threshold: number) => void;
  
  // App-wide loading/network status
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  
  currentBatchReports: any[];
  currentBatchFiles: {uri: string, type: 'photo'|'video'}[];
  setCurrentBatch: (reports: any[], files: {uri: string, type: 'photo'|'video'}[]) => void;

  // Simulated results from the What-If Simulator
  simulatedBatchReports: any[] | null;
  setSimulatedBatch: (reports: any[] | null) => void;
  
  // Authorize: replace original with simulated
  authorizeSettlement: () => void;

  language: 'EN' | 'HI' | 'MR';
  setLanguage: (lang: 'EN' | 'HI' | 'MR') => void;

  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;

  backendUrl: string;
  setBackendUrl: (url: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  ppm: 2.4, // Default fallback
  hasCalibrated: false,
  setPpm: (ppm) => set({ ppm, hasCalibrated: true }),
  
  premiumThreshold: 45,
  setPremiumThreshold: (threshold) => set({ premiumThreshold: threshold }),
  
  isOnline: true,
  setIsOnline: (online) => set({ isOnline: online }),
  
  currentBatchReports: [],
  currentBatchFiles: [],
  setCurrentBatch: (reports, files) => set({ currentBatchReports: reports, currentBatchFiles: files, simulatedBatchReports: null }),

  simulatedBatchReports: null,
  setSimulatedBatch: (reports) => set({ simulatedBatchReports: reports }),
  
  authorizeSettlement: () => {
    const { simulatedBatchReports } = get();
    if (simulatedBatchReports && simulatedBatchReports.length > 0) {
      set({ currentBatchReports: simulatedBatchReports, simulatedBatchReports: null });
    }
  },

  language: 'EN',
  setLanguage: (lang) => set({ language: lang }),

  theme: 'light',
  setTheme: (theme) => set({ theme }),

  backendUrl: 'http://10.19.206.69:8000',
  setBackendUrl: (url) => set({ backendUrl: url }),
}));
