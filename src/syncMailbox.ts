export class SessionExpiredError extends Error {}

export async function syncMailbox<T>(
  request: (url: string, method?: string) => Promise<unknown>,
  setCsrf: (token: string) => void,
  save: (data: T) => void,
  connected: () => boolean,
  rescan = false,
): Promise<void> {
  const session = await request('/api/session') as { authenticated: boolean; csrf: string };
  if (!session.authenticated) {
    throw new SessionExpiredError('La sesión venció. Vuelve a conectar tu correo para actualizar los movimientos.');
  }
  setCsrf(session.csrf);
  let more: boolean;
  do {
    if (!connected()) throw new Error('Se perdió la conexión. La actualización quedó incompleta; inténtalo de nuevo al recuperar internet.');
    const result = await request(rescan ? '/api/sync?rescan=1' : '/api/sync', 'POST') as { has_more: boolean };
    rescan = false;
    save(await request('/api/dashboard') as T);
    more = result.has_more;
  } while (more);
}
