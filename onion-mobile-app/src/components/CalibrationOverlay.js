import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import Slider from '@react-native-community/slider';
import { getTranslation } from '../translations';

export default function CalibrationOverlay({
  visible,
  theme,
  lang,
  circleSize,
  setCircleSize,
  onLock,
  onClose,
}) {
  const currentPpm = (circleSize / 23.0).toFixed(2);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        {/* Top Header Card */}
        <View style={[styles.topCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.title, { color: theme.primary }]}>
            🪙 {getTranslation(lang, 'calibrationTitle')}
          </Text>
          <Text style={[styles.desc, { color: theme.textSecondary }]}>
            {getTranslation(lang, 'calibrationDesc')}
          </Text>
          <View style={[styles.badge, { backgroundColor: theme.primaryLight, borderColor: theme.primaryBorder }]}>
            <Text style={[styles.badgeText, { color: theme.primary }]}>
              {getTranslation(lang, 'currentPpm', { ppm: currentPpm })}
            </Text>
          </View>
        </View>

        {/* Center Target Circle (Reference ₹5 coin) */}
        <View style={styles.centerTarget}>
          <View
            style={[
              styles.coinCircle,
              {
                width: circleSize,
                height: circleSize,
                borderRadius: circleSize / 2,
                borderColor: theme.warning,
                backgroundColor: 'rgba(217, 119, 6, 0.15)',
              },
            ]}
          >
            <View style={[styles.coinInnerCircle, { borderColor: theme.warning }]}>
              <Text style={[styles.coinText, { color: theme.warning }]}>₹5</Text>
              <Text style={[styles.coinSubText, { color: theme.warning }]}>23mm</Text>
            </View>
          </View>
        </View>

        {/* Bottom Control Sheet */}
        <View style={[styles.bottomSheet, { backgroundColor: theme.cardBg, borderTopColor: theme.surfaceBorder }]}>
          <View style={styles.sliderInfoRow}>
            <Text style={[styles.sliderLabel, { color: theme.textSecondary }]}>
              {getTranslation(lang, 'coinReference')}
            </Text>
            <Text style={[styles.sliderValue, { color: theme.text }]}>
              {Math.round(circleSize)} px
            </Text>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={50}
            maximumValue={300}
            step={1}
            value={circleSize}
            onValueChange={setCircleSize}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.sliderMax}
            thumbTintColor={theme.primary}
          />

          <View style={styles.btnRow}>
            {onClose && (
              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}
                onPress={onClose}
              >
                <Text style={[styles.btnText, { color: theme.textSecondary }]}>
                  {getTranslation(lang, 'cancel')}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btn, styles.primaryBtn, { backgroundColor: theme.primary }]}
              onPress={() => onLock(circleSize / 23.0)}
            >
              <Text style={styles.primaryBtnText}>
                {getTranslation(lang, 'lockCalibration')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'space-between',
  },
  topCard: {
    marginHorizontal: 16,
    marginTop: 50,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  desc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  centerTarget: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinCircle: {
    borderWidth: 3,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinInnerCircle: {
    width: '60%',
    height: '60%',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  coinText: {
    fontSize: 18,
    fontWeight: '900',
  },
  coinSubText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bottomSheet: {
    padding: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 6,
  },
  sliderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
  },
  primaryBtn: {
    flex: 2,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
