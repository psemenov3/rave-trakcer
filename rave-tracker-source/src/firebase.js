import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

// NOTE: For a Firebase web app these values are public by design — they are
// NOT secrets. What actually protects your data are the Realtime Database
// security rules (see database.rules.json).
const firebaseConfig = {
  apiKey: 'AIzaSyBvzEb8ezwKsp2xuWjprc6P7Sf7j8YnzEk',
  authDomain: 'rave-tracker-c0f53.firebaseapp.com',
  databaseURL: 'https://rave-tracker-c0f53-default-rtdb.firebaseio.com',
  projectId: 'rave-tracker-c0f53',
  storageBucket: 'rave-tracker-c0f53.firebasestorage.app',
  messagingSenderId: '429391342037',
  appId: '1:429391342037:web:4794686b52a0fc8b9ef55c',
}

export const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
