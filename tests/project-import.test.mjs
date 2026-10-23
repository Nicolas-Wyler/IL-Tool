import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { readProjectFile } from '../dist/project-import.js';
import { zipFiles } from '../dist/export-data.js';
import { parseSettings, serializeSettings } from '../dist/settings.js';

const state = { schemaVersion:3, autoFramingVersion:1, paletteVersion:1, presetVersion:'test', editMode:'pitch',
  wavelength:'3.1', workingDistance:'2000', gratingWidth:'80', rows:[{theta:'4.44',phase:'202.35',pitch:'40',efficiency:'.75',azimuth:'120',radius:'155.47',color:'#123abc',selected:false,angleSign:1}],
  view:'complex', fieldViewport:{zoom:2,x:10,y:-20}, layoutViewport:{zoom:1,x:0,y:0}, timeSeconds:1e-18, playbackSpeed:2, running:false,
  exportResolution:640, projectName:'Original', selectionMode:false };
const text = serializeSettings(state);
const zip = async (files, name='Example.zip') => new File([await zipFiles(files)],name,{type:'application/zip'});
const load = file => readProjectFile(file,parseSettings);
const project = {name:'Example.iltool',data:text};
const archive = await zip([{name:'image.png',data:'image bytes'}, project, {name:'metadata.json',data:'{}'}]);
assert.deepEqual(await load(archive),{name:'Example',settings:state});
assert.deepEqual(await load(new File([text],'Direct.iltool')),{name:'Direct',settings:state});
assert.deepEqual((await load(await zip([{name:'folder/PROJECT.ILTOOL',data:text}],'Renamed.ZIP'))).settings,state);
assert.equal((await load(await zip([project],'Name without extension'))).name,'Name without extension');
await assert.rejects(load(await zip([])),/no \.iltool/);
await assert.rejects(load(await zip([{name:'metadata.json',data:'{}'}])),/no \.iltool/);
await assert.rejects(load(await zip([{name:'__MACOSX/._Example.iltool',data:text}])),/no \.iltool/);
await assert.rejects(load(await zip([{name:'bad.iltool',data:'not JSON'}])),/No compatible/);
await assert.rejects(load(await zip([{name:'future.iltool',data:JSON.stringify({format:'IL Tool',version:99,settings:state})}])),/No compatible/);
assert.deepEqual((await load(await zip([{name:'Example.iltool',data:'invalid'}, {name:'nested/valid.iltool',data:text}]))).settings,state);
const other = serializeSettings({...state,wavelength:'13.5'});
assert.equal((await load(await zip([{name:'Other.iltool',data:other},project]))).settings.wavelength,'3.1');
await assert.rejects(load(new File(['not a zip'],'Broken.zip')),/invalid or damaged/);
const bytes = new Uint8Array(await archive.arrayBuffer());
await assert.rejects(load(new File([bytes.subarray(0,bytes.length-5)],'Truncated.zip')),/invalid or damaged/);
const corrupt = new Uint8Array(await (await zip([project])).arrayBuffer());
corrupt[30+new TextEncoder().encode(project.name).length+10]^=1;
await assert.rejects(load(new File([corrupt],'Corrupt.zip')),/No compatible/);
const encrypted = new Uint8Array(await (await zip([project])).arrayBuffer());
new DataView(encrypted.buffer).setUint16(6,0x801,true);
await assert.rejects(load(new File([encrypted],'Encrypted.zip')),/No compatible/);
await assert.rejects(load(await zip([{name:'Huge.iltool',data:new Uint8Array(10*1024*1024+1)}])),/No compatible/);

// Independent DEFLATE compression with a standard ZIP central directory.
const plain = new Uint8Array(await (await zip([project])).arrayBuffer());
const plainView = new DataView(plain.buffer), oldDirectory = plainView.getUint32(plain.length-6,true);
const dataStart = 30+new TextEncoder().encode(project.name).length;
const packed = deflateRawSync(text), local = plain.slice(0,dataStart), central = plain.slice(oldDirectory,-22), end = plain.slice(-22);
new DataView(local.buffer).setUint16(8,8,true);
new DataView(local.buffer).setUint32(18,packed.length,true);
new DataView(central.buffer).setUint16(10,8,true);
new DataView(central.buffer).setUint32(20,packed.length,true);
new DataView(end.buffer).setUint32(16,local.length+packed.length,true);
assert.deepEqual((await load(new File([local,packed,central,end],'Compressed.zip'))).settings,state);
const streamedLocal=local.slice(), streamedCentral=central.slice(), streamedEnd=end.slice(), descriptor=new Uint8Array(16);
const descriptorView=new DataView(descriptor.buffer);
descriptorView.setUint32(0,0x08074b50,true);
descriptorView.setUint32(4,new DataView(central.buffer).getUint32(16,true),true);
descriptorView.setUint32(8,packed.length,true);
descriptorView.setUint32(12,new TextEncoder().encode(text).length,true);
new DataView(streamedLocal.buffer).setUint16(6,0x808,true); streamedLocal.fill(0,14,26);
new DataView(streamedCentral.buffer).setUint16(8,0x808,true);
new DataView(streamedEnd.buffer).setUint32(16,local.length+packed.length+descriptor.length,true);
assert.deepEqual((await load(new File([streamedLocal,packed,descriptor,streamedCentral,streamedEnd],'Streaming.zip'))).settings,state);


// A real exported ZIP can be much larger than the project limit. Only read its
// directory and .iltool entry, not the image or matrix payloads.
const large = await zip([{name:'matrix.csv',data:new Uint8Array(12*1024*1024)},project]);
let readBytes = 0;
const tracked = {name:large.name,type:large.type,size:large.size,slice:(start,end)=>{readBytes+=end-start;return large.slice(start,end);}};
assert.deepEqual((await load(tracked)).settings,state);
assert.ok(readBytes<100000,`${readBytes} bytes read from a ${large.size} byte archive`);
console.log('Passed: stored/deflated ZIP import, nested and multiple projects, direct files, compatibility and CRC validation, malformed archives, and selective reads from large exports.');
