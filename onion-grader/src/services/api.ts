
import * as FileSystem from 'expo-file-system/legacy';

// For development on physical device, replace with your actual machine IP.
// In production, this would be an env var.
import { useAppStore } from '../store';



export interface AnalyzeResponse {
  batch_metrics: {
    total_unique_onions: number;
    grade_a_pct: string;
    grade_c_pct: string;
    urs_pct: string;
    confidence_interval_95: string;
  };
  defect_breakdown?: Array<{
    fault: string;
    severity_pct: number;
  }>;
  detections?: Array<{
    box: [number, number, number, number];
    class: 'healthy' | 'damaged' | 'unrecognized';
    tier?: string;
    defect?: string;
  }>;
  gate_failed?: boolean;
  reason?: string;
}

export const apiService = {
  /**
   * Analyzes an image or video using the backend.
   * If the network request fails, caches the file locally using the offline queue.
   */
  async analyzeBatch(fileUri: string, ppm: number, type: 'photo' | 'video'): Promise<AnalyzeResponse> {
    try {
      console.log(`Uploading ${type} from ${fileUri} to ${useAppStore.getState().backendUrl}/analyze with ppm=${ppm}`);
      const response = await FileSystem.uploadAsync(`${useAppStore.getState().backendUrl}/analyze`, fileUri, {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: 1, // FileSystemUploadType.MULTIPART
        parameters: { ppm: ppm.toString() }
      });
      
      console.log(`Server responded with status: ${response.status}`);
      if (response.status !== 200) {
        throw new Error(`Server returned status: ${response.status}. Body: ${response.body}`);
      }
      
      return JSON.parse(response.body) as AnalyzeResponse;
    } catch (err: any) {
      console.error("analyzeBatch error:", err);
      throw err;
    }
  },

  async simulateGrading(fileUri: string, ppm: number, minPremiumMm: number): Promise<AnalyzeResponse> {
    const response = await FileSystem.uploadAsync(`${useAppStore.getState().backendUrl}/simulate-grading`, fileUri, {
      fieldName: 'file',
      httpMethod: 'POST',
      uploadType: 1, // FileSystemUploadType.MULTIPART
      parameters: { 
        ppm: ppm.toString(),
        min_premium_mm: minPremiumMm.toString()
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`Server returned status: ${response.status}`);
    }
    
    return JSON.parse(response.body) as AnalyzeResponse;
  },
  
  // Directly syncs a file from the offline queue.
  // We expose this specifically for the background sync process.
  async syncQueuedItem(fileUri: string, ppm: number): Promise<AnalyzeResponse> {
    const response = await FileSystem.uploadAsync(`${useAppStore.getState().backendUrl}/analyze`, fileUri, {
      fieldName: 'file',
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      parameters: { ppm: ppm.toString() }
    });
    
    if (response.status !== 200) {
      throw new Error(`Server returned status: ${response.status}`);
    }
    
    return JSON.parse(response.body) as AnalyzeResponse;
  }
};

