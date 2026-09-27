import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { getTranslation } from '../translations';

export default function StepProgressBar({
  theme,
  lang,
  currentIndex = 0,
  isReassessing = false,
}) {
  const steps = [0, 1, 2];
  const stepLabels = getTranslation(lang, 'samplingSteps');

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.progressTitle, { color: isReassessing ? theme.warning : theme.text }]}>
          {isReassessing ? '⚠️ ' + getTranslation(lang, 'reassessmentActive') : getTranslation(lang, 'sampleProgress', { current: currentIndex + 1, total: 3 })}
        </Text>
        <Text style={[styles.activeLabel, { color: theme.primary }]}>
          {stepLabels[currentIndex]}
        </Text>
      </View>

      <View style={styles.trackRow}>
        {steps.map((idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          let bubbleBg = theme.surfaceBorder;
          let textColor = theme.textMuted;
          let trackBg = theme.surfaceBorder;

          if (isDone) {
            bubbleBg = theme.gradeA;
            textColor = '#FFFFFF';
            trackBg = theme.gradeA;
          } else if (isCurrent) {
            bubbleBg = isReassessing ? theme.warning : theme.primary;
            textColor = '#FFFFFF';
            trackBg = isReassessing ? theme.warning : theme.primary;
          }

          return (
            <React.Fragment key={idx}>
              <View style={styles.stepItem}>
                <View style={[styles.stepBubble, { backgroundColor: bubbleBg }]}>
                  <Text style={[styles.stepBubbleText, { color: textColor }]}>
                    {isDone ? '✓' : idx + 1}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.stepSmallText,
                    { color: isCurrent ? theme.text : theme.textMuted },
                    isCurrent && styles.boldText,
                  ]}
                >
                  {stepLabels[idx]}
                </Text>
              </View>

              {idx < steps.length - 1 && (
                <View
                  style={[
                    styles.connectorLine,
                    { backgroundColor: idx < currentIndex ? theme.gradeA : theme.surfaceBorder },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    width: 80,
  },
  stepBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepBubbleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stepSmallText: {
    fontSize: 10,
    textAlign: 'center',
  },
  boldText: {
    fontWeight: '700',
  },
  connectorLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    marginBottom: 16,
  },
});
