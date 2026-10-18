import assert from 'node:assert/strict';
import {inside,clipSegment,distance,stitchRings,project} from '../scripts/geometry.mjs';

const square=[[0,0],[10,0],[10,10],[0,10],[0,0]];
const hole=[[4,4],[6,4],[6,6],[4,6],[4,4]];
assert.equal(inside([5,5],[[square,hole]]),false);
assert.equal(inside([2,5],[[square,hole]]),true);
const segments=clipSegment([-5,5],[15,5],[[square,hole]]);
assert.equal(segments.length,2);
assert.ok(Math.abs(segments.reduce((sum,segment)=>sum+distance(...segment),0)-8)<1e-8);
assert.equal(stitchRings([[[0,0],[1,0]],[[1,1],[1,0]],[[1,1],[0,0]]])[0].length,4);
assert.throws(()=>stitchRings([[[0,0],[1,0]]]),/Unclosed/);
const projected=project([100.54,13.73],[100.54,13.73]);
assert.ok(projected.every(value=>value===0));
console.log('Geometry checks passed: polygon holes, clipped lengths, reversed rings, invalid rings and projection origin.');
