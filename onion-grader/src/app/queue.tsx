import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radii, MIN_TOUCH_TARGET } from '../theme/spacing';
import { getOfflineQueueService, QueueItem } from '../services/offlineQueue';
import { apiService } from '../services/api';
import { useAppStore } from '../store';

export default function OfflineQueueScreen() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { theme, isOnline, setIsOnline, backendUrl } = useAppStore();

  const isDark = theme === 'dark';
  const bgStyle = isDark ? { backgroundColor: '#121212' } : {};
  const surfaceStyle = isDark ? { backgroundColor: '#1E1E1E', borderColor: '#333' } : {};
  const textStyle = isDark ? { color: '#FFF' } : {};
  const textSecStyle = isDark ? { color: '#AAA' } : {};

  useEffect(() => {
    const unsubscribe = getOfflineQueueService().subscribe(setQueue);
    
    // Active Backend Health Ping — race fetch vs timeout
    const checkHealth = async () => {
      try {
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 3000)
        );
        const ping = fetch(`${backendUrl}/`, { method: 'HEAD' });
        await Promise.race([ping, timeout]);
        setIsOnline(true);
      } catch (e) {
        setIsOnline(false);
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [backendUrl]);

  const handleSyncAll = async () => {
    if (queue.length === 0) return;
    setIsSyncing(true);
    
    try {
      const { successful, rejected, failed, results } = await getOfflineQueueService().processQueue();
      
      if (successful > 0) {
        setIsOnline(true);
        // Save the results to global state
        useAppStore.getState().setCurrentBatch(results, []);
        
        Alert.alert(
          "Sync Complete", 
          `Successfully synced ${successful} items to the backend.`,
          [
            { text: "View Certificate", onPress: () => router.push('/report') },
            { text: "Done", style: "cancel" }
          ]
        );
      } else if (failed > 0 || rejected > 0) {
        Alert.alert("Sync Partial", `Successfully synced: ${successful}\nRejected by Gate: ${rejected}\nFailed (Network): ${failed}`);
      }
    } catch (error: any) {
      console.error("Sync failed:", error);
      Alert.alert("Sync Failed", "An unexpected error occurred during sync.");
    } finally {
      setIsSyncing(false);
    }
  };

  const clearQueue = () => {
    Alert.alert(
      "Clear Queue",
      "Are you sure you want to delete all offline scans? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete All", 
          style: "destructive",
          onPress: async () => {
            await getOfflineQueueService().clearAll();
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, bgStyle]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, surfaceStyle]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={isDark ? '#FFF' : colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, textStyle]}>Offline Queue</Text>
      </View>

      <View style={[styles.statusCard, surfaceStyle]}>
        <View style={styles.statusRow}>
          <Feather name={isOnline ? "check-circle" : "cloud-off"} size={24} color={isOnline ? colors.success : colors.danger} />
          <View style={styles.statusTextWrapper}>
            <Text style={[typography.bodyBold, textStyle]}>
              {isOnline ? "Network Online" : "Currently Offline Mode"}
            </Text>
            <Text style={[typography.bodyMedium, textSecStyle]}>
              {queue.length} items waiting for backend synchronization.
            </Text>
          </View>
        </View>
      </View>

      {queue.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="check" size={48} color={isDark ? '#333' : colors.border} />
          <Text style={[typography.h2, textStyle, { marginTop: spacing.md }]}>Queue is empty</Text>
          <Text style={[typography.bodyMedium, textSecStyle, { textAlign: 'center', marginTop: spacing.sm }]}>
            All local scans have been synced with the Mandi ledger.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {queue.map(item => (
            <View key={item.id} style={[styles.itemCard, surfaceStyle]}>
              <View style={[styles.iconBg, { backgroundColor: item.type === 'video' ? '#E8EAF6' : '#FFF3E0' }]}>
                <Feather name={item.type === 'video' ? 'video' : 'camera'} size={20} color={item.type === 'video' ? '#3F51B5' : '#FF9800'} />
              </View>
              <View style={styles.itemTextWrapper}>
                <Text style={[typography.bodyBold, textStyle]}>
                  {item.type === 'video' ? 'Video Sample' : 'Image Sample'}
                </Text>
                <Text style={[typography.bodyMedium, textSecStyle, { fontSize: 12 }]}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
              </View>
              <Feather name="clock" size={16} color={isDark ? '#AAA' : colors.textSecondary} />
            </View>
          ))}
        </View>
      )}

      {queue.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.syncButton, isSyncing && { opacity: 0.7 }]} 
            onPress={handleSyncAll}
            disabled={isSyncing}
          >
            {isSyncing ? <ActivityIndicator color="#FFF" /> : <Feather name="refresh-cw" size={20} color="#FFF" />}
            <Text style={styles.syncButtonText}>{isSyncing ? "Syncing..." : "Sync All to Backend"}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.clearButton} onPress={clearQueue} disabled={isSyncing}>
            <Text style={styles.clearButtonText}>Clear Queue</Text>
          </TouchableOpacity>
        </View>
      )}
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
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextWrapper: {
    flex: 1,
    marginLeft: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  list: {
    gap: spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTextWrapper: {
    flex: 1,
    marginLeft: spacing.md,
  },
  footer: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  syncButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  syncButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: 'bold',
  }
});
