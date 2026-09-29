import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radii, MIN_TOUCH_TARGET } from '../theme/spacing';
import { getOfflineQueueService, QueueItem } from '../services/offlineQueue';
import { useAppStore } from '../store';
import { translations } from '../utils/i18n';

export default function HomeScreen() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const { hasCalibrated, language, setLanguage, theme, setTheme, currentBatchReports, isOnline, setIsOnline, backendUrl } = useAppStore();

  useEffect(() => {
    const unsubscribe = getOfflineQueueService().subscribe(setQueue);
    
    // Active Backend Health Ping — race fetch vs timeout
    const checkHealth = async () => {
      try {
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 3000)
        );
        const ping = fetch(`${backendUrl}/`, { method: 'HEAD' });
        
        // If fetch resolves first (even with 404/405), server is reachable
        await Promise.race([ping, timeout]);
        setIsOnline(true);
      } catch (e) {
        setIsOnline(false);
      }
    };
    
    checkHealth(); // Check immediately
    const interval = setInterval(checkHealth, 8000); // Check every 8s
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [backendUrl]);

  const handleStartScan = () => {
    if (!hasCalibrated) {
      Alert.alert(
        "Calibration Required", 
        "Please calibrate the camera system with a reference coin first to ensure accurate onion sizing.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Calibrate Now", onPress: () => router.push('/calibration') }
        ]
      );
    } else {
      router.push('/scan');
    }
  };

  const cycleLanguage = () => {
    if (language === 'EN') setLanguage('HI');
    else if (language === 'HI') setLanguage('MR');
    else setLanguage('EN');
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Dynamic Theme Styling
  const isDark = theme === 'dark';
  const bgStyle = isDark ? { backgroundColor: '#121212' } : {};
  const surfaceStyle = isDark ? { backgroundColor: '#1E1E1E', borderColor: '#333' } : {};
  const textStyle = isDark ? { color: '#FFF' } : {};
  const textSecStyle = isDark ? { color: '#AAA' } : {};

  // i18n Dictionary
  const t = translations[language] || translations['EN'];

  return (
    <View style={[styles.container, bgStyle]}>
      {/* HEADER SECTION */}
      <View style={[styles.header, surfaceStyle]}>
        <View style={styles.headerLeft}>
          <View style={[styles.appIconWrapper, isDark && { backgroundColor: '#3A0B1A' }]}>
            <Feather name="layers" size={24} color={isDark ? '#E8CCD5' : colors.primary} />
          </View>
          <View style={styles.headerTextWrapper}>
            <Text style={[styles.headerTitle, textStyle]}>{t.appTitle}</Text>
            <Text style={[styles.headerSubtitle, textSecStyle]}>{t.appSubtitle}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.pill, isDark && { backgroundColor: '#333' }]} onPress={cycleLanguage}>
            <Feather name="globe" size={14} color={isDark ? '#FFF' : colors.textPrimary} />
            <Text style={[styles.pillText, textStyle]}>{language}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={toggleTheme}>
            <Feather name={isDark ? "sun" : "moon"} size={18} color={isDark ? colors.warning : colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/settings')}>
            <Feather name="settings" size={18} color={isDark ? '#AAA' : colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* CONNECTION BANNER */}
        <View style={[styles.banner, isDark && { backgroundColor: isOnline ? '#1B5E20' : '#b71c1c' }, !isDark && !isOnline && { backgroundColor: '#ffebee' }]}>
          <View style={styles.bannerLeft}>
            <View style={[styles.onlineDot, !isOnline && { backgroundColor: colors.danger }]} />
            <Text style={[styles.bannerText, isDark && { color: isOnline ? '#A5D6A7' : '#ffcdd2' }, !isDark && !isOnline && { color: colors.danger }]}>
              {isOnline ? t.backendConnected : "Backend Unreachable"}
            </Text>
          </View>
          <View style={styles.bannerRight}>
            <Feather name={isOnline ? "check" : "x"} size={14} color={isDark ? (isOnline ? '#A5D6A7' : '#ffcdd2') : (isOnline ? colors.success : colors.danger)} />
            <Text style={[styles.bannerTextBold, isDark && { color: isOnline ? '#A5D6A7' : '#ffcdd2' }, !isDark && !isOnline && { color: colors.danger }]}>
              {isOnline ? t.online : "Offline"}
            </Text>
          </View>
        </View>

        {/* HERO CARD */}
        <View style={[styles.heroCard, surfaceStyle]}>
          <View style={[styles.badge, isDark && { backgroundColor: '#3A0B1A' }]}>
            <Feather name="award" size={12} color={isDark ? '#E8CCD5' : colors.primary} />
            <Text style={[styles.badgeText, isDark && { color: '#E8CCD5' }]}>{t.inspectorBadge}</Text>
          </View>
          <Text style={[typography.h1, textStyle]}>{t.heroTitle}</Text>
          <Text style={[typography.body, { marginTop: spacing.xs, marginBottom: spacing.lg }, textSecStyle]}>
            {t.heroSubtitle}
          </Text>
          
          <TouchableOpacity style={styles.heroCta} activeOpacity={0.8} onPress={handleStartScan}>
            <View style={styles.heroCtaIcon}>
              <Feather name="maximize" size={24} color={colors.primary} />
            </View>
            <View style={styles.heroCtaTextWrapper}>
              <Text style={styles.heroCtaTitle}>{t.startInspection}</Text>
              <Text style={styles.heroCtaSubtitle}>{t.startInspectionDesc}</Text>
            </View>
            <Feather name="arrow-right" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* STATS ROW */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, isDark && { backgroundColor: '#1B5E20', borderColor: '#2E7D32' }, !isDark && { backgroundColor: colors.successLight, borderColor: '#C8E6C9' }]}>
            <Text style={[typography.heroStat, { color: isDark ? '#A5D6A7' : colors.success }]}>3</Text>
            <Text style={[styles.statLabel, textSecStyle]}>{t.heapLayers}</Text>
          </View>
          <View style={[styles.statCard, isDark && { backgroundColor: '#3A0B1A', borderColor: '#5E1028' }, !isDark && { backgroundColor: colors.primaryLight, borderColor: '#D8B4E2' }]}>
            <Text style={[typography.heroStat, { color: isDark ? '#E8CCD5' : colors.primary }]}>≥65<Text style={{fontSize: 16}}>mm</Text></Text>
            <Text style={[styles.statLabel, textSecStyle]}>{t.gradeAStd}</Text>
          </View>
          <View style={[styles.statCard, isDark && { backgroundColor: queue.length > 0 ? '#513800' : '#1E1E1E', borderColor: queue.length > 0 ? '#F9A825' : '#333' }, !isDark && { backgroundColor: queue.length > 0 ? colors.warningLight : colors.surface, borderColor: queue.length > 0 ? '#FFF59D' : colors.border }]}>
            <Text style={[typography.heroStat, { color: queue.length > 0 ? colors.warning : (isDark ? '#AAA' : colors.textSecondary) }]}>{queue.length}</Text>
            <Text style={[styles.statLabel, textSecStyle]}>{t.pendingSync}</Text>
          </View>
        </View>

        {/* TOOLS LIST */}
        <View style={styles.listHeader}>
          <Feather name="tool" size={20} color={isDark ? '#AAA' : colors.textSecondary} />
          <Text style={[typography.h2, textStyle]}>{t.toolsHeader}</Text>
        </View>

        <View style={styles.listContainer}>
          <TouchableOpacity style={[styles.listItem, surfaceStyle]} onPress={() => router.push('/calibration')}>
            <View style={[styles.listIconBg, { backgroundColor: isDark ? '#513800' : colors.warningLight }]}>
              <Feather name="target" size={20} color={colors.warning} />
            </View>
            <View style={styles.listTextWrapper}>
              <Text style={[typography.bodyBold, textStyle]}>{t.calibTitle}</Text>
              <Text style={[typography.body, textSecStyle]}>{t.calibDesc}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={isDark ? '#AAA' : colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.listItem, surfaceStyle]} onPress={() => router.push('/dispute')}>
            <View style={[styles.listIconBg, { backgroundColor: isDark ? '#0D47A1' : '#E3F2FD' }]}>
              <Feather name="sliders" size={20} color={isDark ? '#90CAF9' : '#1976D2'} />
            </View>
            <View style={styles.listTextWrapper}>
              <Text style={[typography.bodyBold, textStyle]}>{t.simTitle}</Text>
              <Text style={[typography.body, textSecStyle]}>{t.simDesc}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={isDark ? '#AAA' : colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.listItem, surfaceStyle, (!currentBatchReports || currentBatchReports.length === 0) && { opacity: 0.6 }]} 
            disabled={!currentBatchReports || currentBatchReports.length === 0}
            onPress={() => router.push('/report')}
          >
            <View style={[styles.listIconBg, { backgroundColor: isDark ? '#333' : '#F5F5F5' }]}>
              <Feather name="file-text" size={20} color={isDark ? '#AAA' : colors.textSecondary} />
            </View>
            <View style={styles.listTextWrapper}>
              <Text style={[typography.bodyBold, (currentBatchReports && currentBatchReports.length > 0) ? textStyle : textSecStyle]}>{t.certTitle}</Text>
              <Text style={[typography.body, textSecStyle]}>
                {(currentBatchReports && currentBatchReports.length > 0) ? "Tap to view full PDF/receipt" : t.certDesc}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={isDark ? '#333' : colors.border} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.listItem, surfaceStyle]} onPress={() => router.push('/queue')}>
            <View style={[styles.listIconBg, { backgroundColor: isDark ? '#E65100' : '#FFF3E0' }]}>
              <Feather name="cloud-off" size={20} color={isDark ? '#FFB74D' : '#F57C00'} />
            </View>
            <View style={styles.listTextWrapper}>
              <Text style={[typography.bodyBold, textStyle]}>{t.queueTitle} ({queue.length})</Text>
              <Text style={[typography.body, textSecStyle]}>{t.queueDesc}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={isDark ? '#AAA' : colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.listItem, surfaceStyle]} onPress={() => router.push('/settings')}>
            <View style={[styles.listIconBg, { backgroundColor: isDark ? '#004D40' : '#E0F2F1' }]}>
              <Feather name="settings" size={20} color={isDark ? '#80CBC4' : '#00796B'} />
            </View>
            <View style={styles.listTextWrapper}>
              <Text style={[typography.bodyBold, textStyle]}>{t.settingsTitle}</Text>
              <Text style={[typography.body, textSecStyle]}>{t.settingsDesc}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={isDark ? '#AAA' : colors.textSecondary} />
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl, // Safe area substitute
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  headerTextWrapper: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginRight: spacing.xs,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  iconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  bannerText: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '500',
  },
  bannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTextBold: {
    fontSize: 13,
    color: colors.success,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    marginBottom: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCE4EC',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  heroCta: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  heroCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCtaTextWrapper: {
    flex: 1,
    marginLeft: spacing.md,
  },
  heroCtaTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  heroCtaSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  listContainer: {
    gap: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listIconBg: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listTextWrapper: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  }
});

