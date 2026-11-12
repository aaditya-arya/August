import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useNavigation } from 'expo-router';
import { createDraftPersistence, writingModes, type DraftSnapshot } from '@august/shared';
import { Button, Card, Heading, Loading, Notice, Screen, s } from '../components/ui';
import { useJournal } from '../lib/journal';
import { useTheme } from '../lib/theme';

const persistence = createDraftPersistence(AsyncStorage, 'august-native-draft-v1');

export default function WriteScreen() {
  const c = useTheme();
  const { api, changed } = useJournal();
  const navigation = useNavigation();
  const [content, setContent] = useState('');
  const [ready, setReady] = useState(false);
  const [modeIndex, setModeIndex] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);
  const [focus, setFocus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(true);
  const snapshot = useRef<DraftSnapshot>({ content: '', pending: null });
  const savingRef = useRef(false);
  const editor = useRef<ComponentRef<typeof TextInput>>(null);
  const mode = writingModes[modeIndex];
  const prompt = mode.prompts[promptIndex];
  const wordCount = content.trim() ? content.trim().split(/\s+/u).length : 0;

  useEffect(() => {
    let active = true;
    persistence.read().then(draft => {
      if (!active) return;
      snapshot.current = draft;
      setContent(draft.content);
      setReady(true);
    }).catch(() => { if (active) setError('Your saved draft could not be restored. Reopen August to retry; it has not been overwritten.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!focus) return;
    navigation.setOptions({ tabBarStyle: { display: 'none' } });
    const handler = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', () => { setFocus(false); return true; }) : null;
    return () => { handler?.remove(); navigation.setOptions({ tabBarStyle: { backgroundColor: c.paper, borderTopColor: c.border } }); };
  }, [focus, navigation, c.paper, c.border]);

  function edit(value: string) {
    snapshot.current = { ...snapshot.current, content: value };
    setContent(value);
    setStatus('');
    setPersisted(false);
    void persistence.write(snapshot.current).then(() => {
      if (snapshot.current.content === value) setPersisted(true);
    }).catch(() => { setPersisted(false); });
  }

  async function save() {
    const text = snapshot.current.content;
    if (!text.trim() || savingRef.current || !ready) return;
    if (!api) { setError('Connect your journal in Settings first. Your draft is kept here.'); return; }
    savingRef.current = true;
    setSaving(true); setError(null); setStatus('');
    let savedOnline = false;
    try {
      let submission = snapshot.current.pending;
      if (!submission || submission.content !== text.trim()) submission = { content: text.trim(), key: randomUUID(), currentTime: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
      snapshot.current = { ...snapshot.current, pending: submission };
      // Persist the retry key before the request so interruptions cannot duplicate a note.
      await persistence.write(snapshot.current);
      await api.saveNote(submission);
      savedOnline = true;
      if (snapshot.current.content === text) { snapshot.current.content = ''; setContent(''); }
      snapshot.current.pending = null;
      changed();
      await persistence.write(snapshot.current);
      setPersisted(true);
      setStatus('Your moment has a home in your ledger.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (e) {
      setError(savedOnline ? 'Your moment was saved, but the local draft could not be updated.' : `${e instanceof Error ? e.message : 'Saving failed.'} Your writing is still here.`);
    } finally { savingRef.current = false; setSaving(false); }
  }

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen>
      {!focus && <Heading eyebrow="Your life, in your words" title={'Make a little room\nfor yourself.'} subtitle="A thought, a feeling, a small thing worth remembering." />}
      {!focus && <View style={[s.row, { marginBottom: 20 }]}>
        {writingModes.map((item, i) => <Pressable key={item.name} accessibilityRole="button" accessibilityState={{ selected: modeIndex === i }} onPress={() => { setModeIndex(i); setPromptIndex(0); void Haptics.selectionAsync().catch(() => undefined); }} style={{ padding: 12, borderRadius: 24, backgroundColor: modeIndex === i ? c.wash : 'transparent' }}><Text style={{ color: modeIndex === i ? c.accent : c.muted, fontSize: 12 }}>{item.name}</Text></Pressable>)}
      </View>}
      <Card>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text style={{ fontSize: 10, letterSpacing: 2, color: c.accent }}>TODAY’S PAGE</Text>
          <Pressable accessibilityRole="button" onPress={() => setFocus(!focus)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.accent, fontSize: 12 }}>{focus ? 'Leave focus' : 'Focus mode'}</Text></Pressable>
        </View>
        <Text accessibilityRole="header" style={{ color: c.text, fontFamily: 'serif', fontSize: 25 }}>{mode.title}</Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>No perfect words. Just yours.</Text>
        {!ready && !error && <Loading />}
        <TextInput ref={editor} accessibilityLabel="Your journal entry" editable={ready} multiline textAlignVertical="top" placeholder={mode.placeholder} placeholderTextColor={c.muted} value={content} onChangeText={edit} style={{ minHeight: focus ? 370 : 245, color: c.text, fontFamily: 'serif', fontSize: 19, lineHeight: 34, paddingVertical: 20 }} />
        <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={{ color: c.muted, fontSize: 11 }}>{wordCount} {wordCount === 1 ? 'word' : 'words'}</Text><Text style={{ color: c.muted, fontSize: 11 }}>{content ? persisted ? 'Draft kept on this device' : 'Draft not yet stored' : 'Every beginning counts'}</Text></View>
        <Button label={saving ? 'Saving your moment…' : 'Save moment  ↗'} disabled={!ready || !content.trim() || saving} onPress={() => void save()} />
      </Card>
      {error && <Notice message={error} />}
      {!!status && <Text accessibilityLiveRegion="polite" style={{ color: c.accent, marginBottom: 18 }}>{status}</Text>}
      {!focus && <Card style={{ backgroundColor: c.wash }}>
        <Text style={{ color: c.accent, fontSize: 10, letterSpacing: 2 }}>A LITTLE INSPIRATION</Text>
        <Text style={{ color: c.text, fontFamily: 'serif', fontSize: 20, lineHeight: 30 }}>{prompt}</Text>
        <View style={s.row}><Button label="Start with this ↗" disabled={!ready} onPress={() => { edit(`${content.trimEnd()}${content.trim() ? '\n\n' : ''}${prompt}\n`); editor.current?.focus(); }} quiet /><Button label="Another thought" onPress={() => setPromptIndex((promptIndex + 1) % mode.prompts.length)} quiet /></View>
      </Card>}
      <Text style={{ color: c.muted, fontStyle: 'italic', fontFamily: 'serif', textAlign: 'center', padding: 12 }}>Some days, a sentence is enough.</Text>
    </Screen>
  </KeyboardAvoidingView>;
}
