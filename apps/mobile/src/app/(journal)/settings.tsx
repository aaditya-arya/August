import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { Link } from 'expo-router';
import { Button, Card, Heading, Notice, Screen } from '../../components/ui';
import { useJournal } from '../../lib/journal';
import { useTheme } from '../../lib/theme';

export default function SettingsScreen() {
  const c = useTheme();
  const { server, setServer, ready, user, signOut } = useJournal();
  const [input, setInput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function connect() {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await setServer(input ?? server); setMessage('Connected. Your web and Android apps now use the same journal.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not reach your journal. Check the address and your connection.'); }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading eyebrow="Make yourself at home" title="Your August" subtitle="One journal, wherever you are." />
    <Card><Text style={{ color: c.text, fontFamily: 'serif', fontSize: 23 }}>Your account</Text><Text selectable style={{ color: c.muted }}>{user?.email}</Text><Button label="Sign out on this device" disabled={busy} quiet onPress={() => { setBusy(true); void signOut().catch(e => setMessage(e instanceof Error ? e.message : 'Sign-out failed.')).finally(() => setBusy(false)); }} /></Card>
    <Card>
      <Text style={{ color: c.text, fontFamily: 'serif', fontSize: 23 }}>Connect your journal</Text>
      <Text style={{ color: c.muted, lineHeight: 23 }}>Use the address of your August server. Your saved moments will be available on both devices.</Text>
      <TextInput accessibilityLabel="Server address" autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://your-august-server.example" placeholderTextColor={c.muted} value={input ?? server} onChangeText={setInput} style={{ padding: 14, borderWidth: 1, borderColor: c.border, borderRadius: 10, color: c.text }} />
      <Button label={busy ? 'Checking connection…' : 'Connect and check'} onPress={() => void connect()} disabled={!ready || busy || !(input ?? server).trim()} />
    </Card>
    {!!message && <Notice message={message} />}
    {__DEV__ && <Card>
      <Text style={{ color: c.accent, fontWeight: '600' }}>Local development</Text>
      <Text selectable style={{ color: c.muted, lineHeight: 23 }}>Start the web server on your computer. On an Android emulator use http://10.0.2.2:3000. On a phone, use your computer’s local Wi-Fi address with port 3000. Both devices must be on the same network.</Text>
    </Card>}
    <Card><Text style={{ color: c.text, fontFamily: 'serif', fontSize: 22 }}>A little room to write</Text><Text style={{ color: c.muted, lineHeight: 23 }}>Your writing draft stays on this device, even when you close the app. Saved moments live in your connected journal. Appearance follows your device’s light or dark setting.</Text><Link href="/" style={{ color: c.accent, paddingVertical: 12 }}>Back to your page ↗</Link></Card>
  </Screen>;
}
