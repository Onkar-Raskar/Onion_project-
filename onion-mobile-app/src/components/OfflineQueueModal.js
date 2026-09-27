import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getTranslation } from '../translations';

export default function OfflineQueueModal({
  visible,
  theme,
  lang,
  queue,
  isSyncing,
  onSyncAll,
  onClose,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>
                📦 {getTranslation(lang, 'queueTitle')}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {getTranslation(lang, 'queueSubtitle')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
              <Text style={{ fontSize: 18, color: theme.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* List or Empty State */}
          {queue.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>✅</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {getTranslation(lang, 'emptyQueue')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={queue}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 240, marginVertical: 12 }}
              renderItem={({ item, index }) => (
                <View style={[styles.itemCard, { backgroundColor: theme.cardBgAlt, borderColor: theme.surfaceBorder }]}>
                  <View style={styles.itemHeader}>
                    <Text style={[styles.itemId, { color: theme.text }]}>
                      #{index + 1} • {item.id}
                    </Text>
                    <View style={[styles.typeBadge, { backgroundColor: theme.primaryLight, borderColor: theme.primaryBorder }]}>
                      <Text style={[styles.typeText, { color: theme.primary }]}>
                        {item.fileType?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.itemSub, { color: theme.textMuted }]}>
                    🕒 {item.timestamp} • PPM: {parseFloat(item.ppm || 2.4).toFixed(1)} px/mm
                  </Text>
                </View>
              )}
            />
          )}

          {queue.length > 0 && (
            <TouchableOpacity
              style={[styles.syncBtn, { backgroundColor: theme.primary }]}
              onPress={onSyncAll}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.syncBtnText}>
                  📡 {getTranslation(lang, 'syncAllNow')}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.closeBtn, { borderColor: theme.surfaceBorder }]}
            onPress={onClose}
          >
            <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>
              {getTranslation(lang, 'close')}
            </Text>
          </TouchableOpacity>
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
    maxHeight: '80%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  closeIcon: {
    padding: 4,
  },
  emptyContainer: {
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: 16,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  itemCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemId: {
    fontSize: 13,
    fontWeight: '700',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  itemSub: {
    fontSize: 11,
  },
  syncBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 10,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
