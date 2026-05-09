import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  query,
  orderBy,
  getDocFromServer,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); // CRITICAL
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

export {
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  query,
  orderBy,
  getDocFromServer,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  deleteDoc,
};
