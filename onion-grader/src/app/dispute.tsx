import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAppStore } from '../store';
import { aggregateReports } from '../utils/reportAggregator';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radii, MIN_TOUCH_TARGET } from '../theme/spacing';

export default function DisputeScreen() {
  const { currentBatchReports, simulatedBatchReports, authorizeSettlement } = useAppStore();

  const originalReport = useMemo(() => {
    if (!currentBatchReports || currentBatchReports.length === 0) return null;
    return aggregateReports(currentBatchReports);
  }, [currentBatchReports]);

  const simulatedReport = useMemo(() => {
    if (!simulatedBatchReports || simulatedBatchReports.length === 0) return null;
    return aggregateReports(simulatedBatchReports);
  }, [simulatedBatchReports]);

  if (!originalReport || !simulatedReport) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBg}>
          <Feather name="git-pull-request" size={48} color={colors.primaryLight} />
        </View>
        <Text style={styles.emptyTitle}>No Active Dispute</Text>
        <Text style={styles.emptySubtitle}>Complete a batch inspection and use the What-If Simulator first to generate an audit comparison.</Text>
        <TouchableOpacity style={styles.emptyCta} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#FFF" style={{ marginRight: spacing.sm }} />
          <Text style={styles.emptyCtaText}>Return to Report</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const gradeA = parseFloat(originalReport.batch_metrics.grade_a_pct);
  const gradeC = parseFloat(originalReport.batch_metrics.grade_c_pct);
  const urs = parseFloat(originalReport.batch_metrics.urs_pct);
  const totalOnions = originalReport.batch_metrics.total_unique_onions;

  const reassessedA = parseFloat(simulatedReport.batch_metrics.grade_a_pct);
  const reassessedC = parseFloat(simulatedReport.batch_metrics.grade_c_pct);
  const reassessedUrs = parseFloat(simulatedReport.batch_metrics.urs_pct);

  const deltaA = (reassessedA - gradeA).toFixed(1);
  const deltaC = (reassessedC - gradeC).toFixed(1);
  const deltaUrs = (reassessedUrs - urs).toFixed(1);
  
  const isPosA = parseFloat(deltaA) >= 0;
  const isPosC = parseFloat(deltaC) >= 0;
  const isPosUrs = parseFloat(deltaUrs) >= 0;

  const lotId = `ONION-LOT-${Date.now().toString().slice(-6)}`;

  const handleAuthorize = () => {
    authorizeSettlement();
    router.replace('/report'); // Redirect back to report which will now show the new numbers
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* BACK BUTTON + HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Reassessment Audit</Text>
          <Text style={typography.bodyMedium}>Lot #{lotId} • {totalOnions} onions sampled</Text>
        </View>
      </View>

      {/* GRADE COMPARISON TABLE */}
      <View style={styles.comparisonContainer}>
        
        {/* Original Column */}
        <View style={styles.column}>
          <Text style={styles.columnHeader}>ORIGINAL</Text>
          <View style={styles.dataCard}>
            <Text style={styles.metricLabel}>PREMIUM (A)</Text>
            <Text style={styles.metricValue}>{gradeA.toFixed(1)}%</Text>
            
            <View style={styles.divider} />
            
            <Text style={styles.metricLabel}>COMMERCIAL (C)</Text>
            <Text style={styles.metricValue}>{gradeC.toFixed(1)}%</Text>

            <View style={styles.divider} />
            
            <Text style={styles.metricLabel}>REJECT (URS)</Text>
            <Text style={[styles.metricValue, {color: colors.danger}]}>{urs.toFixed(1)}%</Text>
          </View>
        </View>

        {/* Reassessed Column */}
        <View style={styles.column}>
          <Text style={[styles.columnHeader, {color: colors.primary}]}>REASSESSED</Text>
          <View style={[styles.dataCard, {borderColor: colors.primary, borderWidth: 2}]}>
            <Text style={styles.metricLabel}>PREMIUM (A)</Text>
            <View style={styles.row}>
              <Text style={styles.metricValue}>{reassessedA.toFixed(1)}%</Text>
              <View style={[styles.deltaBadge, { backgroundColor: isPosA ? colors.successLight : 'rgba(198,40,40,0.1)' }]}>
                <Feather name={isPosA ? 'arrow-up-right' : 'arrow-down-right'} size={12} color={isPosA ? colors.success : colors.danger} />
                <Text style={[styles.deltaText, { color: isPosA ? colors.success : colors.danger }]}>{isPosA ? '+' : ''}{deltaA}%</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <Text style={styles.metricLabel}>COMMERCIAL (C)</Text>
            <View style={styles.row}>
              <Text style={styles.metricValue}>{reassessedC.toFixed(1)}%</Text>
              <View style={[styles.deltaBadge, { backgroundColor: isPosC ? colors.successLight : 'rgba(198,40,40,0.1)' }]}>
                <Feather name={isPosC ? 'arrow-up-right' : 'arrow-down-right'} size={12} color={isPosC ? colors.success : colors.danger} />
                <Text style={[styles.deltaText, { color: isPosC ? colors.success : colors.danger }]}>{isPosC ? '+' : ''}{deltaC}%</Text>
              </View>
            </View>

            <View style={styles.divider} />
            
            <Text style={styles.metricLabel}>REJECT (URS)</Text>
            <View style={styles.row}>
              <Text style={[styles.metricValue, {color: colors.danger}]}>{reassessedUrs.toFixed(1)}%</Text>
              <View style={[styles.deltaBadge, { backgroundColor: isPosUrs ? 'rgba(198,40,40,0.1)' : colors.successLight }]}>
                <Feather name={isPosUrs ? 'arrow-up-right' : 'arrow-down-right'} size={12} color={isPosUrs ? colors.danger : colors.success} />
                <Text style={[styles.deltaText, { color: isPosUrs ? colors.danger : colors.success }]}>{isPosUrs ? '+' : ''}{deltaUrs}%</Text>
              </View>
            </View>
          </View>
        </View>

      </View>

      {/* DEFECT BREAKDOWN */}
      {originalReport.defect_breakdown && originalReport.defect_breakdown.length > 0 && (
        <View style={[styles.dataCard, { marginBottom: spacing.xl }]}>
          <View style={styles.cardHeader}>
            <Feather name="alert-triangle" size={18} color={colors.warning} />
            <Text style={[styles.metricLabel, { marginBottom: 0, marginLeft: spacing.sm }]}>DEFECT BREAKDOWN</Text>
          </View>
          {originalReport.defect_breakdown.map((d: any, i: number) => (
            <View key={i} style={styles.defectRow}>
              <Text style={typography.bodyBold}>{d.fault}</Text>
              <Text style={[typography.bodyBold, { color: d.severity_pct > 10 ? colors.danger : colors.warning }]}>
                {d.severity_pct.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* BLOCKCHAIN AUDIT CARD */}
      <View style={styles.auditCard}>
        <Feather name="shield" size={20} color={colors.success} style={{ marginTop: 2 }} />
        <View style={styles.auditTextWrapper}>
          <Text style={styles.auditTitle}>Blockchain Integrity Log</Text>
          <Text style={styles.auditBody}>
            Authorizing this change will generate a new cryptographic certificate and permanently append the delta to the mandi ledger.
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.primaryButton} 
        onPress={handleAuthorize} 
        activeOpacity={0.8}
      >
        <Feather name="check-circle" size={20} color="#FFF" />
        <Text style={styles.primaryButtonText}>Authorize New Settlement</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.secondaryButton} 
        onPress={() => router.back()} 
        activeOpacity={0.8}
      >
        <Text style={styles.secondaryButtonText}>Discard Reassessment</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    opacity: 0.8,
  },
  emptyTitle: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodyMedium,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyCta: {
    flexDirection: 'row',
    backgroundColor: colors.textPrimary,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  emptyCtaText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Filled State
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
  },
  comparisonContainer: { 
    flexDirection: 'row', 
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  column: { 
    flex: 1 
  },
  columnHeader: { 
    ...typography.label, 
    textAlign: 'center', 
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  dataCard: { 
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  metricLabel: { 
    ...typography.label,
    fontSize: 11,
    marginBottom: 4,
  },
  metricValue: { 
    ...typography.h2,
    fontSize: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginLeft: spacing.sm,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  defectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  auditCard: {
    flexDirection: 'row',
    backgroundColor: colors.successLight,
    padding: spacing.lg,
    borderRadius: radii.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.2)',
  },
  auditTextWrapper: {
    flex: 1,
    marginLeft: spacing.md,
  },
  auditTitle: {
    ...typography.bodyBold,
    color: colors.success,
  },
  auditBody: {
    ...typography.bodyMedium,
    color: colors.success,
    marginTop: 4,
    fontSize: 13,
  },
  
  // Buttons
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
  }
});
