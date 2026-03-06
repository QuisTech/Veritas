import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA9oUgfhjdFhZ2K7AIkD1GAPGuXpIPZA-8",
  authDomain: "veritas-38225.firebaseapp.com",
  projectId: "veritas-38225",
  storageBucket: "veritas-38225.firebasestorage.app",
  messagingSenderId: "664280908713",
  appId: "1:664280908713:web:6ee00cf77a3a51faa7bab8",
  measurementId: "G-GNJC9X2JN9"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
