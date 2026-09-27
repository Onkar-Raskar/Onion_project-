import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { getTranslation } from '../translations';

export default function SimulationModal({
  visible,
  theme,
  lang,
  threshold,
  setThreshold,
  isSimulating,
  onRunSimulation,
  onClose,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: theme.accent }]}>
                🎛️ {getTranslation(lang, 'simulatorTitle')}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {getTranslation(lang, 'simulatorDesc', { threshold })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
              <Text style={{ fontSize: 18, color: theme.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Slider Container */}
          <View style={[styles.sliderCard, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}>
            <View style={styles.sliderHeader}>
              <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>
                {lang === 'hi' ? 'ग्रेड A न्यूनतम व्यास (मिमी):' : 'Min Grade A Diameter:'}
              </Text>
              <View style={[styles.valBadge, { backgroundColor: theme.accentLight, borderColor: theme.accent }]}>
                <Text style={[styles.valText, { color: theme.accent }]}>{threshold} mm</Text>
              </View>
            </View>

            <Slider
              style={styles.slider}
              minimumValue={40}
              maximumValue={90}
              step={1}
              value={threshold}
              onValueChange={setThreshold}
              minimumTrackTintColor={theme.accent}
              maximumTrackTintColor={theme.sliderMax}
              thumbTintColor={theme.accent}
            />

            <View style={styles.rangeRow}>
              <Text style={[styles.rangeText, { color: theme.textMuted }]}>40mm ({lang === 'hi' ? 'उदार' : 'Loose'})</Text>
              <Text style={[styles.rangeText, { color: theme.textMuted }]}>65mm ({lang === 'hi' ? 'मानक' : 'Default'})</Text>
              <Text style={[styles.rangeText, { color: theme.textMuted }]}>90mm ({lang === 'hi' ? 'सख्त' : 'Strict'})</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.simulateBtn, { backgroundColor: theme.accent }]}
            onPress={onRunSimulation}
            disabled={isSimulating}
          >
            {isSimulating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.simulateBtnText}>
                🚀 {getTranslation(lang, 'simulateAction')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: theme.surfaceBorder }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>
              {getTranslation(lang, 'close')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  closeIcon: {
    padding: 4,
  },
  sliderCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 12,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  valBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  valText: {
    fontSize: 14,
    fontWeight: '800',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeText: {
    fontSize: 10,
  },
  simulateBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  simulateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
