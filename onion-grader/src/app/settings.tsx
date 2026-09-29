import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Switch, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radii, MIN_TOUCH_TARGET } from '../theme/spacing';
import { useAppStore } from '../store';

export default function SettingsScreen() {
  const { language, setLanguage, theme, setTheme, backendUrl, setBackendUrl } = useAppStore();
  const [ipAddress, setIpAddress] = useState(backendUrl);
  
  const handleSaveIp = () => {
    // Ensure URL has http protocol
    let url = ipAddress;
    if (!url.startsWith('http')) {
      url = `http://${url}`;
    }
    setBackendUrl(url);
    Alert.alert("IP Saved", `Backend IP updated to ${url}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>System Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NETWORK</Text>
        <View style={styles.card}>
          <Text style={typography.bodyBold}>Backend API Address</Text>
          <Text style={typography.bodyMedium}>Hardcoded fallback for local mandis</Text>
          <View style={styles.inputRow}>
            <TextInput 
              style={styles.input}
              value={ipAddress}
              onChangeText={setIpAddress}
              keyboardType="numbers-and-punctuation"
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveIp}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PREFERENCES</Text>
        <View style={styles.card}>
          
          {/* Dark Mode */}
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={typography.bodyBold}>Dark Mode</Text>
              <Text style={typography.bodyMedium}>Switch to high-contrast night theme</Text>
            </View>
            <Switch 
              value={theme === 'dark'}
              onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={theme === 'dark' ? colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={styles.divider} />

          {/* Language Selection */}
          <View style={[styles.settingRow, { alignItems: 'flex-start' }]}>
            <View style={styles.settingText}>
              <Text style={typography.bodyBold}>App Language</Text>
              <Text style={typography.bodyMedium}>Select primary display language</Text>
            </View>
            <View style={styles.languageOptions}>
              {['EN', 'HI', 'MR'].map((lang) => (
                <TouchableOpacity 
                  key={lang}
                  style={[styles.langPill, language === lang && styles.langPillActive]}
                  onPress={() => setLanguage(lang as any)}
                >
                  <Text style={[styles.langText, language === lang && styles.langTextActive]}>
                    {lang === 'EN' ? 'English' : lang === 'HI' ? 'हिंदी' : 'मराठी'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  
  header: {
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
  },
  
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.label,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  inputRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: MIN_TOUCH_TARGET,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    ...typography.bodyBold,
    fontFamily: 'monospace',
  },
  saveButton: {
    backgroundColor: colors.primary,
    height: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },

  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  languageOptions: {
    gap: spacing.sm,
  },
  langPill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  langPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  langText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  langTextActive: {
    color: '#FFF',
  }
});
