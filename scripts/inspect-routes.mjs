import {readFile} from 'node:fs/promises';
import {project,distance} from './geometry.mjs';
for(const id of ['lumphini','benjakitti']){
 const geo=JSON.parse(await readFile(`data/processed/${id}.geojson`,'utf8'));
 const config=JSON.parse(await readFile('data/processed/park-config.json','utf8')).parks[id];
 const paths=geo.features.filter(f=>f.properties.layer==='path'&&!f.properties.bridge&&f.properties.foot!=='no'&&!['private','no'].includes(f.properties.access));
 console.log(id,JSON.stringify(paths.sort((a,b)=>b.properties.clipped_length_m-a.properties.clipped_length_m).slice(0,8).map(f=>({id:f.id,highway:f.properties.highway,name:f.properties.name,length:f.properties.clipped_length_m,segments:f.geometry.coordinates.length,first:project(f.geometry.coordinates[0][0],config.originWgs84)})),null,2));
}
