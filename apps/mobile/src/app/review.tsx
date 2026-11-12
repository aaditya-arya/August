import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { createAugustApi, type Period, type Insight } from '@august/shared';
import { Button, Card, Heading, Loading, Notice, Screen, s } from '../components/ui';
import { useRemote } from '../lib/journal';
import { useTheme } from '../lib/theme';

export default function ReviewScreen() {
  const c = useTheme();
  const [period, setPeriod] = useState<Period>('7');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const load = useCallback((api: ReturnType<typeof createAugustApi>, signal: AbortSignal) => api.review(period, timezone, false, signal), [period, timezone]);
  const { data, loading, error, reload } = useRemote(load);
  const review = data?.review;
  const insight = (item: Insight, label?: string) => <Card key={`${label || ''}:${item.title}`}>
    {label && <Text style={{ color: c.accent, fontSize: 10, letterSpacing: 1.7 }}>{label.toUpperCase()}</Text>}
    <Text style={{ color: c.text, fontFamily: 'serif', fontSize: 23 }}>{item.title}</Text>
    <Text selectable style={{ color: c.text, fontSize: 15, lineHeight: 25 }}>{item.meaning}</Text>
    <Text selectable style={{ color: c.muted, fontSize: 14, lineHeight: 23 }}>{item.takeaway}</Text>
  </Card>;
  return <Screen>
    <Heading eyebrow="Your Sunday ritual" title="A little perspective." subtitle="Step back. Notice what moved, what mattered, and what’s asking for your attention." />
    <View style={[s.row, { marginBottom: 22 }]}>{(['7', '30', 'all'] as const).map((value, i) => <Button key={value} label={['This week', '30 days', 'All time'][i]} quiet={value !== period} onPress={() => setPeriod(value)} />)}</View>
    {loading && <Loading />}
    {error && <Notice message={error} retry={reload} />}
    {!loading && data && !review && <Notice message={data.context_count === 0 ? 'A review grows out of a life recorded. Save a few moments, then return here.' : data.message || 'Your reflection is not ready yet. Try again in a little while.'} retry={data.context_count ? reload : undefined} />}
    {review && <>
      <Card style={{ backgroundColor: c.wash }}><Text selectable style={{ color: c.text, fontFamily: 'serif', fontSize: 21, lineHeight: 33 }}>{review.opening}</Text></Card>
      {review.focus && insight(review.focus, 'Worth a closer look')}
      {review.progress.map(item => insight(item, 'Moving forward'))}
      {review.experiences.map(item => insight(item, 'Living a little'))}
      {review.lessons.map(item => insight(item, 'What you learned'))}
      {review.patterns.map(item => insight(item, 'A thread to notice'))}
      {review.next_step && insight(review.next_step, 'One small next step')}
      <Card style={{ backgroundColor: c.wash }}><Text style={{ color: c.accent, fontSize: 10, letterSpacing: 2 }}>SOMETHING TO SIT WITH</Text><Text selectable style={{ color: c.text, fontFamily: 'serif', fontSize: 23, lineHeight: 34 }}>{review.question}</Text></Card>
    </>}
  </Screen>;
}
