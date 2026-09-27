import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

// Localization & Themes
import { lightTheme, darkTheme } from './src/theme';
import { getTranslation } from './src/translations';

// Utilities
import { aggregateReports, generateMockReport } from './src/utils/reportAggregator';
import { generateAndShareQualityPDF } from './src/utils/pdfGenerator';

// Components
import Header from './src/components/Header';
import HomeScreen from './src/components/HomeScreen';
import BottomNavBar from './src/components/BottomNavBar';
import StepProgressBar from './src/components/StepProgressBar';
import StabilityIndicator from './src/components/StabilityIndicator';
import CalibrationOverlay from './src/components/CalibrationOverlay';
import QualityCertificateView from './src/components/QualityCertificateView';
import DisputeModal from './src/components/DisputeModal';
import SimulationModal from './src/components/SimulationModal';
import OfflineQueueModal from './src/components/OfflineQueueModal';
import SettingsModal from './src/components/SettingsModal';

const QUEUE_STORAGE_KEY = '@onion_grader_offline_queue';
const SETTINGS_KEY = '@onion_grader_settings';

// Default to the computer's actual Wi-Fi IP address on the local network
const DEFAULT_API_URL = 'http://192.168.1.101:8000/analyze';

export default function App() {
  // --- Navigation Tab State ---
  const [currentTab, setCurrentTab] = useState('home'); // 'home' | 'scan' | 'report' | 'settings'

  // --- Camera Permissions ---
  const [camPermission, requestCamPermission] = useCameraPermissions();

  // --- Localization & Theme State ---
  const [lang, setLang] = useState('en'); // 'en' | 'hi'
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = isDarkMode ? darkTheme : lightTheme;

  // --- Network & Backend Status ---
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [backendConnected, setBackendConnected] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // --- Camera & Capture State ---
  const [facing, setFacing] = useState('back');
  const [mode, setMode] = useState('picture'); // default 'picture' prevents Android black screen
  const [captureState, setCaptureState] = useState('idle'); // 'idle' | 'recording' | 'analyzing' | 'syncing'
  const [timeLeft, setTimeLeft] = useState(5);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraRef = useRef(null);

  // --- Calibration State ---
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [circleSize, setCircleSize] = useState(110);
  const [ppm, setPpm] = useState(2.4);

  // --- Motion / Accelerometer Sensor ---
  const [isDeviceSteady, setIsDeviceSteady] = useState(true);
  const isDeviceSteadyRef = useRef(true);

  // --- 3-Layer Sampling Sequence ---
  const [sampleIndex, setSampleIndex] = useState(0);
  const [mediaCache, setMediaCache] = useState([]);
  const [reportBuffer, setReportBuffer] = useState([]);
  const [report, setReport] = useState(null);

  // --- Offline Mandi Queue ---
  const [syncQueue, setSyncQueue] = useState([]);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- Counterfactual Rules Engine (Simulation) ---
  const [premiumThreshold, setPremiumThreshold] = useState(65);
  const [showSimModal, setShowSimModal] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // --- Dispute & Reassessment Protocol ---
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeStep, setDisputeStep] = useState('init');
  const [disputeNotes, setDisputeNotes] = useState('');
  const [disputeData, setDisputeData] = useState(null);
  const [isReassessing, setIsReassessing] = useState(false);

  // --- PDF Export ---
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // --- Initialization ---
  useEffect(() => {
    loadAppSettings();
    loadOfflineQueue();
    checkBackendHealth(apiUrl);

    Accelerometer.setUpdateInterval(200);
    const subscription = Accelerometer.addListener((data) => {
      const { x, y, z } = data;
      const totalForce = Math.sqrt(x * x + y * y + z * z);
      const steady = Math.abs(totalForce - 1.0) <= 0.08;
      isDeviceSteadyRef.current = steady;
      setIsDeviceSteady(steady);
    });

    return () => subscription.remove();
  }, []);

  const checkBackendHealth = async (targetUrl = apiUrl) => {
    setIsCheckingBackend(true);
    try {
      const baseUrl = targetUrl.replace(/\/analyze\/?$/, '').replace(/\/+$/, '');
      const response = await axios.get(baseUrl + '/docs', { timeout: 3000 });
      setBackendConnected(response.status === 200);
    } catch (e) {
      setBackendConnected(false);
    } finally {
      setIsCheckingBackend(false);
    }
  };

  const loadAppSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lang) setLang(parsed.lang);
        if (typeof parsed.isDarkMode === 'boolean') setIsDarkMode(parsed.isDarkMode);
        if (parsed.apiUrl) {
          setApiUrl(parsed.apiUrl);
          checkBackendHealth(parsed.apiUrl);
        }
        if (typeof parsed.isDemoMode === 'boolean') setIsDemoMode(parsed.isDemoMode);
        if (parsed.ppm) {
          setPpm(parsed.ppm);
          setCircleSize(parsed.ppm * 23.0);
        }
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  };

  const saveSettings = async (overrides = {}) => {
    try {
      const newSettings = {
        lang: overrides.lang !== undefined ? overrides.lang : lang,
        isDarkMode: overrides.isDarkMode !== undefined ? overrides.isDarkMode : isDarkMode,
        apiUrl: overrides.apiUrl !== undefined ? overrides.apiUrl : apiUrl,
        isDemoMode: overrides.isDemoMode !== undefined ? overrides.isDemoMode : isDemoMode,
        ppm: overrides.ppm !== undefined ? overrides.ppm : ppm,
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  };

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'hi' : 'en';
    setLang(nextLang);
    saveSettings({ lang: nextLang });
  };

  const toggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    saveSettings({ isDarkMode: nextMode });
  };

  // --- Offline Storage Queue Management ---
  const loadOfflineQueue = async () => {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) setSyncQueue(JSON.parse(stored));
    } catch (e) {
      console.error('Failed to load offline queue:', e);
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
        getTranslation(lang, 'offlineNoticeTitle'),
        getTranslation(lang, 'offlineNoticeMsg')
      );
    } catch (err) {
      Alert.alert('Error', 'Could not cache scan locally.');
    }
  };

  const processSyncQueue = async () => {
    if (syncQueue.length === 0) return;
    setIsSyncing(true);

    const remaining = [];
    let lastReport = null;
    let rejectedCount = 0;

    for (const item of syncQueue) {
      try {
        const response = await Promise.race([
          FileSystem.uploadAsync(apiUrl, item.uri, {
            fieldName: 'file',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            parameters: { ppm: item.ppm.toString() },
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Sync Timeout')), 60000)),
        ]);

        if (response.status !== 200) throw new Error('Sync failed');

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
    setIsSyncing(false);
    setShowQueueModal(false);

    if (remaining.length === 0 && lastReport) {
      const msg = rejectedCount > 0
        ? getTranslation(lang, 'syncRejectedMsg', { count: rejectedCount })
        : getTranslation(lang, 'syncSuccessMsg');
      Alert.alert(getTranslation(lang, 'syncSuccess'), msg);
      setReport(lastReport);
      setCurrentTab('report');
    } else if (remaining.length === 0 && rejectedCount > 0) {
      Alert.alert(getTranslation(lang, 'syncSuccess'), getTranslation(lang, 'syncRejectedMsg', { count: rejectedCount }));
    } else {
      Alert.alert('Partial Sync', getTranslation(lang, 'partialSyncMsg', {
        synced: syncQueue.length - remaining.length,
        remaining: remaining.length,
      }));
    }
  };

  // --- Reset Batch ---
  const resetBatch = () => {
    setReport(null);
    setSampleIndex(0);
    setMediaCache([]);
    setReportBuffer([]);
    setDisputeData(null);
    setDisputeNotes('');
    setIsReassessing(false);
  };

  // --- Camera Capture Flow ---
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
            cameraRef.current?.stopRecording();
            setCaptureState('idle');
            Alert.alert(
              getTranslation(lang, 'holdSteady'),
              getTranslation(lang, 'deviceShaking')
            );
            return;
          }
          time -= 1;
          setTimeLeft(time);
          if (time <= 0) clearInterval(timer);
        }, 1000);

        const video = await cameraRef.current.recordAsync({ maxDuration: 5, mute: true });
        if (aborted) return;

        setCaptureState('analyzing');
        await sendToAPI(video.uri, 'video', ppm);
      } else {
        setCaptureState('analyzing');
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: true });
        await sendToAPI(photo.uri, 'photo', ppm);
      }
    } catch (error) {
      Alert.alert('Capture failed', error.message || 'Check camera permissions');
      setCaptureState('idle');
    }
  };

  // --- Gallery Image Picker Fallback ---
  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video' || asset.uri.endsWith('.mp4');
        setCaptureState('analyzing');
        await sendToAPI(asset.uri, isVideo ? 'video' : 'photo', ppm);
      }
    } catch (err) {
      Alert.alert('Gallery Error', err.message || 'Could not pick image');
    }
  };

  // --- API Analysis Dispatch ---
  const sendToAPI = async (fileUri, fileType, currentPpm) => {
    try {
      let data = null;

      // Check if interactive Demo Mode is active
      if (isDemoMode) {
        await new Promise((r) => setTimeout(r, 1200));
        data = generateMockReport(currentPpm, premiumThreshold);
      } else {
        const response = await Promise.race([
          FileSystem.uploadAsync(apiUrl, fileUri, {
            fieldName: 'file',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            parameters: { ppm: currentPpm.toString() },
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Processing Timeout')), 60000)),
        ]);

        if (response.status !== 200) throw new Error(`Server returned status: ${response.status}`);
        data = JSON.parse(response.body);
      }

      // Check Quality Gate
      if (data.gate_failed) {
        Alert.alert(
          getTranslation(lang, 'gateRejectedTitle'),
          data.reason || getTranslation(lang, 'gateRejectedReasonFallback')
        );
        setCaptureState('idle');
        return;
      }

      // Buffer updates
      const updatedMediaCache = [...mediaCache, { uri: fileUri, type: fileType }];
      const updatedReportBuffer = [...reportBuffer, data];
      setMediaCache(updatedMediaCache);
      setReportBuffer(updatedReportBuffer);

      // Check if more samples are needed in sequence (3-layer sampling)
      const samplingSteps = getTranslation(lang, 'samplingSteps');
      if (sampleIndex < samplingSteps.length - 1) {
        setSampleIndex(sampleIndex + 1);
        Alert.alert(
          getTranslation(lang, 'sampleLoggedTitle'),
          getTranslation(lang, 'proceedToNext', { nextStep: samplingSteps[sampleIndex + 1] })
        );
        setCaptureState('idle');
        return;
      }

      // All 3 samples collected -> mathematically aggregate
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
        setCurrentTab('report');
      }
    } catch (error) {
      console.warn('Upload or processing failed:', error.message);
      if (!isDemoMode) {
        await saveToOfflineQueue(fileUri, fileType, currentPpm);
      }
    } finally {
      setCaptureState('idle');
    }
  };

  // --- Counterfactual Rules Engine (Simulation) ---
  const runSimulation = async () => {
    setIsSimulating(true);
    const simulationUrl = apiUrl.replace(/\/analyze\/?$/, '/simulate-grading');

    try {
      if (isDemoMode || mediaCache.length === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        const simulated = generateMockReport(ppm, premiumThreshold);
        setReport(simulated);
      } else {
        const simulatedReports = [];
        for (const media of mediaCache) {
          const response = await Promise.race([
            FileSystem.uploadAsync(simulationUrl, media.uri, {
              fieldName: 'file',
              httpMethod: 'POST',
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
              parameters: {
                ppm: ppm.toString(),
                min_premium_mm: premiumThreshold.toString(),
              },
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Processing Timeout')), 60000)),
          ]);

          if (response.status !== 200) throw new Error(`Server status: ${response.status}`);
          const parsed = JSON.parse(response.body);
          if (parsed.gate_failed) throw new Error(parsed.reason);
          simulatedReports.push(parsed);
        }

        const newSimulatedReport = aggregateReports(simulatedReports);
        setReport(newSimulatedReport);
      }

      setShowSimModal(false);
      Alert.alert(
        getTranslation(lang, 'simulationComplete'),
        getTranslation(lang, 'simulationNotice', { threshold: premiumThreshold })
      );
    } catch (error) {
      Alert.alert('Simulation Error', error.message || 'Could not connect to simulation server.');
    } finally {
      setIsSimulating(false);
    }
  };

  // --- Dispute & Reassessment Protocol ---
  const triggerReassessment = async (choice) => {
    if (!disputeNotes.trim()) {
      Alert.alert('Notice', getTranslation(lang, 'disputeNotesRequired'));
      return;
    }

    if (choice === 'new') {
      setShowDisputeModal(false);
      setSampleIndex(0);
      setMediaCache([]);
      setReportBuffer([]);
      setIsReassessing(true);
      setCurrentTab('scan');
    } else if (choice === 'same') {
      setIsReassessing(true);
      setDisputeStep('scanning');

      try {
        if (isDemoMode || mediaCache.length === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          const mock = generateMockReport(ppm, premiumThreshold);
          setDisputeData(mock.batch_metrics);
        } else {
          const reassessReports = [];
          for (const media of mediaCache) {
            const response = await FileSystem.uploadAsync(apiUrl, media.uri, {
              fieldName: 'file',
              httpMethod: 'POST',
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
              parameters: { ppm: ppm.toString() },
            });
            reassessReports.push(JSON.parse(response.body));
          }
          const finalReassess = aggregateReports(reassessReports);
          setDisputeData(finalReassess.batch_metrics);
        }

        setIsReassessing(false);
        setDisputeStep('comparison');
      } catch (error) {
        Alert.alert('Reassessment Failed', 'Server connection lost during re-analysis.');
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

  // --- PDF Quality Certificate Generation ---
  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await generateAndShareQualityPDF({
        report,
        disputeData,
        disputeNotes,
        lang,
        threshold: premiumThreshold,
      });
    } catch (e) {
      Alert.alert('PDF Error', e.message || 'Failed to generate PDF certificate.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Persistent Top Header */}
      <Header
        theme={theme}
        lang={lang}
        onToggleLang={toggleLanguage}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenQueue={() => setShowQueueModal(true)}
        queueCount={syncQueue.length}
        isDemoMode={isDemoMode}
      />

      {/* TAB 1: HOME DASHBOARD SCREEN */}
      {currentTab === 'home' && (
        <HomeScreen
          theme={theme}
          lang={lang}
          backendConnected={backendConnected}
          isCheckingBackend={isCheckingBackend}
          onCheckBackend={() => checkBackendHealth(apiUrl)}
          apiUrl={apiUrl}
          onStartInspection={() => setCurrentTab('scan')}
          onOpenCalibration={() => {
            setCurrentTab('scan');
            setIsCalibrating(true);
          }}
          onOpenSimulator={() => setShowSimModal(true)}
          onOpenQueue={() => setShowQueueModal(true)}
          onOpenReport={() => setCurrentTab('report')}
          onOpenSettings={() => setShowSettingsModal(true)}
          hasReport={Boolean(report)}
          queueCount={syncQueue.length}
          isDemoMode={isDemoMode}
        />
      )}

      {/* TAB 2: CAMERA 3-LAYER SCANNER SCREEN */}
      {currentTab === 'scan' && (
        !camPermission?.granted ? (
          <View style={[styles.permissionContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.permCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
              <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>📷</Text>
              <Text style={[styles.permTitle, { color: theme.text }]}>
                {getTranslation(lang, 'cameraPermissionTitle')}
              </Text>
              <Text style={[styles.permMsg, { color: theme.textSecondary }]}>
                {getTranslation(lang, 'cameraPermissionMsg')}
              </Text>
              <TouchableOpacity
                style={[styles.permBtn, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  const res = await requestCamPermission();
                  if (!res.granted) {
                    Alert.alert('Permission Required', 'Please enable Camera permission in your phone settings to scan onion heaps.');
                  }
                }}
              >
                <Text style={styles.permBtnText}>
                  {getTranslation(lang, 'grantPermission')}
                </Text>
              </TouchableOpacity>

              {/* Gallery Fallback Option */}
              <TouchableOpacity
                style={[styles.galleryFallbackBtn, { borderColor: theme.surfaceBorder, marginTop: 12 }]}
                onPress={handlePickFromGallery}
              >
                <Text style={[styles.galleryFallbackText, { color: theme.textSecondary }]}>
                  📁 {lang === 'hi' ? 'गैलरी से फोटो/वीडियो चुनें' : 'Pick Photo/Video from Gallery'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, backgroundColor: '#000000' }}>
            {/* 3-Step Sequence Progress Tracker */}
            <StepProgressBar
              theme={theme}
              lang={lang}
              currentIndex={sampleIndex}
              isReassessing={isReassessing}
            />

            {/* Live Camera Preview Container */}
            <View style={styles.cameraContainer}>
              <CameraView
                key={`${facing}-${mode}`}
                style={styles.camera}
                ref={cameraRef}
                facing={facing}
                mode={mode}
                mute={true}
                onCameraReady={() => setIsCameraReady(true)}
                onMountError={(e) => {
                  console.warn('Camera Mount Error:', e);
                  Alert.alert('Camera Error', e.message || 'Could not start camera preview.');
                }}
              />

              {/* Overlay Reticle & Visual Guides */}
              <View style={styles.reticleOverlay} pointerEvents="none">
                <View style={styles.reticleBox}>
                  <View style={[styles.corner, styles.tl, { borderColor: theme.primary }]} />
                  <View style={[styles.corner, styles.tr, { borderColor: theme.primary }]} />
                  <View style={[styles.corner, styles.bl, { borderColor: theme.primary }]} />
                  <View style={[styles.corner, styles.br, { borderColor: theme.primary }]} />
                </View>
              </View>

              {/* Accelerometer Stability Pill */}
              <View style={styles.stabilityFloat}>
                <StabilityIndicator
                  theme={theme}
                  lang={lang}
                  isSteady={isDeviceSteady}
                  isRecording={captureState === 'recording'}
                  timeLeft={timeLeft}
                  isAnalyzing={captureState === 'analyzing'}
                />
              </View>

              {/* Camera Flip & Gallery Pick Floating Buttons */}
              <View style={styles.cameraTopFloat}>
                <TouchableOpacity
                  style={styles.floatCircleBtn}
                  onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
                >
                  <Text style={{ fontSize: 16 }}>🔄</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.floatCircleBtn}
                  onPress={handlePickFromGallery}
                >
                  <Text style={{ fontSize: 16 }}>📁</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Camera Controls */}
            <View style={[styles.cameraControls, { backgroundColor: theme.cardBg, borderTopColor: theme.surfaceBorder }]}>
              {/* Mode Selector (Photo / Video) */}
              <View style={[styles.modeTabs, { backgroundColor: theme.cardBgAlt }]}>
                <TouchableOpacity
                  style={[styles.modeTab, mode === 'picture' && { backgroundColor: theme.primary }]}
                  onPress={() => captureState === 'idle' && setMode('picture')}
                >
                  <Text style={[styles.modeTabText, mode === 'picture' ? { color: '#FFFFFF' } : { color: theme.textSecondary }]}>
                    📷 {getTranslation(lang, 'modePhoto')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeTab, mode === 'video' && { backgroundColor: theme.primary }]}
                  onPress={() => captureState === 'idle' && setMode('video')}
                >
                  <Text style={[styles.modeTabText, mode === 'video' ? { color: '#FFFFFF' } : { color: theme.textSecondary }]}>
                    🎥 {getTranslation(lang, 'modeVideo')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Shutter Row */}
              <View style={styles.shutterRow}>
                {/* ₹5 Coin Calibration Trigger */}
                <TouchableOpacity
                  style={[styles.sideActionBtn, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}
                  onPress={() => setIsCalibrating(true)}
                  disabled={captureState !== 'idle'}
                >
                  <Text style={{ fontSize: 20 }}>🪙</Text>
                  <Text style={[styles.sideActionLabel, { color: theme.textSecondary }]}>
                    {getTranslation(lang, 'calibrateBtn')}
                  </Text>
                </TouchableOpacity>

                {/* Shutter Button */}
                <View style={styles.shutterCenter}>
                  {captureState === 'analyzing' || captureState === 'syncing' ? (
                    <ActivityIndicator size="large" color={theme.primary} />
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.shutterRing,
                        { borderColor: isDeviceSteady ? theme.primary : '#9CA3AF' },
                        captureState === 'recording' && { borderColor: theme.gradeUrs },
                        !isDeviceSteady && { opacity: 0.6 },
                      ]}
                      onPress={handleCapture}
                      disabled={!isDeviceSteady}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.shutterCore,
                          { backgroundColor: mode === 'video' ? theme.gradeUrs : theme.primary },
                          captureState === 'recording' && styles.shutterRecordingCore,
                        ]}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Reset / Clear Batch Button */}
                <TouchableOpacity
                  style={[styles.sideActionBtn, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}
                  onPress={resetBatch}
                  disabled={captureState !== 'idle' || (sampleIndex === 0 && reportBuffer.length === 0)}
                >
                  <Text style={{ fontSize: 20 }}>🔄</Text>
                  <Text style={[styles.sideActionLabel, { color: theme.textSecondary }]}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )
      )}

      {/* TAB 3: QUALITY CERTIFICATE & REPORT */}
      {currentTab === 'report' && (
        report ? (
          <QualityCertificateView
            theme={theme}
            lang={lang}
            report={report}
            disputeData={disputeData}
            disputeNotes={disputeNotes}
            threshold={premiumThreshold}
            onOpenSimulator={() => setShowSimModal(true)}
            onOpenDispute={() => setShowDisputeModal(true)}
            onGeneratePdf={handleGeneratePdf}
            onNewBatch={() => {
              resetBatch();
              setCurrentTab('scan');
            }}
            isGeneratingPdf={isGeneratingPdf}
          />
        ) : (
          <View style={[styles.emptyReportBox, { backgroundColor: theme.background }]}>
            <Text style={{ fontSize: 50, marginBottom: 12 }}>📜</Text>
            <Text style={[styles.emptyReportTitle, { color: theme.text }]}>
              {getTranslation(lang, 'noReportYet')}
            </Text>
            <Text style={[styles.emptyReportDesc, { color: theme.textSecondary }]}>
              {getTranslation(lang, 'noReportYetDesc')}
            </Text>
            <TouchableOpacity
              style={[styles.startScanBtn, { backgroundColor: theme.primary }]}
              onPress={() => setCurrentTab('scan')}
            >
              <Text style={styles.startScanBtnText}>
                📷 {getTranslation(lang, 'startInspection')}
              </Text>
            </TouchableOpacity>
          </View>
        )
      )}

      {/* TAB 4: SETTINGS SCREEN */}
      {currentTab === 'settings' && (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <SettingsModal
            visible={true}
            theme={theme}
            lang={lang}
            apiUrl={apiUrl}
            setApiUrl={(url) => {
              setApiUrl(url);
              checkBackendHealth(url);
            }}
            onSaveApiUrl={(url) => {
              saveSettings({ apiUrl: url });
              checkBackendHealth(url);
              setCurrentTab('home');
            }}
            onToggleLang={toggleLanguage}
            onToggleTheme={toggleTheme}
            isDemoMode={isDemoMode}
            setIsDemoMode={(val) => {
              setIsDemoMode(val);
              saveSettings({ isDemoMode: val });
            }}
            defaultPpm={ppm}
            setDefaultPpm={setPpm}
            onClose={() => setCurrentTab('home')}
          />
        </View>
      )}

      {/* Bottom Navigation Bar */}
      <BottomNavBar
        theme={theme}
        lang={lang}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        hasReport={Boolean(report)}
      />

      {/* ₹5 Coin Calibration Modal Overlay */}
      <CalibrationOverlay
        visible={isCalibrating}
        theme={theme}
        lang={lang}
        circleSize={circleSize}
        setCircleSize={setCircleSize}
        onLock={(newPpm) => {
          setPpm(newPpm);
          saveSettings({ ppm: newPpm });
          setIsCalibrating(false);
          Alert.alert('Calibration Saved', `PPM locked at ${newPpm.toFixed(2)} px/mm.`);
        }}
        onClose={() => setIsCalibrating(false)}
      />

      {/* Counterfactual Rules Simulation Modal */}
      <SimulationModal
        visible={showSimModal}
        theme={theme}
        lang={lang}
        threshold={premiumThreshold}
        setThreshold={setPremiumThreshold}
        isSimulating={isSimulating}
        onRunSimulation={runSimulation}
        onClose={() => setShowSimModal(false)}
      />

      {/* Dispute & Reassessment Modal */}
      <DisputeModal
        visible={showDisputeModal}
        theme={theme}
        lang={lang}
        disputeStep={disputeStep}
        disputeNotes={disputeNotes}
        setDisputeNotes={setDisputeNotes}
        disputeData={disputeData}
        originalReport={report}
        onTriggerReassessment={triggerReassessment}
        onConfirmDispute={confirmDispute}
        onCancelDispute={cancelDispute}
      />

      {/* Offline Queue Modal */}
      <OfflineQueueModal
        visible={showQueueModal}
        theme={theme}
        lang={lang}
        queue={syncQueue}
        isSyncing={isSyncing}
        onSyncAll={processSyncQueue}
        onClose={() => setShowQueueModal(false)}
      />

      {/* Settings Modal (when opened from Header or Home) */}
      {showSettingsModal && (
        <SettingsModal
          visible={showSettingsModal}
          theme={theme}
          lang={lang}
          apiUrl={apiUrl}
          setApiUrl={(url) => {
            setApiUrl(url);
            checkBackendHealth(url);
          }}
          onSaveApiUrl={(url) => {
            saveSettings({ apiUrl: url });
            checkBackendHealth(url);
          }}
          onToggleLang={toggleLanguage}
          onToggleTheme={toggleTheme}
          isDemoMode={isDemoMode}
          setIsDemoMode={(val) => {
            setIsDemoMode(val);
            saveSettings({ isDemoMode: val });
          }}
          defaultPpm={ppm}
          setDefaultPpm={setPpm}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  permCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  permTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  permMsg: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  permBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  permBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  galleryFallbackBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    width: '100%',
    alignItems: 'center',
  },
  galleryFallbackText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleBox: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  stabilityFloat: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cameraTopFloat: {
    position: 'absolute',
    top: 16,
    right: 16,
    gap: 10,
  },
  floatCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 30, 30, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cameraControls: {
    paddingTop: 14,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modeTabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 20,
    padding: 3,
    marginBottom: 14,
  },
  modeTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideActionBtn: {
    width: 62,
    height: 62,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideActionLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  shutterCenter: {
    width: 78,
    height: 78,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterCore: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  shutterRecordingCore: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  emptyReportBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyReportTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyReportDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  startScanBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  startScanBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
