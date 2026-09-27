import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { getTranslation } from '../translations';

export default function StabilityIndicator({
  theme,
  lang,
  isSteady = true,
  isRecording = false,
  timeLeft = 5,
  isAnalyzing = false,
}) {
  let bgColor = 'rgba(31, 36, 33, 0.75)';
  let borderColor = 'rgba(255, 255, 255, 0.2)';
  let textColor = '#FFFFFF';
  let message = '';

  if (isAnalyzing) {
    bgColor = theme.accentLight;
    borderColor = theme.accent;
    textColor = theme.accent;
    message = '⏳ ' + getTranslation(lang, 'analyzingSample');
  } else if (!isSteady) {
    bgColor = 'rgba(220, 38, 38, 0.9)';
    borderColor = '#FECACA';
    textColor = '#FFFFFF';
    message = '📳 ' + getTranslation(lang, 'holdSteady');
  } else if (isRecording) {
    bgColor = 'rgba(220, 38, 38, 0.9)';
    borderColor = '#FCA5A5';
    textColor = '#FFFFFF';
    message = '● ' + getTranslation(lang, 'recordingHint', { seconds: timeLeft });
  } else {
    bgColor = 'rgba(46, 125, 50, 0.85)';
    borderColor = '#B7E4C0';
    textColor = '#FFFFFF';
    message = '✓ ' + (lang === 'hi' ? 'फोन स्थिर है' : 'Camera Stable');
  }

  return (
    <View style={[styles.pill, { backgroundColor: bgColor, borderColor: borderColor }]}>
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
