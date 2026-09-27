import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getTranslation } from '../translations';
import DefectBreakdownCard from './DefectBreakdownCard';

export default function QualityCertificateView({
  theme,
  lang,
  report,
  disputeData,
  disputeNotes,
  threshold,
  onOpenSimulator,
  onOpenDispute,
  onGeneratePdf,
  onNewBatch,
  isGeneratingPdf,
}) {
  const metrics = report?.batch_metrics || {};
  const activeGradeA = disputeData ? disputeData.grade_a_pct : metrics.grade_a_pct;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Banner Card */}
      <View style={[styles.certHeaderCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
        <View style={styles.certBadgeRow}>
          <View style={[styles.verifiedBadge, { backgroundColor: theme.primaryLight, borderColor: theme.primaryBorder }]}>
            <Text style={[styles.verifiedText, { color: theme.primary }]}>
              ✓ {lang === 'hi' ? 'प्रमाणित डिजिटल रिपोर्ट' : 'VERIFIED QUALITY LOT'}
            </Text>
          </View>
          <Text style={[styles.marginText, { color: theme.textSecondary }]}>
            CI: {metrics.confidence_interval_95 || '±0.0%'}
          </Text>
        </View>

        <Text style={[styles.certTitle, { color: theme.text }]}>
          📜 {getTranslation(lang, 'certificateTitle')}
        </Text>

        <View style={styles.lotMetaRow}>
          <Text style={[styles.lotMetaText, { color: theme.textSecondary }]}>
            {getTranslation(lang, 'totalAnalyzed')}:
          </Text>
          <Text style={[styles.lotMetaVal, { color: theme.text }]}>
            {metrics.total_unique_onions || 0} {lang === 'hi' ? 'इकाई' : 'units'}
          </Text>
        </View>
      </View>

      {/* DISPUTE ACTIVE BANNER */}
      {disputeData && (
        <View style={[styles.disputeBanner, { backgroundColor: theme.warningBg, borderColor: theme.warning }]}>
          <Text style={[styles.disputeBannerTitle, { color: theme.warning }]}>
            ⚠️ {getTranslation(lang, 'reassessmentActive')}
          </Text>
          <Text style={[styles.disputeNoteText, { color: theme.text }]}>
            {disputeNotes ? `"${disputeNotes}"` : 'Secondary sample verified.'}
          </Text>
        </View>
      )}

      {/* THREE MAIN COMMERCIAL GRADE CARDS */}
      <View style={styles.gradesContainer}>
        {/* Grade A Card */}
        <View style={[styles.gradeCard, { backgroundColor: theme.gradeABg, borderColor: theme.gradeABorder }]}>
          <View style={styles.gradeHeaderRow}>
            <Text style={[styles.gradeBadgeText, { color: theme.gradeA }]}>
              {getTranslation(lang, 'gradeA')}
            </Text>
            {disputeData && (
              <Text style={[styles.struckVal, { color: theme.textMuted }]}>
                {metrics.grade_a_pct}%
              </Text>
            )}
          </View>
          <Text style={[styles.gradeValue, { color: theme.gradeA }]}>
            {activeGradeA}%
          </Text>
          <Text style={[styles.gradeDesc, { color: theme.textSecondary }]}>
            {getTranslation(lang, 'gradeADesc', { threshold })}
          </Text>
        </View>

        {/* Grade C Card */}
        <View style={[styles.gradeCard, { backgroundColor: theme.gradeCBg, borderColor: theme.gradeCBorder }]}>
          <View style={styles.gradeHeaderRow}>
            <Text style={[styles.gradeBadgeText, { color: theme.gradeC }]}>
              {getTranslation(lang, 'gradeC')}
            </Text>
          </View>
          <Text style={[styles.gradeValue, { color: theme.gradeC }]}>
            {disputeData ? disputeData.grade_c_pct : metrics.grade_c_pct}%
          </Text>
          <Text style={[styles.gradeDesc, { color: theme.textSecondary }]}>
            {getTranslation(lang, 'gradeCDesc')}
          </Text>
        </View>

        {/* URS / Rejected Card */}
        <View style={[styles.gradeCard, { backgroundColor: theme.gradeUrsBg, borderColor: theme.gradeUrsBorder }]}>
          <View style={styles.gradeHeaderRow}>
            <Text style={[styles.gradeBadgeText, { color: theme.gradeUrs }]}>
              {getTranslation(lang, 'gradeUrs')}
            </Text>
          </View>
          <Text style={[styles.gradeValue, { color: theme.gradeUrs }]}>
            {disputeData ? disputeData.urs_pct : metrics.urs_pct}%
          </Text>
          <Text style={[styles.gradeDesc, { color: theme.textSecondary }]}>
            {getTranslation(lang, 'gradeUrsDesc')}
          </Text>
        </View>
      </View>

      {/* FINAL SETTLEMENT CALLOUT */}
      <View style={[styles.settlementBanner, { backgroundColor: theme.cardBg, borderColor: theme.gradeABorder }]}>
        <View style={[styles.settlementIconBox, { backgroundColor: theme.gradeABg }]}>
          <Text style={{ fontSize: 20 }}>💰</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.settlementLabel, { color: theme.textSecondary }]}>
            {lang === 'hi' ? 'अंतिम मंडी खरीद दर' : 'Mandatory Mandi Settlement Basis'}
          </Text>
          <Text style={[styles.settlementVal, { color: theme.gradeA }]}>
            {getTranslation(lang, 'settlementRate', { rate: activeGradeA })}
          </Text>
        </View>
      </View>

      {/* DEFECT BREAKDOWN */}
      <DefectBreakdownCard
        theme={theme}
        lang={lang}
        defects={report?.defect_breakdown}
      />

      {/* COUNTERFACTUAL RULES QUICK LAUNCHER */}
      <TouchableOpacity
        style={[styles.simLaunchBtn, { backgroundColor: theme.cardBg, borderColor: theme.accent }]}
        onPress={onOpenSimulator}
        activeOpacity={0.8}
      >
        <View style={[styles.simIconBox, { backgroundColor: theme.accentLight }]}>
          <Text style={{ fontSize: 18 }}>🎛️</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.simLaunchTitle, { color: theme.accent }]}>
            {getTranslation(lang, 'simulatorTitle')}
          </Text>
          <Text style={[styles.simLaunchSub, { color: theme.textSecondary }]}>
            {lang === 'hi'
              ? `जांचें कि ${threshold}mm आकार बदलने पर दर क्या होगी`
              : `Simulate pricing yield if size rule changes from ${threshold}mm`}
          </Text>
        </View>
        <Text style={{ fontSize: 16, color: theme.accent }}>➔</Text>
      </TouchableOpacity>

      {/* ACTION BUTTONS */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
          onPress={onGeneratePdf}
          disabled={isGeneratingPdf}
        >
          {isGeneratingPdf ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryActionBtnText}>
              📄 {getTranslation(lang, 'generatePdf')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}
          onPress={onNewBatch}
        >
          <Text style={[styles.secondaryActionBtnText, { color: theme.text }]}>
            🔄 {getTranslation(lang, 'newBatch')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* DISPUTE TRIGGER */}
      {!disputeData && (
        <TouchableOpacity
          style={[styles.disputeTriggerBtn, { backgroundColor: theme.warningBg, borderColor: theme.warning }]}
          onPress={onOpenDispute}
        >
          <Text style={[styles.disputeTriggerText, { color: theme.warning }]}>
            ⚖️ {getTranslation(lang, 'raiseDispute')}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  certHeaderCard: {
    margin: 16,
    marginBottom: 8,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  certBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  verifiedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  marginText: {
    fontSize: 11,
    fontWeight: '600',
  },
  certTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 4,
  },
  lotMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EAE5DF',
  },
  lotMetaText: {
    fontSize: 13,
  },
  lotMetaVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  disputeBanner: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  disputeBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  disputeNoteText: {
    fontSize: 12,
    marginTop: 2,
  },
  gradesContainer: {
    marginHorizontal: 16,
    marginVertical: 4,
    gap: 10,
  },
  gradeCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  gradeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  gradeBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  struckVal: {
    fontSize: 16,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  gradeValue: {
    fontSize: 34,
    fontWeight: '900',
    marginVertical: 2,
  },
  gradeDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  settlementBanner: {
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settlementIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settlementLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  settlementVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  simLaunchBtn: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  simIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simLaunchTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  simLaunchSub: {
    fontSize: 11,
    marginTop: 2,
  },
  actionRow: {
    marginHorizontal: 16,
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  primaryActionBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  disputeTriggerBtn: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  disputeTriggerText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
