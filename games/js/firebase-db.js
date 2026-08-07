/* =========================================================================
   FIREBASE DB LAYER
   -------------------------------------------------------------------------
   Semua interaksi Firestore terpusat di sini. File ini adalah ES module
   (dimuat dengan <script type="module">), lalu mengekspos hasilnya sebagai
   window.FirebaseDB dan window.__firebaseDBReady.
   ========================================================================= */

import { db } from './firebase-config.js';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, orderBy, limit, getDocs,
  runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

function usernameKey(username) {
  return username.trim().toLowerCase();
}

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomUniqueCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = n => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `VP-${seg(4)}-${seg(4)}`;
}

function defaultPlayerDoc(uuid, username) {
  return {
    uuid, username, avatar: null,
    level: 1, xp: 0, coin: 20,
    badges: [], achievements: [], gamesPlayed: [],
    collection: {}, pullCount: 0, bestCard: null,
    upgrades: { luck: 0, autoSpin: 0, animSpeed: 0, dailyBonus: 0 },
    lastDailyClaim: null,
    favoriteGame: null, favoriteCard: null, bestRank: null,
    stats: { quiz: {}, gacha: {}, tebakGambar: {}, memory: {}, tebakSiluet: {} },
    joinDate: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };
}

/** Throws Error('USERNAME_TAKEN') if the username is already registered. */
async function createAccount(username) {
  const trimmed = username.trim().slice(0, 24);
  if (trimmed.length < 3) throw new Error('TOO_SHORT');
  const key = usernameKey(trimmed);
  const uuid = crypto.randomUUID();
  const code = randomUniqueCode();
  const codeHash = await sha256Hex(code);
  const playerDoc = defaultPlayerDoc(uuid, trimmed);

  await runTransaction(db, async (tx) => {
    const uRef = doc(db, 'usernames', key);
    const uSnap = await tx.get(uRef);
    if (uSnap.exists()) throw new Error('USERNAME_TAKEN');
    tx.set(uRef, { uuid, username: trimmed });
    tx.set(doc(db, 'players', uuid), playerDoc);
    tx.set(doc(db, 'authcodes', uuid), { codeHash });
  });

  return { uuid, username: trimmed, code, player: playerDoc };
}

/** Throws Error('NOT_FOUND') or Error('BAD_CODE') on failure. */
async function login(username, code) {
  const key = usernameKey(username);
  const uSnap = await getDoc(doc(db, 'usernames', key));
  if (!uSnap.exists()) throw new Error('NOT_FOUND');
  const { uuid } = uSnap.data();

  const codeSnap = await getDoc(doc(db, 'authcodes', uuid));
  if (!codeSnap.exists()) throw new Error('NOT_FOUND');
  const hash = await sha256Hex(code.trim().toUpperCase());
  if (hash !== codeSnap.data().codeHash) throw new Error('BAD_CODE');

  await updateDoc(doc(db, 'players', uuid), { lastLogin: new Date().toISOString() });
  const pSnap = await getDoc(doc(db, 'players', uuid));
  return { uuid, player: pSnap.data() };
}

/** Rename an existing account's username, keeping the usernames/ index in sync. */
async function renameUsername(uuid, oldUsername, newUsername) {
  const trimmed = newUsername.trim().slice(0, 24);
  if (trimmed.length < 3) throw new Error('TOO_SHORT');
  const oldKey = usernameKey(oldUsername);
  const newKey = usernameKey(trimmed);
  if (oldKey === newKey) {
    await updateDoc(doc(db, 'players', uuid), { username: trimmed });
    return trimmed;
  }
  await runTransaction(db, async (tx) => {
    const newRef = doc(db, 'usernames', newKey);
    const newSnap = await tx.get(newRef);
    if (newSnap.exists()) throw new Error('USERNAME_TAKEN');
    tx.set(newRef, { uuid, username: trimmed });
    tx.delete(doc(db, 'usernames', oldKey));
    tx.update(doc(db, 'players', uuid), { username: trimmed });
  });
  return trimmed;
}

async function loadPlayer(uuid) {
  const snap = await getDoc(doc(db, 'players', uuid));
  return snap.exists() ? snap.data() : null;
}

async function savePlayer(uuid, data) {
  // Remove undefined values and ensure dates are strings
  const cleanData = JSON.parse(JSON.stringify(data));
  await setDoc(doc(db, 'players', uuid), cleanData, { merge: true });
}

async function submitScore(gameId, entry) {
  const ref = doc(db, 'leaderboard_' + gameId, entry.uuid);
  const snap = await getDoc(ref);
  if (!snap.exists() || entry.score > snap.data().score) {
    await setDoc(ref, { ...entry, date: new Date().toISOString() });
  }
}

async function getLeaderboard(gameId, top = 100) {
  try {
    const q = query(collection(db, 'leaderboard_' + gameId), orderBy('score', 'desc'), limit(top));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  } catch (err) {
    console.warn('Leaderboard query error (may need index):', err);
    // Fallback: get all and sort manually (slower, but works without index)
    const q = query(collection(db, 'leaderboard_' + gameId));
    const snap = await getDocs(q);
    const results = snap.docs.map(d => d.data());
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, top);
  }
}

// Export to window for ArcadeCore to use
const FirebaseDB = {
  defaultPlayerDoc, createAccount, login, renameUsername,
  loadPlayer, savePlayer, submitScore, getLeaderboard,
};

window.FirebaseDB = FirebaseDB;
window.__firebaseDBReady = true;

// Notify ArcadeCore that FirebaseDB is ready
if (window.ArcadeCore && window.ArcadeCore.setFirebaseDB) {
  window.ArcadeCore.setFirebaseDB(FirebaseDB);
  console.log('✅ FirebaseDB connected to ArcadeCore');
}

// Signal readiness to classic (non-module) scripts loaded after this one.
if (window.__resolveFirebaseReady) {
  window.__resolveFirebaseReady();
}
console.log('🔥 FirebaseDB initialized and ready');