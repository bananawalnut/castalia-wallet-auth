import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createProviderProfileStore } from '../src/provider-profile-store.js'
const profile=(issuer='alpha')=>({schema:'castalia.provider-profile.v1',display_name:issuer,origins:['https://a.example','https://b.example'],membership:{protocol:'castalia.zenith-membership.v3',issuer_origin:`https://${issuer}.example`,roots:[{issuerId:issuer,keyId:'key',signatureSuite:'Ed25519',publicKey:(issuer==='alpha'?'ab':'cd').repeat(32)}]},presentations:[]})
function fixture(){let data:any;let id=0;const store=createProviderProfileStore({read:async()=>data,write:async v=>{data=structuredClone(v)},randomId:()=>`profile-${++id}`,digest:async s=>s,verifyMembership:async(c:any,roots:any,owner)=>{if(c.ownerPublicKey!==owner||!roots.some((r:any)=>r.issuerId===c.issuerId))throw Error('untrusted');return c}});return {store,get data(){return data},set data(v){data=v}}}
test('empty configuration; purposes, profiles and per-origin legacy selection stay separate',async()=>{
 const {store}=fixture();assert.deepEqual(await store.list('https://a.example'),[]);assert.deepEqual(await store.presentationPins(),[])
 const a=await store.approve(profile());const b=await store.approve(profile('beta'))
 await store.bindLegacy('https://a.example',a.id,a.revision);await store.bindLegacy('https://b.example',b.id,b.revision)
 assert.equal((await store.legacy('https://a.example')).id,a.id);assert.equal((await store.legacy('https://b.example')).id,b.id)
 await assert.rejects(store.legacy('https://c.example'))
 await store.remove(a.id,a.revision);await assert.rejects(store.legacy('https://a.example'));assert.equal((await store.legacy('https://b.example')).id,b.id)
})
test('two issuers with the same membership id coexist; revocation retains original proof bytes',async()=>{
 const f=fixture(),s=f.store,a=await s.approve(profile()),b=await s.approve(profile('beta'))
 const credential=(issuer:string)=>({schema:'castalia.zenith-membership-credential.v3',ownerPublicKey:'11'.repeat(32),membershipId:'22'.repeat(32),issuerId:issuer,issuerKeyId:'key'})
 await s.saveCredential(a.id,a.revision,credential('alpha'),'11'.repeat(32));await s.saveCredential(b.id,b.revision,credential('beta'),'11'.repeat(32))
 assert.equal((await s.credential(a.id,'https://a.example','11'.repeat(32))).issuerId,'alpha')
 await s.remove(a.id,a.revision);assert.equal(f.data.credentials.length,2);await assert.rejects(s.credential(a.id,'https://a.example','11'.repeat(32)))
 assert.equal((await s.credential(b.id,'https://a.example','11'.repeat(32))).issuerId,'beta')
})
test('stale edits, conflicting keys, absent purposes and scope expansion fail',async()=>{
 const {store:s}=fixture();const a=await s.approve(profile());await assert.rejects(s.remove(a.id,0))
 const collision:any=profile();collision.membership.roots[0].publicKey='ef'.repeat(32);await assert.rejects(s.approve(collision))
 await assert.rejects(s.bindLegacy('https://c.example',a.id,a.revision))
 await assert.rejects(s.saveCredential(a.id,0,{},'11'.repeat(32)))
 const update=await s.approve({...profile(),display_name:'renamed'},{id:a.id,expectedRevision:a.revision});assert.equal(update.id,a.id);assert.equal(update.revision,a.revision+1)
 await assert.rejects(s.saveCredential(a.id,a.revision,{},'11'.repeat(32)))
})
test('unknown persisted schema fails closed; identity replacement clears cached credentials and selections only',async()=>{
 const f=fixture();f.data={schema:'future'};await assert.rejects(f.store.list('https://a.example'))
 f.data=undefined;const a=await f.store.approve(profile());await f.store.bindLegacy('https://a.example',a.id,a.revision)
 await f.store.clearIdentity();assert.equal((await f.store.list('https://a.example')).length,1);await assert.rejects(f.store.legacy('https://a.example'))
})

test('credential digest survives Chrome storage property reordering but rejects changed bytes',async()=>{
 const f=fixture(),p=await f.store.approve(profile()),owner='11'.repeat(32)
 const credential={schema:'castalia.zenith-membership-credential.v3',ownerPublicKey:owner,membershipId:'22'.repeat(32),issuerId:'alpha',issuerKeyId:'key'}
 await f.store.saveCredential(p.id,p.revision,credential,owner)
 f.data.credentials[0].credential=Object.fromEntries(Object.entries(credential).reverse())
 assert.deepEqual(await f.store.credential(p.id,'https://a.example',owner),credential)
 f.data.credentials[0].credential.membershipId='33'.repeat(32)
 await assert.rejects(f.store.credential(p.id,'https://a.example',owner),/digest_mismatch/)
})
