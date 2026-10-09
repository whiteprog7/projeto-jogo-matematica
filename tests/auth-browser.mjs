import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

// Uses the local UI with real auth/admin handlers and the caller's isolated SQLite DB.
// Session cookies remain in this process; no account or password is sent to a live API.
export async function testAuthBrowser({auth, route: authRoute, admin, teacher, game, sql}) {
  const origin = process.env.TUFI_TEST_URL || 'http://localhost:5173';
  const target = new URL(origin);
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname), 'Browser auth tests require a local server');
  assert.ok(['http:', 'https:'].includes(target.protocol), 'Browser auth tests require HTTP');
  const configuredModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const moduleUrl = /^[A-Za-z]:[\\/]/.test(configuredModule) ? pathToFileURL(configuredModule).href : configuredModule;
  const {chromium} = await import(moduleUrl);
  const fixtureUser = 'reset-browser-fixture';
  const fixtureLogin = 'TF-RESET-BROWSER';
  const fixtureName = 'Conta de teste';
  const hash = await auth.hashPassword('browser-fixture-initial-password');
  sql.prepare("INSERT INTO profiles(id,name,email,role,requested_role,status) VALUES(?,?,'','student','student','approved')").run(fixtureUser, fixtureName);
  sql.prepare('INSERT INTO accounts(user_id,login_id,password_hash,created) VALUES(?,?,?,?)').run(fixtureUser, fixtureLogin, hash, Date.now());

  sql.prepare("INSERT INTO profiles(id,name,email,role,requested_role,status) VALUES('browser-mentor','Professora de teste','','teacher','teacher','approved')").run();
  sql.prepare("INSERT INTO accounts(user_id,login_id,password_hash,created) VALUES('browser-mentor','TF-BROWSER-MENTOR',?,?)").run(hash,Date.now());
  sql.prepare("INSERT INTO classes(id,name,teacher,code) VALUES('browser-class','Turma do navegador','browser-mentor','BROWSER-CLASS')").run();
  sql.prepare("UPDATE profiles SET class_id='browser-class' WHERE id=?").run(fixtureUser);

  const previousHeaders = globalThis.testHeaders;
  const previousLegacyUser = globalThis.legacyUser;
  globalThis.legacyUser = null;
  let serverCookie = (await auth.issueSession('owner')).split(';')[0];
  let serial = Promise.resolve();
  const requests = [], failures = [], pageErrors = [], blockedOrigins = [];
  const browser = await chromium.launch({headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge'});
  const context = await browser.newContext({viewport: {width: 1280, height: 900}, serviceWorkers: 'block'});
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));

  await context.addInitScript(() => {
    window.__authClipboardTest = {mode: 'success', value: null, modernCalls: 0, fallbackCalls: 0};
    const clipboard = {
      async writeText(value) {
        const state = window.__authClipboardTest;
        state.modernCalls++;
        if (state.mode !== 'success') throw new DOMException('Fixture clipboard permission denied', 'NotAllowedError');
        state.value = String(value);
      },
    };
    Object.defineProperty(navigator, 'clipboard', {configurable: true, get() {
      return window.__authClipboardTest.mode === 'absent' ? undefined : clipboard;
    }});
    document.execCommand = command => {
      const state = window.__authClipboardTest;
      state.fallbackCalls++;
      if (command !== 'copy' || !['fallback', 'absent'].includes(state.mode)) return false;
      const field = document.activeElement;
      state.value = typeof field?.value === 'string'
        ? field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? field.value.length)
        : window.getSelection()?.toString() || '';
      return true;
    };
  });

  async function handleApi(intercept) {
    const request = intercept.request(), url = new URL(request.url());
    const headers = new Headers(await request.allHeaders());
    headers.set('cookie', serverCookie);
    headers.set('cf-connecting-ip', '192.0.2.80');
    if (request.method() === 'POST') headers.set('origin', target.origin);
    globalThis.testHeaders = headers;
    const action = request.method() === 'POST' ? request.postDataJSON()?.action : null;
    const realRequest = new Request(request.url(), {
      method: request.method(), headers,
      ...(request.method() === 'POST' ? {body: request.postData()} : {}),
    });
    let response;
    if (url.pathname === '/api/auth') {
      response = request.method() === 'POST' ? await authRoute.POST(realRequest) : await authRoute.GET();
    } else if (url.pathname === '/api/admin') {
      response = request.method() === 'POST' ? await admin.POST(realRequest) : await admin.GET();
    } else if(url.pathname === '/api/teacher') {
      response = await teacher.POST(realRequest);
    } else if(url.pathname === '/api/game') {
      response = request.method() === 'POST' ? await game.POST(realRequest) : await game.GET(realRequest);
    } else {
      failures.push(`Unexpected local API: ${request.method()} ${url.pathname}`);
      response = Response.json({error: 'Unexpected test API'}, {status: 501});
    }
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) serverCookie = setCookie.split(';')[0];
    requests.push({path: url.pathname, action, status: response.status});
    await intercept.fulfill({
      status: response.status,
      headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'},
      body: await response.text(),
    });
  }

  // Serialize handlers because they deliberately share testHeaders and the server cookie.
  await context.route('**/*', async intercept => {
    const url = new URL(intercept.request().url());
    if (url.origin !== target.origin) {
      blockedOrigins.push(url.origin);
      await intercept.abort('blockedbyclient');
      return;
    }
    if (!url.pathname.startsWith('/api/')) { await intercept.continue(); return; }
    const operation = serial.then(() => handleApi(intercept));
    serial = operation.catch(() => {});
    try { await operation; }
    catch {
      failures.push('Local API interception failed');
      await intercept.fulfill({status: 500, json: {error: 'Local test transport failed'}}).catch(() => {});
    }
  });

  const setClipboardMode = mode => page.evaluate(value => {
    Object.assign(window.__authClipboardTest, {mode: value, value: null, modernCalls: 0, fallbackCalls: 0});
  }, mode);
  const copiedValue = () => page.evaluate(() => window.__authClipboardTest.value);
  const showOwner = async () => {
    await serial;
    serverCookie = (await auth.issueSession('owner')).split(';')[0];
    await page.goto(target.origin, {waitUntil: 'domcontentloaded'});
    await page.getByRole('button', {name: 'Abrir painel do administrador', exact: true}).click();
    await page.getByRole('heading', {name: 'Administração', exact: true}).waitFor();
  };
  const resetFromUI = async () => {
    const row = page.getByRole('row').filter({hasText: fixtureLogin});
    await row.getByRole('button', {name: 'Redefinir senha', exact: true}).click();
    await page.getByRole('dialog').getByRole('button', {name: 'Criar senha temporária', exact: true}).click();
    await page.locator('#temporary-login').waitFor();
    await page.locator('#temporary-password').waitFor();
    assert.equal(await page.locator('#temporary-login').inputValue(), fixtureLogin);
    assert.equal((await page.locator('#temporary-password').inputValue()).length, 18);
  };
  const copyFromUI = async (kind, mode) => {
    const isPassword = kind === 'password';
    const field = page.locator(isPassword ? '#temporary-password' : '#temporary-login');
    const fieldContainer = field.locator('xpath=../..');
    const label = isPassword ? 'Copiar senha temporária' : 'Copiar ID de acesso';
    const status = isPassword ? 'Senha temporária copiada.' : 'ID de acesso copiado.';
    await setClipboardMode(mode);
    await page.getByRole('button', {name: label, exact: true}).click();
    await page.waitForFunction(expected => {
      const state = window.__authClipboardTest;
      return state.modernCalls === (expected === 'absent' ? 0 : 1)
        && state.fallbackCalls === (expected === 'success' ? 0 : 1)
        && (expected === 'manual' || typeof state.value === 'string');
    }, mode);
    if (mode === 'manual') {
      await fieldContainer.getByRole('alert').filter({hasText: 'A cópia automática não funcionou.'}).waitFor();
      const warning = await fieldContainer.getByRole('alert').filter({hasText: 'A cópia automática não funcionou.'}).innerText();
      assert.match(warning, /selecionad/i);
      assert.match(warning, /copie/i);
      assert.equal(await field.evaluate(input => document.activeElement === input && input.selectionStart === 0 && input.selectionEnd === input.value.length), true, 'Manual copy must select the complete credential');
      assert.equal(await copiedValue(), null, 'Denied clipboard must not claim a successful copy');
    } else {
      await fieldContainer.getByRole('status').filter({hasText: status}).waitFor();
      assert.ok(await copiedValue() === await field.inputValue(), 'Clipboard must contain the full displayed credential');
    }
    const counters = await page.evaluate(() => ({modern: window.__authClipboardTest.modernCalls, fallback: window.__authClipboardTest.fallbackCalls}));
    assert.equal(counters.modern, mode === 'absent' ? 0 : 1);
    assert.equal(counters.fallback, mode === 'success' ? 0 : 1);
    return copiedValue();
  };
  const closeAndLogout = async () => {
    await page.getByRole('dialog').getByRole('button', {name: 'Concluir', exact: true}).click();
    await page.getByRole('button', {name: 'Sair', exact: true}).click();
    await page.getByRole('heading', {name: 'Como você quer entrar?', exact: true}).waitFor();
  };
  const submitLogin = async (login, password) => {
    await page.locator('.role-options').getByRole('button').filter({hasText: 'Aluno'}).click();
    await page.locator('#login-id').fill(login);
    await page.locator('#login-password').fill(password);
    await page.locator('form').getByRole('button', {name: 'Entrar', exact: true}).click();
  };

  const choosePassword=async (temporary,password) => {
    await page.getByRole('heading',{name:'Escolha sua nova senha',exact:true}).waitFor();
    assert.equal(await page.locator('.app-shell').count(),0);
    await page.reload();
    await page.getByRole('heading',{name:'Escolha sua nova senha',exact:true}).waitFor();
    await page.locator('#current-password').fill(temporary);
    await page.locator('#new-password').fill(password);
    await page.locator('#new-password-confirm').fill('different-fixture-password');
    await page.getByRole('button',{name:'Salvar senha e continuar',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'As novas senhas precisam ser iguais.'}).waitFor();
    await page.locator('#new-password-confirm').fill(password);
    await page.getByRole('button',{name:'Salvar senha e continuar',exact:true}).click();
    await page.locator('.profile-chip').filter({hasText:fixtureName}).waitFor();
  };
  const showTeacher=async()=>{
    await serial;serverCookie=(await auth.issueSession('browser-mentor')).split(';')[0];
    await page.goto(target.origin,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Abrir painel do professor',exact:true}).click();
    await page.getByRole('heading',{name:'Aprendizagem em acompanhamento',exact:true}).waitFor();
  };
  try {
    await showOwner();
    await resetFromUI();
    const firstLogin = await copyFromUI('login', 'success');
    const firstPassword = await copyFromUI('password', 'success');
    await closeAndLogout();
    await submitLogin(firstLogin, firstPassword);
    await choosePassword(firstPassword,'first-chosen-browser-password');
    await page.locator('.profile-chip').filter({hasText: fixtureName}).waitFor();
    assert.equal(requests.filter(item => item.action === 'login').at(-1)?.status, 200);
    assert.ok(sql.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id=?').get(fixtureUser).n > 0);

    await showTeacher();
    await resetFromUI();
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id=?').get(fixtureUser).n, 0, 'A new reset must revoke the prior session');
    assert.ok(await page.locator('#temporary-password').inputValue() !== firstPassword, 'A second reset must issue a different password');
    await page.setViewportSize({width: 390, height: 844});
    for (const id of ['temporary-login', 'temporary-password']) {
      const box = await page.locator('#' + id).boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= 390, 'Credential fields must fit the mobile viewport');
    }
    for (const kind of ['login', 'password']) await copyFromUI(kind, 'manual');
    const secondLogin = await copyFromUI('login', 'fallback');
    const secondPassword = await copyFromUI('password', 'fallback');
    // Browsers without navigator.clipboard must use the same selected-field fallback.
    for (const kind of ['login', 'password']) await copyFromUI(kind, 'absent');
    // The modern API still works after an earlier denied attempt in the same dialog.
    await copyFromUI('password', 'success');
    await closeAndLogout();
    await submitLogin(firstLogin, firstPassword);
    await page.getByRole('alert').filter({hasText: 'ID ou senha incorretos.'}).waitFor();
    assert.equal(requests.filter(item => item.action === 'login').at(-1)?.status, 401);
    await submitLogin(secondLogin, secondPassword);
    await choosePassword(secondPassword,'second-chosen-browser-password');
    await page.getByRole('button',{name:'Sair',exact:true}).click();
    await submitLogin(secondLogin,'second-chosen-browser-password');
    await page.locator('.profile-chip').filter({hasText: fixtureName}).waitFor();
    assert.equal(requests.filter(item => item.action === 'login').at(-1)?.status, 200);
    assert.equal(requests.filter(item => item.action === 'resetPassword' && item.status === 200).length, 2);
    assert.deepEqual(failures, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(blockedOrigins, []);
    console.log('PASS: admin and teacher browser reset, required password choice/reload, personal password login, copied ID/password login, second reset invalidation, session revocation, clipboard success, denied/absent API fallback and selected manual-copy recovery.');
  } finally {
    await serial;
    await browser.close();
    globalThis.testHeaders = previousHeaders;
    globalThis.legacyUser = previousLegacyUser;
  }
}
