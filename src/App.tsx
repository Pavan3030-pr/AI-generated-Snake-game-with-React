/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Terminal } from 'lucide-react';

// --- Types ---
type Point = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number };
type Track = { id: number; title: string; artist: string; url: string };

// --- Constants ---
const GRID_W = 20;
const GRID_H = 20;
const CELL_SIZE = 20;
const CANVAS_W = GRID_W * CELL_SIZE;
const CANVAS_H = GRID_H * CELL_SIZE;
const MOVE_INTERVAL = 100; // ms

const TRACKS: Track[] = [
  { id: 1, title: 'SYS.INIT_01', artist: 'AI_CORE_ALPHA', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 2, title: 'MEM_LEAK_DETECTED', artist: 'AI_CORE_BETA', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 3, title: 'KERNEL_PANIC', artist: 'AI_CORE_GAMMA', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
];

export default function App() {
  // --- Music Player State ---
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // --- Game State (React) ---
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'CRASHED'>('IDLE');
  const [score, setScore] = useState(0);
  const [shake, setShake] = useState(false);

  // --- Game State (Mutable Refs for Animation Loop) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }]);
  const dirRef = useRef<Point>({ x: 0, y: -1 });
  const nextDirRef = useRef<Point>({ x: 0, y: -1 });
  const foodRef = useRef<Point>({ x: 5, y: 5 });
  const particlesRef = useRef<Particle[]>([]);
  const lastMoveTimeRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const gameStateRef = useRef<'IDLE' | 'PLAYING' | 'CRASHED'>('IDLE');

  // --- Music Player Logic ---
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (isPlaying) {
      audioRef.current?.play().catch(console.error);
    } else {
      audioRef.current?.pause();
    }
  }, [isPlaying, currentTrackIndex]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  
  const nextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % TRACKS.length);
    setIsPlaying(true);
  };
  
  const prevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + TRACKS.length) % TRACKS.length);
    setIsPlaying(true);
  };

  const handleTrackEnded = () => {
    nextTrack();
  };

  // --- Game Logic ---
  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 200);
  }, []);

  const spawnFood = useCallback(() => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_W),
        y: Math.floor(Math.random() * GRID_H),
      };
      // eslint-disable-next-line no-loop-func
      if (!snakeRef.current.some(s => s.x === newFood.x && s.y === newFood.y)) {
        break;
      }
    }
    foodRef.current = newFood;
  }, []);

  const spawnParticles = useCallback((x: number, y: number) => {
    for (let i = 0; i < 15; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0
      });
    }
  }, []);

  const initGame = useCallback(() => {
    snakeRef.current = [{ x: 10, y: 10 }];
    dirRef.current = { x: 0, y: -1 };
    nextDirRef.current = { x: 0, y: -1 };
    scoreRef.current = 0;
    setScore(0);
    particlesRef.current = [];
    spawnFood();
    gameStateRef.current = 'PLAYING';
    setGameState('PLAYING');
    lastMoveTimeRef.current = performance.now();
    
    if (!isPlaying) {
      setIsPlaying(true);
    }
  }, [isPlaying, spawnFood]);

  // --- Game Loop ---
  const update = useCallback((time: number) => {
    if (gameStateRef.current !== 'PLAYING') return;

    // Update Particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Update Snake
    if (time - lastMoveTimeRef.current > MOVE_INTERVAL) {
      lastMoveTimeRef.current = time;
      dirRef.current = nextDirRef.current;

      const head = snakeRef.current[0];
      const newHead = { x: head.x + dirRef.current.x, y: head.y + dirRef.current.y };

      // Collisions
      if (
        newHead.x < 0 || newHead.x >= GRID_W || 
        newHead.y < 0 || newHead.y >= GRID_H ||
        snakeRef.current.some(s => s.x === newHead.x && s.y === newHead.y)
      ) {
        gameStateRef.current = 'CRASHED';
        setGameState('CRASHED');
        triggerShake();
        return;
      }

      snakeRef.current.unshift(newHead);

      // Food
      if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        spawnParticles(foodRef.current.x * CELL_SIZE + CELL_SIZE / 2, foodRef.current.y * CELL_SIZE + CELL_SIZE / 2);
        triggerShake();
        spawnFood();
      } else {
        snakeRef.current.pop();
      }
    }
  }, [spawnFood, spawnParticles, triggerShake]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid (Glitchy)
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < GRID_W; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL_SIZE, 0); ctx.lineTo(i * CELL_SIZE, CANVAS_H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL_SIZE); ctx.lineTo(CANVAS_W, i * CELL_SIZE); ctx.stroke();
    }

    // Food
    ctx.fillStyle = '#ff00ff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff00ff';
    ctx.fillRect(foodRef.current.x * CELL_SIZE + 2, foodRef.current.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    ctx.shadowBlur = 0;

    // Snake
    snakeRef.current.forEach((segment, i) => {
      ctx.fillStyle = i === 0 ? '#ffffff' : '#00ffff';
      if (i === 0) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(segment.x * CELL_SIZE + 1, segment.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    });
    ctx.shadowBlur = 0;

    // Particles
    particlesRef.current.forEach(p => {
      ctx.fillStyle = `rgba(255, 0, 255, ${p.life})`;
      ctx.fillRect(p.x, p.y, 4, 4);
    });

  }, []);

  const loop = useCallback((time: number) => {
    update(time);
    draw();
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [loop]);

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
      }
      
      if (gameStateRef.current !== 'PLAYING') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (dirRef.current.y !== 1) nextDirRef.current = { x: 0, y: -1 };
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (dirRef.current.y !== -1) nextDirRef.current = { x: 0, y: 1 };
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (dirRef.current.x !== 1) nextDirRef.current = { x: -1, y: 0 };
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (dirRef.current.x !== -1) nextDirRef.current = { x: 1, y: 0 };
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`min-h-screen bg-[#050505] text-[#00ffff] font-mono flex flex-col items-center justify-center p-4 relative ${shake ? 'shake-active' : ''}`}>
      <div className="static-noise" />
      <div className="scanline" />
      
      <header className="mb-8 text-center z-10 screen-tear">
        <h1 className="text-6xl font-bold tracking-widest uppercase mb-2 glitch-text" data-text="SYS.SNAKE_PROTOCOL">
          SYS.SNAKE_PROTOCOL
        </h1>
        <div className="flex items-center justify-center gap-4 text-2xl">
          <span className="text-[#ff00ff]">DATA_FRAGMENTS: {score.toString().padStart(4, '0')}</span>
        </div>
      </header>

      <main className="flex flex-col xl:flex-row gap-12 items-center z-10 w-full max-w-6xl justify-center">
        
        {/* Game Container */}
        <div className="relative border-4 border-[#00ffff] bg-[#050505] p-2 shadow-[0_0_20px_rgba(0,255,255,0.3)] shrink-0">
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none border border-[#ff00ff] opacity-50 mix-blend-screen" style={{ transform: 'translate(4px, 4px)' }} />
          
          <div className="relative w-full max-w-[400px] aspect-square">
            <canvas 
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full h-full block bg-[#050505]"
            />

            {gameState === 'IDLE' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#050505]/80 z-20">
                <button 
                  onClick={initGame}
                  className="px-8 py-4 border-2 border-[#00ffff] text-[#00ffff] text-2xl hover:bg-[#00ffff] hover:text-[#050505] transition-colors uppercase tracking-widest"
                >
                  &gt; INIT_SEQ
                </button>
              </div>
            )}

            {gameState === 'CRASHED' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505]/90 z-20">
                <h2 className="text-5xl font-bold text-[#ff00ff] mb-4 glitch-text" data-text="SYSTEM FAILURE">SYSTEM FAILURE</h2>
                <p className="text-xl text-[#00ffff] mb-8">FRAGMENTS_LOST: {score}</p>
                <button 
                  onClick={initGame}
                  className="px-8 py-4 border-2 border-[#ff00ff] text-[#ff00ff] text-2xl hover:bg-[#ff00ff] hover:text-[#050505] transition-colors uppercase tracking-widest"
                >
                  &gt; REBOOT
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Audio Uplink (Music Player) */}
        <div className="w-full max-w-md border-2 border-[#ff00ff] bg-[#050505] p-6 shadow-[0_0_20px_rgba(255,0,255,0.2)] relative shrink-0">
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none border border-[#00ffff] opacity-30 mix-blend-screen" style={{ transform: 'translate(-4px, -4px)' }} />
          
          <div className="flex items-center gap-2 mb-6 border-b border-[#ff00ff] pb-2">
            <Terminal size={20} className="text-[#ff00ff]" />
            <h3 className="text-xl font-bold tracking-widest text-[#ff00ff] uppercase">AUDIO_UPLINK</h3>
          </div>
          
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 border-2 border-[#00ffff] bg-[#050505] flex items-center justify-center relative overflow-hidden shrink-0">
              {isPlaying ? (
                <div className="absolute inset-0 flex items-end justify-center gap-1 p-2 opacity-80">
                  <div className="w-2 bg-[#00ffff] animate-[bounce_0.5s_infinite]" style={{ height: '40%' }} />
                  <div className="w-2 bg-[#ff00ff] animate-[bounce_0.7s_infinite]" style={{ height: '80%' }} />
                  <div className="w-2 bg-[#00ffff] animate-[bounce_0.4s_infinite]" style={{ height: '60%' }} />
                  <div className="w-2 bg-[#ff00ff] animate-[bounce_0.6s_infinite]" style={{ height: '30%' }} />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#00ffff] opacity-50">
                  [OFFLINE]
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-2xl text-[#00ffff] truncate uppercase">{TRACKS[currentTrackIndex].title}</h4>
              <p className="text-lg text-[#ff00ff] truncate uppercase">SRC: {TRACKS[currentTrackIndex].artist}</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border border-[#00ffff] p-2">
              <button onClick={prevTrack} className="p-2 text-[#00ffff] hover:bg-[#00ffff] hover:text-[#050505] transition-colors">
                <SkipBack size={28} />
              </button>
              <button 
                onClick={togglePlay} 
                className="px-8 py-2 bg-[#ff00ff] text-[#050505] font-bold text-xl hover:bg-[#050505] hover:text-[#ff00ff] border-2 border-[#ff00ff] transition-all uppercase"
              >
                {isPlaying ? 'PAUSE_SEQ' : 'EXEC_PLAY'}
              </button>
              <button onClick={nextTrack} className="p-2 text-[#00ffff] hover:bg-[#00ffff] hover:text-[#050505] transition-colors">
                <SkipForward size={28} />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={() => setIsMuted(!isMuted)} className="text-[#ff00ff] hover:text-[#00ffff] shrink-0">
                {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </button>
              <div className="relative w-full h-4 border border-[#ff00ff] bg-[#050505]">
                <div 
                  className="absolute top-0 left-0 h-full bg-[#ff00ff] transition-all duration-100"
                  style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    if (isMuted) setIsMuted(false);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <span className="text-[#ff00ff] w-12 text-right">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          </div>

          <audio 
            ref={audioRef} 
            src={TRACKS[currentTrackIndex].url} 
            onEnded={handleTrackEnded}
          />
        </div>

      </main>

      <div className="mt-16 text-[#00ffff] text-xl text-center z-10 opacity-50 uppercase tracking-widest">
        [ INPUT_REQ: W A S D // ARROWS ]
      </div>
    </div>
  );
}
