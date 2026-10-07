export function authResumeUrl(raw: unknown, origin: string): string | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.origin !== origin ||
      url.username ||
      url.password ||
      url.hash ||
      !['/mobile/feed', '/mobile/settings'].includes(url.pathname)
    )
      return null;
    const result = new URL(url.pathname, origin);
    for (const key of ['topic_id', 'task_id', 'agent_id', 'source']) {
      const values = url.searchParams.getAll(key);
      if (values.length > 1 || (values[0]?.length || 0) > 128) return null;
      if (values[0]) result.searchParams.set(key, values[0]);
    }
    return result.toString();
  } catch {
    return null;
  }
}
