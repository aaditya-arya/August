import { useColorScheme } from "react-native";

const light = { background: '#faf8f5', paper: '#fffdf9', text: '#302c2a', muted: '#77716d', accent: '#704858', wash: '#f4edef', border: '#e7dfd8', danger: '#aa304c', onAccent: '#fffdf9' };
const dark: typeof light = { background: '#121314', paper: '#201f21', text: '#eee8e0', muted: '#aaa39c', accent: '#e2b2c4', wash: '#2b242a', border: '#353031', danger: '#f4a2b5', onAccent: '#201f21' };
export function useTheme() { return useColorScheme() === 'dark' ? dark : light; }
