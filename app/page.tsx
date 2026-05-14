"use client";

import React, { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, setDoc, arrayUnion } from "firebase/firestore";

export default function Home() {
  const [playerName, setPlayerName] = useState("");
  const [initialChipsInput, setInitialChipsInput] = useState("10000");
  const [sbInput, setSbInput] = useState("30"); // デフォルトSB
  const [bbInput, setBbInput] = useState("60"); // デフォルトBB
  const [isJoined, setIsJoined] = useState(false);
  const [pot, setPot] = useState(0);
  const [players, setPlayers] = useState<any[]>([]);
  const [input, setInput] = useState('0');
  const [history, setHistory] = useState<string[]>([]);
  const [tableConfig, setTableConfig] = useState({ sb: 30, bb: 60 });

  const gameDocRef = doc(db, "games", "table1");

  useEffect(() => {
    const savedName = localStorage.getItem("poker_player_name");
    if (savedName) setPlayerName(savedName);

    const unsub = onSnapshot(gameDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentPlayers = data.players || [];
        setPot(data.pot || 0);
        setPlayers(currentPlayers);
        setHistory(data.history || []);
        setTableConfig(data.config || { sb: 30, bb: 60 });

        if (savedName && currentPlayers.some((p: any) => p.name === savedName)) {
          setIsJoined(true);
        } else {
          setIsJoined(false);
        }
      } else {
        setDoc(gameDocRef, { pot: 0, players: [], history: [], config: { sb: 30, bb: 60 } });
      }
    });
    return () => unsub();
  }, []);

  // 状態保存（Undo用）
  const saveForUndo = async () => {
    const currentData = { pot, players, history };
    await updateDoc(gameDocRef, { previousState: currentData });
  };

  const handleJoin = async () => {
    if (!playerName) return;
    const isAlreadyInList = players.some(p => p.name === playerName);
    if (!isAlreadyInList) {
      await updateDoc(gameDocRef, {
        players: arrayUnion({ name: playerName, chips: parseInt(initialChipsInput) || 10000 }),
        config: { sb: parseInt(sbInput), bb: parseInt(bbInput) }
      });
    }
    localStorage.setItem("poker_player_name", playerName);
    setIsJoined(true);
  };

  const handleReset = async () => {
    if (!confirm("全員消去してリセットしますか？")) return;
    localStorage.removeItem("poker_player_name");
    await updateDoc(gameDocRef, { pot: 0, players: [], history: ["Reset"], previousState: null });
  };

  const handleUndo = async () => {
    const docSnap = await (await import("firebase/firestore")).getDoc(gameDocRef);
    const prevState = docSnap.data()?.previousState;
    if (prevState) {
      await updateDoc(gameDocRef, { ...prevState, previousState: null });
    } else {
      alert("戻れる履歴がありません");
    }
  };

  const currentPlayer = players.find(p => p.name === playerName);

  // チップを動かす共通処理
  const moveChips = async (amount: number, label: string) => {
    if (!currentPlayer || currentPlayer.chips < amount) return;
    await saveForUndo();
    const updatedPlayers = players.map(p => 
      p.name === playerName ? { ...p, chips: p.chips - amount } : p
    );
    await updateDoc(gameDocRef, {
      pot: pot + amount,
      players: updatedPlayers,
      history: [`${playerName} ${label}: ${amount}`, ...history].slice(0, 10)
    });
    setInput('0');
  };

  const handleWin = async () => {
    if (!currentPlayer || pot === 0) return;
    await saveForUndo();
    const updatedPlayers = players.map(p => 
      p.name === playerName ? { ...p, chips: p.chips + pot } : p
    );
    await updateDoc(gameDocRef, { pot: 0, players: updatedPlayers, history: [`${playerName} Win Pot: ${pot}`, ...history].slice(0, 10) });
  };

  const sortedPlayers = [...players].sort((a, b) => b.chips - a.chips);

  if (!isJoined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 font-sans">
        <h1 className="text-3xl font-bold mb-8 italic tracking-tighter text-orange-500">POKER CHIP TOOL</h1>
        <div className="w-full max-w-sm space-y-4">
          <input type="text" placeholder="Name" className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl w-full text-center text-xl" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center"><label className="text-[10px] text-zinc-500 uppercase">SB</label><input type="number" className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg w-full text-center" value={sbInput} onChange={(e) => setSbInput(e.target.value)} /></div>
            <div className="text-center"><label className="text-[10px] text-zinc-500 uppercase">BB</label><input type="number" className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg w-full text-center" value={bbInput} onChange={(e) => setBbInput(e.target.value)} /></div>
          </div>
          <input type="number" placeholder="Buy-in" className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl w-full text-center text-xl" value={initialChipsInput} onChange={(e) => setInitialChipsInput(e.target.value)} />
          <button onClick={handleJoin} className="bg-orange-500 w-full p-4 rounded-xl font-bold text-xl active:scale-95 transition-transform">JOIN TABLE</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white p-4 max-w-2xl mx-auto relative overflow-hidden">
      <button onClick={handleReset} className="absolute top-4 right-4 text-[10px] text-red-500/50 border border-red-900/30 rounded px-2 py-1">RESET TABLE</button>

      {/* POT DISPLAY */}
      <div className="flex-1 flex flex-col justify-end pb-4 text-right mt-12">
        <div className="text-zinc-500 text-xs uppercase tracking-widest">Current Pot</div>
        <div className="text-7xl font-light text-white mb-6">{pot.toLocaleString()}</div>
        
        {/* LEADERBOARD */}
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-4">
          {sortedPlayers.map((p, i) => {
            const isMe = p.name === playerName;
            return (
              <div key={i} className={`flex justify-between items-center py-2 border-b border-zinc-800/30 last:border-0 ${isMe ? 'text-orange-400 font-bold bg-orange-900/10 -mx-2 px-2 rounded-lg' : 'text-zinc-400'}`}>
                <span className={isMe ? 'text-lg' : 'text-sm'}>{p.name} {isMe && "★"}</span>
                <span className={`font-mono ${isMe ? 'text-xl' : 'text-base'}`}>{p.chips.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* INPUT DISPLAY */}
      <div className="text-right text-4xl mb-4 pr-2 font-mono text-orange-500 h-10">
        {parseInt(input) > 0 ? parseInt(input).toLocaleString() : ""}
      </div>

      {/* ACTION BRIDGE */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <button onClick={() => moveChips(tableConfig.sb, "SB")} className="bg-zinc-800 rounded-xl py-4 text-xs font-bold active:bg-zinc-700">SB ({tableConfig.sb})</button>
        <button onClick={() => moveChips(tableConfig.bb, "BB")} className="bg-zinc-800 rounded-xl py-4 text-xs font-bold active:bg-zinc-700">BB ({tableConfig.bb})</button>
        <button onClick={() => currentPlayer && setInput(String(currentPlayer.chips))} className="bg-zinc-800 rounded-xl py-4 text-xs font-bold active:bg-zinc-700 text-red-400">MAX</button>
        <button onClick={() => setInput('0')} className="bg-zinc-700 rounded-xl py-4 text-xs font-bold active:bg-zinc-600">AC</button>
      </div>

      {/* MAIN BUTTONS */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={() => moveChips(parseInt(input), "BET")} className="bg-orange-500 text-white rounded-2xl h-20 font-black text-xl active:scale-95 transition-transform">BET / CALL</button>
        <button onClick={handleWin} className="bg-orange-700 text-white rounded-2xl h-20 font-black text-xl active:scale-95 transition-transform">WIN POT</button>
      </div>

      {/* TEN KEYPAD & UNDO */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button key={num} onClick={() => setInput(prev => prev === '0' ? String(num) : prev + num)} className="bg-zinc-900 border border-zinc-800/50 rounded-2xl h-14 text-2xl active:bg-zinc-800">{num}</button>
        ))}
        <button onClick={handleUndo} className="bg-zinc-800/50 text-zinc-500 rounded-2xl h-14 text-xs font-bold">UNDO ↩︎</button>
        <button onClick={() => setInput(prev => prev === '0' ? '0' : prev + '0')} className="bg-zinc-900 border border-zinc-800/50 rounded-2xl h-14 text-2xl active:bg-zinc-800">0</button>
        <div className="flex items-center justify-center text-[10px] text-zinc-700 font-mono">ver 1.5</div>
      </div>
    </div>
  );
}