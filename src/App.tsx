import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Undo2, RotateCcw, Check, Lightbulb, SkipForward, TriangleAlert, Sun, Moon, CalendarDays } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';
import { soundEngine } from './lib/sounds';

const TUBE_CAPACITY = 4;

function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

const LEVEL_COLORS = [
  "linear-gradient(135deg, #FF595E, #CC0000)", // Red
  "linear-gradient(135deg, #FFCA3A, #E69500)", // Yellow
  "linear-gradient(135deg, #8AC926, #2B8000)", // Green
  "linear-gradient(135deg, #1982C4, #00509E)", // Blue
  "linear-gradient(135deg, #6A4C93, #3A1B63)", // Purple
  "linear-gradient(135deg, #FF924C, #C74500)", // Orange
  "linear-gradient(135deg, #FFC4D9, #D48095)", // Pink
  "linear-gradient(135deg, #00B4D8, #00779E)", // Cyan
  "linear-gradient(135deg, #8338EC, #3A0CA3)", // Violet
  "linear-gradient(135deg, #118AB2, #073B4C)", // Deep Sea
  "linear-gradient(135deg, #06D6A0, #037A5B)", // Mint
  "linear-gradient(135deg, #EF476F, #91122D)", // Rose
  "linear-gradient(135deg, #52796F, #2F3E46)", // Dark Teal
  "linear-gradient(135deg, #D4A373, #A5734D)", // Tan
  "linear-gradient(135deg, #A8DADC, #66A5AD)", // Ice
  "linear-gradient(135deg, #D62828, #801818)", // Crimson
  "linear-gradient(135deg, #F77F00, #944C00)", // Amber
  "linear-gradient(135deg, #EAE2B7, #8C876E)", // Vanilla
  "linear-gradient(135deg, #9D4EDD, #5E2F84)", // Amethyst
  "linear-gradient(135deg, #48BFE3, #2B7288)", // Sky
  "linear-gradient(135deg, #74C69D, #45765E)", // Sage
  "linear-gradient(135deg, #FFC8DD, #997884)", // Cotton Candy
  "linear-gradient(135deg, #B5838D, #6C4E54)", // Dusty Rose
  "linear-gradient(135deg, #E5989B, #895B5D)", // Coral Pink
  "linear-gradient(135deg, #6D6875, #413E46)", // Plum
  "linear-gradient(135deg, #2A9D8F, #195E55)", // Pine
  "linear-gradient(135deg, #E9C46A, #8B753F)", // Ochre
  "linear-gradient(135deg, #F4A261, #92613A)", // Burnt Orange
  "linear-gradient(135deg, #264653, #162A31)", // Charcoal Bleu
  "linear-gradient(135deg, #F1FAEE, #90968E)", // Pearl
];

type Block = {
  id: string;
  colorIndex: number;
};

function getComplexity(tubes: Block[][]) {
    let transitions = 0;
    for (const t of tubes) {
        for (let i = 0; i < t.length - 1; i++) {
            if (t[i].colorIndex !== t[i + 1].colorIndex) {
                transitions++;
            }
        }
    }
    return transitions;
}

function generateLevel(levelNumber: number, rng: () => number = Math.random) {
  const numColors = Math.min(LEVEL_COLORS.length, 3 + Math.floor((levelNumber - 1) / 4)); 
  const numEmpty = levelNumber > 50 ? 3 : 2; 
  const numTubes = numColors + numEmpty;

  let idCounter = 0;
  const startTubes: Block[][] = [];
  for (let c = 0; c < numColors; c++) {
      startTubes.push(Array.from({length: TUBE_CAPACITY}, () => ({ id: `block-${idCounter++}`, colorIndex: c })));
  }
  for (let i = 0; i < numEmpty; i++) {
      startTubes.push([]);
  }

  // Difficulty targets
  const targetComplexity = Math.min(numColors * 2.5, 2 + Math.floor(levelNumber * 0.8));
  const minShuffles = Math.min(150, 20 + levelNumber * 4);

  const cloneState = (state: Block[][]) => state.map(t => [...t]);
  let currentTubes = cloneState(startTubes);
  
  let lastMove = { from: -1, to: -1 };
  
  const history = new Set<string>();
  const hash = (tubes: Block[][]) => tubes.map(t => t.map(b => b.colorIndex).join(',')).join('|');
  history.add(hash(currentTubes));

  let shuffles = 0;
  let bestTubes = currentTubes;
  let bestComplexity = 0;

  while (shuffles < 800) {
    const validMoves: { from: number, to: number }[] = [];

    for (let from = 0; from < numTubes; from++) {
      if (currentTubes[from].length === 0) continue;
      
      const topBlock = currentTubes[from][currentTubes[from].length - 1];
      const blockBelow = currentTubes[from].length > 1 ? currentTubes[from][currentTubes[from].length - 2] : null;

      if (blockBelow === null || blockBelow.colorIndex === topBlock.colorIndex) {
        for (let to = 0; to < numTubes; to++) {
          if (from === to) continue;
          if (currentTubes[to].length < TUBE_CAPACITY) {
             validMoves.push({ from, to });
          }
        }
      }
    }

    if (validMoves.length === 0) break;

    const allowedMoves = validMoves.filter(m => !(m.from === lastMove.to && m.to === lastMove.from));
    
    const moveStates = allowedMoves.map(m => {
        const next = cloneState(currentTubes);
        const b = next[m.from].pop()!;
        next[m.to].push(b);
        return { move: m, next, hash: hash(next), comp: getComplexity(next) };
    });

    let unvisited = moveStates.filter(ms => !history.has(ms.hash));
    if (unvisited.length === 0) {
        unvisited = moveStates; // fallback
        if (unvisited.length === 0) break;
    }

    // Favor moves that increase complexity
    unvisited.sort((a, b) => {
        const scoreA = a.comp + rng() * 1.5;
        const scoreB = b.comp + rng() * 1.5;
        return scoreB - scoreA;
    });

    // Pick from the top candidates to maintain randomness while drifting toward higher complexity
    const poolSize = Math.max(1, Math.floor(unvisited.length / 2));
    const chosen = unvisited[Math.floor(rng() * poolSize)];

    currentTubes = chosen.next;
    lastMove = chosen.move;
    history.add(chosen.hash);
    shuffles++;

    if (chosen.comp > bestComplexity) {
        bestComplexity = chosen.comp;
        bestTubes = cloneState(currentTubes);
    }

    if (shuffles >= minShuffles && chosen.comp >= targetComplexity) {
        bestTubes = cloneState(currentTubes);
        break;
    }
  }

  return bestTubes;
}

function checkWin(currentTubes: Block[][]) {
  for (let tube of currentTubes) {
     if (tube.length === 0) continue;
     if (tube.length !== TUBE_CAPACITY) return false;
     const firstColor = tube[0].colorIndex;
     for (let block of tube) {
        if (block.colorIndex !== firstColor) return false;
     }
  }
  return true; 
}

function generateValidLevel(level: number, seed?: number): Block[][] {
   const rng = seed !== undefined ? mulberry32(seed) : Math.random;
   let tubes = generateLevel(level, rng);
   let attempts = 0;
   while(checkWin(tubes) && attempts < 100) {
       tubes = generateLevel(level, rng);
       attempts++;
   }
   return tubes;
}

function getHint(currentTubes: Block[][]): { from: number, to: number } | null {
    const moves: {from: number, to: number, score: number}[] = [];

    for (let from = 0; from < currentTubes.length; from++) {
        if (currentTubes[from].length === 0) continue;

        const source = currentTubes[from];
        const topColor = source[source.length - 1].colorIndex;
        let blocksToMove = 0;
        for (let i = source.length - 1; i >= 0; i--) {
            if (source[i].colorIndex === topColor) blocksToMove++;
            else break;
        }

        const isSingleColor = blocksToMove === source.length;

        for (let to = 0; to < currentTubes.length; to++) {
            if (from === to) continue;
            const dest = currentTubes[to];
            
            if (dest.length === TUBE_CAPACITY) continue;

            if (dest.length === 0) {
                if (isSingleColor) continue; 
                moves.push({ from, to, score: 10 });
            } else if (dest[dest.length - 1].colorIndex === topColor) {
                const available = TUBE_CAPACITY - dest.length;
                const moved = Math.min(blocksToMove, available);
                
                let score = 20;
                if (dest.length + moved === TUBE_CAPACITY) score += 50; 
                if (blocksToMove <= available && source.length === blocksToMove) score += 30; 
                
                moves.push({ from, to, score });
            }
        }
    }

    if (moves.length === 0) return null;
    moves.sort((a, b) => b.score - a.score);
    return moves[0];
}

function getTutorialLevel(): Block[][] {
   return [
      [{id: 't-0', colorIndex: 0}, {id: 't-1', colorIndex: 0}, {id: 't-2', colorIndex: 2}, {id: 't-3', colorIndex: 2}],
      [{id: 't-4', colorIndex: 2}, {id: 't-5', colorIndex: 2}, {id: 't-6', colorIndex: 0}, {id: 't-7', colorIndex: 0}],
      []
   ];
}

export default function App() {
  const [levelNumber, setLevelNumber] = useState(() => {
    const saved = localStorage.getItem('blockSortLevel');
    const lvl = saved ? parseInt(saved) : 1;
    return isNaN(lvl) ? 1 : lvl;
  });

  const [gameMode, setGameMode] = useState<'normal' | 'daily'>('normal');

  const todayStr = new Date().toISOString().split('T')[0];
  const hashString = (s: string) => Math.abs(s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0));
  const dailySeed = hashString(todayStr);
  const DAILY_LEVEL_DIFFICULTY = 50;

  const [showWin, setShowWin] = useState(false);
  const [showAd, setShowAd] = useState(false);
  
  const [isTutorialPending, setIsTutorialPending] = useState(() => localStorage.getItem('blockSortTutorialComplete') !== 'true');
  const isTutorial = isTutorialPending && levelNumber === 1 && gameMode === 'normal';

  useEffect(() => {
      localStorage.setItem('blockSortLevel', levelNumber.toString());
  }, [levelNumber]);

  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    return (localStorage.getItem('blockSortTheme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
      localStorage.setItem('blockSortTheme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <div className={cn("min-h-screen font-sans flex flex-col relative overflow-hidden transition-colors duration-300", 
        theme === 'dark' ? "dark bg-zinc-950 text-zinc-100 selection:bg-zinc-800" : "bg-neutral-50 text-zinc-900 selection:bg-neutral-200"
    )}>
        {/* Background ambient lights */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] dark:bg-zinc-800/30 bg-blue-300/40 blur-[120px] rounded-full" />
           <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] dark:bg-zinc-900/40 bg-purple-300/40 blur-[120px] rounded-full" />
        </div>

        <GameBoard 
           key={gameMode === 'daily' ? `daily-${todayStr}` : (isTutorial ? 'tutorial' : levelNumber)} 
           levelNumber={gameMode === 'daily' ? DAILY_LEVEL_DIFFICULTY : levelNumber} 
           theme={theme}
           toggleTheme={toggleTheme}
           isDaily={gameMode === 'daily'}
           isTutorial={isTutorial}
           dailySeed={gameMode === 'daily' ? dailySeed : undefined}
           todayStr={todayStr}
           onWin={() => {
               setShowWin(true);
               if (isTutorial) {
                   localStorage.setItem('blockSortTutorialComplete', 'true');
                   setIsTutorialPending(false);
               }
           }} 
           onToggleDaily={() => setGameMode(g => g === 'normal' ? 'daily' : 'normal')}
        />

        <AnimatePresence>
            {showWin && !showAd && (
               <WinModal 
                  level={levelNumber} 
                  isDaily={gameMode === 'daily'}
                  isTutorial={isTutorial}
                  onNext={() => {
                      if (isTutorial) {
                          setShowWin(false);
                      } else {
                          setShowAd(true);
                      }
                  }} 
               />
            )}
        </AnimatePresence>

        <AnimatePresence>
            {showAd && (
                <AdModal 
                   onComplete={() => {
                       if (gameMode === 'daily') {
                           localStorage.setItem(`blockSortDailyComplete_${todayStr}`, 'true');
                           setGameMode('normal');
                       } else {
                           setLevelNumber(l => l + 1);
                       }
                       setShowWin(false);
                       setShowAd(false);
                   }}
                />
            )}
        </AnimatePresence>
    </div>
  )
}

function GameBoard({ levelNumber, theme, toggleTheme, isDaily, isTutorial, dailySeed, onToggleDaily, onWin, todayStr }: { levelNumber: number, theme: 'light'|'dark', toggleTheme: () => void, isDaily: boolean, isTutorial?: boolean, dailySeed?: number, onToggleDaily: () => void, onWin: () => void, todayStr: string }) {
    const savedStateKey = isDaily && dailySeed ? `blockSortDailyState_${dailySeed}` : null;

    const [state] = useState(() => {
        if (savedStateKey) {
            const saved = localStorage.getItem(savedStateKey);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    return parsed;
                } catch(e) {}
            }
        }
        const initial = isTutorial ? getTutorialLevel() : generateValidLevel(levelNumber, dailySeed);
        return {
            initialTubes: initial,
            tubes: initial,
            history: [],
            moves: 0,
            isComplete: false
        };
    });

    const [initialTubes, setInitialTubes] = useState<Block[][]>(state.initialTubes);
    const [tubes, setTubes] = useState<Block[][]>(state.tubes);
    const [history, setHistory] = useState<Block[][][]>(state.history);
    const [selectedTube, setSelectedTube] = useState<number | null>(null);
    const [moves, setMoves] = useState(state.moves);
    const [hint, setHint] = useState<{from: number, to: number} | null>(null);
    const [isComplete, setIsComplete] = useState(state.isComplete);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    
    // Tutorial State
    const [tutorialStep, setTutorialStep] = useState(0);

    useEffect(() => {
        if (savedStateKey) {
            localStorage.setItem(savedStateKey, JSON.stringify({
                initialTubes,
                tubes,
                history,
                moves,
                isComplete
            }));
        }
    }, [initialTubes, tubes, history, moves, isComplete, savedStateKey]);

    useEffect(() => {
       if (isComplete) {
           const t = setTimeout(() => onWin(), 600);
           return () => clearTimeout(t);
       }
    }, [isComplete, onWin]);

    const handleTubeClick = (tubeIndex: number) => {
        setHint(null);
        if (isComplete) return;

        if (isTutorial) {
            if (tutorialStep === 0 && tubeIndex !== 0) return;
            if (tutorialStep === 1 && tubeIndex !== 2 && tubeIndex !== 0) return;
        }

        soundEngine.init();

        if (selectedTube === null) {
            if (tubes[tubeIndex].length === 0) {
                soundEngine.error();
                return;
            }
            soundEngine.select();
            setSelectedTube(tubeIndex);
            
            if (isTutorial && tutorialStep === 0 && tubeIndex === 0) {
                setTutorialStep(1);
            }
        } else {
            if (selectedTube === tubeIndex) {
                soundEngine.deselect();
                setSelectedTube(null);
                if (isTutorial && tutorialStep === 1 && tubeIndex === 0) {
                    setTutorialStep(0);
                }
                return;
            }

            const source = tubes[selectedTube];
            const dest = tubes[tubeIndex];

            if (source.length === 0) {
                soundEngine.deselect();
                setSelectedTube(null);
                return;
            }

            const topBlock = source[source.length - 1];

            if (dest.length > 0 && dest[dest.length - 1].colorIndex !== topBlock.colorIndex) {
                // Change selection cleanly if we clicked another colored tube 
                if (dest.length > 0) {
                    soundEngine.select();
                    setSelectedTube(tubeIndex);
                    // Do not allow changing selection in tutorial step 1
                    if (isTutorial && tutorialStep === 1) {
                         setSelectedTube(null);
                         setTutorialStep(0);
                    }
                } else {
                    soundEngine.deselect();
                    setSelectedTube(null);
                    if (isTutorial && tutorialStep === 1) setTutorialStep(0);
                }
                return;
            }

            if (dest.length === TUBE_CAPACITY) {
                soundEngine.select();
                setSelectedTube(tubeIndex);
                if (isTutorial && tutorialStep === 1) setTutorialStep(0);
                return;
            }

            const availableSpace = TUBE_CAPACITY - dest.length;
            let blocksToMove = 0;
            for (let i = source.length - 1; i >= 0; i--) {
                if (source[i].colorIndex === topBlock.colorIndex) blocksToMove++;
                else break;
            }
            
            const movedCount = Math.min(blocksToMove, availableSpace);
            
            const newTubes = tubes.map(t => [...t]);
            const movingBlocks = newTubes[selectedTube].splice(-movedCount);
            newTubes[tubeIndex].push(...movingBlocks);

            setHistory([...history, tubes.map(t => [...t])]); // Clone for history
            setTubes(newTubes);
            setMoves(m => m + 1);
            setSelectedTube(null);
            
            if (isTutorial && tutorialStep === 1 && tubeIndex === 2) {
                setTutorialStep(2);
            }

            if (checkWin(newTubes)) {
                soundEngine.win();
                setIsComplete(true);
            } else {
                const isTubeComplete = newTubes[tubeIndex].length === TUBE_CAPACITY && 
                                     newTubes[tubeIndex].every(b => b.colorIndex === topBlock.colorIndex);
                if (isTubeComplete) {
                    soundEngine.tubeComplete();
                } else {
                    soundEngine.move();
                }
            }
        }
    };

    const handleUndo = () => {
        setHint(null);
        if (history.length > 0 && !isComplete) {
          soundEngine.init();
          soundEngine.move();
          const prev = history[history.length - 1];
          setTubes(prev);
          setHistory(history.slice(0, -1));
          setMoves(Math.max(0, moves - 1));
          setSelectedTube(null);
        }
    };

    const handleReset = () => {
        setHint(null);
        setShowResetConfirm(false);
        if (history.length > 0 && !isComplete) {
          soundEngine.init();
          soundEngine.error(); // Dull sound to indicate reset
          setTubes(initialTubes.map(t => [...t]));
          setHistory([]);
          setMoves(0);
          setSelectedTube(null);
        }
    };

    const handleSkip = () => {
        if (!isComplete) {
            soundEngine.init();
            soundEngine.win();
            setIsComplete(true);
        }
    };

    const canSkip = moves >= 10 && !isComplete;

    return (
        <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col relative z-10" onClick={() => { setSelectedTube(null); soundEngine.init(); }}>
            <header className="w-full flex items-center justify-between p-6 dark:text-zinc-100 text-zinc-900 z-10 relative">
                  <div className="flex flex-col">
                      <span className="text-sm font-semibold dark:text-zinc-500 text-zinc-500 uppercase tracking-widest dark:bg-zinc-800/50 bg-white/60 rounded-full px-3 py-1 w-fit border dark:border-zinc-700/50 border-zinc-200/80 mb-2">Block Sort</span>
                      <div className="flex items-baseline gap-4">
                          <h1 className="text-3xl font-bold tracking-tight">{isDaily ? 'Daily Challenge' : `Level ${levelNumber}`}</h1>
                          <span className="dark:text-zinc-400 text-zinc-600 font-medium dark:bg-zinc-800/40 bg-zinc-200/50 px-3 py-1 rounded-full text-sm border dark:border-zinc-800 border-zinc-300/50 shadow-inner">{moves} Moves</span>
                      </div>
                  </div>
                  <div className="flex gap-3 relative z-10 pointer-events-auto">
                     <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (!isDaily && localStorage.getItem(`blockSortDailyComplete_${todayStr}`) === 'true') {
                                // Already complete
                                return;
                            }
                            onToggleDaily(); 
                        }}
                        title={isDaily ? 'Return to Normal Mode' : 'Play Daily Challenge'}
                        className={cn("p-3 rounded-full border transition-all shadow-sm",
                             !isDaily && localStorage.getItem(`blockSortDailyComplete_${todayStr}`) === 'true'
                             ? "dark:bg-emerald-900/40 bg-emerald-100 dark:border-emerald-800 border-emerald-300 opacity-80 cursor-not-allowed" 
                             : "dark:bg-zinc-800/80 bg-white/80 dark:border-zinc-700 border-zinc-200 dark:hover:bg-zinc-700 hover:bg-zinc-50"
                        )}
                     >
                         <CalendarDays className={cn("w-5 h-5", isDaily ? "text-emerald-500" : (!isDaily && localStorage.getItem(`blockSortDailyComplete_${todayStr}`) === 'true' ? "dark:text-emerald-400 text-emerald-600" : "dark:text-zinc-400 text-zinc-500"))} />
                     </button>
                     <button 
                        onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                        title="Toggle Theme"
                        className="p-3 rounded-full dark:bg-zinc-800/80 bg-white/80 border dark:border-zinc-700 border-zinc-200 dark:hover:bg-zinc-700 hover:bg-zinc-50 transition-all shadow-sm"
                     >
                         {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
                     </button>
                     {canSkip && !isTutorial && (
                         <motion.button 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={(e) => { e.stopPropagation(); handleSkip(); }}
                            title="Skip Level (Available after 10 moves)"
                            className="p-3 rounded-full bg-indigo-500/20 border border-indigo-500/50 hover:bg-indigo-500/30 transition-all shadow-sm"
                         >
                             <SkipForward className="w-5 h-5 dark:text-indigo-300 text-indigo-600" />
                         </motion.button>
                     )}
                     <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setHint(getHint(tubes)); 
                            soundEngine.init();
                            soundEngine.select();
                        }}
                        disabled={isComplete}
                        title="Get Hint"
                        className="p-3 rounded-full dark:bg-zinc-800/80 bg-white/80 border dark:border-zinc-700 border-zinc-200 dark:hover:bg-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                     >
                         <Lightbulb className="w-5 h-5 text-yellow-400" />
                     </button>
                     <button 
                        onClick={(e) => { e.stopPropagation(); handleUndo(); }}
                        disabled={history.length === 0 || isComplete} 
                        className="p-3 rounded-full dark:bg-zinc-800/80 bg-white/80 border dark:border-zinc-700 border-zinc-200 dark:hover:bg-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                     >
                         <Undo2 className="w-5 h-5 dark:text-white text-zinc-700" />
                     </button>
                     <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            soundEngine.init();
                            soundEngine.select();
                            setShowResetConfirm(true); 
                        }}
                        disabled={history.length === 0 || isComplete} 
                        className="p-3 rounded-full dark:bg-zinc-800/80 bg-white/80 border dark:border-zinc-700 border-zinc-200 dark:hover:bg-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                     >
                         <RotateCcw className="w-5 h-5 dark:text-white text-zinc-700" />
                     </button>
                  </div>
            </header>

            <main className="flex-1 w-full p-4 flex flex-col relative overflow-y-auto overflow-x-hidden soft-scrollbar items-center justify-center">
               
               <AnimatePresence>
                   {isTutorial && !isComplete && (
                       <motion.div 
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="absolute top-10 left-0 right-0 z-50 flex justify-center pointer-events-none px-4"
                       >
                           <div className="bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl max-w-sm text-center text-lg font-bold shadow-emerald-500/20 border border-emerald-400">
                               {tutorialStep === 0 && "Welcome! Tap the first tube to pick up the green blocks."}
                               {tutorialStep === 1 && "Now tap the empty tube to move the green blocks there."}
                               {tutorialStep > 1 && "Great job! Now sort the rest of the colors to finish the tutorial."}
                           </div>
                       </motion.div>
                   )}
               </AnimatePresence>

               <div className={cn("flex flex-wrap justify-center content-center gap-x-3 sm:gap-x-5 gap-y-8 sm:gap-y-12 w-full max-w-4xl pb-16 pt-8", isTutorial && tutorialStep < 2 ? "pointer-events-none" : "")}>
                   {tubes.map((tube, i) => (
                      <Tube 
                          key={`tube-${i}`} 
                          tube={tube} 
                          index={i} 
                          isSelected={selectedTube === i} 
                          onSelect={handleTubeClick} 
                          isHintSource={hint?.from === i}
                          isHintDest={hint?.to === i}
                          isTutorialHighlight={isTutorial && ((tutorialStep === 0 && i === 0) || (tutorialStep === 1 && i === 2))}
                      />
                   ))}
               </div>
            </main>

            <AnimatePresence>
                {showResetConfirm && (
                    <ResetConfirmModal 
                        onConfirm={handleReset} 
                        onCancel={() => {
                            soundEngine.init();
                            soundEngine.deselect();
                            setShowResetConfirm(false);
                        }} 
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

function Tube({ tube, index, isSelected, onSelect, isHintSource, isHintDest, isTutorialHighlight }: { tube: Block[], index: number, isSelected: boolean, onSelect: (i: number) => void, isHintSource?: boolean, isHintDest?: boolean, isTutorialHighlight?: boolean }) {
   const getMovingCount = () => {
       if (!isSelected || tube.length === 0) return 0;
       const topColor = tube[tube.length - 1].colorIndex;
       let c = 0;
       for (let i = tube.length - 1; i >= 0; i--) {
           if (tube[i].colorIndex === topColor) c++;
           else break;
       }
       return c;
   }
   const movingCount = getMovingCount();

   return (
       <div 
          onClick={(e) => { e.stopPropagation(); onSelect(index); }}
          className={cn(
             "relative w-[44px] sm:w-[56px] h-[180px] sm:h-[224px] rounded-b-[20px] sm:rounded-b-[24px] border-x-[3px] border-b-[3px] sm:border-x-4 sm:border-b-4 flex flex-col-reverse justify-start p-[2px] sm:p-[3px] cursor-pointer transition-all duration-300",
             isTutorialHighlight ? "pointer-events-auto" : "",
             "dark:bg-black/20 bg-black/5 dark:shadow-[inset_0_-10px_20px_rgba(0,0,0,0.5)] shadow-[inset_0_-10px_20px_rgba(0,0,0,0.1)]",
             isSelected ? "dark:border-white/60 border-black/40 dark:bg-white/10 bg-black/5 dark:shadow-white/10 shadow-black/10 translate-y-[-4px]" : "dark:border-white/20 border-black/10 dark:hover:border-white/30 hover:border-black/20 dark:hover:bg-white/5 hover:bg-black/10",
             isHintSource && "border-yellow-400/80 shadow-[0_0_20px_rgba(250,204,21,0.5)] animate-pulse",
             isHintDest && "border-emerald-400/80 shadow-[0_0_20px_rgba(52,211,153,0.5)] animate-pulse",
             isTutorialHighlight && "border-emerald-400 ring-4 ring-emerald-500/50 shadow-[0_0_30px_rgba(52,211,153,0.8)] z-20 scale-105"
          )}
       >
          {tube.map((block, i) => {
             const isMoving = isSelected && i >= tube.length - movingCount;
             return (
                 <motion.div
                    key={block.id}
                    layoutId={block.id}
                    animate={{ y: isMoving ? -24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 28 }}
                    className="w-full h-[38px] sm:h-[48px] rounded-[8px] sm:rounded-xl mb-[2px] sm:mb-1 relative overflow-hidden shadow-md flex-shrink-0 border border-black/10"
                    style={{ background: LEVEL_COLORS[block.colorIndex] }}
                 >
                    <div className="absolute inset-x-2 top-1 h-3 rounded-full bg-white/25 blur-[1px]"></div>
                    <div className="absolute -left-2 top-0 bottom-0 w-4 bg-white/20 blur-[2px]"></div>
                 </motion.div>
             )
          })}
       </div>
   )
}

function WinModal({ level, isDaily, isTutorial, onNext }: { level: number, isDaily: boolean, isTutorial?: boolean, onNext: () => void }) {
   useEffect(() => {
      soundEngine.levelComplete();
      const duration = 2500;
      const end = Date.now() + duration;

      const frame = () => {
         confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93']
         });
         confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93']
         });

         if (Date.now() < end) {
            requestAnimationFrame(frame);
         }
      };
      
      frame();
   }, []);

   return (
      <div className="absolute inset-0 z-50 flex items-center justify-center p-4 dark:bg-zinc-950/80 bg-zinc-900/40 backdrop-blur-sm shadow-xl">
         <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            className="dark:bg-zinc-900 bg-white border dark:border-zinc-800 border-zinc-200 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center"
         >
            <div className="w-20 h-20 rounded-full dark:bg-emerald-500/20 bg-emerald-100 flex items-center justify-center mb-6">
                <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold dark:text-white text-zinc-900 mb-2 tracking-tight">
                {isTutorial ? 'Tutorial Complete!' : isDaily ? 'Daily Challenge Cleared!' : `Level ${level} Cleared`}
            </h2>
            <p className="dark:text-zinc-400 text-zinc-600 mb-8 max-w-xs text-center text-sm">
                {isTutorial ? "You're ready to play." : "Excellent logical deduction."} {isTutorial ? '' : isDaily ? 'Come back tomorrow for another challenge!' : 'Ready for the next challenge?'}
            </p>
            <button 
                onClick={() => {
                    soundEngine.init();
                    soundEngine.select();
                    onNext();
                }}
                className="w-full py-4 rounded-xl dark:bg-white bg-zinc-900 dark:text-zinc-950 text-white font-bold text-lg dark:hover:bg-zinc-200 hover:bg-zinc-800 transition-colors shadow-lg shadow-white/10"
            >
                {isTutorial ? 'Start Level 1' : isDaily ? 'Continue' : 'Next Level'}
            </button>
         </motion.div>
      </div>
   )
}

function ResetConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) {
   return (
      <div className="absolute inset-0 z-50 flex items-center justify-center p-4 dark:bg-zinc-950/80 bg-zinc-900/40 backdrop-blur-sm shadow-xl">
         <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            className="dark:bg-zinc-900 bg-white border dark:border-zinc-800 border-zinc-200 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center"
         >
            <div className="w-16 h-16 rounded-full dark:bg-red-500/10 bg-red-100 flex items-center justify-center mb-6 border dark:border-red-500/20 border-red-200">
                <TriangleAlert className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold dark:text-white text-zinc-900 mb-2 tracking-tight">Reset Level?</h2>
            <p className="dark:text-zinc-400 text-zinc-600 mb-8 max-w-xs text-center text-sm">
                This will wipe out all your current progress and restart the puzzle from the beginning.
            </p>
            <div className="flex gap-4 w-full">
                <button 
                    onClick={onCancel}
                    className="flex-1 py-3 rounded-xl dark:bg-zinc-800 bg-zinc-200 dark:text-white text-zinc-900 font-medium dark:hover:bg-zinc-700 hover:bg-zinc-300 transition-colors shadow-sm"
                >
                    Cancel
                </button>
                <button 
                    onClick={onConfirm}
                    className="flex-1 py-3 rounded-xl bg-red-500/90 text-white font-medium hover:bg-red-500 transition-colors shadow-sm"
                >
                    Reset
                </button>
            </div>
         </motion.div>
      </div>
   )
}

function AdModal({ onComplete }: { onComplete: () => void }) {
   const [timeLeft, setTimeLeft] = useState(5);

   useEffect(() => {
       try {
           // @ts-ignore
           (window.adsbygoogle = window.adsbygoogle || []).push({});
       } catch (e) {
           console.error("AdSense error", e);
       }
   }, []);

   useEffect(() => {
       if (timeLeft > 0) {
           const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
           return () => clearTimeout(timer);
       }
   }, [timeLeft]);

   return (
       <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 dark:bg-zinc-950/95 bg-zinc-900/60 backdrop-blur-md shadow-xl overflow-hidden">
          <motion.div 
             initial={{ scale: 0.95, opacity: 0, y: 10 }}
             animate={{ scale: 1, opacity: 1, y: 0 }}
             exit={{ scale: 0.95, opacity: 0, y: -10 }}
             className="dark:bg-black/40 bg-white/90 border dark:border-zinc-800 border-zinc-200 rounded-2xl w-full max-w-sm h-full max-h-[500px] flex flex-col relative overflow-hidden shadow-2xl"
          >
             <div className="flex justify-between items-center p-3 border-b dark:border-zinc-800/60 border-zinc-200/60 dark:bg-zinc-900/40 bg-zinc-100/40">
                 <span className="text-[10px] font-bold dark:text-zinc-500 text-zinc-500 uppercase tracking-widest px-2 py-0.5 rounded-full border dark:border-zinc-800 border-zinc-300">Advertisement</span>
                 {timeLeft > 0 ? (
                     <span className="text-xs dark:text-zinc-400 text-zinc-600 font-medium dark:bg-zinc-800 bg-zinc-200 px-3 py-1 rounded-full">Reward in {timeLeft}</span>
                 ) : (
                     <button 
                         onClick={onComplete}
                         className="dark:text-white text-zinc-900 text-xs font-bold dark:bg-zinc-700/80 bg-zinc-200 dark:hover:bg-zinc-600 hover:bg-zinc-300 px-4 py-1 rounded-full transition-colors shadow-sm cursor-pointer"
                     >
                         Skip Ad ⏭
                     </button>
                 )}
             </div>

             <div className="flex-1 w-full dark:bg-zinc-900/50 bg-zinc-50/50 flex flex-col items-center justify-center p-6 text-center">
                 <div className="w-full max-w-[300px] h-[250px] dark:bg-zinc-800/80 bg-zinc-200/80 rounded-xl overflow-hidden mb-6 flex items-center justify-center relative">
                     <span className="absolute text-xs text-zinc-500 z-0 text-center px-4 mb-2">
                         Google AdSpace
                     </span>
                     {/* AdSense Unit */}
                     <ins className="adsbygoogle relative z-10 w-full h-full block"
                          style={{ display: "block" }}
                          data-ad-client="ca-pub-1639833678251990"
                          data-ad-slot="5396881650"
                          data-ad-format="auto"
                          data-full-width-responsive="true"></ins>
                 </div>
                 
                 <h3 className="text-xl font-bold dark:text-white text-zinc-900 mb-2">Support the Developer</h3>
                 <p className="dark:text-zinc-400 text-zinc-600 text-sm max-w-[250px]">
                     Ads help keep Block Sort free to play! Thanks for playing.
                 </p>
             </div>
          </motion.div>
       </div>
   )
}
