import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Share, Text, TextInput, View } from 'react-native';
import { type Period, type Moment, createAugustApi } from '@august/shared';
import { Button, Card, Heading, Notice, Screen, s } from '../components/ui';
import { useRemote } from '../lib/journal';
import { useTheme } from '../lib/theme';

export default function MomentsScreen() {
  const c = useTheme();
  const [period, setPeriod] = useState<Period>('7');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const load = useCallback((api: ReturnType<typeof createAugustApi>, signal: AbortSignal) => api.items(period, signal), [period]);
  const { data, loading, error, reload } = useRemote(load);
  const categories = useMemo(() => [...new Set((data?.items || []).map(item => item.category))].sort(), [data]);
  const items = useMemo(() => (data?.items || []).filter(item => (!category || item.category === category) && `${item.content} ${item.memory?.title || ''} ${(item.tags || []).join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [data, category, query]);

  function renderItem({ item }: { item: Moment }) {
    return <Card>
      <Text style={{ color: c.accent, fontSize: 11 }}>{item.category.replace(/_/g, ' ')} · {new Date(item.event_timestamp || item.created_at).toLocaleDateString()}</Text>
      {item.memory?.title && <Text style={{ color: c.text, fontFamily: 'serif', fontSize: 21 }}>{item.memory.title}</Text>}
      <Text selectable style={{ color: c.text, fontFamily: 'serif', fontSize: 17, lineHeight: 29 }}>{item.content}</Text>
      {!!item.tags?.length && <Text style={{ color: c.muted, fontSize: 11 }}>{item.tags.map(tag => `#${tag}`).join('  ')}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel="Share this moment" onPress={() => { void Share.share({ message: item.content }).catch(() => Alert.alert('Could not share', 'Please try again.')); }} style={{ minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: c.accent, fontSize: 12 }}>Share moment ↗</Text></Pressable>
    </Card>;
  }
  return <Screen scroll={false}><FlatList data={items} keyExtractor={item => item.id} renderItem={renderItem} contentContainerStyle={s.screen} refreshing={loading} onRefresh={reload} keyboardShouldPersistTaps="handled"
    ListHeaderComponent={<>
      <Heading eyebrow="The things you’ve kept" title="A life in little moments" subtitle="Find the words, ideas, and experiences you came back to." />
      <View style={[s.row, { marginBottom: 16 }]}>{(['7', '30', 'all'] as const).map((value, i) => <Button key={value} label={['This week', '30 days', 'All time'][i]} quiet={period !== value} onPress={() => { setPeriod(value); setCategory(null); }} />)}</View>
      <TextInput accessibilityLabel="Search moments" placeholder="Search words, titles, or tags…" placeholderTextColor={c.muted} value={query} onChangeText={setQuery} style={{ backgroundColor: c.paper, borderColor: c.border, borderWidth: 1, color: c.text, padding: 14, borderRadius: 12, marginBottom: 15 }} />
      <View style={[s.row, { marginBottom: 20 }]}>{[null, ...categories].map(value => <Pressable key={value || 'all'} accessibilityRole="button" accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} style={{ padding: 10, borderRadius: 16, backgroundColor: category === value ? c.wash : 'transparent' }}><Text style={{ color: c.accent, fontSize: 11 }}>{value?.replace(/_/g, ' ') || 'All categories'}</Text></Pressable>)}</View>
      {error && <Notice message={error} retry={reload} />}
    </>}
    ListEmptyComponent={!loading && !error ? <Notice message={query || category ? 'No moments match these filters.' : 'Your story starts with a small moment. Write something on your page, and it will find a home here.'} /> : undefined}
  /></Screen>;
}
