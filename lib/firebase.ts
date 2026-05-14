import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 余計なコメントや重複を削って、あなたの設定情報だけに整理しました
const firebaseConfig = {
  apiKey: "AIzaSyBjWYRZXOQZ5DT6onB4cA5cDn7fN_zAlcQ",
  authDomain: "my-porker-app.firebaseapp.com",
  projectId: "my-porker-app",
  storageBucket: "my-porker-app.firebasestorage.app",
  messagingSenderId: "792283170167",
  appId: "1:792283170167:web:71eb147b4c2c5d8227cd72",
  measurementId: "G-2KYV3PFZR3"
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// データベース（Firestore）をエクスポート
export const db = getFirestore(app);