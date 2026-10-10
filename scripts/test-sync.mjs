import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' })
try {
  const { syncMailbox, SessionExpiredError } = await server.ssrLoadModule('/src/syncMailbox.ts')
  const purchase = { merchant: 'DLC TEMU COM DUBLIN IRL', amount: '20762.00', currency: 'CRC' }
  const calls = [], saved = []
  let imported = false, csrf = ''
  await syncMailbox(async (url, method) => {
    calls.push([url, method])
    if (url === '/api/session') return { authenticated: true, csrf: 'test-token' }
    if (url === '/api/sync') {
      assert.equal(csrf, 'test-token')
      assert.equal(method, 'POST')
      imported = true
      return { has_more: false }
    }
    assert.equal(imported, true, 'La interfaz debe consultar los datos después de importar')
    return { transactions: [purchase] }
  }, token => { csrf = token }, data => saved.push(data), () => true)
  assert.deepEqual(saved.at(-1).transactions, [purchase])
  assert.deepEqual(calls.map(([url]) => url), ['/api/session', '/api/sync', '/api/dashboard'])

  const pages = [], snapshots = []
  let page = 0
  await syncMailbox(async url => {
    if (url === '/api/session') return { authenticated: true, csrf: 'token' }
    if (url.startsWith('/api/sync')) { pages.push(url); return { has_more: ++page < 2 } }
    return { transactions: page === 2 ? [purchase] : [] }
  }, () => {}, data => snapshots.push(data), () => true, true)
  assert.deepEqual(pages, ['/api/sync?rescan=1', '/api/sync'])
  assert.deepEqual(snapshots.at(-1).transactions, [purchase])

  let stored = false
  await assert.rejects(syncMailbox(async () => ({ authenticated: false }), () => {}, () => { stored = true }, () => true), SessionExpiredError)
  assert.equal(stored, false, 'Una sesión vencida no debe guardar una actualización ficticia')
  await assert.rejects(syncMailbox(async url => {
    if (url === '/api/session') return { authenticated: true, csrf: 'token' }
    throw new Error('El proveedor no respondió')
  }, () => {}, () => { stored = true }, () => true), /proveedor/)
  assert.equal(stored, false)
  await assert.rejects(syncMailbox(async () => ({ authenticated: true, csrf: 'token' }), () => {}, () => {}, () => false), /conexión/)
  console.log('Sincronización verificada: compra nueva visible, paginación, sesión vencida y fallos sin éxito falso.')
} finally {
  await server.close()
}
