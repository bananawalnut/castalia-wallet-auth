import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseProviderProfile, providerProfileBytes, PROVIDER_PROFILE_CAPABILITIES } from '../src/provider-profiles.js'

const proposal = () => ({
  schema: 'castalia.provider-profile.v1', display_name: 'Independent provider',
  origins: ['https://app.example'],
  membership: { protocol: 'castalia.zenith-membership.v3', issuer_origin: 'https://issuer.example',
    roots: [{ issuerId: 'independent', keyId: 'key-1', signatureSuite: 'Ed25519', publicKey: 'ab'.repeat(32) }] },
  presentations: [],
})
test('neutral profile preserves the existing protocol without privileging the issuer', () => {
  const p = parseProviderProfile(proposal())
  assert.equal(p.membership?.roots[0].issuerId, 'independent')
  assert.deepEqual(p.presentations, [])
  assert(PROVIDER_PROFILE_CAPABILITIES.includes('registration_proposal_v2'))
  assert.equal(providerProfileBytes(p), providerProfileBytes({ ...p }))
})
test('trust purposes are independent and endpoints, origins and display are bounded', () => {
  for (const change of [
    (p: any) => p.extra = 'adapter.js',
    (p: any) => p.membership.issuer_origin = 'https://issuer.example/redirect',
    (p: any) => p.membership.issuer_origin = 'http://issuer.example',
    (p: any) => p.origins = ['https://*.example'],
    (p: any) => p.display_name = 'trusted\u202e',
    (p: any) => p.membership.roots[0].publicKey = 'AB'.repeat(32),
    (p: any) => p.membership.protocol = 'executable-adapter',
    (p: any) => p.origins.push(p.origins[0]),
    (p: any) => p.presentations = [{issuer:'i',key_id:'k',public_key:'ab'.repeat(32),audience:'a',callers:[{kind:'browser',id:'https://other.example'}]}],
  ]) { const p=proposal(); change(p); assert.throws(() => parseProviderProfile(p)) }
})
test('presentation-only and membership-only profiles cannot grant the other purpose', () => {
  const p:any=proposal(); p.membership=null
  assert.throws(()=>parseProviderProfile(p))
  p.presentations=[{issuer:'another',key_id:'key',public_key:'cd'.repeat(32),audience:'documents',callers:[{kind:'browser',id:p.origins[0]}]}]
  assert.equal(parseProviderProfile(p).membership,null)
  assert.throws(()=>parseProviderProfile({...p,presentations:[...p.presentations,...p.presentations]}))
})
test('no identity, credential or privilege can be installed by a profile', () => {
  for(const key of ['member_key','credential','controller','allow_signing','is_zenith','profile_id']) {
    assert.throws(()=>parseProviderProfile({...proposal(),[key]:'anything'}))
  }
  const p:any=proposal(); p.origins=new Array(2); assert.throws(()=>parseProviderProfile(p))
})
