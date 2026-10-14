import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

export type Movement = { id: number; kind: string; amount: string; currency: string; merchant: string | null; occurred_at: string; date_from_email: boolean; account_reference: string | null; subject: string | null; instrument_type?: string; mail_record_id?: number | null; notes?: string | null; user_edited?: boolean }
type BalanceAccount = { account_reference: string; currency: string; amount: string; base_at?: string; observed_at?: string }
type Props = { balances: BalanceAccount[]; movement: Movement | null; currency: string; online: boolean; mutate: (url: string, fields: Record<string, string>) => Promise<void>; onClose: () => void; onSaved: (date: string, currency: string) => void }
function localTime(value: string) {
  const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'America/Costa_Rica' }).formatToParts(new Date(value))
  const get = (name: string) => parts.find(part => part.type === name)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}

export default function MovementEditor({ balances, movement, currency, online, mutate, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const clientId = useRef(crypto.randomUUID())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState(movement?.currency || currency)
  const accounts = balances.filter(item => item.currency === selectedCurrency)
  const [account, setAccount] = useState(movement?.account_reference || (balances.filter(item => item.currency === currency).length === 1 ? balances.find(item => item.currency === currency)!.account_reference : ''))
  const [kind, setKind] = useState(movement?.kind || 'expense')
  const [amount, setAmount] = useState(movement?.amount || '')
  const [instrument, setInstrument] = useState(movement?.instrument_type || 'bank_account')
  const [occurredAt, setOccurredAt] = useState(localTime(movement?.occurred_at || new Date().toISOString()))
  const balance = accounts.find(item => item.account_reference === account)
  const baseAt = balance?.base_at || balance?.observed_at
  const affectsBalance = balance && instrument !== 'card' && (!movement?.date_from_email) && (!baseAt || new Date(`${occurredAt}-06:00`) > new Date(baseAt))
  const formatted = (value: number) => new Intl.NumberFormat('es-CR', { style: 'currency', currency: selectedCurrency }).format(value)

  useEffect(() => {
    const node = dialog.current
    node?.showModal()
    return () => node?.close()
  }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const fields = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    fields.occurred_at = `${fields.occurred_at.length === 16 ? `${fields.occurred_at}:00` : fields.occurred_at}-06:00`
    fields.client_id = clientId.current
    try {
      await mutate(movement ? `/api/movements/${movement.id}` : '/api/movements', fields)
      onSaved(fields.occurred_at, fields.currency)
      onClose()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el movimiento.') }
    finally { setSaving(false) }
  }
  return <dialog ref={dialog} className="movement-dialog" aria-labelledby="editor-title" onCancel={event => { if (saving) event.preventDefault(); else onClose() }}><div className="dialog-heading"><div><span className="eyebrow">TU HISTORIAL</span><h2 id="editor-title">{movement ? 'Editar movimiento' : 'Agregar movimiento'}</h2></div><button type="button" className="close-button" aria-label="Cerrar editor" disabled={saving} onClick={onClose}>×</button></div><p className="muted">{movement ? 'Corrige el comercio o cualquier dato de la operación. Tus cambios se conservan al sincronizar.' : 'Registra un gasto o ingreso que no llegó a tu correo, como un SINPE.'}</p>
    <form className="movement-form" onSubmit={event => void submit(event)}><label className="full">Comercio / persona o descripción<input name="merchant" required maxLength={255} defaultValue={movement?.merchant || ''} placeholder="Ej. SUPERMERCADO COMPRE BI ALAJUELA CRI" autoFocus={typeof window !== 'undefined' && window.matchMedia('(min-width: 721px)').matches} /></label><label>Tipo<select name="kind" value={kind} onChange={event => setKind(event.target.value)}><option value="expense">Gasto / salida</option><option value="income">Ingreso / entrada</option></select></label><label>Moneda<select name="currency" value={selectedCurrency} onChange={event => { setSelectedCurrency(event.target.value); const next = balances.filter(item => item.currency === event.target.value); setAccount(next.length === 1 ? next[0].account_reference : '') }}><option>CRC</option><option>USD</option><option>GTQ</option><option>EUR</option></select></label><label>Monto<input type="number" name="amount" step="0.01" min="0.01" max="999999999999.99" required inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" /></label><label>Fecha y hora · Costa Rica<input name="occurred_at" type="datetime-local" step="1" required min="2026-09-01T00:00" max={localTime(new Date().toISOString())} value={occurredAt} onChange={event => setOccurredAt(event.target.value)} /></label><label>Cuenta o tarjeta (4 cifras)<input name="account_reference" pattern="[0-9]{4}" maxLength={4} inputMode="numeric" list="balance-accounts" required={accounts.length > 0} value={account} onChange={event => setAccount(event.target.value)} placeholder="1234" /><datalist id="balance-accounts">{accounts.map(item => <option key={item.account_reference} value={item.account_reference}>Cuenta {item.account_reference} / {formatted(Number(item.amount))}</option>)}</datalist>{accounts.length > 0 && <div className="account-choices">{accounts.map(item => <button type="button" className={`secondary ${account === item.account_reference ? 'selected-account' : ''}`} key={item.account_reference} onClick={() => { setAccount(item.account_reference); setInstrument('bank_account') }}>Cuenta {item.account_reference}</button>)}</div>}</label><label>Medio<select name="instrument_type" value={instrument} onChange={event => setInstrument(event.target.value)}><option value="bank_account">Cuenta bancaria / SINPE</option><option value="card">Tarjeta</option><option value="unknown">Efectivo / otro</option></select></label><label className="full">Nota (opcional)<textarea name="notes" maxLength={2000} rows={3} defaultValue={movement?.notes || ''} placeholder="Una referencia o detalle para recordar este movimiento" /></label>{movement?.date_from_email && <label className="full confirm-time"><span><input name="date_confirmed" type="checkbox" value="1" /> Confirmo que la fecha y hora son las de la operación</span><small>Si solo corriges el comercio, la hora sigue marcada como aproximada.</small></label>}<p className="muted full" aria-live="polite">{affectsBalance ? movement ? 'Al guardar, recalcularemos el saldo con los datos corregidos.' : `Saldo al guardar: ${formatted(Number(balance.amount) + (kind === 'income' ? 1 : -1) * Number(amount || 0))}` : balance ? 'Los movimientos anteriores al saldo base ya se consideran incluidos. Para tarjetas, asocia la tarjeta a su cuenta en Estados de cuenta.' : 'Selecciona una cuenta con saldo. Si no tienes una base, establece tu saldo real en Estados de cuenta.'}</p>{error && <div className="notice error full" role="alert">{error}</div>}<div className="dialog-actions full"><button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancelar</button><button disabled={!online || saving}>{saving ? 'Guardando…' : 'Guardar movimiento'}</button></div></form></dialog>
}
