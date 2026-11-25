import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { Button, Card, Heading, Loading, Notice, Screen } from '../components/ui';
import { useJournal } from '../lib/journal';
import { useTheme } from '../lib/theme';

export default function SignIn() {
  const c = useTheme();
  const { ready, server, setServer, authError, signInGoogle } = useJournal();
  const [input, setInput] = useState<string | null>(null);
  const [busy, setBusy] = useState<'connection' | 'sign-in' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function run(action: () => Promise<void>, operation: 'connection' | 'sign-in') {
    setBusy(operation); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(null); }
  }
  return <Screen>
    <Text style={{ color: c.accent, fontFamily: 'serif', fontStyle: 'italic', fontSize: 30, marginVertical: 35 }}>August</Text>
    <Heading eyebrow="A little room for you" title={'Your words.\nYour little world.'} subtitle="Keep your moments and progress together, on your phone and the web." />
    {!ready ? <Loading /> : <>
      <Card>
        <Text style={{ color: c.text, fontFamily: 'serif', fontSize: 22 }}>{server ? 'Your journal is connected' : 'Connect your journal'}</Text>
        <Text style={{ color: c.muted, lineHeight: 23 }}>Enter the address of your August web app. Use the same server and Google account on both devices.</Text>
        <TextInput accessibilityLabel="August server address" autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://your-august.example" placeholderTextColor={c.muted} value={input ?? server} onChangeText={setInput} style={{ padding: 14, borderWidth: 1, borderColor: c.border, borderRadius: 10, color: c.text }} />
        <Button label={busy === 'connection' ? 'Checking connection…' : server ? 'Check connection' : 'Connect'} disabled={!!busy || !(input ?? server).trim()} onPress={() => void run(async () => { await setServer(input ?? server); setMessage('Connected. Continue with Google to sign in.'); }, 'connection')} quiet />
      </Card>
      {!!message && <Text accessibilityLiveRegion="polite" style={{ color: c.accent, marginBottom: 15, lineHeight: 23 }}>{message}</Text>}
      <Button label={busy === 'sign-in' ? 'Opening Google sign-in…' : 'Continue with Google'} disabled={!!busy || !(input ?? server).trim()} onPress={() => void run(() => signInGoogle(input ?? server), 'sign-in')} />
    </>}
    {!!(error || authError) && <Notice message={error || authError!} />}
    <Text style={{ color: c.muted, marginTop: 25, lineHeight: 23, fontSize: 12 }}>Google shares your identity for sign-in. August does not request access to your Gmail inbox. Your existing drafts stay on this device.</Text>
  </Screen>;
}
