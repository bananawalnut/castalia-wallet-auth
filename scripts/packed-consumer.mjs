import assert from 'node:assert/strict'
import {createHash,createPublicKey,verify} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
const require=createRequire(pathToFileURL(process.cwd()+'/consumer.cjs'))
const entry=require.resolve('@castalia/wallet-auth')
const api=await import(pathToFileURL(entry))
for(const name of ['createWalletAuthChallenge','verifyWalletPresentation','assertPresentationRequest','assertCredentialPresentation','parseProviderProfile','createProviderProfileStore'])assert.equal(typeof api[name],'function',name)
const profile=JSON.parse(await readFile(new URL('../fixtures/provider-profiles-v1.json',pathToFileURL(entry)),'utf8'))
assert.deepEqual(api.parseProviderProfile(profile),profile)
const v=JSON.parse(await readFile(new URL('../fixtures/credential-presentation-v2.json',pathToFileURL(entry)),'utf8'))
api.assertPresentationRequest(v.request,v.now);api.assertCredentialPresentation(v.expected_presentation,v.approved_at)
assert.equal(api.canonicalPresentationJson(v.request),v.canonical_request)
assert.equal(Buffer.from(api.credentialTranscript(v.request.credential.claims)).toString('hex'),v.credential_signing_bytes_hex)
assert.equal(Buffer.from(api.presentationTranscript(v.expected_presentation)).toString('hex'),v.presentation_signing_bytes_hex)
const pub=hex=>createPublicKey({key:Buffer.from('302a300506032b6570032100'+hex,'hex'),format:'der',type:'spki'})
assert(verify(null,api.credentialTranscript(v.request.credential.claims),pub(v.trust_config.pins[0].public_key),Buffer.from(v.request.credential.signature,'hex')))
assert(verify(null,api.presentationTranscript(v.expected_presentation),pub(v.expected_presentation.holder_public_key),Buffer.from(v.expected_presentation.signature,'hex')))
console.log('Isolated packed exports, fixture bytes and signatures verified')
