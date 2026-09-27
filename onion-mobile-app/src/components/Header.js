import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { getTranslation } from '../translations';

export default function Header({
  theme,
  lang,
  onToggleLang,
  onToggleTheme,
  onOpenSettings,
  onOpenQueue,
  queueCount = 0,
  isDemoMode = false,
}) {
  return (
    <View style={[styles.container, { backgroundColor: theme.headerBg, borderBottomColor: theme.surfaceBorder }]}>
      <View style={styles.leftRow}>
        <View style={[styles.avatarBadge, { backgroundColor: theme.primaryLight, borderColor: theme.primaryBorder }]}>
          <Text style={[styles.avatarIcon, { color: theme.primary }]}>🧅</Text>
        </View>
        <View style={styles.titleCol}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>{getTranslation(lang, 'appTitle')}</Text>
            {isDemoMode && (
              <View style={[styles.demoTag, { backgroundColor: theme.warningBg, borderColor: theme.warning }]}>
                <Text style={[styles.demoTagText, { color: theme.warning }]}>DEMO</Text>
              </View>
            )}
          </View>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{getTranslation(lang, 'appSubtitle')}</Text>
        </View>
      </View>

      <View style={styles.rightActions}>
        {/* Offline Queue Badge Button */}
        {queueCount > 0 && (
          <TouchableOpacity
            style={[styles.badgeBtn, { backgroundColor: theme.warningBg, borderColor: theme.warning }]}
            onPress={onOpenQueue}
            activeOpacity={0.7}
          >
            <Text style={[styles.badgeText, { color: theme.warning }]}>📦 {queueCount}</Text>
          </TouchableOpacity>
        )}

        {/* Language Switch Button */}
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}
          onPress={onToggleLang}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionBtnText, { color: theme.primary }]}>
            {lang === 'en' ? 'हिन्दी' : 'EN'}
          </Text>
        </TouchableOpacity>

        {/* Theme Switch Button */}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}
          onPress={onToggleTheme}
          activeOpacity={0.7}
        >
          <Text style={styles.btnIcon}>{theme.mode === 'light' ? '🌙' : '☀️'}</Text>
        </TouchableOpacity>

        {/* Settings Button */}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}
          onPress={onOpenSettings}
          activeOpacity={0.7}
        >
          <Text style={styles.btnIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 10,
  },
  avatarIcon: {
    fontSize: 20,
  },
  titleCol: {
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  demoTag: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  demoTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnIcon: {
    fontSize: 14,
  },
});
