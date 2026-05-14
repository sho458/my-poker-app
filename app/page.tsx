"use client";

import React, { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, setDoc, getDoc, collection, deleteDoc } from "firebase/firestore";

export default function Home() {
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [initialChips, setInitialChips] = useState("2000"); // 初期値を2000に変更
  const [sb, setSb] = useState("30");
  const [bb, setBb] = useState("60");
  
  const [isJoined, setIsJoined] = useState(false);
  const [pot, setPot] = useState(0);
  const [players, setPlayers] = useState<any[]>([]);
  const [input, setInput] = useState('0');
  const [history, setHistory] = useState<string[]>([]);
  const [config, setConfig] = useState({ sb: 30, bb: 60, initialChips: 2000 }); // ここも2000に統一

  useEffect(() => {
    const savedName = localStorage.getItem("poker_name");
    const savedRoom = localStorage.getItem("poker_room");
    if (savedName) setPlayerName(savedName);
    
    const roomsCol = collection(db, "games");
    const unsubRooms = onSnapshot(roomsCol, (snap) => {
      setAvailableRooms(snap.docs.map(doc => doc.id));
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
        setConfig(data.config || { sb: 30, bb: 60, initialChips: 2000 });
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
      if (snap.exists()) return alert("そのルーム名は既に使用されています。");
      
      await setDoc(docRef, {
        pot: 0,
        players: [{ name: playerName, chips: parseInt(initialChips) }],
        config: { sb: parseInt(sb), bb: parseInt(bb), initialChips: parseInt(initialChips) },
        history: ["Room Created"]
      });
    } else {
      if (!snap.exists()) return alert("その部屋はもうありません");
      const data = snap.data();
      if (!data.players.some((p: any) => p.name === playerName)) {
        await updateDoc(docRef, {
          players: [...data.players, { name: playerName, chips: data.config?.initialChips || 2000 }]
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
    const docRef = doc(db, "games", roomId);
    const remainingPlayers = players.filter(p => p.name !== playerName);
    if (remainingPlayers.length === 0) {
      await deleteDoc(docRef);
    } else {
      await updateDoc(docRef, { players: remainingPlayers });
    }
    localStorage.removeItem("poker_room");
    setIsJoined(false);
  };

  const currentPlayer = players.find(p => p.name === playerName);

  const moveChips = async (amount: number, label: string) => {
    if (!currentPlayer || amount <= 0 || currentPlayer.chips < amount) return;
    const docRef = doc(db, "games", roomId);
    const snap = await getDoc(docRef);
    const updatedPlayers = players.map(p => 
      p.name === playerName ? { ...p, chips: p.chips - amount } : p
    );
    await updateDoc(docRef, {
      previousState: snap.data(),
      pot: pot + amount,
      players: updatedPlayers,
      history: [`${playerName}: ${label} (${amount})`, ...history].slice(0, 50)
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
      history: [`${playerName}: Win Pot (${pot})`, ...history].slice(0, 50)
    });
  };

  // チップ数を直接編集する機能
  const handleEditChips = async (targetName: string, currentAmount: number) => {
    const val = prompt(`${targetName} のチップ数を修正しますか？`, String(currentAmount));
    if (val === null || isNaN(parseInt(val))) return;
    
    const docRef = doc(db, "games", roomId);
    const updatedPlayers = players.map(p => 
      p.name === targetName ? { ...p, chips: parseInt(val) } : p
    );
    await updateDoc(docRef, {
      players: updatedPlayers,
      history: [`${playerName}: Edit ${targetName} to ${val}`, ...history].slice(0, 50)
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 w-full">
        <h1 className="text-3xl font-bold mb-8 italic text-orange-500 tracking-tighter text-center">POKER CHIP TOOL</h1>
        <div className="w-full max-w-sm space-y-6">
          <input type="text" placeholder="Your Name" className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl w-full text-center text-xl shadow-inner" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
          <div className="space-y-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest text-center font-bold">既存のルームに参加</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {availableRooms.length > 0 ? (
                availableRooms.map(r => (
                  <button key={r} onClick={() => handleJoin('join', r)} className="bg-zinc-800 hover:bg-zinc-700 w-full p-4 rounded-xl font-bold flex justify-between items-center transition-all active:scale-95">
                    <span>{r}</span>
                    <span className="text-orange-500 text-xs">JOIN →</span>
                  </button>
                ))
              ) : (
                <div className="text-center py-4 bg-zinc-900/30 rounded-xl border border-zinc-800/20 text-zinc-600 text-sm italic">稼働中のルームはありません</div>
              )}
            </div>
          </div>
          <div className="pt-6 border-t border-zinc-800 space-y-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest text-center font-bold">新しくルームを作る</p>
            <input type="text" placeholder="New Room Name" className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl w-full text-center" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800 text-center"><label className="block text-[8px] text-zinc-500 uppercase mb-1">SB</label><input type="number" className="bg-transparent w-full text-center font-bold text-sm" value={sb} onChange={(e) => setSb(e.target.value)} /></div>
              <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800 text-center"><label className="block text-[8px] text-zinc-500 uppercase mb-1">BB</label><input type="number" className="bg-transparent w-full text-center font-bold text-sm" value={bb} onChange={(e) => setBb(e.target.value)} /></div>
              <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800 text-center"><label className="block text-[8px] text-zinc-500 uppercase mb-1">Buy-in</label><input type="number" className="bg-transparent w-full text-center font-bold text-sm" value={initialChips} onChange={(e) => setInitialChips(e.target.value)} /></div>
            </div>
            <button onClick={() => handleJoin('create')} className="bg-orange-600 hover:bg-orange-500 w-full p-4 rounded-xl font-bold transition-all active:scale-95">CREATE & ENTER</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white p-4 w-full mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-tighter">Room: {roomId} (SB:{config.sb}/BB:{config.bb})</span>
        <button onClick={handleReset} className="text-[10px] text-red-500 border border-red-900/30 px-2 py-1 rounded hover:bg-red-950 transition-colors">EXIT</button>
      </div>

      {/* POT DISPLAY */}
      <div className="flex-1 flex flex-col justify-end pb-4 text-right">
        <div className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Current Pot</div>
        <div className="text-7xl font-light mb-6 tracking-tighter">{pot.toLocaleString()}</div>
        
        {/* PLAYER LIST */}
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-4 shadow-2xl">
          {[...players].sort((a, b) => b.chips - a.chips).map((p, i) => (
            <button 
              key={i} 
              onClick={() => handleEditChips(p.name, p.chips)}
              className={`w-full flex justify-between items-center py-2 ${p.name === playerName ? 'text-orange-400 font-bold' : 'text-zinc-400'} active:bg-white/5 rounded-lg transition-colors`}
            >
              <span className="text-sm">{p.name} {p.name === playerName && "★"}</span>
              <span className="font-mono text-lg">{p.chips.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* INPUT */}
      <div className="text-right text-4xl mb-2 pr-2 font-mono text-orange-500 h-12 flex items-center justify-end">
        {parseInt(input) > 0 ? parseInt(input).toLocaleString() : ""}
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <button onClick={() => moveChips(config.sb, "SB")} className="bg-zinc-800 rounded-xl py-4 text-xs font-bold active:bg-zinc-700">SB ({config.sb})</button>
        <button onClick={() => moveChips(config.bb, "BB")} className="bg-zinc-800 rounded-xl py-4 text-xs font-bold active:bg-zinc-700">BB ({config.bb})</button>
        <button onClick={() => currentPlayer && setInput(String(currentPlayer.chips))} className="bg-zinc-800 rounded-xl py-4 text-xs font-bold text-red-400 active:bg-zinc-700">MAX</button>
        <button onClick={() => setInput('0')} className="bg-zinc-700 rounded-xl py-4 text-xs font-bold active:bg-zinc-600">AC</button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={() => moveChips(parseInt(input), "Bet/Call")} className="bg-orange-500 rounded-2xl h-16 font-black text-xl active:scale-95 transition-all">BET / CALL</button>
        <button onClick={handleWin} className="bg-orange-700 rounded-2xl h-16 font-black text-xl active:scale-95 transition-all">WIN POT</button>
      </div>

      {/* TEN KEYPAD */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button key={num} onClick={() => setInput(prev => prev === '0' ? String(num) : prev + num)} className="bg-zinc-900 border border-zinc-800/50 rounded-2xl h-12 text-xl active:bg-zinc-800">{num}</button>
        ))}
        <button onClick={handleUndo} className="bg-zinc-800/50 text-zinc-500 rounded-2xl h-12 text-xs font-bold active:bg-zinc-700">UNDO ↩︎</button>
        <button onClick={() => setInput(prev => prev === '0' ? '0' : prev + '0')} className="bg-zinc-900 border border-zinc-800/50 rounded-2xl h-12 text-xl active:bg-zinc-800">0</button>
      </div>

      {/* HISTORY LOG AREA */}
      <div className="bg-zinc-900/20 border-t border-zinc-800/50 -mx-4 px-4 py-3">
        <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-2 font-bold">Recent History</p>
        <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
          {history.length > 0 ? (
            history.map((log, i) => (
              <div key={i} className="text-[10px] text-zinc-500 font-mono flex justify-between border-b border-zinc-800/30 pb-1 last:border-0">
                <span>{log.split(':')[0]}</span>
                <span className="text-zinc-400">{log.split(':')[1]}</span>
              </div>
            ))
          ) : (
            <p className="text-[10px] text-zinc-700 italic">No actions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}