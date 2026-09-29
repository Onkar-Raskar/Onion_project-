import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import Slider from '@react-native-community/slider';
import { Feather } from '@expo/vector-icons';
import { useAppStore } from '../store';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radii, MIN_TOUCH_TARGET } from '../theme/spacing';

export default function CalibrationScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const setPpm = useAppStore(state => state.setPpm);
  
  const [circleSize, setCircleSize] = useState(110);
  const cameraRef = useRef(null);

  if (!permission) return <View style={styles.blackBackground} />;
  
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Feather name="camera-off" size={64} color={colors.textSecondary} style={{ marginBottom: spacing.lg }} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>The calibration tool requires optical sensor access to measure standard reference coins.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ppmValue = (circleSize / 23.0).toFixed(2);

  const lockCalibration = () => {
    setPpm(circleSize / 23.0);
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Must keep flex:1 on CameraView and absolute UI layer to prevent Android layout bug */}
      <CameraView style={styles.camera} facing="back" ref={cameraRef} />
      
      <SafeAreaView style={styles.uiLayer}>
        <View style={styles.topArea}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="x" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.instructionCard}>
            <View style={styles.instructionHeader}>
              <Feather name="target" size={16} color={colors.warning} />
              <Text style={styles.instructionTitle}>OPTICAL CALIBRATION</Text>
            </View>
            <Text style={styles.instructionText}>Place a standard ₹5 coin (23mm) on a flat surface and align the reticle exactly with the coin edges.</Text>
          </View>
        </View>

        <View style={styles.centerArea}>
          <View style={[
            styles.calibrationCircle, 
            { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }
          ]}>
            <View style={styles.crosshairV} />
            <View style={styles.crosshairH} />
          </View>
        </View>

        <View style={styles.bottomArea}>
          {/* Precision Typography Data Readout */}
          <View style={styles.dataReadoutContainer}>
            <View style={styles.dataBlock}>
              <Text style={styles.dataLabel}>DIAMETER</Text>
              <Text style={styles.dataValue}>{Math.round(circleSize)}px</Text>
            </View>
            <View style={styles.dataDivider} />
            <View style={styles.dataBlock}>
              <Text style={styles.dataLabel}>RESOLUTION</Text>
              <Text style={[styles.dataValue, { color: colors.warning }]}>{ppmValue} PPM</Text>
            </View>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={50}
            maximumValue={300}
            value={circleSize}
            onValueChange={setCircleSize}
            minimumTrackTintColor={colors.warning}
            maximumTrackTintColor="rgba(255,255,255,0.3)"
            thumbTintColor={colors.warning}
          />
          
          <TouchableOpacity style={styles.lockButton} onPress={lockCalibration} activeOpacity={0.8}>
            <Feather name="lock" size={20} color="#FFF" />
            <Text style={styles.lockButtonText}>LOCK CALIBRATION</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  blackBackground: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  uiLayer: { 
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10,
    justifyContent: 'space-between',
  },
  
  // Header
  topArea: { 
    paddingHorizontal: spacing.md, 
    paddingTop: spacing.md,
    flexDirection: 'row', 
    alignItems: 'flex-start' 
  },
  backButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: spacing.md,
  },
  instructionCard: { 
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)', 
    padding: spacing.md, 
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  instructionTitle: { 
    color: colors.warning, 
    fontSize: 12, 
    fontWeight: 'bold', 
    letterSpacing: 1,
    marginLeft: spacing.xs,
  },
  instructionText: { 
    color: '#FFF', 
    fontSize: 14, 
    lineHeight: 20 
  },

  // Reticle
  centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  calibrationCircle: { 
    borderWidth: 2, 
    borderColor: colors.warning, 
    backgroundColor: 'rgba(249, 168, 37, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairV: {
    width: 1,
    height: 20,
    backgroundColor: colors.warning,
    position: 'absolute'
  },
  crosshairH: {
    width: 20,
    height: 1,
    backgroundColor: colors.warning,
    position: 'absolute'
  },

  // Footer Controls
  bottomArea: { 
    backgroundColor: 'rgba(18, 26, 33, 0.9)', // Dark industrial background
    paddingHorizontal: spacing.lg, 
    paddingBottom: spacing.xxl, 
    paddingTop: spacing.lg, 
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  dataReadoutContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  dataBlock: {
    flex: 1,
    alignItems: 'center',
  },
  dataDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: spacing.md,
  },
  dataLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  dataValue: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '300',
    fontFamily: 'monospace',
  },
  slider: { 
    width: '100%', 
    height: 40, 
    marginBottom: spacing.xl 
  },
  lockButton: { 
    backgroundColor: colors.primary, 
    height: MIN_TOUCH_TARGET, 
    borderRadius: radii.md, 
    flexDirection: 'row',
    justifyContent: 'center', 
    alignItems: 'center', 
    width: '100%' 
  },
  lockButtonText: { 
    color: '#FFF', 
    fontSize: 15, 
    fontWeight: '700', 
    letterSpacing: 1,
    marginLeft: spacing.sm,
  },

  // Permissions
  permissionContainer: { 
    flex: 1, 
    backgroundColor: colors.background, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: spacing.xl 
  },
  permissionTitle: { 
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  permissionText: { 
    ...typography.bodyMedium,
    textAlign: 'center', 
    marginBottom: spacing.xl 
  },
  primaryButton: { 
    backgroundColor: colors.primary, 
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.md, 
    justifyContent: 'center',
    alignItems: 'center', 
    width: '100%',
    marginBottom: spacing.md,
  },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  cancelButton: {
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  cancelButtonText: { color: colors.textSecondary, fontSize: 16, fontWeight: '600' }
});
