/**
 * apiService.js
 * 
 * Centralized API service for communicating with the FastAPI backend.
 * Maps every backend endpoint to a clean function the frontend can call.
 * 
 * Backend Endpoints:
 *   POST /analyze          — Analyze onion heap image/video  
 *   POST /simulate-grading — Re-grade with custom size threshold
 *   GET  /docs             — Health check (FastAPI auto-docs)
 */
import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';

// Default timeout for all API calls (60 seconds for large video processing)
const API_TIMEOUT_MS = 60000;
// Health check timeout (fast, just checking if server is alive)
const HEALTH_TIMEOUT_MS = 4000;

/**
 * Extracts the base URL from the full analyze endpoint URL.
 * e.g., "http://192.168.1.101:8000/analyze" → "http://192.168.1.101:8000"
 */
const getBaseUrl = (apiUrl) => {
  return apiUrl.replace(/\/analyze\/?$/, '').replace(/\/+$/, '');
};

/**
 * Check if the FastAPI backend is reachable.
 * Hits the auto-generated /docs endpoint as a lightweight health probe.
 * 
 * @param {string} apiUrl - Full API URL (e.g., "http://192.168.1.101:8000/analyze")
 * @returns {Promise<{connected: boolean, serverInfo: string|null, error: string|null}>}
 */
export const checkHealth = async (apiUrl) => {
  try {
    const baseUrl = getBaseUrl(apiUrl);
    const response = await axios.get(baseUrl + '/docs', { timeout: HEALTH_TIMEOUT_MS });
    
    if (response.status === 200) {
      return {
        connected: true,
        serverInfo: 'SIH Onion Procurement API v1.0',
        error: null,
      };
    }
    return {
      connected: false,
      serverInfo: null,
      error: `Server returned status ${response.status}`,
    };
  } catch (e) {
    let errorMsg = 'Server unreachable';
    if (e.code === 'ECONNREFUSED') {
      errorMsg = 'Connection refused — is the backend running?';
    } else if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
      errorMsg = 'Connection timed out — check IP address and port';
    } else if (e.message) {
      errorMsg = e.message;
    }
    return {
      connected: false,
      serverInfo: null,
      error: errorMsg,
    };
  }
};

/**
 * Upload an image or video file to POST /analyze for onion quality grading.
 * 
 * Backend expects:
 *   - file: UploadFile (multipart form field named "file")
 *   - ppm: float (pixels per millimeter, Form field, default 2.4)
 * 
 * Backend returns on success:
 *   {
 *     batch_metrics: {
 *       total_unique_onions: number,
 *       grade_a_pct: number,      // e.g. 65.2
 *       grade_c_pct: number,      // e.g. 28.3
 *       urs_pct: number,          // e.g. 6.5
 *       confidence_interval_95: string  // e.g. "±8.42%"
 *     },
 *     defect_breakdown: [
 *       { fault: string, severity_pct: number }   // e.g. { fault: "Sprouting", severity_pct: 45.2 }
 *     ]
 *   }
 * 
 * Backend returns on quality gate failure:
 *   { gate_failed: true, reason: string }
 * 
 * Quality Gates (enforced server-side):
 *   Gate 1: No circular objects found → gate_failed
 *   Gate 2: Fewer than 4 objects detected → gate_failed
 *   Gate 3: ≥80% objects are non-onion/URS → gate_failed
 * 
 * @param {string} apiUrl - Full API URL ending in /analyze
 * @param {string} fileUri - Local file URI (from camera or gallery)
 * @param {number} ppm - Pixels per millimeter calibration value
 * @returns {Promise<{success: boolean, data: object|null, error: string|null, isGateFailure: boolean}>}
 */
export const analyzeHeap = async (apiUrl, fileUri, ppm = 2.4) => {
  try {
    const response = await Promise.race([
      FileSystem.uploadAsync(apiUrl, fileUri, {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        parameters: { ppm: ppm.toString() },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Analysis timed out after 60s. The server may be processing a large file.')), API_TIMEOUT_MS)
      ),
    ]);

    if (response.status !== 200) {
      return {
        success: false,
        data: null,
        error: `Server error (HTTP ${response.status}). Check if the backend is running.`,
        isGateFailure: false,
      };
    }

    const data = JSON.parse(response.body);

    // Check for quality gate rejection
    if (data.gate_failed) {
      return {
        success: false,
        data: data,
        error: data.reason || 'Image quality check failed.',
        isGateFailure: true,
      };
    }

    return {
      success: true,
      data: data,
      error: null,
      isGateFailure: false,
    };
  } catch (error) {
    let errorMsg = error.message || 'Failed to connect to analysis server.';
    if (errorMsg.includes('Network request failed')) {
      errorMsg = 'Network error — check Wi-Fi connection and server IP.';
    }
    return {
      success: false,
      data: null,
      error: errorMsg,
      isGateFailure: false,
    };
  }
};

/**
 * Upload an image or video to POST /simulate-grading with a custom size threshold.
 * This lets farmers see "what-if" scenarios by adjusting the Grade A minimum diameter.
 * 
 * Backend expects:
 *   - file: UploadFile (multipart form field named "file")
 *   - ppm: float (pixels per millimeter, Form field)
 *   - min_premium_mm: float (minimum diameter in mm for Grade A, Form field, default 65.0)
 * 
 * Response format is identical to /analyze.
 * 
 * @param {string} apiUrl - Full API URL ending in /analyze (will be transformed to /simulate-grading)
 * @param {string} fileUri - Local file URI
 * @param {number} ppm - Pixels per millimeter
 * @param {number} minPremiumMm - Custom Grade A minimum diameter threshold in mm
 * @returns {Promise<{success: boolean, data: object|null, error: string|null, isGateFailure: boolean}>}
 */
export const simulateGrading = async (apiUrl, fileUri, ppm = 2.4, minPremiumMm = 65.0) => {
  const simulationUrl = apiUrl.replace(/\/analyze\/?$/, '/simulate-grading');

  try {
    const response = await Promise.race([
      FileSystem.uploadAsync(simulationUrl, fileUri, {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        parameters: {
          ppm: ppm.toString(),
          min_premium_mm: minPremiumMm.toString(),
        },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Simulation timed out after 60s.')), API_TIMEOUT_MS)
      ),
    ]);

    if (response.status !== 200) {
      return {
        success: false,
        data: null,
        error: `Simulation server error (HTTP ${response.status}).`,
        isGateFailure: false,
      };
    }

    const data = JSON.parse(response.body);

    if (data.gate_failed) {
      return {
        success: false,
        data: data,
        error: data.reason || 'Image rejected during simulation.',
        isGateFailure: true,
      };
    }

    return {
      success: true,
      data: data,
      error: null,
      isGateFailure: false,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error.message || 'Simulation failed.',
      isGateFailure: false,
    };
  }
};

/**
 * Sync an offline-queued scan to the backend.
 * Same as analyzeHeap but with specific error handling for batch sync.
 * 
 * @param {string} apiUrl - Full API URL
 * @param {string} fileUri - Local cached file URI
 * @param {number} ppm - Pixels per millimeter
 * @returns {Promise<{success: boolean, data: object|null, isGateFailure: boolean, error: string|null}>}
 */
export const syncOfflineScan = async (apiUrl, fileUri, ppm) => {
  return analyzeHeap(apiUrl, fileUri, ppm);
};
