import test from "node:test";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
const { safeMessages } = await import("../server.js");
test("safeMessages accepts only valid chat messages", () => {
  assert.deepEqual(safeMessages([{role:"user",content:"hello"},{role:"system",content:"bad"},null]), [{role:"user",content:"hello"}]);
});
test("safeMessages limits retained history", () => assert.equal(safeMessages(Array.from({length:30},(_,i)=>({role:"user",content:String(i)}))).length,20));
