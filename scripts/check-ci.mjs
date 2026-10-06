import {execFileSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {assertSourceIdentity,assertDistribution,verifyFixtureFiles} from './ci-contract.mjs'
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
if(process.argv[2]==='source')assertSourceIdentity({actual:git('rev-parse','HEAD'),expected:process.env.BUILDKITE_COMMIT,dirty:git('status','--porcelain')})
else if(process.argv[2]==='dist')assertDistribution(git('status','--porcelain','--untracked-files=all','--','dist'))
else if(process.argv[2]==='fixtures')await verifyFixtureFiles(process.cwd(),JSON.parse(await readFile(new URL('./fixture-digests.json',import.meta.url),'utf8')))
else throw new Error('unknown CI check')
