"use client";

import React, { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";

export default function Home() {
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [initialChips, setInitialChips] = useState("10000");
  const [sb, setSb] = useState("30");
  const [bb, setBb] = useState("60");
  
  const [isJoined, setIsJoined] = useState(false);
  const [pot, setPot] = useState(0);
  const [players, setPlayers] = useState<any[]>([]);
  const [input, setInput] = useState('0');
  const [history, setHistory] = useState<string[]>([]);
  const [config, setConfig] = useState({ sb: 30, bb: 60 });

  // 1. 初期化：ブラウザの記憶とルーム一覧の取得
  useEffect(() => {
    const savedName = localStorage.getItem("poker_name");
    const savedRoom = localStorage.getItem("poker_room");
    if (savedName) setPlayerName(savedName);
    
    // ルーム一覧をリアルタイムで取得
    const roomsCol = collection(db, "games");
    const unsubRooms = onSnapshot(roomsCol, (snap) => {
      const roomList = snap.docs.map(doc => doc.id);
      setAvailableRooms(roomList);
    });

   if (savedRoom && savedName) {
  setRoomId(savedRoom);
  startSync(savedRoom, savedName);
}
    return () => unsubRooms();
  }, []);

  const startSync = (rId: string, pName: string) => {
    const docRef = doc(db, "games", rId);
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPot(data.pot || 0);
        setPlayers(data.players || []);
        setHistory(data.history || []);
        setConfig(data.config || { sb: 30, bb: 60 });
        if (data.players?.some((p: any) => p.name === pName)) setIsJoined(true);
      }
    });
  };

  const handleJoin = async (mode: 'create' | 'join', selectedRoom?: string) => {
    const targetRoom = selectedRoom || roomId;
    if (!playerName || !targetRoom) return alert("名前とルーム名を確認してね");

    const docRef = doc(db, "games", targetRoom);
    const snap = await getDoc(docRef);

    if (mode === 'create') {
      await setDoc(docRef, {
        pot: 0,
        players: [{ name: playerName, chips: parseInt(initialChips) }],
        config: { sb: parseInt(sb), bb: parseInt(bb) },
        history: ["Room Created"]
      });
    } else {
      if (!snap.exists()) return alert("その部屋はもうありません");
      const data = snap.data();
      if (!data.players.some((p: any) => p.name === playerName)) {
        await updateDoc(docRef, {
          players: [...data.players, { name: playerName, chips: 10000 }] // 初期チップ
        });
      }
    }

    localStorage.setItem("poker_name", playerName);
    localStorage.setItem("poker_room", targetRoom);
    setRoomId(targetRoom);
    setIsJoined(true);
    startSync(targetRoom, playerName);
  };

  const handleReset = async () => {
    if (!confirm("ルームから退出しますか？")) return;
    localStorage.removeItem("poker_room");
    setIsJoined(false);
  };

  const currentPlayer = players.find(p => p.name === playerName);

  const moveChips = async (amount: number, label: string) => {
    if (!currentPlayer || currentPlayer.chips < amount) return;
    const docRef = doc(db, "games", roomId);
    const snap = await getDoc(docRef);
    const updatedPlayers = players.map(p => 
      p.name === playerName ? { ...p, chips: p.chips - amount } : p
    );
    await updateDoc(docRef, {
      previousState: snap.data(),
      pot: pot + amount,
      players: updatedPlayers,
      history: [`${playerName} ${label}: ${amount}`, ...history].slice(0, 10)
    });
    setInput('0');
  };

  const handleWin = async () => {
    if (!currentPlayer || pot === 0) return;
    const docRef = doc(db, "games", roomId);
    const snap = await getDoc(docRef);
    const updatedPlayers = players.map(p => 
      p.name === playerName ? { ...p, chips: p.chips + pot } : p
    );
    await updateDoc(docRef, {
      previousState: snap.data(),
      pot: 0,
      players: updatedPlayers,
      history: [`${playerName} Win: ${pot}`, ...history].slice(0, 10)
    });
  };

  const handleUndo = async () => {
    const docRef = doc(db, "games", roomId);
    const snap = await getDoc(docRef);
    const prevState = snap.data()?.previousState;
    if (prevState) await updateDoc(docRef, { ...prevState, previousState: null });
  };

  if (!isJoined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 font-sans">
        <h1 className="text-3xl font-bold mb-8 italic text-orange-500 tracking-tighter">POKER CHIP TOOL</h1>
        <div className="w-full max-w-sm space-y-6">
          <input type="text" placeholder="Your Name" className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl w-full text-center text-xl" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
          
          <div className="space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest text-center">既存のルームに参加</p>
            <div className="space-y-2">
              {availableRooms.length > 0 ? (
                availableRooms.map(r => (
                  <button key={r} onClick={() => handleJoin('join', r)} className="bg-zinc-800 hover:bg-zinc-700 w-full p-4 rounded-xl font-bold flex justify-between items-center transition-colors">
                    <span>{r}</span>
                    <span className="text-orange-500 text-xs">JOIN →</span>
                  </button>
                ))
              ) : (
                <div className="text-center py-4 bg-zinc-900/50 rounded-xl border border-zinc-800/30 text-zinc-600 text-sm italic">
                  現在稼働中のルームはありません
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-800 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest text-center">新しくルームを作る</p>
            <input type="text" placeholder="New Room Name" className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl w-full text-center" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                <label className="block text-[8px] text-zinc-500 text-center uppercase">SB Amount</label>
                <input type="number" className="bg-transparent w-full text-center font-bold" value={sb} onChange={(e) => setSb(e.target.value)} />
              </div>
              <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                <label className="block text-[8px] text-zinc-500 text-center uppercase">BB Amount</label>
                <input type="number" className="bg-transparent w-full text-center font-bold" value={bb} onChange={(e) => setBb(e.target.value)} />
              </div>
            </div>
            <button onClick={() => handleJoin('create')} className="bg-orange-600 hover:bg-orange-500 w-full p-4 rounded-xl font-bold transition-colors">CREATE & ENTER</button>
          </div>
        </div>
      </div>
    );
  }

  // (メイン画面のUIはVer 1.6と同じため省略... 必要に応じてVer 1.6のreturn部分をここに配置してください)
  return (
    <div className="flex flex-col min-h-screen bg-black text-white p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <span className="text-[10px] text-zinc-500 uppercase font-mono">Room: {roomId} (SB:{config.sb}/BB:{config.bb})</span>
        <button onClick={handleReset} className="text-[10px] text-red-500 border border-red-900/30 px-2 py-1 rounded">EXIT</button>
      </div>

      <div className="flex-1 flex flex-col justify-end pb-4 text-right">
        <div className="text-7xl font-light mb-6">{pot.toLocaleString()}</div>
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-4">
          {[...players].sort((a, b) => b.chips - a.chips).map((p, i) => (
            <div key={i} className={`flex justify-between items-center py-2 ${p.name === playerName ? 'text-orange-400 font-bold' : 'text-zinc-400'}`}>
              <span>{p.name} {p.name === playerName && "★"}</span>
              <span className="font-mono">{p.chips.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-right text-4xl mb-4 pr-2 font-mono text-orange-500 h-10">
        {parseInt(input) > 0 ? parseInt(input).toLocaleString() : ""}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <button onClick={() => moveChips(config.sb, "SB")} className="bg-zinc-800 rounded-xl py-4 text-xs font-bold active:scale-95 transition-transform">SB ({config.sb})</button>
        <button onClick={() => moveChips(config.bb, "BB")} className="bg-zinc-800 rounded-xl py-4 text-xs font-bold active:scale-95 transition-transform">BB ({config.bb})</button>
        <button onClick={() => currentPlayer && setInput(String(currentPlayer.chips))} className="bg-zinc-800 rounded-xl py-4 text-xs font-bold text-red-400">MAX</button>
        <button onClick={() => setInput('0')} className="bg-zinc-700 rounded-xl py-4 text-xs font-bold">AC</button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={() => moveChips(parseInt(input), "BET")} className="bg-orange-500 rounded-2xl h-20 font-black text-xl active:scale-95 transition-transform">BET / CALL</button>
        <button onClick={handleWin} className="bg-orange-700 rounded-2xl h-20 font-black text-xl active:scale-95 transition-transform">WIN POT</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button key={num} onClick={() => setInput(prev => prev === '0' ? String(num) : prev + num)} className="bg-zinc-900 border border-zinc-800/50 rounded-2xl h-14 text-2xl active:bg-zinc-800">{num}</button>
        ))}
        <button onClick={handleUndo} className="bg-zinc-800/50 text-zinc-500 rounded-2xl h-14 text-xs font-bold active:scale-95">UNDO ↩︎</button>
        <button onClick={() => setInput(prev => prev === '0' ? '0' : prev + '0')} className="bg-zinc-900 border border-zinc-800/50 rounded-2xl h-14 text-2xl active:bg-zinc-800">0</button>
      </div>
    </div>
  );
}