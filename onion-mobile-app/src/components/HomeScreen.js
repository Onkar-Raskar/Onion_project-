import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getTranslation } from '../translations';

export default function HomeScreen({
  theme,
  lang,
  backendConnected,
  isCheckingBackend,
  onCheckBackend,
  apiUrl,
  onStartInspection,
  onOpenCalibration,
  onOpenSimulator,
  onOpenQueue,
  onOpenReport,
  onOpenSettings,
  hasReport,
  queueCount = 0,
  isDemoMode = false,
}) {
  const [showHowToConnect, setShowHowToConnect] = useState(false);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Backend Connection Status Banner */}
      <TouchableOpacity
        style={[
          styles.backendCard,
          {
            backgroundColor: backendConnected ? theme.gradeABg : theme.gradeUrsBg,
            borderColor: backendConnected ? theme.gradeABorder : theme.gradeUrsBorder,
          },
        ]}
        onPress={onCheckBackend}
        activeOpacity={0.8}
      >
        <View style={styles.backendRow}>
          <View style={styles.statusDotRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: backendConnected ? theme.gradeA : theme.gradeUrs },
              ]}
            />
            <Text
              style={[
                styles.backendStatusText,
                { color: backendConnected ? theme.gradeA : theme.gradeUrs },
              ]}
            >
              {isCheckingBackend
                ? getTranslation(lang, 'checkingBackend')
                : backendConnected
                ? `${getTranslation(lang, 'backendStatusConnected')} (192.168.1.101:8000)`
                : getTranslation(lang, 'backendStatusOffline')}
            </Text>
          </View>

          {isCheckingBackend ? (
            <ActivityIndicator size="small" color={backendConnected ? theme.gradeA : theme.gradeUrs} />
          ) : (
            <Text style={[styles.backendAction, { color: backendConnected ? theme.gradeA : theme.gradeUrs }]}>
              {backendConnected ? '✓ Online' : 'Tap to test ↻'}
            </Text>
          )}
        </View>

        {!backendConnected && (
          <TouchableOpacity
            style={styles.howToBtn}
            onPress={() => setShowHowToConnect(!showHowToConnect)}
          >
            <Text style={[styles.howToText, { color: theme.textSecondary }]}>
              ℹ️ {getTranslation(lang, 'howToConnectTitle')} {showHowToConnect ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
        )}

        {showHowToConnect && !backendConnected && (
          <View style={[styles.howToBox, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.howToDesc, { color: theme.text }]}>
              {getTranslation(lang, 'howToConnectSteps')}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Hero Welcome Card */}
      <View style={[styles.heroCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
        <View style={styles.heroTopRow}>
          <View style={[styles.heroBadge, { backgroundColor: theme.primaryLight, borderColor: theme.primaryBorder }]}>
            <Text style={[styles.heroBadgeText, { color: theme.primary }]}>
              🌾 {getTranslation(lang, 'homeGreeting')}
            </Text>
          </View>
          {isDemoMode && (
            <View style={[styles.demoBadge, { backgroundColor: theme.warningBg, borderColor: theme.warning }]}>
              <Text style={[styles.demoBadgeText, { color: theme.warning }]}>
                {getTranslation(lang, 'demoActiveBadge')}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.heroTitle, { color: theme.text }]}>
          {getTranslation(lang, 'homeWelcome')}
        </Text>
        <Text style={[styles.heroDesc, { color: theme.textSecondary }]}>
          {getTranslation(lang, 'homeDesc')}
        </Text>

        {/* Big Primary Inspection Button */}
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: theme.primary }]}
          onPress={onStartInspection}
          activeOpacity={0.85}
        >
          <View style={styles.startBtnIconBox}>
            <Text style={{ fontSize: 24 }}>🧅</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.startBtnTitle}>
              {getTranslation(lang, 'startInspection')}
            </Text>
            <Text style={styles.startBtnSubtitle}>
              {getTranslation(lang, 'startInspectionSub')}
            </Text>
          </View>
          <Text style={styles.startBtnArrow}>➔</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Mandi Stats Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.statNumber, { color: theme.gradeA }]}>3</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            {lang === 'hi' ? 'परत नमूने' : 'Heap Layers'}
          </Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.statNumber, { color: theme.primary }]}>≥65mm</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            {lang === 'hi' ? 'ग्रेड A मानक' : 'Grade A Std'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.statBox, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}
          onPress={onOpenQueue}
          activeOpacity={0.7}
        >
          <Text style={[styles.statNumber, { color: queueCount > 0 ? theme.warning : theme.textMuted }]}>
            {queueCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            {getTranslation(lang, 'statsPendingSync')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Section Title */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        🛠️ {getTranslation(lang, 'quickToolsTitle')}
      </Text>

      {/* Grid of Action Tools */}
      <View style={styles.toolsContainer}>
        {/* ₹5 Coin Optical Calibration */}
        <TouchableOpacity
          style={[styles.toolCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}
          onPress={onOpenCalibration}
          activeOpacity={0.75}
        >
          <View style={[styles.toolIconBox, { backgroundColor: 'rgba(217, 119, 6, 0.12)' }]}>
            <Text style={{ fontSize: 22 }}>🪙</Text>
          </View>
          <View style={styles.toolContent}>
            <Text style={[styles.toolTitle, { color: theme.text }]}>
              {getTranslation(lang, 'toolCalibrationTitle')}
            </Text>
            <Text style={[styles.toolDesc, { color: theme.textSecondary }]}>
              {getTranslation(lang, 'toolCalibrationSub')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Rules Engine Simulator */}
        <TouchableOpacity
          style={[styles.toolCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}
          onPress={onOpenSimulator}
          activeOpacity={0.75}
        >
          <View style={[styles.toolIconBox, { backgroundColor: theme.accentLight }]}>
            <Text style={{ fontSize: 22 }}>🎛️</Text>
          </View>
          <View style={styles.toolContent}>
            <Text style={[styles.toolTitle, { color: theme.text }]}>
              {getTranslation(lang, 'toolSimulatorTitle')}
            </Text>
            <Text style={[styles.toolDesc, { color: theme.textSecondary }]}>
              {getTranslation(lang, 'toolSimulatorSub')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* View Active Certificate */}
        <TouchableOpacity
          style={[
            styles.toolCard,
            { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder },
            !hasReport && { opacity: 0.6 },
          ]}
          onPress={onOpenReport}
          activeOpacity={0.75}
          disabled={!hasReport}
        >
          <View style={[styles.toolIconBox, { backgroundColor: theme.gradeABg }]}>
            <Text style={{ fontSize: 22 }}>📜</Text>
          </View>
          <View style={styles.toolContent}>
            <Text style={[styles.toolTitle, { color: theme.text }]}>
              {getTranslation(lang, 'toolHistoryTitle')}
            </Text>
            <Text style={[styles.toolDesc, { color: theme.textSecondary }]}>
              {hasReport ? getTranslation(lang, 'toolHistorySub') : getTranslation(lang, 'noReportYet')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Offline Queue */}
        <TouchableOpacity
          style={[styles.toolCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}
          onPress={onOpenQueue}
          activeOpacity={0.75}
        >
          <View style={[styles.toolIconBox, { backgroundColor: 'rgba(234, 88, 12, 0.12)' }]}>
            <Text style={{ fontSize: 22 }}>📦</Text>
          </View>
          <View style={styles.toolContent}>
            <Text style={[styles.toolTitle, { color: theme.text }]}>
              {getTranslation(lang, 'toolQueueTitle')} ({queueCount})
            </Text>
            <Text style={[styles.toolDesc, { color: theme.textSecondary }]}>
              {getTranslation(lang, 'toolQueueSub')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Settings */}
        <TouchableOpacity
          style={[styles.toolCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}
          onPress={onOpenSettings}
          activeOpacity={0.75}
        >
          <View style={[styles.toolIconBox, { backgroundColor: theme.cardBgAlt }]}>
            <Text style={{ fontSize: 22 }}>⚙️</Text>
          </View>
          <View style={styles.toolContent}>
            <Text style={[styles.toolTitle, { color: theme.text }]}>
              {getTranslation(lang, 'settingsTitle')}
            </Text>
            <Text style={[styles.toolDesc, { color: theme.textSecondary }]}>
              {lang === 'hi' ? 'सर्वर IP, भाषा (हिन्दी/EN), थीम' : 'Backend IP, Language, Dark Mode'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backendCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  backendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  backendStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  backendAction: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8,
  },
  howToBtn: {
    marginTop: 6,
    paddingTop: 4,
  },
  howToText: {
    fontSize: 11,
    fontWeight: '600',
  },
  howToBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  howToDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  demoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  demoBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    shadowColor: '#8D2644',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  startBtnIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startBtnTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  startBtnSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  startBtnArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    gap: 10,
  },
  statBox: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginHorizontal: 16,
    marginTop: 22,
    marginBottom: 10,
  },
  toolsContainer: {
    marginHorizontal: 16,
    gap: 10,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  toolIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolContent: {
    flex: 1,
    marginLeft: 12,
  },
  toolTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  toolDesc: {
    fontSize: 11,
    marginTop: 2,
  },
});
