import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useAppStore } from '../store';
import { apiService, AnalyzeResponse } from '../services/api';
import { Button } from '../components/Button';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

const SAMPLING_PROMPTS = ["Scan Top Layer", "Scan Middle Crate", "Scan Bottom Layer"];

export default function ScanScreen() {
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  
  const { ppm } = useAppStore();
  
  const [mode, setMode] = useState<'picture' | 'video'>('video');
  const [flashMode, setFlashMode] = useState<'on' | 'off'>('off');
  const [captureState, setCaptureState] = useState<'idle' | 'recording' | 'analyzing'>('idle'); 
  const [timeLeft, setTimeLeft] = useState(5);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [reportBuffer, setReportBuffer] = useState<AnalyzeResponse[]>([]);
  const [fileBuffer, setFileBuffer] = useState<{uri: string, type: 'photo'|'video'}[]>([]);
  
  const [isDeviceSteady, setIsDeviceSteady] = useState(true);
  const isDeviceSteadyRef = useRef(true); 
  const cameraRef = useRef<any>(null);

  // LOCAL offline flag — immune to the Home screen health check overriding the store.
  // Initialize from the global store: if health check already says offline, start in offline mode.
  const offlineModeRef = useRef(!useAppStore.getState().isOnline);
  const sampleIndexRef = useRef(0);

  useEffect(() => {
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

  // Keep the ref in sync with sampleIndex state
  useEffect(() => {
    sampleIndexRef.current = sampleIndex;
  }, [sampleIndex]);

  if (!camPermission || !micPermission) return <View style={styles.blackBackground} />;
  
  if (!camPermission.granted || !micPermission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera and Microphone access needed to scan batches.</Text>
        <Button 
          title="Enable Hardware" 
          onPress={async () => {
            await requestCamPermission();
            await requestMicPermission();
          }} 
        />
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || captureState !== 'idle' || !isDeviceSteadyRef.current) return;

    try {
      if (mode === 'video') {
        setCaptureState('recording');
        
        let time = 2; // Reduced to 2s to boost effective frame rate for backend tracker
        setTimeLeft(time);
        let aborted = false;

        const timer = setInterval(() => {
          if (!isDeviceSteadyRef.current) {
            clearInterval(timer);
            aborted = true;
            cameraRef.current.stopRecording(); 
            setCaptureState('idle');
            Alert.alert("Capture Aborted", "Device was shaking too much. Hold steady.");
            return;
          }
          time -= 1;
          setTimeLeft(time);
          if (time <= 0) clearInterval(timer);
        }, 1000);

        const video = await cameraRef.current.recordAsync({ maxDuration: 2 });
        if (aborted) return; 
        
        setCaptureState('analyzing');
        await processMedia(video.uri, 'video');
      } else {
        setCaptureState('analyzing');
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        await processMedia(photo.uri, 'photo');
      }
    } catch (error) {
      Alert.alert("Capture failed", "Camera encountered an error.");
      setCaptureState('idle');
    }
  };

  const handleGalleryPick = async () => {
    if (captureState !== 'idle') return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setCaptureState('analyzing');
        const mediaType = asset.type === 'video' ? 'video' : 'photo';
        await processMedia(asset.uri, mediaType);
      }
    } catch (error: any) {
      console.error("Gallery Pick Error:", error);
      Alert.alert("Gallery Error", `Could not pick file: ${error.message}`);
      setCaptureState('idle');
    }
  };

  const processMedia = async (fileUri: string, type: 'photo' | 'video') => {
    let persistentUri = '';
    try {
      // 1. Persist the file so Expo Camera doesn't delete it when unmounting!
      const ext = type === 'video' ? 'mp4' : 'jpg';
      persistentUri = `${FileSystem.documentDirectory}sim_cache_${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: fileUri, to: persistentUri });

      const currentIdx = sampleIndexRef.current;

      // If we already switched to offline mode (after a previous failure), skip the network entirely
      if (offlineModeRef.current) {
        const { getOfflineQueueService } = require('../services/offlineQueue');
        await getOfflineQueueService().enqueue(persistentUri, ppm, type);
        
        const updatedFiles = [...fileBuffer, { uri: persistentUri, type }];
        setFileBuffer(updatedFiles);

        if (currentIdx < SAMPLING_PROMPTS.length - 1) {
          const nextIdx = currentIdx + 1;
          setSampleIndex(nextIdx);
          sampleIndexRef.current = nextIdx;
          Alert.alert("Saved Offline", `Proceed to: ${SAMPLING_PROMPTS[nextIdx]}`);
          setCaptureState('idle');
        } else {
          Alert.alert("Batch Complete", "All 3 layers saved to Offline Queue. Sync when internet returns.");
          router.replace('/');
        }
        return;
      }

      // 2. Try to analyze using the backend
      const data = await apiService.analyzeBatch(persistentUri, ppm, type);
      
      if (data.gate_failed) {
        Alert.alert("Quality Gate Rejected", data.reason || "Image blur or framing issue.");
        setCaptureState('idle');
        return; 
      }

      const updatedBuffer = [...reportBuffer, data];
      const updatedFiles = [...fileBuffer, { uri: persistentUri, type }];
      setReportBuffer(updatedBuffer);
      setFileBuffer(updatedFiles);

      if (currentIdx < SAMPLING_PROMPTS.length - 1) {
        const nextIdx = currentIdx + 1;
        setSampleIndex(nextIdx);
        sampleIndexRef.current = nextIdx;
        Alert.alert("Sample Logged", `Proceed to: ${SAMPLING_PROMPTS[nextIdx]}`);
        setCaptureState('idle');
      } else {
        const store = useAppStore.getState();
        store.setCurrentBatch(updatedBuffer, updatedFiles);
        router.replace('/report');
      }
    } catch (error: any) {
      console.error("processMedia failed:", error);
      
      // AUTOMATICALLY switch to offline mode — no need for a second prompt ever
      offlineModeRef.current = true;
      useAppStore.getState().setIsOnline(false);

      // Enqueue the failed file immediately
      const { getOfflineQueueService } = require('../services/offlineQueue');
      await getOfflineQueueService().enqueue(persistentUri, ppm, type);
      
      const updatedFiles = [...fileBuffer, { uri: persistentUri, type }];
      setFileBuffer(updatedFiles);

      const currentIdx = sampleIndexRef.current;

      if (currentIdx < SAMPLING_PROMPTS.length - 1) {
        const nextIdx = currentIdx + 1;
        setSampleIndex(nextIdx);
        sampleIndexRef.current = nextIdx;
        Alert.alert(
          "Switched to Offline Mode", 
          `Backend unreachable. This scan was saved locally.\n\nProceed to: ${SAMPLING_PROMPTS[nextIdx]}\n\nRemaining layers will be saved offline automatically.`
        );
        setCaptureState('idle');
      } else {
        Alert.alert("Batch Complete (Offline)", "All layers saved to Offline Queue. Sync from Home when internet returns.");
        router.replace('/');
      }
    }
  };

  const currentSequenceTarget = SAMPLING_PROMPTS[sampleIndex];

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} mode={mode} facing="back" enableTorch={flashMode === 'on'} />
      
      <View style={styles.uiLayer}>
        <View style={styles.topArea}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={{color: '#FFF', fontWeight: 'bold'}}>← Cancel</Text>
          </TouchableOpacity>
          
          <View style={styles.stepperContainer}>
            {[0, 1, 2].map(step => (
              <View key={step} style={[
                styles.stepDot,
                sampleIndex >= step && styles.stepDotActive,
                sampleIndex === step && styles.stepDotCurrent
              ]} />
            ))}
          </View>

          <View style={[
            styles.instructionPill, 
            !isDeviceSteady ? { backgroundColor: colors.danger } : {}
          ]}>
            <Text style={[styles.instructionText, captureState === 'recording' && styles.recordingText]}>
              {!isDeviceSteady 
                ? "⚠️ HOLD DEVICE STEADY" 
                : captureState === 'recording' 
                  ? `● RECORDING - Pan slowly (${timeLeft}s)` 
                  : captureState === 'analyzing'
                    ? "Analyzing Sample..."
                    : `Step ${sampleIndex + 1}: ${currentSequenceTarget}`}
            </Text>
          </View>
        </View>

        <View style={styles.centerArea}>
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.topLeft, !isDeviceSteady && {borderColor: colors.danger}]} />
            <View style={[styles.corner, styles.topRight, !isDeviceSteady && {borderColor: colors.danger}]} />
            <View style={[styles.corner, styles.bottomLeft, !isDeviceSteady && {borderColor: colors.danger}]} />
            <View style={[styles.corner, styles.bottomRight, !isDeviceSteady && {borderColor: colors.danger}]} />
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
            {/* GALLERY BUTTON */}
            <TouchableOpacity 
              style={styles.sideButton} 
              onPress={handleGalleryPick}
              disabled={captureState !== 'idle'}
            >
              <Feather name="image" size={28} color={captureState === 'idle' ? '#FFF' : '#888'} />
            </TouchableOpacity>

            {/* MAIN CAPTURE BUTTON */}
            <View style={styles.captureArea}>
              {captureState === 'analyzing' ? (
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

            {/* FLASH BUTTON */}
            <TouchableOpacity 
              style={styles.sideButton} 
              onPress={() => setFlashMode(prev => prev === 'on' ? 'off' : 'on')}
              disabled={captureState !== 'idle'}
            >
              <Feather name={flashMode === 'on' ? "zap" : "zap-off"} size={28} color={captureState === 'idle' ? (flashMode === 'on' ? '#FFEB3B' : '#FFF') : '#888'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blackBackground: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  permissionText: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  camera: {
    flex: 1,
  },
  uiLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    elevation: 10,
    justifyContent: 'space-between',
    paddingTop: 50,
  },
  topArea: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  stepperContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepDotCurrent: {
    borderWidth: 2,
    borderColor: '#FFF',
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  instructionPill: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  instructionText: {
    ...typography.bodyMedium,
    color: '#FFF',
  },
  recordingText: {
    color: colors.danger,
    fontWeight: 'bold',
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticle: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#4CAF50',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  bottomControlArea: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingBottom: 60, // Increased bottom padding to prevent clipping
    paddingTop: 20,
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 30,
  },
  modeText: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeModeText: {
    color: '#FFC107',
  },
  captureRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  sideButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
  },
  captureArea: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureOuterRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingOuterRing: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  captureInnerButton: {
    borderRadius: 28,
  },
  photoInner: {
    width: 56,
    height: 56,
    backgroundColor: '#FFF',
  },
  videoInner: {
    width: 56,
    height: 56,
    backgroundColor: '#F44336',
  },
  recordingInner: {
    width: 28,
    height: 28,
    borderRadius: 4,
  },
});

