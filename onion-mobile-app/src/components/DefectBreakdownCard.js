import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { getTranslation } from '../translations';

export default function DefectBreakdownCard({ theme, lang, defects }) {
  if (!defects || defects.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
        <Text style={[styles.header, { color: theme.gradeA }]}>
          ✓ {lang === 'hi' ? 'कोई गंभीर दोष नहीं' : 'No Critical Defects'}
        </Text>
        <Text style={[styles.noDefectText, { color: theme.textSecondary }]}>
          {getTranslation(lang, 'noDefects')}
        </Text>
      </View>
    );
  }

  const getDefectName = (rawFault) => {
    const f = (rawFault || '').toLowerCase();
    if (f.includes('smut') || f.includes('fungus')) return getTranslation(lang, 'defectFungus');
    if (f.includes('sprout')) return getTranslation(lang, 'defectSprouting');
    if (f.includes('crack') || f.includes('mechanical')) return getTranslation(lang, 'defectMechanical');
    if (f.includes('foreign') || f.includes('unrecognized')) return getTranslation(lang, 'defectForeign');
    return rawFault;
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
      <Text style={[styles.header, { color: theme.gradeUrs }]}>
        🔍 {getTranslation(lang, 'defectHeader')}
      </Text>

      {defects.map((d, index) => {
        const severity = parseFloat(d.severity_pct || 0);
        const barWidth = Math.min(100, Math.max(8, severity));

        return (
          <View key={index} style={styles.defectItem}>
            <View style={styles.row}>
              <Text style={[styles.defectName, { color: theme.text }]}>
                {getDefectName(d.fault)}
              </Text>
              <Text style={[styles.defectSeverity, { color: theme.gradeUrs }]}>
                {getTranslation(lang, 'severityArea', { pct: d.severity_pct })}
              </Text>
            </View>

            {/* Visual Severity Progress Bar */}
            <View style={[styles.barTrack, { backgroundColor: theme.cardBgAlt }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${barWidth}%`,
                    backgroundColor: severity > 20 ? theme.gradeUrs : theme.warning,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  noDefectText: {
    fontSize: 13,
    lineHeight: 18,
  },
  defectItem: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  defectName: {
    fontSize: 13,
    fontWeight: '600',
  },
  defectSeverity: {
    fontSize: 13,
    fontWeight: '700',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
});
