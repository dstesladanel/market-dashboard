// נקודת כניסה אחת ל-Firebase. אין שלב build: הספרייה נטענת ישירות מה-CDN של גוגל.
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const configured = !firebaseConfig.apiKey.startsWith("PASTE");
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  initializeApp, deleteApp, getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, writeBatch
};
export { firebaseConfig };
