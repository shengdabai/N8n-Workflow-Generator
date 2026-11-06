import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeWorkflowPath } from '../api/utils/safeWorkflowPath.ts';

test('downloads stay inside the generated directory including symlinks', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-path-test-'));
  const base = path.join(root, 'generated');
  try {
    await fs.mkdir(base);
    await fs.writeFile(path.join(base,'valid.json'), '{}');
    await fs.writeFile(path.join(root,'outside.json'), '{}');
    await fs.symlink(path.join(root,'outside.json'),path.join(base,'link.json'));
    assert.equal(await safeWorkflowPath(base,'valid.json'),await fs.realpath(path.join(base,'valid.json')));
    for(const name of ['../outside.json','..\\outside.json','link.json','missing.json','x.json\r\nBad: true','package.json/../outside.json']) {
      assert.equal(await safeWorkflowPath(base,name),null,name);
    }
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
