import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JournalProvider, useJournal } from '../lib/journal';

function Routes() {
  const { user } = useJournal();
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={!!user}><Stack.Screen name="(journal)" /></Stack.Protected>
    <Stack.Protected guard={!user}><Stack.Screen name="sign-in" /></Stack.Protected>
    <Stack.Screen name="auth/callback" />
  </Stack>;
}
export default function Layout() {
  return <SafeAreaProvider><JournalProvider><Routes /></JournalProvider></SafeAreaProvider>;
}
