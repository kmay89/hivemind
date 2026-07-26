// HIVEMIND — the hive mailbox.
//
// The ONLY server-side code in this project, and it is deliberately tiny: an
// ephemeral pigeonhole where a host can leave a WebRTC offer under a four-letter
// code and a joiner can pick it up and leave an answer back. Nothing about the
// game passes through here — no colony state, no saves, no accounts. Once the
// two devices shake hands they talk peer-to-peer and this forgets them.
//
// Why it exists: a WebRTC handshake is ~600 characters (DTLS fingerprint + ICE
// credentials) and cannot be shortened into something a person types, and a
// browser has no way to discover games on the local network. A rendezvous point
// is the only way to get "type BUZZ and you're in". The game still works with
// this unreachable — index.html falls back to the paste/QR handshake (see
// docs/MULTIPLAYER.md), which is what happens on file:// and offline.
//
// Everything expires after ROOM_TTL. Nothing is ever written that a player
// didn't put on screen themselves (a hive name and a keeper name).
import { getStore } from '@netlify/blobs';

const ROOM_TTL = 8 * 60 * 1000;    // a lobby that nobody joins fades in 8 minutes
const MAX_ROOMS = 60;              // ceiling on a listing sweep, not on the world
const MAX_SLOTS = 12;              // 8 keepers + churn
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I/O — they read as 1/0 out loud
const SDP_MAX = 8000;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const clean = (s, n) => String(s == null ? '' : s).replace(/[<>&"']/g, '').trim().slice(0, n);
const isCode = c => /^[A-Z]{4}$/.test(c || '');
const isSdp = s => typeof s === 'string' && s.length > 40 && s.length < SDP_MAX && s.indexOf('v=0') === 0;

export default async (req) => {
  let store;
  try { store = getStore({ name: 'hive-rooms', consistency: 'strong' }); }
  catch (e) { return json({ error: 'mailbox unavailable' }, 503); }

  const url = new URL(req.url);
  const a = url.searchParams.get('a') || '';
  const now = Date.now();

  const readRoom = async (code) => {
    if (!isCode(code)) return null;
    const r = await store.get(code, { type: 'json' }).catch(() => null);
    if (!r || now - r.t > ROOM_TTL) return null;
    return r;
  };
  const writeRoom = async (code, room) => {
    room.t = now;
    await store.setJSON(code, room);
  };
  const body = async () => {
    try { return await req.json(); } catch (e) { return {}; }
  };

  // ---- list: the waiting hives, freshest first ----
  if (a === 'list') {
    const { blobs } = await store.list().catch(() => ({ blobs: [] }));
    const out = [];
    for (const b of blobs.slice(0, MAX_ROOMS)) {
      const r = await store.get(b.key, { type: 'json' }).catch(() => null);
      if (!r) continue;
      if (now - r.t > ROOM_TTL) { store.delete(b.key).catch(() => {}); continue; }
      if (r.started) continue;
      if (!r.slots.some(s => !s.claimed)) continue;   // full — nowhere to put a newcomer
      out.push({ code: b.key, name: r.name, host: r.host, keepers: r.keepers, age: Math.round((now - r.born) / 1000) });
    }
    out.sort((x, y) => x.age - y.age);
    return json({ rooms: out.slice(0, 12) });
  }

  // ---- host: claim a code and leave the first offer ----
  if (a === 'host') {
    const b = await body();
    if (!isSdp(b.offer)) return json({ error: 'bad offer' }, 400);
    const host = clean(b.host, 16) || 'A keeper';
    const name = clean(b.name, 28) || 'A hive';
    let code = null;
    for (let i = 0; i < 8 && !code; i++) {
      let c = ''; for (let k = 0; k < 4; k++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)];
      const taken = await store.get(c, { type: 'json' }).catch(() => null);
      if (!taken || now - taken.t > ROOM_TTL) code = c;
    }
    if (!code) return json({ error: 'the hives are crowded — try again' }, 503);
    await writeRoom(code, { born: now, host, name, keepers: 1, started: false, seq: 1,
      slots: [{ id: 1, offer: b.offer, claimed: false, answer: null }] });
    return json({ code });
  }

  // ---- offer: the host keeps one free pigeonhole waiting at all times ----
  if (a === 'offer') {
    const b = await body();
    const room = await readRoom(b.code);
    if (!room) return json({ error: 'that hive has flown' }, 404);
    if (!isSdp(b.offer)) return json({ error: 'bad offer' }, 400);
    room.slots = room.slots.filter(s => !s.taken).slice(-MAX_SLOTS);
    room.seq = (room.seq || 0) + 1;
    room.slots.push({ id: room.seq, offer: b.offer, claimed: false, answer: null });
    await writeRoom(b.code, room);
    return json({ slot: room.seq });
  }

  // ---- join: take the waiting offer, hold the pigeonhole ----
  if (a === 'join') {
    const b = await body();
    const code = (b.code || '').toUpperCase();
    const room = await readRoom(code);
    if (!room) return json({ error: 'No hive by that name — check the code with your host.' }, 404);
    // a woken hive is hidden from the list but still joinable by code — the game
    // welcomes latecomers mid-year (see hostAdmitMidGame in index.html)
    const slot = room.slots.find(s => !s.claimed);
    if (!slot) return json({ error: 'That hive is full up.' }, 409);
    slot.claimed = true; slot.who = clean(b.name, 16) || 'A keeper';
    await writeRoom(code, room);
    return json({ slot: slot.id, offer: slot.offer, name: room.name, host: room.host });
  }

  // ---- answer: the joiner leaves their half of the handshake ----
  if (a === 'answer') {
    const b = await body();
    const code = (b.code || '').toUpperCase();
    const room = await readRoom(code);
    if (!room) return json({ error: 'that hive has flown' }, 404);
    if (!isSdp(b.answer)) return json({ error: 'bad answer' }, 400);
    const slot = room.slots.find(s => s.id === b.slot);
    if (!slot) return json({ error: 'that pigeonhole is gone' }, 404);
    slot.answer = b.answer;
    await writeRoom(code, room);
    return json({ ok: true });
  }

  // ---- poll: the host collects answers left since last time ----
  if (a === 'poll') {
    const room = await readRoom(url.searchParams.get('code'));
    if (!room) return json({ error: 'that hive has flown' }, 404);
    const fresh = room.slots.filter(s => s.answer && !s.taken);
    if (fresh.length) {
      for (const s of fresh) s.taken = true;
      room.keepers = Math.min(8, (room.keepers || 1) + fresh.length);
      await writeRoom(url.searchParams.get('code'), room);
    }
    return json({ answers: fresh.map(s => ({ slot: s.id, answer: s.answer, who: s.who || 'A keeper' })),
      keepers: room.keepers, free: room.slots.filter(s => !s.claimed).length });
  }

  // ---- close: the hive woke, or the host went home ----
  if (a === 'close') {
    const b = await body();
    const code = (b.code || '').toUpperCase();
    if (!isCode(code)) return json({ error: 'bad code' }, 400);
    if (b.started) { const room = await readRoom(code);
      if (room) { room.started = true; await writeRoom(code, room); } }
    else await store.delete(code).catch(() => {});
    return json({ ok: true });
  }

  return json({ error: 'unknown request' }, 400);
};

export const config = { path: '/api/hive' };
