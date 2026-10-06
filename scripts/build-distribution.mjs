import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {lstat, mkdir, mkdtemp, readdir, readFile, rename, rm} from 'node:fs/promises'
import {join, resolve} from 'node:path'

const args=process.argv.slice(2)
if(args.length>1 || args.some(arg=>arg!=='--check'))throw new Error('usage: build-distribution.mjs [--check]')
const root=process.cwd(),dist=join(root,'dist'),staging=await mkdtemp(join(root,'.auth-dist-build-'))
const output=join(staging,'dist')

async function inventory(directory,prefix='',files=new Map()) {
 const stat=await lstat(directory)
 if(!stat.isDirectory() || stat.isSymbolicLink())throw new Error('distribution must be a real directory: '+directory)
 for(const entry of await readdir(directory,{withFileTypes:true})) {
  const path=join(directory,entry.name),name=prefix+entry.name
  if(entry.isDirectory())await inventory(path,name+'/',files)
  else if(entry.isFile())files.set(name,createHash('sha256').update(await readFile(path)).digest('hex'))
  else throw new Error('unsupported distribution entry: '+name)
 }
 return files
}

try {
 await mkdir(output)
 execFileSync(process.execPath,[resolve(root,'node_modules/typescript/bin/tsc'),'--project','tsconfig.build.json','--outDir',output],{cwd:root,stdio:'inherit'})
 if(args.includes('--check')) {
  const generated=await inventory(output)
  const recorded=await inventory(dist).catch(error=>{if(error.code==='ENOENT')return new Map();throw error})
  const differences=[]
  for(const name of [...recorded.keys()].sort())if(!generated.has(name))differences.push('obsolete: '+name)
  for(const [name,hash] of [...generated].sort(([a],[b])=>a.localeCompare(b))) {
   if(!recorded.has(name))differences.push('missing: '+name)
   else if(recorded.get(name)!==hash)differences.push('changed: '+name)
  }
  if(differences.length)throw new Error('Committed dist differs from clean build:\n'+differences.join('\n'))
  console.log('Complete clean distribution matches: '+generated.size+' files')
 } else {
  // Compilation must succeed before replacing the old generated tree. Staging
  // shares its filesystem so publication does not copy a partially built tree.
  await rm(dist,{recursive:true,force:true})
  await rename(output,dist)
 }
} finally {await rm(staging,{recursive:true,force:true})}
