import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createLocalServer, APP_ID, HOST, PORT } from '../scripts/local-server.mjs';

function request(server, resource, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: HOST, port: server.address().port, path: resource, method }, (res) => {
      const chunks = [];
      res.on('data', (data) => chunks.push(data));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('local static server serves files safely on a test-only ephemeral port', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'job-library-server-'));
  const root = path.join(directory, 'public');
  await mkdir(root);
  const html = '<html lang="zh">投递素材库</html>';
  await writeFile(path.join(root, 'index.html'), html);
  await writeFile(path.join(root, 'app.js'), 'export const ready = true;');
  await writeFile(path.join(root, 'style.css'), 'body { color: blue; }');
  await writeFile(path.join(root, 'template.json'), '{"topic":"项目经历"}');
  await writeFile(path.join(directory, 'private.txt'), 'never serve outside root');
  const server = await createLocalServer({ root });
  server.listen(0, HOST);
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });

  await t.test('fixed production host and port are explicit', () => {
    assert.equal(HOST, '127.0.0.1');
    assert.equal(PORT, 4173);
    assert.notEqual(server.address().port, PORT);
  });
  await t.test('root and query serve UTF-8 index, HEAD omits body', async () => {
    const index = await request(server, '/?preview=1');
    assert.equal(index.status, 200);
    assert.equal(index.body, html);
    assert.match(index.headers['content-type'], /text\/html; charset=utf-8/);
    const head = await request(server, '/', 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.equal(Number(head.headers['content-length']), Buffer.byteLength(html));
  });
  await t.test('appropriate content types and no caching', async () => {
    for (const [resource, type] of [['/app.js', 'text/javascript'], ['/style.css', 'text/css'], ['/template.json', 'application/json']]) {
      const response = await request(server, resource);
      assert.equal(response.status, 200);
      assert.ok(response.headers['content-type'].startsWith(type));
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
    }
  });
  await t.test('health returns only application identity and process ID', async () => {
    const response = await request(server, '/health');
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.body), { app: APP_ID, pid: process.pid });
  });
  await t.test('unknown resources do not fall back to the application', async () => {
    assert.equal((await request(server, '/missing.js')).status, 404);
    assert.equal((await request(server, '/unknown-route')).status, 404);
  });
  await t.test('POST is rejected', async () => {
    const response = await request(server, '/health', 'POST');
    assert.equal(response.status, 405);
    assert.equal(response.headers.allow, 'GET, HEAD');
  });
  await t.test('traversal and malformed encodings are rejected', async () => {
    for (const resource of ['/../private.txt', '/%2e%2e/private.txt', '/..%2fprivate.txt', '/%5c..%5cprivate.txt', '/%00']) {
      const response = await request(server, resource);
      assert.equal(response.status, 403, resource);
      assert.ok(!response.body.includes('never serve outside root'));
    }
    assert.equal((await request(server, '/%zz')).status, 400);
  });
  await t.test('external symlink is not served', async (subtest) => {
    const outside = path.join(directory, 'outside');
    await mkdir(outside);
    await writeFile(path.join(outside, 'private.txt'), 'never serve outside root');
    try {
      // Directory junctions can be created without the file-symlink privilege on Windows.
      await symlink(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EACCES') {
        subtest.skip('This Windows account cannot create file symlinks.');
        return;
      }
      throw error;
    }
    assert.equal((await request(server, '/linked/private.txt')).status, 403);
  });
  await t.test('occupied port fails rather than picking another port', async () => {
    const conflicting = await createLocalServer({ root });
    const errorEvent = once(conflicting, 'error');
    conflicting.listen(server.address().port, HOST);
    const [error] = await errorEvent;
    assert.equal(error.code, 'EADDRINUSE');
    assert.equal(conflicting.listening, false);
  });
});
