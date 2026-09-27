import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList, TextInput, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

const QUEUE_STORAGE_KEY = '@onion_grader_offline_queue';

// --- FEATURE 4: HARDCODED SAMPLING SEQUENCE ---
const SAMPLING_PROMPTS = ["Scan Top Layer", "Scan Middle Crate", "Scan Bottom Layer"];

// Helper function to safely aggregate 3 separate AI JSON responses into 1 master report
const aggregateReports = (reports) => {
  let total = 0, aCount = 0, cCount = 0, ursCount = 0;
  let allDefects = [];

  reports.forEach(r => {
    const t = r.batch_metrics.total_unique_onions;
    total += t;
    aCount += Math.round((r.batch_metrics.grade_a_pct / 100) * t);
    cCount += Math.round((r.batch_metrics.grade_c_pct / 100) * t);
    ursCount += Math.round((r.batch_metrics.urs_pct / 100) * t);
    if (r.defect_breakdown) allDefects = allDefects.concat(r.defect_breakdown);
  });

  const defectMap = {};
  allDefects.forEach(d => {
    if (!defectMap[d.fault]) defectMap[d.fault] = { count: 0, severitySum: 0 };
    defectMap[d.fault].count += 1;
    defectMap[d.fault].severitySum += parseFloat(d.severity_pct);
  });

  const finalDefects = Object.keys(defectMap).map(key => ({
    fault: key,
    severity_pct: (defectMap[key].severitySum / defectMap[key].count).toFixed(1)
  }));

  let p_a = total > 0 ? (aCount / total) : 0;
  let margin = total > 0 ? (1.96 * Math.sqrt((p_a * (1 - p_a)) / total) * 100).toFixed(2) : 0.0;

  return {
    batch_metrics: {
      total_unique_onions: total,
      grade_a_pct: total > 0 ? ((aCount / total) * 100).toFixed(1) : "0.0",
      grade_c_pct: total > 0 ? ((cCount / total) * 100).toFixed(1) : "0.0",
      urs_pct: total > 0 ? ((ursCount / total) * 100).toFixed(1) : "0.0",
      confidence_interval_95: `±${margin}%`
    },
    defect_breakdown: finalDefects
  };
};

export default function App() {
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  
  const [mode, setMode] = useState('video');
  const [captureState, setCaptureState] = useState('idle'); 
  const [timeLeft, setTimeLeft] = useState(5);
  const [report, setReport] = useState(null);
  
  const [isCalibrating, setIsCalibrating] = useState(true); 
  const [circleSize, setCircleSize] = useState(110); 
  const [ppm, setPpm] = useState(2.4); 

  const [syncQueue, setSyncQueue] = useState([]);
  const [showQueueModal, setShowQueueModal] = useState(false);
  
  // --- FEATURE 4 STATE: Multi-Scan Buffer ---
  const [sampleIndex, setSampleIndex] = useState(0);
  const [mediaCache, setMediaCache] = useState([]); 
  const [reportBuffer, setReportBuffer] = useState([]);

  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeStep, setDisputeStep] = useState('init'); 
  const [disputeNotes, setDisputeNotes] = useState('');
  const [disputeData, setDisputeData] = useState(null); 
  const [isReassessing, setIsReassessing] = useState(false); 

  const [premiumThreshold, setPremiumThreshold] = useState(65);
  const [isSimulating, setIsSimulating] = useState(false);
  
  const [isDeviceSteady, setIsDeviceSteady] = useState(true);
  const isDeviceSteadyRef = useRef(true); 
  
  const cameraRef = useRef(null);

  useEffect(() => {
    loadOfflineQueue();

    Accelerometer.setUpdateInterval(200);
    const subscription = Accelerometer.addListener(data => {
      const { x, y, z } = data;
      const totalForce = Math.sqrt(x * x + y * y + z * z);
      const steady = Math.abs(totalForce - 1.0) <= 0.08;
      isDeviceSteadyRef.current = steady;
      setIsDeviceSteady(steady);
    });

    return () => subscription.remove();
  }, []);

  const loadOfflineQueue = async () => {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) setSyncQueue(JSON.parse(stored));
    } catch (e) {
      console.error("Failed to load offline queue:", e);
    }
  };

  const saveToOfflineQueue = async (fileUri, fileType, currentPpm) => {
    try {
      const queueDir = `${FileSystem.documentDirectory}offline_queue/`;
      const dirInfo = await FileSystem.getInfoAsync(queueDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(queueDir, { intermediates: true });
      }

      const scanId = `SCAN_${Date.now()}`;
      const ext = fileType === 'video' ? 'mp4' : 'jpg';
      const persistentPath = `${queueDir}${scanId}.${ext}`;

      await FileSystem.copyAsync({ from: fileUri, to: persistentPath });

      const newEntry = {
        id: scanId,
        uri: persistentPath,
        fileType,
        ppm: currentPpm,
        timestamp: new Date().toLocaleTimeString(),
      };

      const updatedQueue = [...syncQueue, newEntry];
      setSyncQueue(updatedQueue);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updatedQueue));

      Alert.alert(
        "Mandi Offline Mode",
        "Network connection unreachable. Sample saved to device queue."
      );
    } catch (err) {
      Alert.alert("Error", "Could not cache scan locally.");
    }
  };

  const resetBatch = () => {
    setReport(null);
    setSampleIndex(0);
    setMediaCache([]);
    setReportBuffer([]);
  };

  const handleCapture = async () => {
    if (!cameraRef.current || captureState !== 'idle' || !isDeviceSteadyRef.current) return;

    try {
      if (mode === 'video') {
        setCaptureState('recording');
        
        let time = 5;
        setTimeLeft(time);
        let aborted = false;

        const timer = setInterval(() => {
          if (!isDeviceSteadyRef.current) {
            clearInterval(timer);
            aborted = true;
            cameraRef.current.stopRecording(); 
            setCaptureState('idle');
            Alert.alert("Capture Aborted 📳", "Device was shaking too much. Hold steady.");
            return;
          }
          time -= 1;
          setTimeLeft(time);
          if (time <= 0) clearInterval(timer);
        }, 1000);

        const video = await cameraRef.current.recordAsync({ maxDuration: 5 });
        if (aborted) return; 
        
        setCaptureState('analyzing');
        await sendToAPI(video.uri, 'video', ppm);
      } else {
        setCaptureState('analyzing');
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        await sendToAPI(photo.uri, 'photo', ppm);
      }
    } catch (error) {
      Alert.alert("Capture failed", "Check console.");
      setCaptureState('idle');
    }
  };

  const sendToAPI = async (fileUri, fileType, currentPpm) => {
    const apiUrl = 'http://10.19.206.69:8000/analyze'; 
    
    try {
      const response = await Promise.race([
        FileSystem.uploadAsync(apiUrl, fileUri, {
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          parameters: { ppm: currentPpm.toString() }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Processing Timeout")), 60000))
      ]);

      if (response.status !== 200) throw new Error(`Server returned status: ${response.status}`);

      const data = JSON.parse(response.body);
      
      if (data.gate_failed) {
        Alert.alert("Quality Gate Rejected ❌", data.reason);
        // Note: We deliberately do NOT advance the sampleIndex here. They must retry this step.
        setCaptureState('idle');
        return; 
      }

      // --- FEATURE 4: Update Buffers & Sequence Logic ---
      const updatedMediaCache = [...mediaCache, { uri: fileUri, type: fileType }];
      const updatedReportBuffer = [...reportBuffer, data];
      
      setMediaCache(updatedMediaCache);
      setReportBuffer(updatedReportBuffer);

      if (sampleIndex < SAMPLING_PROMPTS.length - 1) {
        // More samples needed. Increment sequence and stay in camera mode.
        setSampleIndex(sampleIndex + 1);
        Alert.alert("Sample Logged ✅", `Proceed to: ${SAMPLING_PROMPTS[sampleIndex + 1]}`);
        setCaptureState('idle');
        return;
      }
      
      // All 3 samples collected. Mathematically aggregate.
      const finalAggregatedReport = aggregateReports(updatedReportBuffer);

      if (isReassessing) {
        setDisputeData(finalAggregatedReport.batch_metrics);
        setIsReassessing(false);      
        setDisputeStep('comparison'); 
        setShowDisputeModal(true);    
      } else {
        setDisputeData(null);
        setDisputeNotes('');
        setDisputeStep('init');
        setPremiumThreshold(65); 
        setReport(finalAggregatedReport);
      }
      
    } catch (error) {
      console.warn("Upload or processing failed:", error.message);
      await saveToOfflineQueue(fileUri, fileType, currentPpm);
    } finally {
      setCaptureState('idle');
    }
  };

  const processSyncQueue = async () => {
    if (syncQueue.length === 0) return;
    setCaptureState('syncing');

    const remaining = [];
    let lastReport = null;
    let rejectedCount = 0;

    for (const item of syncQueue) {
      try {
        const response = await Promise.race([
          FileSystem.uploadAsync('http://10.19.206.69:8000/analyze', item.uri, {
            fieldName: 'file',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            parameters: { ppm: item.ppm.toString() }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Queue Sync Timeout")), 60000))
        ]);

        if (response.status !== 200) throw new Error("Sync failed");
        
        const parsedBody = JSON.parse(response.body);
        
        if (parsedBody.gate_failed) {
          rejectedCount += 1;
        } else {
          lastReport = parsedBody;
        }
        
        await FileSystem.deleteAsync(item.uri, { idempotent: true });
      } catch (err) {
        remaining.push(item);
      }
    }

    setSyncQueue(remaining);
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
    setCaptureState('idle');
    setShowQueueModal(false);

    if (remaining.length === 0 && lastReport) {
      const msg = rejectedCount > 0 
        ? `Sync complete. ${rejectedCount} batches were rejected by the Quality Gate.`
        : "All pending mandi batches processed successfully.";
      Alert.alert("Sync Complete", msg);
      // Because offline sync is batch-less, we just display the final processed file.
      setReport(lastReport);
    } else if (remaining.length === 0 && rejectedCount > 0) {
      Alert.alert("Sync Complete", `All batches processed, but ${rejectedCount} were rejected by the Quality Gate.`);
    } else {
      Alert.alert("Partial Sync", `${syncQueue.length - remaining.length} processed. ${remaining.length} remaining offline.`);
    }
  };

  const runSimulation = async () => {
    if (mediaCache.length === 0) return;
    
    setIsSimulating(true);
    const simulationUrl = 'http://10.19.206.69:8000/simulate-grading'; 
    
    try {
      // Loop over all 3 cached images/videos to simulate the full representative batch
      const simulatedReports = [];
      for (const media of mediaCache) {
        const response = await Promise.race([
          FileSystem.uploadAsync(simulationUrl, media.uri, {
            fieldName: 'file',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            parameters: {
              ppm: ppm.toString(),
              min_premium_mm: premiumThreshold.toString() 
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Processing Timeout")), 60000))
        ]);

        if (response.status !== 200) throw new Error(`Server returned status: ${response.status}`);
        const parsed = JSON.parse(response.body);
        if (parsed.gate_failed) throw new Error(parsed.reason);
        simulatedReports.push(parsed);
      }
      
      const newSimulatedReport = aggregateReports(simulatedReports);
      setReport(newSimulatedReport);
      Alert.alert("Simulation Complete", `Report updated using ${premiumThreshold}mm as the new Grade A standard.`);
      
    } catch (error) {
      Alert.alert("Simulation Error", error.message || "Could not reach the server to run simulation.");
    } finally {
      setIsSimulating(false);
    }
  };

  const triggerReassessment = async (choice) => {
    if (choice === 'new') {
      setShowDisputeModal(false); 
      setSampleIndex(0); 
      setMediaCache([]);
      setReportBuffer([]);
      setIsReassessing(true);     
    } else if (choice === 'same') {
      setIsReassessing(true);
      setDisputeStep('scanning');
      
      try {
        const reassessReports = [];
        for (const media of mediaCache) {
          const response = await FileSystem.uploadAsync('http://10.19.206.69:8000/analyze', media.uri, {
            fieldName: 'file',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            parameters: { ppm: ppm.toString() }
          });
          reassessReports.push(JSON.parse(response.body));
        }
        const finalReassess = aggregateReports(reassessReports);
        setDisputeData(finalReassess.batch_metrics);
        setIsReassessing(false);
        setDisputeStep('comparison');
      } catch(error) {
        Alert.alert("Reassessment Failed", "Network drop during loop.");
        setIsReassessing(false);
        setDisputeStep('init');
      }
    }
  };

  const confirmDispute = () => {
    setShowDisputeModal(false);
    setDisputeStep('init');
  };

  const cancelDispute = () => {
    setDisputeData(null);
    setDisputeNotes('');
    setShowDisputeModal(false);
    setDisputeStep('init');
    setIsReassessing(false);
  };

  const generateAndSharePDF = async () => {
    setCaptureState('analyzing'); 
    try {
      const batchId = `ONION-LOT-${Date.now()}`;
      
      const originalString = `${batchId}|A:${report.batch_metrics.grade_a_pct}|C:${report.batch_metrics.grade_c_pct}|URS:${report.batch_metrics.urs_pct}`;
      const originalHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, originalString);

      let disputeHash = null;
      if (disputeData) {
        const disputeString = `${batchId}|A:${disputeData.grade_a_pct}|C:${disputeData.grade_c_pct}|URS:${disputeData.urs_pct}|Notes:${disputeNotes}`;
        disputeHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, disputeString);
      }

      const htmlContent = `
        <html>
          <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333;">
            <div style="text-align: center; border-bottom: 2px solid #4CAF50; padding-bottom: 20px; margin-bottom: 30px;">
              <h1 style="color: #4CAF50; margin: 0; font-size: 28px;">Official Quality Certificate</h1>
              <p style="color: #777; margin-top: 5px;">Automated Procurement Division</p>
            </div>
            
            <table style="width: 100%; font-size: 16px; margin-bottom: 30px;">
              <tr><td style="padding: 8px 0; font-weight: bold;">Batch ID:</td><td style="text-align: right; font-family: monospace;">${batchId}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Total Unique Onions Analyzed:</td><td style="text-align: right;">${report.batch_metrics.total_unique_onions}</td></tr>
            </table>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Original Grading Breakdown</h3>
              <p style="font-size: 18px;"><strong>Premium (Grade A):</strong> <span style="color: #4CAF50; float: right;">${report.batch_metrics.grade_a_pct}%</span></p>
              <p style="font-size: 18px;"><strong>Undersized (Grade C):</strong> <span style="color: #FFC107; float: right;">${report.batch_metrics.grade_c_pct}%</span></p>
              <p style="font-size: 18px;"><strong>Rejected (URS):</strong> <span style="color: #F44336; float: right;">${report.batch_metrics.urs_pct}%</span></p>
              <div style="margin-top: 15px; font-size: 11px; font-family: monospace; background: #eee; padding: 10px; word-break: break-all;">Original SHA-256: ${originalHash}</div>
            </div>

            ${disputeData ? `
              <div style="background-color: #fff8e1; border: 1px solid #FFC107; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h3 style="margin-top: 0; color: #d32f2f; border-bottom: 1px solid #FFC107; padding-bottom: 10px;">⚠️ DISPUTED & RE-EVALUATED</h3>
                <p><strong>Dispute Reason/Notes:</strong> ${disputeNotes || 'Secondary sample scan requested.'}</p>
                <p style="font-size: 18px;"><strong>New Premium (Grade A):</strong> <span style="color: #4CAF50; float: right;">${disputeData.grade_a_pct}%</span></p>
                <p style="font-size: 18px;"><strong>New Undersized (Grade C):</strong> <span style="color: #FFC107; float: right;">${disputeData.grade_c_pct}%</span></p>
                <p style="font-size: 18px;"><strong>New Rejected (URS):</strong> <span style="color: #F44336; float: right;">${disputeData.urs_pct}%</span></p>
                <div style="margin-top: 15px; font-size: 11px; font-family: monospace; background: #eee; padding: 10px; word-break: break-all;">Reassessment SHA-256: ${disputeHash}</div>
              </div>
            ` : ''}

            <div style="background-color: #e8f5e9; border-left: 5px solid #4CAF50; padding: 15px; margin-top: 30px; font-weight: bold;">
              FINAL SETTLEMENT RATE: ${disputeData ? disputeData.grade_a_pct : report.batch_metrics.grade_a_pct}% (Grade A)
            </div>
          </body>
        </html>
      `;

      const { base64 } = await Print.printToFileAsync({ html: htmlContent, base64: true });
      const newUri = `${FileSystem.documentDirectory}Quality_Certificate_${batchId}.pdf`;
      await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(newUri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert("PDF Error", "Failed to generate PDF receipt.");
    } finally {
      setCaptureState('idle');
    }
  };

  if (!camPermission || !micPermission) return <View style={styles.blackBackground} />;
  
  if (!camPermission.granted || !micPermission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Onion Grader requires Camera and Microphone access.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={async () => {
            await requestCamPermission();
            await requestMicPermission();
          }}>
          <Text style={styles.primaryButtonText}>Enable Hardware</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- REPORT SCREEN ---
  if (report && !isReassessing) {
    return (
      <View style={styles.reportContainer}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
          <Text style={styles.header}>Quality Certificate</Text>
          <View style={styles.statsCard}>
            <Text style={styles.statLabel}>Premium (Grade A)</Text>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>{report.batch_metrics.grade_a_pct}%</Text>
            <Text style={styles.statLabel}>Undersized (Grade C)</Text>
            <Text style={[styles.statValue, { color: '#FFC107' }]}>{report.batch_metrics.grade_c_pct}%</Text>
            <Text style={styles.statLabel}>Rejected (URS)</Text>
            <Text style={[styles.statValue, { color: '#F44336' }]}>{report.batch_metrics.urs_pct}%</Text>
          </View>

          {disputeData && (
            <View style={[styles.statsCard, { borderColor: '#FFC107', borderWidth: 1 }]}>
              <Text style={[styles.statLabel, { color: '#FFC107' }]}>Reassessment Active</Text>
              <Text style={styles.statLabel}>New Premium (Grade A)</Text>
              <Text style={[styles.statValue, { color: '#4CAF50', marginBottom: 5 }]}>{disputeData.grade_a_pct}%</Text>
              <Text style={[styles.statLabel, { textTransform: 'none' }]}>Note: {disputeNotes}</Text>
            </View>
          )}

          {report.defect_breakdown && report.defect_breakdown.length > 0 && !disputeData && (
              <View style={styles.defectContainer}>
                  <Text style={styles.defectHeader}>Primary Defects</Text>
                  {report.defect_breakdown.map((defect, index) => (
                      <View key={index} style={styles.defectRow}>
                        <Text style={styles.defectText}>{defect.fault}</Text>
                        <Text style={styles.defectSeverity}>{defect.severity_pct}% Area</Text>
                      </View>
                  ))}
              </View>
          )}

          {!disputeData && (
            <View style={styles.simulationCard}>
              <Text style={[styles.statLabel, { color: '#2196F3', fontWeight: 'bold' }]}>Counterfactual Rules Engine</Text>
              <Text style={styles.modalSubtitle}>Simulate what happens if the Mandi accepted {premiumThreshold}mm as the minimum size for Grade A.</Text>
              <Slider
                style={{ width: '100%', height: 40, marginTop: 10 }}
                minimumValue={40}
                maximumValue={90}
                step={1}
                value={premiumThreshold}
                onValueChange={setPremiumThreshold}
                minimumTrackTintColor="#2196F3"
                maximumTrackTintColor="#555"
                thumbTintColor="#2196F3"
              />
              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: '#2196F3', marginTop: 15 }]} 
                onPress={runSimulation}
                disabled={isSimulating}
              >
                {isSimulating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Simulate New Rules</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          
          {captureState === 'analyzing' ? (
             <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 20 }} />
          ) : (
            <View style={{ marginTop: 20 }}>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.primaryButton, styles.pdfButton]} onPress={generateAndSharePDF}>
                  <Text style={styles.primaryButtonText}>Generate PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryButton, styles.scanButton]} onPress={resetBatch}>
                  <Text style={styles.primaryButtonText}>New Batch</Text>
                </TouchableOpacity>
              </View>
              
              {!disputeData && (
                <TouchableOpacity 
                  style={[styles.primaryButton, { backgroundColor: '#FFC107', marginTop: 15 }]} 
                  onPress={() => setShowDisputeModal(true)}
                >
                  <Text style={[styles.primaryButtonText, { color: '#000' }]}>Raise Dispute / Reassessment</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>

        <Modal visible={showDisputeModal} animationType="slide" transparent={true}>
          <View style={styles.disputeModalContainer}>
            <View style={styles.disputeModalContent}>
              <Text style={styles.modalTitle}>Procurement Dispute</Text>
              
              {disputeStep === 'init' && (
                <View>
                  <Text style={styles.modalSubtitle}>Attach reason for contesting this batch.</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., Farmer requested bottom-layer scan"
                    placeholderTextColor="#888"
                    value={disputeNotes}
                    onChangeText={setDisputeNotes}
                    multiline
                  />
                  
                  <Text style={[styles.statLabel, { marginTop: 20, marginBottom: 5 }]}>Choose Action:</Text>
                  
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#FFC107' }]} onPress={() => triggerReassessment('new')}>
                    <Text style={[styles.primaryButtonText, { color: '#000' }]}>📷 Lock Camera & Re-scan Sequence</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#2196F3', marginTop: 10 }]} onPress={() => triggerReassessment('same')}>
                    <Text style={styles.primaryButtonText}>🔄 Reassess Cached Sequence</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#444', marginTop: 15 }]} onPress={cancelDispute}>
                    <Text style={styles.primaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {disputeStep === 'scanning' && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={[styles.modalTitle, { color: '#FFC107' }]}>Reassessing Sample</Text>
                  <Text style={styles.modalSubtitle}>Sending sequence through AI pipeline...</Text>
                  <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 20 }} />
                </View>
              )}

              {disputeStep === 'comparison' && disputeData && (
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statLabel}>Original A%</Text>
                      <Text style={[styles.statValue, { color: '#888', textDecorationLine: 'line-through' }]}>{report.batch_metrics.grade_a_pct}%</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statLabel}>New A%</Text>
                      <Text style={[styles.statValue, { color: '#FFF' }]}>{disputeData.grade_a_pct}%</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.primaryButton} onPress={confirmDispute}>
                    <Text style={styles.primaryButtonText}>Accept New Scan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#FF3B30', marginTop: 10 }]} onPress={cancelDispute}>
                    <Text style={styles.primaryButtonText}>Discard & Keep Original</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  if (isCalibrating) {
    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} facing="back" />
        <View style={styles.uiLayer}>
          <View style={styles.topArea}>
            <View style={styles.instructionPill}>
              <Text style={styles.instructionText}>System Setup: Match circle to a ₹5 coin</Text>
            </View>
          </View>

          <View style={styles.centerArea}>
            <View style={[styles.calibrationCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]} />
          </View>

          <View style={styles.calibrationBottomArea}>
            <Slider
              style={styles.slider}
              minimumValue={50}
              maximumValue={300}
              value={circleSize}
              onValueChange={setCircleSize}
              minimumTrackTintColor="#FFC107"
              maximumTrackTintColor="#FFFFFF"
              thumbTintColor="#FFC107"
            />
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={() => {
                setPpm(circleSize / 23.0);
                setIsCalibrating(false);
              }}
            >
              <Text style={styles.primaryButtonText}>Lock Calibration</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const currentSequenceTarget = SAMPLING_PROMPTS[sampleIndex];

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} mode={mode} facing="back" />
      
      <View style={styles.uiLayer}>
        <View style={styles.topArea}>
          
          {syncQueue.length > 0 && (
            <TouchableOpacity 
              style={styles.queueBanner} 
              onPress={() => setShowQueueModal(true)}
            >
              <Text style={styles.queueBannerText}>📡 {syncQueue.length} Pending Mandi Batch(es) • Tap to Sync</Text>
            </TouchableOpacity>
          )}

          <View style={[
            styles.instructionPill, 
            { marginTop: 10 }, 
            isReassessing ? { backgroundColor: 'rgba(255, 193, 7, 0.9)' } : (!isDeviceSteady ? { backgroundColor: 'rgba(244, 67, 54, 0.9)' } : {})
          ]}>
            <Text style={[styles.instructionText, captureState === 'recording' && styles.recordingText, (isReassessing || !isDeviceSteady) && { color: '#000' }]}>
              {!isDeviceSteady 
                ? "⚠️ HOLD DEVICE STEADY" 
                : captureState === 'recording' 
                  ? `● RECORDING - Pan slowly (${timeLeft}s)` 
                  : captureState === 'analyzing'
                    ? "Analyzing Sample..."
                    : captureState === 'syncing'
                      ? "Syncing batches with cloud API..."
                      : isReassessing 
                        ? `⚠️ DISPUTE [${sampleIndex + 1}/3]: ${currentSequenceTarget}`
                        : `[SAMPLE ${sampleIndex + 1}/3] ${currentSequenceTarget}`}
            </Text>
          </View>
        </View>

        <View style={styles.centerArea}>
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        <View style={styles.bottomControlArea}>
          <View style={styles.modeSelector}>
            <TouchableOpacity onPress={() => captureState === 'idle' && setMode('picture')}>
              <Text style={[styles.modeText, mode === 'picture' && styles.activeModeText]}>PHOTO</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => captureState === 'idle' && setMode('video')}>
              <Text style={[styles.modeText, mode === 'video' && styles.activeModeText]}>VIDEO</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.captureRow}>
            <TouchableOpacity 
              style={styles.sideButton} 
              onPress={() => setIsCalibrating(true)}
              disabled={captureState !== 'idle'}
            >
              <Text style={styles.gearIcon}>⚙️</Text>
            </TouchableOpacity>

            <View style={styles.captureArea}>
              {captureState === 'analyzing' || captureState === 'syncing' ? (
                <ActivityIndicator size="large" color="#ffffff" />
              ) : (
                <TouchableOpacity 
                  style={[
                    styles.captureOuterRing, 
                    captureState === 'recording' && styles.recordingOuterRing,
                    !isDeviceSteady && { borderColor: '#888', opacity: 0.5 }
                  ]} 
                  onPress={handleCapture}
                  disabled={!isDeviceSteady} 
                >
                  <View style={[
                    styles.captureInnerButton, 
                    mode === 'video' ? styles.videoInner : styles.photoInner,
                    captureState === 'recording' && styles.recordingInner
                  ]} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.sideButton} />
          </View>
        </View>
      </View>

      <Modal visible={showQueueModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Offline Batch Queue</Text>
            <Text style={styles.modalSubtitle}>Stored safely on device storage until network returns.</Text>
            
            <FlatList
              data={syncQueue}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.queueItem}>
                  <Text style={styles.queueItemText}>📦 {item.id} ({item.fileType.toUpperCase()})</Text>
                  <Text style={styles.queueItemSub}>{item.timestamp} | PPM: {parseFloat(item.ppm).toFixed(1)}</Text>
                </View>
              )}
              style={{ maxHeight: 200, marginVertical: 15 }}
            />

            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: '#2196F3', marginBottom: 10 }]} 
              onPress={processSyncQueue}
            >
              <Text style={styles.primaryButtonText}>Sync All Now</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: '#444' }]} 
              onPress={() => setShowQueueModal(false)}
            >
              <Text style={styles.primaryButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  blackBackground: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  uiLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, elevation: 10, justifyContent: 'space-between' },
  topArea: { paddingTop: 50, alignItems: 'center', width: '100%' },
  
  queueBanner: { backgroundColor: '#FF9800', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginBottom: 8 },
  queueBannerText: { color: '#000', fontWeight: 'bold', fontSize: 13 },

  instructionPill: { backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25 },
  instructionText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  recordingText: { color: '#FF3B30' },
  
  centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  reticle: { width: 250, height: 250, backgroundColor: 'transparent' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: 'rgba(255,255,255,0.8)' },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  
  calibrationCircle: { borderWidth: 3, borderColor: '#FFC107', backgroundColor: 'rgba(255, 193, 7, 0.2)' },
  calibrationBottomArea: { backgroundColor: 'rgba(0,0,0,0.8)', paddingBottom: 50, paddingTop: 30, alignItems: 'center', width: '100%' },
  slider: { width: '80%', height: 40, marginBottom: 20 },

  bottomControlArea: { backgroundColor: 'rgba(0,0,0,0.5)', paddingBottom: 50, paddingTop: 20, alignItems: 'center' },
  modeSelector: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginBottom: 20 },
  modeText: { color: '#AAA', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  activeModeText: { color: '#FFC107' },
  
  captureRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40 },
  sideButton: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  gearIcon: { fontSize: 28 },
  
  captureArea: { height: 80, justifyContent: 'center', alignItems: 'center' },
  captureOuterRing: { width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  recordingOuterRing: { borderColor: '#888' },
  captureInnerButton: { borderRadius: 30 },
  photoInner: { width: 56, height: 56, backgroundColor: '#FFF' },
  videoInner: { width: 56, height: 56, backgroundColor: '#FF3B30' },
  recordingInner: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#FF3B30' },
  
  permissionContainer: { flex: 1, backgroundColor: '#111', justifyContent: 'center', padding: 30 },
  permissionText: { color: '#FFF', fontSize: 18, textAlign: 'center', marginBottom: 30, lineHeight: 26 },
  reportContainer: { flex: 1, backgroundColor: '#111', padding: 30, paddingTop: 60 },
  header: { color: '#FFF', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  statsCard: { backgroundColor: '#222', borderRadius: 16, padding: 20, marginBottom: 20 },
  statLabel: { color: '#AAA', fontSize: 14, textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 32, fontWeight: '800', marginBottom: 15, color: '#FFF' },
  defectContainer: { backgroundColor: '#311', borderRadius: 16, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: '#522' },
  defectHeader: { color: '#FF5252', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15 },
  defectRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  defectText: { color: '#FFF', fontSize: 16 },
  defectSeverity: { color: '#FF5252', fontSize: 16, fontWeight: '600' },
  
  simulationCard: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 20, marginTop: 10, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  primaryButton: { backgroundColor: '#4CAF50', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', width: '100%' },
  pdfButton: { backgroundColor: '#2196F3', marginRight: 10, flex: 1 },
  scanButton: { backgroundColor: '#4CAF50', marginLeft: 10, flex: 1 },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 20 },
  modalContent: { backgroundColor: '#222', width: '100%', borderRadius: 16, padding: 24 },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  modalSubtitle: { color: '#AAA', fontSize: 14, marginBottom: 10 },
  queueItem: { backgroundColor: '#333', padding: 12, borderRadius: 8, marginBottom: 8 },
  queueItemText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  queueItemSub: { color: '#888', fontSize: 12, marginTop: 4 },

  disputeModalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' },
  disputeModalContent: { backgroundColor: '#222', padding: 30, borderTopLeftRadius: 20, borderTopRightRadius: 20, minHeight: 350 },
  textInput: { backgroundColor: '#333', color: '#FFF', borderRadius: 12, padding: 16, height: 100, textAlignVertical: 'top', fontSize: 16, marginTop: 10 },
});