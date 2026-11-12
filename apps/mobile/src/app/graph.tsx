import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { createAugustApi } from '@august/shared';
import { Card, Heading, Loading, Notice, Screen, s } from '../components/ui';
import { useRemote } from '../lib/journal';
import { useTheme } from '../lib/theme';

export default function GraphScreen() {
  const c = useTheme();
  const load = useCallback((api: ReturnType<typeof createAugustApi>, signal: AbortSignal) => api.graph(signal), []);
  const { data, loading, error, reload } = useRemote(load);
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const groups = useMemo(() => [...new Set(data?.nodes.map(node => node.group) || [])].sort(), [data]);
  const eligible = useMemo(() => data?.nodes.filter(node => !category || node.group === category) || [], [category, data]);
  const nodes = useMemo(() => eligible.slice(0, 60).map((node, index, list) => {
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const radius = list.length === 1 ? 0 : 140 * Math.sqrt((index + 1) / list.length);
    return { ...node, x: 180 + Math.cos(angle) * radius, y: 180 + Math.sin(angle) * radius };
  }), [eligible]);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const current = nodes.find(node => node.id === selected);
  return <Screen>
    <Heading eyebrow="Your connected life" title="Follow a thought." subtitle="Ideas and experiences connect in unexpected ways. Tap a dot to revisit a moment." />
    {loading && <Loading />}
    {error && <Notice message={error} retry={reload} />}
    {!loading && data && data.nodes.length === 0 && <Notice message="Your graph grows as you write. Save a few moments to start discovering connections." />}
    {!!data?.nodes.length && <>
      <View style={[s.row, { marginBottom: 18 }]}>{[null, ...groups].map(group => <Pressable accessibilityRole="button" accessibilityState={{ selected: category === group }} key={group || 'all'} onPress={() => { setCategory(group); setSelected(null); }} style={{ padding: 10, backgroundColor: category === group ? c.wash : 'transparent', borderRadius: 15 }}><Text style={{ color: c.accent, fontSize: 11 }}>{group?.replace(/_/g, ' ') || 'All threads'}</Text></Pressable>)}</View>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Svg viewBox="0 0 360 360" width="100%" height={360} accessibilityLabel="Connections between your moments">
          {data.links.map((link, i) => {
            const source = byId.get(link.source), target = byId.get(link.target);
            return source && target ? <Line key={i} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={c.accent} strokeOpacity={.25} strokeWidth={1 + link.weight} /> : null;
          })}
          {nodes.map(node => <Circle key={node.id} cx={node.x} cy={node.y} r={node.id === selected ? 13 : 8} fill={node.color} stroke={node.id === selected ? c.text : c.paper} strokeWidth={2} onPress={() => setSelected(node.id)} />)}
        </Svg>
      </Card>
      <Text style={{ color: c.muted, fontSize: 12, marginBottom: 18 }}>{eligible.length > 60 ? `Showing 60 of ${eligible.length} moments. Choose a category to narrow the graph.` : `${nodes.length} moments in this view`}</Text>
      {current && <Card style={{ backgroundColor: c.wash }}><Text style={{ color: c.accent, fontSize: 12 }}>{current.group.replace(/_/g, ' ')}</Text><Text selectable style={{ color: c.text, fontFamily: 'serif', fontSize: 19, lineHeight: 29 }}>{current.name}</Text></Card>}
      <Text accessibilityRole="header" style={{ color: c.text, fontFamily: 'serif', fontSize: 23, marginBottom: 15 }}>Explore the moments</Text>
      {nodes.map(node => <Pressable key={node.id} accessibilityRole="button" accessibilityLabel={`Explore ${node.name}`} accessibilityState={{ selected: selected === node.id }} onPress={() => setSelected(node.id)} style={{ borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 15, gap: 7 }}><Text style={{ color: c.accent, fontSize: 10 }}>{node.group.replace(/_/g, ' ')}</Text><Text style={{ color: c.text, lineHeight: 23 }} numberOfLines={selected === node.id ? undefined : 2}>{node.name}</Text></Pressable>)}
    </>}
  </Screen>;
}
