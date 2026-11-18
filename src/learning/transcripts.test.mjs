import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildTimeline, blockAt, planSwitch, transcriptBlocks, validateRelationships} from "./core.mjs";
const source = JSON.parse(fs.readFileSync(new URL("./lesson.json", import.meta.url)));
const audio = JSON.parse(fs.readFileSync(new URL("./audio.transcript.json", import.meta.url))).segments;
const video = JSON.parse(fs.readFileSync(new URL("./video.transcript.json", import.meta.url))).segments;
const lesson = {...source, transcripts:{audio,video}};
test("both transcript tracks validate",()=>assert.doesNotThrow(()=>validateRelationships(lesson)));
test("audio and video text remain separate at the same second",()=>{
 const a=blockAt(buildTimeline(lesson.blocks,"audio",lesson.transcripts),64);
 const v=blockAt(buildTimeline(lesson.blocks,"video",lesson.transcripts),64);
 assert.equal(a,"seg_20"); assert.equal(v,"v029"); assert.notEqual(a,v);
});
test("highlight clears in pauses and at the end",()=>{
 const timeline=buildTimeline(lesson.blocks,"audio",lesson.transcripts);
 assert.equal(blockAt(timeline,4),null);
 assert.equal(blockAt(timeline,4.16),"seg_1");
 assert.equal(blockAt(timeline,204.16),null);
});
test("a missing transcript timestamp is not borrowed from another format",()=>{
 const partial={...source,transcripts:{audio:[{id:"a",start:1,end:2,text:"Only audio"}]}};
 const videoTimeline=buildTimeline(source.blocks,"video",partial.transcripts);
 assert.equal(blockAt(videoTimeline,1),null);
});
test("switch restores destination bookmark, not transcript boundary",()=>{
 const result=planSwitch("video","audio",{position:139,playing:true},{audio:{position:72,updatedAt:"old"}},"now");
 assert.deepEqual(result.destination,{format:"audio",position:72,shouldPlay:true});
 assert.equal(result.progress.video.position,139);
});
test("paused state and zero destination bookmark survive switching",()=>{
 assert.deepEqual(planSwitch("audio","video",{position:72,playing:false},{},"now").destination,
 {format:"video",position:0,shouldPlay:false});
});
test("click target is the displayed track's own time",()=>{
 const blocks=transcriptBlocks(lesson,"audio");
 assert.equal(blocks.find(b=>b.id==="seg_20").timestamps.audio,63.88);
 assert.equal(blocks.find(b=>b.id==="seg_20").timestamps.video,undefined);
});
test("unordered and overlapping transcript ranges are rejected",()=>{
 const bad={...lesson,transcripts:{audio:[{id:"one",start:0,end:5,text:"one"},{id:"two",start:4,end:6,text:"two"}]}};
 assert.throws(()=>validateRelationships(bad),/range/);
});
test("duplicate transcript IDs and empty text are rejected",()=>{
 assert.throws(()=>validateRelationships({...lesson,transcripts:{audio:[{id:"a",start:0,end:1,text:"a"},{id:"a",start:1,end:2,text:"b"}]}}),/ID/);
 assert.throws(()=>validateRelationships({...lesson,transcripts:{audio:[{id:"a",start:0,end:1,text:" "}]}}),/text/);
});
test("legacy start-only block timelines still work",()=>{
 assert.equal(blockAt(buildTimeline([{id:"old",timestamps:{video:3}}],"video"),100),"old");
});
