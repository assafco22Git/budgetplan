import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDGFzMTCmZqVwMDOSnsNadG9a0OnNacqkw",
  authDomain: "budgetplan-1f19a.firebaseapp.com",
  projectId: "budgetplan-1f19a",
  storageBucket: "budgetplan-1f19a.firebasestorage.app",
  messagingSenderId: "1075130210824",
  appId: "1:1075130210824:web:ee7727442947106a5c4fbd"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
