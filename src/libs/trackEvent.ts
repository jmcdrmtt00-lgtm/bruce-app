export interface ActivityEventPayload {
  app_id: string;
  email: string;
  event_type: 'session' | 'click';
  count: number;
  input_tokens: number;
  output_tokens: number;
}

export async function trackEvents(events: ActivityEventPayload[]): Promise<void> {
  const url = process.env.HEADLIGHTS_URL;
  const key = process.env.HEADLIGHTS_EVENTS_API_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(events),
    });
  } catch {}
}
