import { initializeApp, getApp, getApps } from "firebase/app";
import { getDatabase, ref, set, push, onValue, update } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { FileData } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyAlOICqCg9hdlIX-yKHTSH2skWfqAqSnXM",
  authDomain: "gen-lang-client-0972837952.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0972837952-default-rtdb.firebaseio.com",
  projectId: "gen-lang-client-0972837952",
  storageBucket: "gen-lang-client-0972837952.firebasestorage.app",
  messagingSenderId: "683423213216",
  appId: "1:683423213216:web:0dc223491b8d95fb2d4bc5",
  measurementId: "G-HDLCS4MDKN"
};

// Singleton initialization pattern
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getDatabase(app);
export const storage = getStorage(app);

// Helper to upload a base64 or blob to Firebase Storage
export const uploadFileToCloud = async (fileData: FileData): Promise<string> => {
  try {
    const binary = atob(fileData.data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([array], { type: fileData.mimeType });
    const path = `bills/${Date.now()}_${fileData.fileName}`;
    const fileRef = storageRef(storage, path);
    
    await uploadBytes(fileRef, blob);
    return getDownloadURL(fileRef);
  } catch (error) {
    console.error("Storage upload error:", error);
    throw error;
  }
};

// Database Sync Helpers
export const syncOutlets = (callback: (outlets: any[]) => void) => {
  return onValue(ref(db, 'outlets'), (snapshot) => {
    const data = snapshot.val();
    callback(data ? Object.values(data) : []);
  });
};

export const syncRecords = (callback: (records: any[]) => void) => {
  return onValue(ref(db, 'records'), (snapshot) => {
    const data = snapshot.val();
    callback(data ? Object.values(data) : []);
  });
};

export const syncBills = (callback: (bills: any[]) => void) => {
  return onValue(ref(db, 'bills'), (snapshot) => {
    const data = snapshot.val();
    callback(data ? Object.values(data) : []);
  });
};

export const syncVendors = (callback: (vendors: any[]) => void) => {
  return onValue(ref(db, 'vendors'), (snapshot) => {
    const data = snapshot.val();
    callback(data ? Object.values(data) : []);
  });
};

export const syncCountries = (callback: (countries: any[]) => void) => {
  return onValue(ref(db, 'countries'), (snapshot) => {
    const data = snapshot.val();
    callback(data ? Object.values(data) : []);
  });
};