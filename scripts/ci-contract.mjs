import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
export function assertSourceIdentity({actual,expected,dirty}) {
 if(!/^[a-f0-9]{40}$/.test(expected)||actual!==expected||dirty)throw new Error('clean exact source revision required')
}
export function assertDistribution(status) { if(status.trim())throw new Error('generated dist is stale: '+status) }
export async function verifyFixtureFiles(root,manifest) {
 for(const [path,expected] of Object.entries(manifest)) {
  if(!/^[a-zA-Z0-9._/-]+$/.test(path)||path.includes('..')||!/^[a-f0-9]{64}$/.test(expected))throw new Error('invalid fixture inventory')
  if(createHash('sha256').update(await readFile(resolve(root,path))).digest('hex')!==expected)throw new Error('fixture digest mismatch: '+path)
 }
}
