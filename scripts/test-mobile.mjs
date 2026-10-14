import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
assert.ok(chrome, 'A Chromium browser is required for the mobile layout check')
const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' })
try {
  const { default: Editor } = await server.ssrLoadModule('/src/MovementEditor.tsx')
  const markup = renderToStaticMarkup(createElement(Editor, { balances: [{ account_reference: '1234', currency: 'CRC', amount: '10000', base_at: '2026-09-01T00:00:00Z' }], movement: null, currency: 'CRC', online: true, mutate: async () => {}, onClose: () => {}, onSaved: () => {} })).replace('<dialog ', '<dialog open ')
  const css = readFileSync('src/index.css', 'utf8') + readFileSync('src/App.css', 'utf8')
  const folder = resolve('.mobile-check')
  mkdirSync(folder, { recursive: true })
  for (const [width, height] of [[360, 800], [390, 844], [430, 932], [820, 1180], [1280, 900]]) {
    const mobile = width <= 900
    const page = resolve(folder, `editor-${width}.html`)
    writeFileSync(page, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${markup}<pre id="result" hidden></pre><script>
      const dialog=document.querySelector('dialog'), fields=document.querySelector('.movement-fields'), actions=document.querySelector('.dialog-actions');
      const rect=dialog.getBoundingClientRect(), footer=actions.getBoundingClientRect();
      const noOverflow=dialog.scrollWidth<=dialog.clientWidth && fields.scrollWidth<=fields.clientWidth;
      const columns=getComputedStyle(fields).gridTemplateColumns.split(' ').length;
      const details=document.querySelector('details');
      const initial={width:innerWidth, noOverflow, columns, footerVisible:footer.bottom<=innerHeight+1 && footer.top>=0, fullWidth:Math.abs(rect.width-innerWidth)<2, detailsCollapsed:!details.open};
      details.open=true; fields.scrollTop=fields.scrollHeight;
      initial.expandedNoOverflow=fields.scrollWidth<=fields.clientWidth;
      initial.footerStaysVisible=actions.getBoundingClientRect().bottom<=innerHeight+1;
      document.querySelector('#result').textContent=JSON.stringify(initial);
    </script></body></html>`)
    const profile = resolve(folder, `cdp-${width}-${Date.now()}`)
    const browser = spawn(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
    let socket
    try {
      const portFile = resolve(profile, 'DevToolsActivePort')
      for (let attempt = 0; !existsSync(portFile) && attempt < 100; attempt++) await new Promise(done => setTimeout(done, 100))
      let port
      for (let attempt = 0; !port && attempt < 100; attempt++) { try { port = readFileSync(portFile, 'utf8').split('\n')[0] } catch {} if (!port) await new Promise(done => setTimeout(done, 100)) }
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
      await new Promise((done, reject) => { socket.addEventListener('open', done); socket.addEventListener('error', reject) })
      let sequence = 0
      const command = (method, params = {}) => new Promise((done, reject) => {
        const id = ++sequence
        const listener = event => { const message = JSON.parse(event.data); if (message.id === id) { socket.removeEventListener('message', listener); if (message.error) reject(new Error(JSON.stringify(message.error))); else done(message.result) } }
        socket.addEventListener('message', listener)
        socket.send(JSON.stringify({ id, method, params }))
      })
      await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
      await command('Page.navigate', { url: pathToFileURL(page).href })
      let metrics
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await command('Runtime.evaluate', { expression: 'document.querySelector("#result")?.textContent', returnByValue: true })
        if (result.result.value) { metrics = JSON.parse(result.result.value); break }
        await new Promise(done => setTimeout(done, 50))
      }
      assert.ok(metrics, 'Browser did not report layout results')
      assert.equal(metrics.width, width)
      await command('Runtime.evaluate', { expression: 'document.querySelector("details").open=false; document.querySelector(".movement-fields").scrollTop=0' })
      const screenshot = await command('Page.captureScreenshot', { format: 'png' })
      writeFileSync(resolve(folder, `editor-${width}.png`), Buffer.from(screenshot.data, 'base64'))
    assert.ok(metrics.noOverflow && metrics.expandedNoOverflow, JSON.stringify(metrics))
    assert.ok(metrics.footerVisible && metrics.footerStaysVisible, JSON.stringify(metrics))
    assert.ok(metrics.detailsCollapsed)
    assert.equal(metrics.columns, mobile ? 1 : 2)
    if (mobile) assert.ok(metrics.fullWidth)
    console.log(`${width}px: ${JSON.stringify(metrics)}`)
    } finally { socket?.close(); browser.kill() }
  }
} finally { await server.close() }
