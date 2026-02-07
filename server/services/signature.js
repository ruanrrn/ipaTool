import { createWriteStream, readFileSync } from 'fs';
import JSZip from 'jszip';
import plist from 'plist';

export async function readZip(path){ const content = readFileSync(path); return await JSZip.loadAsync(content); }
export class SignatureClient{
  constructor(songList0,email){ this.archive=new JSZip(); this.filename=''; this.metadata={...songList0.metadata,'apple-id':email,userName:email,'appleId':email}; this.signature=songList0.sinfs.find(s=>s.id===0); if(!this.signature) throw new Error('Invalid signature.'); this.email=email; }
  async loadFile(path){ this.archive=await readZip(path); this.filename=path; }
  appendMetadata(){ const metadataPlist=plist.build(this.metadata); this.archive.file('iTunesMetadata.plist', Buffer.from(metadataPlist,'utf8')); return this; }
  async appendSignature(){ const manifestFile=this.archive.file(/\.app\/SC_Info\/Manifest\.plist$/)[0]; if(!manifestFile) throw new Error('Invalid app bundle.'); const manifestContent=await manifestFile.async('string'); const manifest=plist.parse(manifestContent||'<plist></plist>'); const sinfPath=manifest.SinfPaths?.[0]; if(!sinfPath) throw new Error('Invalid signature.'); const appBundleName=manifestFile.name.split('/')[1].replace(/\.app$/,''); const signatureTargetPath=`Payload/${appBundleName}.app/${sinfPath}`; this.archive.file(signatureTargetPath, Buffer.from(this.signature.sinf,'base64')); return this; }
  async write(){ const output=createWriteStream(this.filename); return new Promise((resolve,reject)=>{ this.archive.generateNodeStream({streamFiles:true,compression:'DEFLATE',compressionOptions:{level:9}}).pipe(output).on('finish',resolve).on('error',reject); }); }
}
