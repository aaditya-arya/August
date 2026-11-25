import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { useJournal } from '../../lib/journal';
import { useTheme } from '../../lib/theme';

const tabs = [
  { name: 'index', title: 'Write', icon: '✎' },
  { name: 'moments', title: 'Moments', icon: '▤' },
  { name: 'review', title: 'Review', icon: '◷' },
  { name: 'graph', title: 'Graph', icon: '⌘' },
  { name: 'settings', title: 'Settings', icon: '⚙' },
];
export default function Layout() {
  const c = useTheme();
  const { user, namespace } = useJournal();
  return <><StatusBar style="auto" />
    <Tabs key={`${namespace}:${user?.id}`} screenOptions={{ headerShown: false, tabBarActiveTintColor: c.accent, tabBarInactiveTintColor: c.muted, tabBarHideOnKeyboard: true, tabBarStyle: { backgroundColor: c.paper, borderTopColor: c.border }, tabBarLabelStyle: { fontSize: 10 }, sceneStyle: { backgroundColor: c.background } }}>
      {tabs.map(tab => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title, tabBarIcon: ({ color }) => <Text style={{ fontSize: 23, color }}>{tab.icon}</Text> }} />)}
    </Tabs>
  </>;
}
