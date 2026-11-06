import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import router from '../api/routes/workflowWithImage.ts';

test('invalid descriptions do not leave uploaded files behind', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'workflow-upload-test-'));
  const previous=process.cwd();process.chdir(root);
  const app=express();app.use(router);
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  try {
    for(const description of ['', 'short']){
      const body=new FormData();body.set('description',description);
      body.set('image',new Blob(['test-image-fixture'],{type:'image/png'}),'fixture.png');
      const response=await fetch(`http://127.0.0.1:${server.address().port}/generate-with-image`,{method:'POST',body});
      assert.equal(response.status,400);
      // Response is sent before the route finally finishes unlinking.
      for(let n=0;n<50;n++){
        if((await fs.readdir(path.join(root,'data/uploads'))).length===0)break;
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      assert.deepEqual(await fs.readdir(path.join(root,'data/uploads')),[]);
    }
  }finally{
    await new Promise(resolve=>server.close(resolve));process.chdir(previous);
    await fs.rm(root,{recursive:true,force:true});
  }
});
