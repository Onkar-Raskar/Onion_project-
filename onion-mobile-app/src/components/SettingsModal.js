import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import axios from 'axios';
import { getTranslation } from '../translations';

export default function SettingsModal({
  visible,
  theme,
  lang,
  apiUrl,
  setApiUrl,
  onSaveApiUrl,
  onToggleLang,
  onToggleTheme,
  isDemoMode,
  setIsDemoMode,
  defaultPpm,
  setDefaultPpm,
  onClose,
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, msg: string }

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const baseUrl = apiUrl.replace(/\/analyze\/?$/, '').replace(/\/+$/, '');
      const response = await axios.get(baseUrl + '/docs', { timeout: 4000 });
      if (response.status === 200) {
        setTestResult({
          success: true,
          msg: getTranslation(lang, 'connectionSuccess'),
        });
      } else {
        setTestResult({
          success: false,
          msg: `Server returned status ${response.status}`,
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        msg: getTranslation(lang, 'connectionFailed'),
      });
    } finally {
      setTesting(false);
    }
  };

  const applyPreset = (presetUrl) => {
    setApiUrl(presetUrl);
    setTestResult(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: theme.text }]}>
                ⚙️ {getTranslation(lang, 'settingsTitle')}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
                <Text style={{ fontSize: 18, color: theme.textSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* API Server URL & Presets */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>
                🌐 {getTranslation(lang, 'serverUrlLabel')}
              </Text>
              <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
                {getTranslation(lang, 'serverUrlHint')}
              </Text>
              
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.cardBgAlt,
                    borderColor: theme.surfaceBorder,
                    color: theme.text,
                  },
                ]}
                value={apiUrl}
                onChangeText={setApiUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.1.101:8000/analyze"
                placeholderTextColor={theme.textMuted}
              />

              {/* One-tap Quick IP Presets */}
              <View style={styles.presetsRow}>
                <TouchableOpacity
                  style={[styles.presetChip, { backgroundColor: theme.primaryLight, borderColor: theme.primaryBorder }]}
                  onPress={() => applyPreset('http://192.168.1.101:8000/analyze')}
                >
                  <Text style={[styles.presetChipText, { color: theme.primary }]}>
                    📶 192.168.1.101 (Wi-Fi)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.presetChip, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}
                  onPress={() => applyPreset('http://10.0.2.2:8000/analyze')}
                >
                  <Text style={[styles.presetChipText, { color: theme.textSecondary }]}>
                    🤖 10.0.2.2 (Emulator)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.presetChip, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}
                  onPress={() => applyPreset('http://127.0.0.1:8000/analyze')}
                >
                  <Text style={[styles.presetChipText, { color: theme.textSecondary }]}>
                    💻 Localhost
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.testBtn, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}
                onPress={handleTestConnection}
                disabled={testing}
              >
                {testing ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Text style={[styles.testBtnText, { color: theme.primary }]}>
                    🔍 {getTranslation(lang, 'testConnection')}
                  </Text>
                )}
              </TouchableOpacity>

              {testResult && (
                <View
                  style={[
                    styles.resultBadge,
                    {
                      backgroundColor: testResult.success ? theme.gradeABg : theme.gradeUrsBg,
                      borderColor: testResult.success ? theme.gradeABorder : theme.gradeUrsBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.resultText,
                      { color: testResult.success ? theme.gradeA : theme.gradeUrs },
                    ]}
                  >
                    {testResult.msg}
                  </Text>
                </View>
              )}
            </View>

            {/* Language & Theme Controls */}
            <View style={[styles.rowSetting, { borderColor: theme.surfaceBorder }]}>
              <View>
                <Text style={[styles.rowTitle, { color: theme.text }]}>
                  {getTranslation(lang, 'languageLabel')}
                </Text>
                <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                  {lang === 'en' ? 'English (Current)' : 'हिन्दी (सक्रिय)'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: theme.primaryLight, borderColor: theme.primaryBorder }]}
                onPress={onToggleLang}
              >
                <Text style={[styles.smallBtnText, { color: theme.primary }]}>
                  {lang === 'en' ? 'Switch to हिन्दी' : 'Switch to EN'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.rowSetting, { borderColor: theme.surfaceBorder }]}>
              <View>
                <Text style={[styles.rowTitle, { color: theme.text }]}>
                  {getTranslation(lang, 'themeLabel')}
                </Text>
                <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                  {theme.mode === 'light' ? getTranslation(lang, 'themeLight') : getTranslation(lang, 'themeDark')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}
                onPress={onToggleTheme}
              >
                <Text style={[styles.smallBtnText, { color: theme.text }]}>
                  {theme.mode === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Demo Mode Toggle */}
            <View style={[styles.rowSetting, { borderColor: theme.surfaceBorder }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>
                  💡 {getTranslation(lang, 'demoModeLabel')}
                </Text>
                <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                  {getTranslation(lang, 'demoModeDesc')}
                </Text>
              </View>
              <Switch
                value={isDemoMode}
                onValueChange={setIsDemoMode}
                trackColor={{ false: theme.sliderMax, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Save & Close Button */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                if (onSaveApiUrl) onSaveApiUrl(apiUrl);
                onClose();
              }}
            >
              <Text style={styles.saveBtnText}>
                {getTranslation(lang, 'saveSettings')}
              </Text>
            </TouchableOpacity>
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
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeIcon: {
    padding: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionHint: {
    fontSize: 11,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  testBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  resultBadge: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  resultText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  rowSetting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 11,
    marginTop: 2,
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  smallBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  saveBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
