import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { getTranslation } from '../translations';

export default function DisputeModal({
  visible,
  theme,
  lang,
  disputeStep, // 'init' | 'scanning' | 'comparison'
  disputeNotes,
  setDisputeNotes,
  disputeData,
  originalReport,
  onTriggerReassessment,
  onConfirmDispute,
  onCancelDispute,
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.title, { color: theme.text }]}>
                  ⚖️ {getTranslation(lang, 'disputeTitle')}
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {getTranslation(lang, 'disputeSubtitle')}
                </Text>
              </View>
              <TouchableOpacity onPress={onCancelDispute} style={styles.closeIcon}>
                <Text style={{ fontSize: 18, color: theme.textSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* STEP 1: Enter dispute notes & select action */}
            {disputeStep === 'init' && (
              <View style={styles.stepContainer}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  {lang === 'hi' ? 'आपत्ति / विवाद का कारण:' : 'Contestation / Dispute Note:'}
                </Text>
                <TextInput
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: theme.cardBgAlt,
                      borderColor: theme.surfaceBorder,
                      color: theme.text,
                    },
                  ]}
                  placeholder={getTranslation(lang, 'disputeNotesPlaceholder')}
                  placeholderTextColor={theme.textMuted}
                  value={disputeNotes}
                  onChangeText={setDisputeNotes}
                  multiline
                  numberOfLines={3}
                />

                <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 16 }]}>
                  {getTranslation(lang, 'chooseAction')}
                </Text>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.warning, borderColor: theme.warning }]}
                  onPress={() => onTriggerReassessment('new')}
                >
                  <Text style={[styles.actionBtnText, { color: '#000000' }]}>
                    📷 {getTranslation(lang, 'rescanSequence')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.primary, marginTop: 10 }]}
                  onPress={() => onTriggerReassessment('same')}
                >
                  <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>
                    🔄 {getTranslation(lang, 'reassessCached')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.surfaceBorder, marginTop: 12 }]}
                  onPress={onCancelDispute}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>
                    {getTranslation(lang, 'cancel')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2: Processing Reassessment */}
            {disputeStep === 'scanning' && (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingTitle, { color: theme.text, marginTop: 16 }]}>
                  {getTranslation(lang, 'reassessingTitle')}
                </Text>
                <Text style={[styles.loadingDesc, { color: theme.textSecondary, marginTop: 4 }]}>
                  {getTranslation(lang, 'reassessingDesc')}
                </Text>
              </View>
            )}

            {/* STEP 3: Comparison View */}
            {disputeStep === 'comparison' && disputeData && originalReport && (
              <View style={styles.stepContainer}>
                <View style={[styles.comparisonCard, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}>
                  <View style={styles.compCol}>
                    <Text style={[styles.compLabel, { color: theme.textMuted }]}>
                      {getTranslation(lang, 'originalGradeA')}
                    </Text>
                    <Text style={[styles.compValueStruck, { color: theme.textMuted }]}>
                      {originalReport.batch_metrics?.grade_a_pct}%
                    </Text>
                  </View>

                  <View style={styles.arrowCol}>
                    <Text style={{ fontSize: 20, color: theme.textSecondary }}>➔</Text>
                  </View>

                  <View style={styles.compCol}>
                    <Text style={[styles.compLabel, { color: theme.gradeA }]}>
                      {getTranslation(lang, 'newGradeA')}
                    </Text>
                    <Text style={[styles.compValueNew, { color: theme.gradeA }]}>
                      {disputeData.grade_a_pct}%
                    </Text>
                  </View>
                </View>

                {/* Additional details */}
                <View style={[styles.detailTable, { borderColor: theme.surfaceBorder }]}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailText, { color: theme.textSecondary }]}>{getTranslation(lang, 'gradeC')}:</Text>
                    <Text style={[styles.detailVal, { color: theme.gradeC }]}>{disputeData.grade_c_pct}%</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailText, { color: theme.textSecondary }]}>{getTranslation(lang, 'gradeUrs')}:</Text>
                    <Text style={[styles.detailVal, { color: theme.gradeUrs }]}>{disputeData.urs_pct}%</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.gradeA, borderColor: theme.gradeA, marginTop: 16 }]}
                  onPress={onConfirmDispute}
                >
                  <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>
                    ✓ {getTranslation(lang, 'acceptNewScan')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.gradeUrs, marginTop: 10 }]}
                  onPress={onCancelDispute}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.gradeUrs }]}>
                    ✕ {getTranslation(lang, 'keepOriginal')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
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
    maxHeight: '85%',
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
    marginTop: 2,
  },
  closeIcon: {
    padding: 4,
  },
  stepContainer: {
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    height: 80,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  centerLoading: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  loadingDesc: {
    fontSize: 12,
  },
  comparisonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 10,
  },
  compCol: {
    alignItems: 'center',
  },
  arrowCol: {
    paddingHorizontal: 8,
  },
  compLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  compValueStruck: {
    fontSize: 26,
    fontWeight: '800',
    textDecorationLine: 'line-through',
  },
  compValueNew: {
    fontSize: 28,
    fontWeight: '900',
  },
  detailTable: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailText: {
    fontSize: 13,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '700',
  },
});
