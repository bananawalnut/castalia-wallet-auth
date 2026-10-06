import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { assertSourceIdentity, verifyFixtureFiles, assertDistribution } from '../scripts/ci-contract.mjs'
test('CI binds clean source to the exact requested commit', () => {
 const input={actual:'a'.repeat(40),expected:'a'.repeat(40),dirty:''};assert.doesNotThrow(()=>assertSourceIdentity(input))
 for(const changed of [{expected:'main'},{actual:'b'.repeat(40)},{dirty:' M src/index.ts'}]) assert.throws(()=>assertSourceIdentity({...input,...changed}))
})
test('fixture inventory rejects altered or missing files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'auth-fixture-gate-'))
 try {const data='synthetic vector';await writeFile(join(dir,'vector.json'),data);const manifest={'vector.json':createHash('sha256').update(data).digest('hex')};await verifyFixtureFiles(dir,manifest);await writeFile(join(dir,'vector.json'),'altered vector');await assert.rejects(verifyFixtureFiles(dir,manifest));await rm(join(dir,'vector.json'));await assert.rejects(verifyFixtureFiles(dir,manifest))}finally{await rm(dir,{recursive:true,force:true})}
})
test('generated distribution rejects modified, new and removed outputs',()=>{
 assert.doesNotThrow(()=>assertDistribution(''))
 for(const status of [' M dist/index.js','?? dist/new.js',' D dist/index.d.ts'])assert.throws(()=>assertDistribution(status))
})
