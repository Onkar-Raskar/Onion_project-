import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { getTranslation } from '../translations';

export default function BottomNavBar({
  theme,
  lang,
  currentTab, // 'home' | 'scan' | 'report' | 'settings'
  onSelectTab,
  hasReport = false,
}) {
  const tabs = [
    { key: 'home', icon: '🏠', label: getTranslation(lang, 'navHome') },
    { key: 'scan', icon: '📷', label: getTranslation(lang, 'navScan') },
    { key: 'report', icon: '📜', label: getTranslation(lang, 'navReport') },
    { key: 'settings', icon: '⚙️', label: getTranslation(lang, 'navSettings') },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.tabBarBg, borderTopColor: theme.surfaceBorder }]}>
      {tabs.map((tab) => {
        const isActive = currentTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onSelectTab(tab.key)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconContainer,
                isActive && { backgroundColor: theme.primaryLight },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{tab.icon}</Text>
            </View>
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? theme.primary : theme.textMuted },
                isActive && styles.activeTabLabel,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 62,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    elevation: 8,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    width: 36,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  activeTabLabel: {
    fontWeight: '800',
  },
});
