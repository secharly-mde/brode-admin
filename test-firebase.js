import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, orderBy } from "firebase/firestore";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const mes = "2026-07";
    const q = query(
      collection(db, "pedidos"),
      where("fecha", ">=", `${mes}-01`),
      where("fecha", "<=", `${mes}-31`),
      orderBy("fecha", "desc")
    );
    console.log("Fetching...");
    const snap = await getDocs(q);
    console.log("Success! Docs:", snap.docs.length);
  } catch (err) {
    console.error("Firebase Error:", err.message);
  }
}
test();
