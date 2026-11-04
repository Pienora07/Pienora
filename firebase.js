
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBFDvWbdmgiA3iPxwTEjAAoNARNHNMkzAc",
  authDomain: "nexastore-1287e.firebaseapp.com",
  projectId: "nexastore-1287e",
  storageBucket: "nexastore-1287e.firebasestorage.app",
  messagingSenderId: "635063814978",
  appId: "1:635063814978:web:d4aad9fca5d49297c8d6db",
  measurementId: "G-E0GMG54W9C"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
