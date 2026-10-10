import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' })
try {
  const { default: Workspace } = await server.ssrLoadModule('/src/ExpenseWorkspace.tsx')
  const data = {
    user: { id: 1, email: 'test@example.com' }, accounts: [], balances: [], unrecognized: 0,
    transactions: [{ id: 1, kind: 'expense', amount: '1208.00', currency: 'CRC', merchant: 'SUPERMERCADO EJEMPLO ALAJUELA CRI', occurred_at: new Date().toISOString(), date_from_email: false, account_reference: '1234', subject: 'Comprobante de compra', mail_record_id: 1 }],
    statements: [{ id: 1, filename: 'estado-prueba.pdf', status: 'confirmed', confirmed: true, account_type: 'bank_account', account_reference: '1234', currency: 'CRC', closing_date: '2026-09-30', closing_balance: '10000.00' }],
  }
  const render = (view, online = true) => {
    globalThis.location = { hash: `#${view}`, search: '' }
    return renderToStaticMarkup(createElement(Workspace, { data, online, busy: false, expired: false, error: '', sync: async () => {}, mutate: async () => {}, logout: async () => {} }))
  }
  const overview = render('resumen')
  assert.ok(overview.includes('Gastos del mes'))
  assert.ok(overview.includes('SUPERMERCADO EJEMPLO ALAJUELA CRI'))
  assert.ok(!overview.includes('estado-prueba.pdf'))
  assert.ok(!overview.includes('class="banking"'))
  const movements = render('movimientos')
  assert.ok(movements.includes('Editar movimiento de SUPERMERCADO EJEMPLO ALAJUELA CRI'))
  assert.ok(movements.includes('Agregar movimiento'))
  assert.ok(!movements.includes('estado-prueba.pdf'))
  const states = render('estados')
  assert.ok(states.includes('ÚLTIMO ESTADO DE CUENTA'))
  assert.ok(states.includes('Corte del'))
  assert.ok(!states.includes('Confirmar datos'))
  assert.ok(!states.includes('POR REVISAR'))
  assert.ok(states.includes('Qué significa cada saldo'))
  assert.ok(overview.includes('Modo oscuro'))
  data.statements.push({ id: 2, filename: 'Glosario.pdf', status: 'reference', confirmed: false, account_type: 'unknown', closing_date: null })
  assert.ok(!render('estados').includes('Glosario.pdf'))
  assert.ok(render('resumen', false).includes('para agregar o editar movimientos necesitas recuperar la conexión'))
  globalThis.location = { hash: '#resumen', search: '' }
  const expired = renderToStaticMarkup(createElement(Workspace, { data, online: true, busy: false, expired: true, error: 'La sesión venció.', sync: async () => {}, mutate: async () => {}, logout: async () => {} }))
  assert.ok(expired.includes('Conecta tu correo para actualizar'))
  assert.ok(expired.indexOf('Conecta tu correo para actualizar') < expired.indexOf('Resumen del mes'))
  data.projected_balances = [{ account_reference: '1234', currency: 'CRC', amount: '85238.00', base_amount: '106000.00', base_at: '2026-10-01T06:00:00Z', source: 'manual', applied_movements: 1, applied_expenses: '20762.00', applied_income: '0.00' }]
  assert.ok(render('estados').includes('Asociar mi tarjeta de débito'))
  assert.ok(render('estados').includes('Saldo antes de los gastos del mes'))
  assert.ok(render('estados').includes('− Gastos:'))
  console.log('Vistas verificadas: dashboard sin estados, comercio completo, edición, alta y consulta offline.')
} finally {
  await server.close()
}
