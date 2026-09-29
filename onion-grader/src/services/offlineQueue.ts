import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { apiService, AnalyzeResponse } from './api';

const QUEUE_STORAGE_KEY = '@onion_grader_offline_queue';

export interface QueueItem {
  id: string;
  uri: string;
  ppm: number;
  type: 'photo' | 'video';
  timestamp: string;
  status: 'pending' | 'uploading' | 'failed';
  retryCount: number;
}

class OfflineQueueService {
  private queue: QueueItem[] = [];
  private listeners: Array<(queue: QueueItem[]) => void> = [];

  constructor() {
    this.loadQueue();
  }

  subscribe(listener: (queue: QueueItem[]) => void) {
    this.listeners.push(listener);
    listener(this.queue);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.queue));
  }

  private async loadQueue() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        this.notify();
      }
    } catch (e) {
      console.error('Failed to load offline queue:', e);
    }
  }

  private async saveQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      this.notify();
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  }

  async enqueue(fileUri: string, ppm: number, type: 'photo' | 'video'): Promise<void> {
    const queueDir = `${FileSystem.documentDirectory}offline_queue/`;
    const dirInfo = await FileSystem.getInfoAsync(queueDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(queueDir, { intermediates: true });
    }

    const scanId = `SCAN_${Date.now()}`;
    const ext = type === 'video' ? 'mp4' : 'jpg';
    const persistentPath = `${queueDir}${scanId}.${ext}`;

    await FileSystem.copyAsync({ from: fileUri, to: persistentPath });

    const newItem: QueueItem = {
      id: scanId,
      uri: persistentPath,
      ppm,
      type,
      timestamp: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    };

    this.queue.push(newItem);
    await this.saveQueue();
  }

  async processQueue(): Promise<{ successful: number, rejected: number, failed: number, results: AnalyzeResponse[] }> {
    let successful = 0;
    let rejected = 0;
    let failed = 0;
    let results: AnalyzeResponse[] = [];
    
    const now = Date.now();

    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (item.status === 'uploading') continue;
      
      // Exponential backoff: base delay 5s * 2^retryCount
      if (item.status === 'failed') {
        const backoffMs = 5000 * Math.pow(2, item.retryCount);
        const lastAttempt = new Date(item.timestamp).getTime();
        if (now - lastAttempt < backoffMs) {
          continue; // Skip, still in backoff period
        }
      }

      this.queue[i].status = 'uploading';
      this.queue[i].timestamp = new Date().toISOString(); // Update timestamp for next backoff calc
      await this.saveQueue();

      try {
        const result = await apiService.syncQueuedItem(item.uri, item.ppm);
        if (result.gate_failed) {
          rejected++;
        } else {
          successful++;
          results.push(result);
        }

        // Cleanup file safely
        try {
          await FileSystem.deleteAsync(item.uri, { idempotent: true });
        } catch (e) {
          console.warn("Failed to delete synced file:", e);
        }
        
        // Remove from queue
        this.queue = this.queue.filter(q => q.id !== item.id);
        i--; // Adjust index since array shifted
      } catch (e) {
        console.error(`Failed to sync item ${item.id}`, e);
        failed++;
        
        // Revert status to failed and increment retry
        const failedItem = this.queue.find(q => q.id === item.id);
        if (failedItem) {
          failedItem.status = 'failed';
          failedItem.retryCount += 1;
        }
      }
      await this.saveQueue();
    }

    return { successful, rejected, failed, results };
  }

  getQueue() {
    return this.queue;
  }

  async remove(id: string) {
    const item = this.queue.find(q => q.id === id);
    if (item) {
      try {
        await FileSystem.deleteAsync(item.uri, { idempotent: true });
      } catch (e) {
        console.warn("Failed to delete local file:", e);
      }
      this.queue = this.queue.filter(q => q.id !== id);
      await this.saveQueue();
    }
  }

  async clearAll() {
    for (const item of this.queue) {
      try {
        await FileSystem.deleteAsync(item.uri, { idempotent: true });
      } catch (e) {
        // ignore
      }
    }
    this.queue = [];
    await this.saveQueue();
  }
}

// Singleton pattern
let instance: OfflineQueueService;
export const getOfflineQueueService = () => {
  if (!instance) {
    instance = new OfflineQueueService();
  }
  return instance;
};
