import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: colors.background,
          }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ title: 'Scan Batch', headerShown: false }} />
        <Stack.Screen name="calibration" options={{ title: 'Calibrate Camera', presentation: 'modal' }} />
        <Stack.Screen name="report" options={{ title: 'Quality Certificate' }} />
        <Stack.Screen name="queue" options={{ title: 'Offline Queue', headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'System Settings', headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
