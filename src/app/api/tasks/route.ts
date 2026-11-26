import { withAccount } from '@/lib/auth-server';
import { supabase } from '@/lib/supabase';
import { invalidateReviewData } from '@/lib/review-data';
import { taskList, taskUpdate, toTask, TaskConflictError } from '@/lib/tasks';
import { validTimezone } from '@/lib/time';
import { errorMessage } from '@/lib/errors';
import type { LedgerItem } from '@/lib/ledger';

export const GET = withAccount(async request => {
  try {
    const timezone = validTimezone(new URL(request.url).searchParams.get('timezone')) || 'UTC';
    const entries: LedgerItem[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('extracted_items').select('id, category, content, tags, calendar_action, event_timestamp, created_at')
        .or('category.in.(Task,task,TASK,Reminder,reminder,REMINDER),calendar_action->task.not.is.null,calendar_action->>kind.in.(task,reminder)')
        .order('id').range(offset, offset + 499);
      if (error) throw error;
      entries.push(...data as LedgerItem[]);
      if (data.length < 500) break;
    }
    return Response.json({ tasks: taskList(entries, timezone) });
  } catch (error) { return Response.json({ error: errorMessage(error) }, { status: 500 }); }
});

export const PATCH = withAccount(async request => {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid task update is required.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || typeof body.item_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.item_id)) return Response.json({ error: 'A valid task ID is required.' }, { status: 400 });
  const timezone = validTimezone(body.timezone) || 'UTC';
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: item, error } = await supabase.from('extracted_items').select('id, category, content, tags, calendar_action, created_at, event_timestamp').eq('id', body.item_id).maybeSingle();
      if (error) throw error;
      if (!item) return Response.json({ error: 'This task no longer exists.' }, { status: 404 });
      let calendar;
      try { calendar = taskUpdate(item as LedgerItem, body, timezone); }
      catch (error) { return Response.json({ error: errorMessage(error) }, { status: error instanceof TaskConflictError ? 409 : 400 }); }
      let update = supabase.from('extracted_items').update({ calendar_action: calendar }).eq('id', item.id);
      update = item.calendar_action === null ? update.is('calendar_action', null) : update.eq('calendar_action', JSON.stringify(item.calendar_action));
      const { data, error: saveError } = await update.select('id');
      if (saveError) throw saveError;
      if (data?.length) {
        invalidateReviewData();
        return Response.json({ task: toTask({ ...item, calendar_action: calendar } as LedgerItem, timezone) });
      }
    }
    return Response.json({ error: 'This task changed while you were editing. Try again.' }, { status: 409 });
  } catch (error) { return Response.json({ error: errorMessage(error) }, { status: 500 }); }
});
