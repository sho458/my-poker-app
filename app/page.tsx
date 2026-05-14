"use client";

import React, { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, setDoc, arrayUnion } from "firebase/firestore";

export default function Home() {
  const [playerName, setPlayerName] = useState("");
  const [initialChipsInput, setInitialChipsInput] = useState("10000");
  const [isJoined, setIsJoined] = useState(false);
  const [pot, setPot] = useState(0);
  const [players, setPlayers] = useState<any[]>([]);
  const [input, setInput] = useState('0');
  const [history, setHistory] = useState<string[]>([]);

  const gameDocRef = doc(db, "games", "table1");

  useEffect(() => {
    const unsub = onSnapshot(gameDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentPlayers = data.players || [];
        
        setPot(data.pot || 0);
        setPlayers(currentPlayers);
        setHistory(data.history || []);

        if (isJoined && !currentPlayers.some((p: any) => p.name === playerName)) {
          setIsJoined(false);
        }
      } else {
        setDoc(gameDocRef, { pot: 0, players: [], history: [] });
      }
    });
    return () => unsub();
  }, [isJoined, playerName]);

  const handleJoin = async () => {
    if (!playerName) return;
    const chipsAmount = parseInt(initialChipsInput) || 10000;
    const newPlayer = { name: playerName, chips: chipsAmount };
    
    await updateDoc(gameDocRef, {
      players: arrayUnion(newPlayer)
    });
    setIsJoined(true);
  };

  const handleReset = async () => {
    if (!confirm("全員の参加データを消去してリセットしますか？")) return;
    await updateDoc(gameDocRef, {
      pot: 0,
      players: [],
      history: ["Table Reset"]
    });
  };

  const addDigit = (num: number) => {
    setInput(prev => prev === '0' ? String(num) : prev + num);
  };

  const addAmount = (amount: number) => {
    setInput(prev => String(parseInt(prev) + amount));
  };

  const currentPlayer = players.find(p => p.name === playerName);

  const handleCall = async () => {
    const amount = parseInt(input);
    if (amount > 0 && currentPlayer && currentPlayer.chips >= amount) {
      const updatedPlayers = players.map(p => 
        p.name === playerName ? { ...p, chips: p.chips - amount } : p
      );
      
      await updateDoc(gameDocRef, {
        pot: pot + amount,
        players: updatedPlayers,
        history: [`${playerName}: ${amount}`, ...history].slice(0, 10)
      });
      setInput('0');
    }
  };

  const handleAllIn = async () => {
    if (!currentPlayer || currentPlayer.chips <= 0) return;
    const amount = currentPlayer.chips;
    const updatedPlayers = players.map(p => 
      p.name === playerName ? { ...p, chips: 0 } : p
    );
    
    await updateDoc(gameDocRef, {
      pot: pot + amount,
      players: updatedPlayers,
      history: [`${playerName} ALL-IN: ${amount}`, ...history].slice(0, 10)
    });
    setInput('0');
  };

  const handleWin = async () => {
    if (!currentPlayer) return;
    const updatedPlayers = players.map(p => 
      p.name === playerName ? { ...p, chips: p.chips + pot } : p
    );
    
    await updateDoc(gameDocRef, {
      pot: 0,
      players: updatedPlayers,
      history: [`${playerName} Win Pot: ${pot}`, ...history].slice(0, 10)
    });
  };

  // 【追加】プレイヤーをチップが多い順に並び替える
  const sortedPlayers = [...players].sort((a, b) => b.chips - a.chips);

  if (!isJoined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
        <h1 className="text-3xl font-bold mb-8 italic">POKER CHIP TOOL</h1>
        <div className="w-full max-w-sm mb-4 text-left">
          <label className="text-zinc-500 text-xs mb-1 block uppercase tracking-widest">Player Name</label>
          <input 
            type="text" 
            className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl w-full text-center text-xl focus:outline-none focus:border-orange-500"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </div>
        <div className="w-full max-w-sm mb-8 text-left">
          <label className="text-zinc-500 text-xs mb-1 block uppercase tracking-widest">Buy-in Chips</label>
          <input 
            type="number" 
            className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl w-full text-center text-xl focus:outline-none focus:border-orange-500"
            value={initialChipsInput}
            onChange={(e) => setInitialChipsInput(e.target.value)}
          />
        </div>
        <button onClick={handleJoin} className="bg-orange-500 w-full max-w-sm p-4 rounded-xl font-bold text-xl active:scale-95 transition-transform">
          JOIN TABLE
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white p-4 font-sans w-full max-w-2xl mx-auto relative">
      
      <button onClick={handleReset} className="absolute top-4 right-4 text-[10px] text-red-500 border border-red-900/50 rounded px-2 py-1 uppercase tracking-tighter">
        Reset Table
      </button>

      <div className="flex-1 flex flex-col justify-end pb-4 text-right mt-12">
        <div className="text-zinc-500 text-sm uppercase tracking-widest">Pot</div>
        <div className="text-7xl font-light mb-6 text-white">{pot.toLocaleString()}</div>
        
        {/* 【修正】プレイヤーリストの表示 */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-left">
          <p className="text-[10px] text-zinc-500 uppercase mb-2 tracking-widest">Leaderboard</p>
          {sortedPlayers.map((p, i) => {
            const isMe = p.name === playerName;
            return (
              <div 
                key={i} 
                className={`flex justify-between items-center py-2 border-b border-zinc-800/50 last:border-0 
                ${isMe ? 'text-orange-400 font-bold bg-orange-900/10 -mx-2 px-2 rounded-lg' : 'text-zinc-300'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs text-zinc-600 font-mono w-4 ${isMe ? 'text-orange-600' : ''}`}>{i + 1}</span>
                  <span className={isMe ? 'text-lg' : 'text-sm'}>{p.name} {isMe && "★"}</span>
                </div>
                <span className={`font-mono ${isMe ? 'text-xl' : 'text-base'}`}>
                  {p.chips.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-right text-3xl mb-4 pr-2 font-mono text-orange-500 mt-2">
        <span className="text-zinc-600 text-sm mr-2">INPUT:</span>
        {parseInt(input).toLocaleString()}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {[10, 50, 100, 500].map(val => (
          <button key={val} onClick={() => addAmount(val)} className="bg-zinc-800 rounded-xl py-3 text-xs font-bold active:bg-zinc-700">+{val}</button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <button onClick={() => setInput('0')} className="bg-zinc-600 text-white rounded-2xl h-16 font-bold">AC</button>
        <button onClick={handleCall} className="bg-orange-500 text-white rounded-2xl h-16 font-bold">BET / CALL</button>
        <button onClick={handleWin} className="bg-orange-600 text-white rounded-2xl h-16 font-bold">WIN POT</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button key={num} onClick={() => addDigit(num)} className="bg-zinc-900 border border-zinc-800 rounded-2xl h-14 text-xl active:bg-zinc-800">{num}</button>
        ))}
        <button onClick={handleAllIn} className="bg-red-900/30 text-red-500 border border-red-900/50 rounded-2xl h-14 font-bold text-xs">ALL IN</button>
        <button onClick={() => addDigit(0)} className="bg-zinc-900 border border-zinc-800 rounded-2xl h-14 text-xl active:bg-zinc-800">0</button>
        <div className="flex items-center justify-center text-[10px] text-zinc-600 font-mono tracking-tighter">
          ver 1.3
        </div>
      </div>

      <div className="h-20 overflow-y-auto border-t border-zinc-800/50 pt-2 text-[10px] text-zinc-600 font-mono">
        {history.map((h, i) => <div key={i} className="mb-0.5">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}] {h}</div>)}
      </div>
    </div>
  );
}