/* =========================================================================
   FIREBASE CONFIG
   -------------------------------------------------------------------------
   GANTI seluruh nilai di bawah dengan config Firebase project kamu sendiri.
   Cara mendapatkannya:
     1. Buka https://console.firebase.google.com -> pilih project kamu.
     2. Klik ikon gerigi (Project settings) di sidebar kiri atas.
     3. Scroll ke bagian "Your apps". Jika belum ada Web App, klik ikon
        </> untuk membuat satu (tidak perlu Firebase Hosting).
     4. Salin object firebaseConfig yang muncul, tempel nilainya di sini.

   Nilai-nilai ini AMAN untuk berada di kode client-side (bukan rahasia) —
   yang menjaga keamanan data adalah Firestore Security Rules, bukan
   config ini. Lihat penjelasan rules di akhir jawaban chat.
   ========================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7a6tqjkFglzwAcW9L3M5EF4MitBDU0MY",
  authDomain: "virtara-arcade.firebaseapp.com",
  projectId: "virtara-arcade",
  storageBucket: "virtara-arcade.firebasestorage.app",
  messagingSenderId: "399745551507",
  appId: "1:399745551507:web:a2bde5006cfd4c7dd79166",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);