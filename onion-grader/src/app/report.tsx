import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Feather } from '@expo/vector-icons';
import { aggregateReports } from '../utils/reportAggregator';
import { apiService, AnalyzeResponse } from '../services/api';
import { useAppStore } from '../store';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radii, MIN_TOUCH_TARGET } from '../theme/spacing';

export default function ReportScreen() {
  const { ppm, currentBatchReports, currentBatchFiles, setSimulatedBatch } = useAppStore();
  
  const originalParsedBuffer = currentBatchReports;
  const parsedFiles = currentBatchFiles;

  const [currentBuffer, setCurrentBuffer] = useState<AnalyzeResponse[]>(originalParsedBuffer);
  const [minPremiumMm, setMinPremiumMm] = useState(45.0);
  const [isSimulating, setIsSimulating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (minPremiumMm === 45.0) {
      setCurrentBuffer(originalParsedBuffer);
      setSimulatedBatch(null); // Reset — no simulation active
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    
    timerRef.current = setTimeout(async () => {
      setIsSimulating(true);
      try {
        const newReports = await Promise.all(
          parsedFiles.map(f => apiService.simulateGrading(f.uri, ppm, minPremiumMm))
        );
        setCurrentBuffer(newReports);
        setSimulatedBatch(newReports); // Persist to store for dispute screen
      } catch (error: any) {
        console.error("Simulation error:", error);
        Alert.alert("Simulation Failed", `Could not simulate: ${error.message}`);
      } finally {
        setIsSimulating(false);
      }
    }, 800);
  }, [minPremiumMm]);

  const report = useMemo(() => {
    if (!currentBuffer || currentBuffer.length === 0) return null;
    return aggregateReports(currentBuffer);
  }, [currentBuffer]);

  const generateAndSharePDF = async () => {
    if (!report) return;
    try {
      const batchId = `ONION-LOT-${Date.now()}`;
      const originalString = `${batchId}|A:${report.batch_metrics.grade_a_pct}|C:${report.batch_metrics.grade_c_pct}|URS:${report.batch_metrics.urs_pct}`;
      const originalHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, originalString);

      const htmlContent = `
        <html>
          <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333;">
            <div style="text-align: center; border-bottom: 2px solid ${colors.primary}; padding-bottom: 20px; margin-bottom: 30px;">
              <h1 style="color: ${colors.primary}; margin: 0; font-size: 28px;">Official Quality Certificate</h1>
              <p style="color: #777; margin-top: 5px;">Automated Procurement Division</p>
            </div>
            
            <table style="width: 100%; font-size: 16px; margin-bottom: 30px;">
              <tr><td style="padding: 8px 0; font-weight: bold;">Batch ID:</td><td style="text-align: right; font-family: monospace;">${batchId}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Total Unique Onions Analyzed:</td><td style="text-align: right;">${report.batch_metrics.total_unique_onions}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Confidence Interval:</td><td style="text-align: right;">${report.batch_metrics.confidence_interval_95}</td></tr>
            </table>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Grading Breakdown</h3>
              <p style="font-size: 18px;"><strong>Premium (Grade A > ${minPremiumMm}mm):</strong> <span style="color: ${colors.success}; float: right;">${report.batch_metrics.grade_a_pct}%</span></p>
              <p style="font-size: 18px;"><strong>Undersized (Grade C):</strong> <span style="color: ${colors.warning}; float: right;">${report.batch_metrics.grade_c_pct}%</span></p>
              <p style="font-size: 18px;"><strong>Rejected (URS):</strong> <span style="color: ${colors.danger}; float: right;">${report.batch_metrics.urs_pct}%</span></p>
              <div style="margin-top: 15px; font-size: 11px; font-family: monospace; background: #eee; padding: 10px; word-break: break-all;">Original SHA-256: ${originalHash}</div>
            </div>
            
            <div style="background-color: ${colors.successLight}; border-left: 5px solid ${colors.success}; padding: 15px; margin-top: 30px; font-weight: bold;">
              FINAL SETTLEMENT RATE: ${report.batch_metrics.grade_a_pct}% (Grade A)
            </div>
          </body>
        </html>
      `;

      const { base64 } = await Print.printToFileAsync({ html: htmlContent, base64: true });
      const newUri = `${FileSystem.documentDirectory}Quality_Certificate_${batchId}.pdf`;
      await FileSystem.writeAsStringAsync(newUri, base64 ?? '', { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(newUri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert("PDF Error", "Failed to generate PDF receipt.");
    }
  };

  // --- EMPTY STATE UI ---
  if (!report) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBg}>
          <Feather name="file-text" size={48} color={colors.primaryLight} />
        </View>
        <Text style={styles.emptyTitle}>No Active Inspection Report</Text>
        <Text style={styles.emptySubtitle}>Start an inspection scan from the Home tab to generate a cryptographic quality certificate.</Text>
        <TouchableOpacity style={styles.emptyCta} onPress={() => router.replace('/')}>
          <Feather name="camera" size={20} color="#FFF" style={{ marginRight: spacing.sm }} />
          <Text style={styles.emptyCtaText}>Start Lot Inspection</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- FILLED DASHBOARD UI ---
  const photoWithDetections = parsedFiles.find(f => f.type === 'photo');
  const photoDetections = photoWithDetections ? currentBuffer[parsedFiles.indexOf(photoWithDetections)]?.detections : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      
      {/* NINJACART-STYLE HERO STATS */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View>
            <Text style={typography.heroDisplay}>{report.batch_metrics.grade_a_pct}<Text style={{fontSize: 24}}>%</Text></Text>
            <Text style={[typography.h2, { color: colors.success }]}>GRADE A (PREMIUM)</Text>
          </View>
          <View style={styles.heroIconWrapper}>
            <Feather name="award" size={32} color={colors.success} />
          </View>
        </View>
        
        <View style={styles.heroDivider} />
        
        <View style={styles.heroMetricsRow}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricLabel}>UNIFORMITY</Text>
            <Text style={styles.heroMetricValue}>{report.batch_metrics.uniformity}</Text>
          </View>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricLabel}>INTEGRITY</Text>
            <Text style={styles.heroMetricValue}>{report.batch_metrics.integrity_score}</Text>
          </View>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricLabel}>CONFIDENCE</Text>
            <Text style={styles.heroMetricValue}>{report.batch_metrics.confidence_interval_95}</Text>
          </View>
        </View>
      </View>

      {/* ANNOTATED IMAGE */}
      {photoWithDetections && photoDetections && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="aperture" size={18} color={colors.textSecondary} />
            <Text style={styles.cardTitle}>Vision Sampling</Text>
          </View>
          <View style={styles.imageContainer}>
            <Image source={{ uri: photoWithDetections.uri }} style={styles.image} resizeMode="contain" />
            {photoDetections.map((d: any, i: number) => (
              <View key={i} style={[
                styles.box, 
                { left: d.box[0], top: d.box[1], width: d.box[2], height: d.box[3] },
                d.class === 'healthy' && d.tier === 'Grade A' ? { borderColor: colors.success } :
                d.class === 'healthy' ? { borderColor: colors.warning } : { borderColor: colors.danger }
              ]} />
            ))}
          </View>
          <Text style={styles.imageCaption}>Optical boundaries detected ({report.batch_metrics.total_unique_onions} onions)</Text>
        </View>
      )}

      {/* GRADING BARS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Distribution</Text>
        
        <View style={styles.barRow}>
          <View style={styles.barLabelGroup}>
            <Text style={typography.bodyBold}>Grade A</Text>
            <Text style={[typography.bodyBold, { color: colors.success }]}>{report.batch_metrics.grade_a_pct}%</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { backgroundColor: colors.success, width: `${report.batch_metrics.grade_a_pct}%` as any }]} />
          </View>
        </View>

        <View style={styles.barRow}>
          <View style={styles.barLabelGroup}>
            <Text style={typography.bodyBold}>Grade C</Text>
            <Text style={[typography.bodyBold, { color: colors.warning }]}>{report.batch_metrics.grade_c_pct}%</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { backgroundColor: colors.warning, width: `${report.batch_metrics.grade_c_pct}%` as any }]} />
          </View>
        </View>

        <View style={styles.barRow}>
          <View style={styles.barLabelGroup}>
            <Text style={typography.bodyBold}>Reject (URS)</Text>
            <Text style={[typography.bodyBold, { color: colors.danger }]}>{report.batch_metrics.urs_pct}%</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { backgroundColor: colors.danger, width: `${report.batch_metrics.urs_pct}%` as any }]} />
          </View>
        </View>
      </View>

      {/* PER-ONION LIST PREVIEW */}
      {report.detections && report.detections.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Analyzed Subjects ({report.detections.length})</Text>
          {report.detections.slice(0, 5).map((d: any, i: number) => (
            <View key={i} style={styles.onionRow}>
              <View style={[styles.onionIcon, { backgroundColor: d.class === 'damaged' ? colors.danger : colors.successLight }]}>
                <Feather name={d.class === 'damaged' ? 'alert-triangle' : 'check'} size={14} color={d.class === 'damaged' ? '#FFF' : colors.success} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={typography.bodyBold}>{d.class === 'healthy' ? d.tier : 'Rejected'}</Text>
                <Text style={typography.bodyMedium}>{d.defect || 'Standard Quality'}</Text>
              </View>
            </View>
          ))}
          {report.detections.length > 5 && (
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>View All {report.detections.length} Subjects</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* WHAT-IF SIMULATOR */}
      <View style={[styles.card, { backgroundColor: colors.primaryLight, borderColor: 'transparent' }]}>
        <View style={styles.cardHeader}>
          <Feather name="sliders" size={18} color={colors.primaryDark} />
          <Text style={[styles.cardTitle, { color: colors.primaryDark }]}>What-If Simulator {isSimulating && <ActivityIndicator size="small" color={colors.primaryDark} style={{marginLeft: 8}}/>}</Text>
        </View>
        <Text style={[typography.bodyMedium, { color: colors.primaryDark }]}>Simulate yield if buyers demand a larger minimum size for premium.</Text>
        <Text style={[typography.heroDisplay, { textAlign: 'center', marginVertical: spacing.md, fontSize: 36 }]}>{minPremiumMm.toFixed(1)}<Text style={{fontSize: 16}}>mm</Text></Text>
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={40}
          maximumValue={80}
          value={minPremiumMm}
          onValueChange={setMinPremiumMm}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor="rgba(139, 30, 63, 0.2)"
          thumbTintColor={colors.primary}
        />
      </View>

      {/* STRIPE-STYLE RECEIPT CTA */}
      <TouchableOpacity style={styles.receiptCta} onPress={generateAndSharePDF} activeOpacity={0.8}>
        <Feather name="shield" size={24} color="#FFF" />
        <View style={styles.receiptCtaTextWrapper}>
          <Text style={styles.receiptCtaTitle}>Generate Certificate</Text>
          <Text style={styles.receiptCtaSubtitle}>Cryptographically signed PDF</Text>
        </View>
        <Feather name="share" size={20} color="#FFF" />
      </TouchableOpacity>

      {/* DISPUTE / AUDIT BUTTON */}
      <TouchableOpacity 
        style={[styles.receiptCta, { backgroundColor: minPremiumMm !== 45.0 ? '#1565C0' : '#9E9E9E', marginTop: spacing.md }]} 
        onPress={() => router.push('/dispute')} 
        activeOpacity={0.8}
        disabled={minPremiumMm === 45.0}
      >
        <Feather name="alert-circle" size={24} color="#FFF" />
        <View style={styles.receiptCtaTextWrapper}>
          <Text style={styles.receiptCtaTitle}>Dispute / Audit</Text>
          <Text style={styles.receiptCtaSubtitle}>
            {minPremiumMm !== 45.0 ? "Compare original vs. simulated grades" : "Use the slider above to simulate first"}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color="#FFF" />
      </TouchableOpacity>
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  
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
    backgroundColor: '#F5EBEF', 
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
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
    backgroundColor: colors.primary,
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

  // Dashboard Cards
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroMetric: {
    alignItems: 'center',
  },
  heroMetricLabel: {
    ...typography.label,
    fontSize: 11,
    marginBottom: 4,
  },
  heroMetricValue: {
    ...typography.h2,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 8,
  },
  cardTitle: {
    ...typography.h2,
    marginBottom: spacing.md,
  },

  // Image & Boxes
  imageContainer: {
    width: '100%',
    height: 220,
    backgroundColor: '#F5F5F5',
    borderRadius: radii.sm,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
  },
  imageCaption: {
    ...typography.bodyMedium,
    fontSize: 13,
    textAlign: 'center',
  },

  // Progress Bars
  barRow: {
    marginBottom: spacing.md,
  },
  barLabelGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  barTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Per-onion List
  onionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  onionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewAllButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  viewAllText: {
    ...typography.label,
    color: colors.primary,
  },

  // Receipt CTA
  receiptCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E', // Dark trust color
    borderRadius: radii.md,
    padding: spacing.lg,
    marginTop: spacing.sm,
    minHeight: 80,
  },
  receiptCtaTextWrapper: {
    flex: 1,
    marginLeft: spacing.md,
  },
  receiptCtaTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  receiptCtaSubtitle: {
    color: '#9E9E9E',
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'monospace',
  }
});
