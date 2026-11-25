import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Loading, Notice, Screen } from '../../components/ui';
import { useJournal } from '../../lib/journal';

export default function Callback() {
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const { ready, completeSignIn } = useJournal();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!ready) return;
    let active = true;
    async function finish() {
      try {
        if (params.error || typeof params.code !== 'string') throw new Error('Sign-in was not completed. Please start again.');
        await completeSignIn(params.code);
        if (active) router.replace('/');
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.'); }
    }
    void finish();
    return () => { active = false; };
  }, [ready, params.code, params.error, completeSignIn]);
  return <Screen>{error ? <><Notice message={error} /><Button label="Return to August" onPress={() => router.replace('/')} /></> : <Loading />}</Screen>;
}
