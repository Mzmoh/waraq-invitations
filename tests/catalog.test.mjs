import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { templates, scene } from '../public/templates/index.js';

const categories=['general','ramadan','fitr','hajj','adha','wedding','baby','graduation'];
test('80 unique identities, compositions and motion recipes',()=>{
  assert.equal(templates.length,80);
  for(const key of ['id','titleEn','sceneComposition','animationSignature','preview','thumbnail']){
    assert.equal(new Set(templates.map(t=>t[key])).size,80,key);
  }
});
for(const category of categories){
  test(category+' has ten complete, reproducible vector covers and animated previews',async()=>{
    const group=templates.filter(t=>t.category===category);
    assert.equal(group.length,10);
    for(const t of group){
      assert.match(t.id,/^[a-z0-9-]+$/);
      const cover=await readFile(new URL('../public'+t.thumbnail,import.meta.url),'utf8');
      assert.equal(cover,scene(t,{staticCover:true}));
      const dynamic=scene(t);
      assert.match(dynamic,/prefers-reduced-motion/);
      assert.match(dynamic,/\.opened \.studio-art/);
      assert.ok(t.layers.length>=2);
      assert.ok(!dynamic.includes('undefined'));
      assert.deepEqual(Object.keys(t.colorTokens),['background','surface','accent','ink','muted']);
      assert.ok(t.supportedFields.includes('timeZone'));
      assert.equal(t.supportedFields.includes('bride'),category==='wedding');
      assert.equal(t.supportedFields.includes('graduate'),category==='graduation');
    }
  });
}

