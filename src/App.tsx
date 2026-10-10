import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import ExpenseWorkspace from './ExpenseWorkspace';
import { SessionExpiredError, syncMailbox } from './syncMailbox';
import type { Movement } from './MovementEditor';
import type { Statement, Projection } from './BankingPanel';
type Tx = Movement;
export type Data = {
    user: {
        id: number;
        email: string;
    };
    accounts: {
        id: number;
        email: string;
        provider: string;
        last_synced_at: string | null; sync_started_at?: string | null;
    }[];
    transactions: Tx[]; statements?: Statement[]; projected_balances?: Projection[];
    debit_card_links?: { card_reference: string; account_reference: string; currency: string }[];
    balances: {
        amount: string;
        currency: string;
        account_reference: string;
        observed_at: string;
    }[];
    unrecognized: number; scanned?: number; import_since?: string;
};
type Snapshot = {
    data: Data;
    savedAt: string;
};
const key = 'k-gastos-v1';
function cached(): Snapshot | null { try {
    return JSON.parse(localStorage.getItem(key) || 'null');
}
catch {
    return null;
} }
export default function App() {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(cached), [online, setOnline] = useState(navigator.onLine), [busy, setBusy] = useState(false), [error, setError] = useState(''), [expired, setExpired] = useState(false);
    const running = useRef(false), csrf = useRef('');
    const request = useCallback(async (url: string, method = 'GET', body?: Record<string, string>) => { const r = await fetch(url, { method, cache: 'no-store', body: body ? JSON.stringify(body) : undefined, credentials: 'include', headers: { Accept: 'application/json', ...(method === 'POST' ? { 'X-CSRF-TOKEN': csrf.current, ...(body ? { 'Content-Type': 'application/json' } : {}) } : {}) } }); if (r.status === 401 || r.status === 419) {
        setExpired(true);
        throw new Error('La sesión venció. Autoriza de nuevo tu correo; tu copia local sigue disponible.');
    } if (!r.ok) {
        const d = await r.json().catch(() => null);
        if (d?.reconnect) setExpired(true);
        throw new Error(d?.message || 'No se pudo actualizar. Inténtalo de nuevo.');
    } if (!r.headers.get('content-type')?.includes('application/json')) throw new Error('La app no está conectada al servidor de gastos. Inicia los servidores de Laravel y de la interfaz para actualizar.'); return r.json(); }, []);
    const save = useCallback((data: Data) => { const next = { data, savedAt: new Date().toISOString() }; setSnapshot(next); try {
        localStorage.setItem(key, JSON.stringify(next));
    }
    catch {
        setError('No hay espacio para guardar esta actualización sin conexión.');
    } }, []);
    const sync = useCallback(async (rescan = false) => { if (!navigator.onLine || running.current)
        return; running.current = true; setBusy(true); setError(''); try {
        await syncMailbox<Data>(request, token => { csrf.current = token; }, save, () => navigator.onLine, rescan);
        setExpired(false);
    }
    catch (e) {
        if (e instanceof SessionExpiredError) setExpired(true);
        setError(e instanceof Error ? e.message : 'No se pudo conectar al servidor.');
    }
    finally {
        running.current = false;
        setBusy(false);
    } }, [request, save]);
    useEffect(() => { const on = () => { setOnline(true); void sync(); }, off = () => setOnline(false), visible = () => { if (document.visibilityState === 'visible')
        void sync(); }; window.addEventListener('online', on); window.addEventListener('offline', off); document.addEventListener('visibilitychange', visible); const timer = setInterval(() => void sync(), 300000); const initial = setTimeout(() => void sync(), 0); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); document.removeEventListener('visibilitychange', visible); clearInterval(timer); clearTimeout(initial); }; }, [sync]);
    async function logout() { try {
        await request('/api/logout', 'POST');
        localStorage.removeItem(key);
        setSnapshot(null);
        setExpired(false);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cerrar la sesión.');
    } }
    async function mutate(url: string, body: Record<string, string>) { await request(url, 'POST', body); save(await request('/api/dashboard')); }
    return <ExpenseWorkspace data={snapshot?.data} online={online} busy={busy} expired={expired} error={error} savedAt={snapshot?.savedAt} sync={sync} mutate={mutate} logout={logout} />;
}
