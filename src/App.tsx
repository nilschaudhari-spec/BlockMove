import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Undo2, RotateCcw, Check, Lightbulb, SkipForward } from 'lucide-react';
import { cn } from './lib/utils';
import { soundEngine } from './lib/sounds';

const TUBE_CAPACITY = 4;

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
  "linear-gradient(135deg, #A8DADC, #66A5AD)"  // Ice
];

type Block = {
  id: string;
  colorIndex: number;
};

function generateLevel(levelNumber: number) {
  const numColors = Math.min(14, 3 + Math.floor((levelNumber - 1) / 15)); 
  const numEmpty = levelNumber > 100 ? 3 : 2; 
  const numTubes = numColors + numEmpty;

  let idCounter = 0;
  const startTubes: Block[][] = [];
  for (let c = 0; c < numColors; c++) {
      startTubes.push(Array.from({length: TUBE_CAPACITY}, () => ({ id: `block-${idCounter++}`, colorIndex: c })));
  }
  for (let i = 0; i < numEmpty; i++) {
      startTubes.push([]);
  }

  // Shuffle intensity increases with level
  const shuffles = Math.min(300, 30 + levelNumber * 8); 
  const cloneState = (state: Block[][]) => state.map(t => [...t]);
  let currentTubes = cloneState(startTubes);
  
  let lastMove = { from: -1, to: -1 };

  for (let i = 0; i < shuffles; i++) {
    const validMoves: { from: number, to: number }[] = [];

    for (let from = 0; from < numTubes; from++) {
      if (currentTubes[from].length === 0) continue;
      
      const topBlock = currentTubes[from][currentTubes[from].length - 1];
      const blockBelow = currentTubes[from].length > 1 ? currentTubes[from][currentTubes[from].length - 2] : null;

      if (blockBelow === null || blockBelow.colorIndex === topBlock.colorIndex) {
        for (let to = 0; to < numTubes; to++) {
          if (from === to) continue;
          if (currentTubes[to].length < TUBE_CAPACITY) {
             if (from === lastMove.to && to === lastMove.from) {
                continue;
             }
             validMoves.push({ from, to });
          }
        }
      }
    }

    if (validMoves.length === 0) break;

    const move = validMoves[Math.floor(Math.random() * validMoves.length)];
    const block = currentTubes[move.from].pop()!;
    currentTubes[move.to].push(block);
    lastMove = move;
  }

  return currentTubes;
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

function generateValidLevel(level: number): Block[][] {
   let tubes = generateLevel(level);
   while(checkWin(tubes)) {
       tubes = generateLevel(level);
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

export default function App() {
  const [levelNumber, setLevelNumber] = useState(() => {
    const saved = localStorage.getItem('blockSortLevel');
    const lvl = saved ? parseInt(saved) : 1;
    return isNaN(lvl) ? 1 : lvl;
  });

  const [showWin, setShowWin] = useState(false);

  useEffect(() => {
      localStorage.setItem('blockSortLevel', levelNumber.toString());
  }, [levelNumber]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800 flex flex-col relative overflow-hidden">
        {/* Background ambient lights */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-zinc-800/30 blur-[120px] rounded-full" />
           <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-zinc-900/40 blur-[120px] rounded-full" />
        </div>

        <GameBoard 
           key={levelNumber} 
           levelNumber={levelNumber} 
           onWin={() => setShowWin(true)} 
        />

        <AnimatePresence>
            {showWin && (
               <WinModal 
                  level={levelNumber} 
                  onNext={() => {
                      setLevelNumber(l => l + 1);
                      setShowWin(false);
                  }} 
               />
            )}
        </AnimatePresence>
    </div>
  )
}

function GameBoard({ levelNumber, onWin }: { levelNumber: number, onWin: () => void }) {
    const [initialTubes, setInitialTubes] = useState<Block[][]>(() => generateValidLevel(levelNumber));
    const [tubes, setTubes] = useState<Block[][]>(initialTubes);
    const [history, setHistory] = useState<Block[][][]>([]);
    const [selectedTube, setSelectedTube] = useState<number | null>(null);
    const [moves, setMoves] = useState(0);
    const [hint, setHint] = useState<{from: number, to: number} | null>(null);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
       if (isComplete) {
           const t = setTimeout(() => onWin(), 600);
           return () => clearTimeout(t);
       }
    }, [isComplete, onWin]);

    const handleTubeClick = (tubeIndex: number) => {
        setHint(null);
        if (isComplete) return;

        soundEngine.init();

        if (selectedTube === null) {
            if (tubes[tubeIndex].length === 0) {
                soundEngine.error();
                return;
            }
            soundEngine.select();
            setSelectedTube(tubeIndex);
        } else {
            if (selectedTube === tubeIndex) {
                soundEngine.deselect();
                setSelectedTube(null);
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
                } else {
                    soundEngine.deselect();
                    setSelectedTube(null);
                }
                return;
            }

            if (dest.length === TUBE_CAPACITY) {
                soundEngine.select();
                setSelectedTube(tubeIndex);
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
            <header className="w-full flex items-center justify-between p-6 text-zinc-100 z-10 relative">
                  <div className="flex flex-col">
                      <span className="text-sm font-semibold text-zinc-500 uppercase tracking-widest bg-zinc-800/50 rounded-full px-3 py-1 w-fit border border-zinc-700/50 mb-2">Block Sort</span>
                      <div className="flex items-baseline gap-4">
                          <h1 className="text-3xl font-bold tracking-tight">Level {levelNumber}</h1>
                          <span className="text-zinc-400 font-medium bg-zinc-800/40 px-3 py-1 rounded-full text-sm border border-zinc-800 shadow-inner">{moves} Moves</span>
                      </div>
                  </div>
                  <div className="flex gap-3">
                     {canSkip && (
                         <motion.button 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={(e) => { e.stopPropagation(); handleSkip(); }}
                            title="Skip Level (Available after 10 moves)"
                            className="p-3 rounded-full bg-indigo-500/20 border border-indigo-500/50 hover:bg-indigo-500/30 transition-all shadow-sm"
                         >
                             <SkipForward className="w-5 h-5 text-indigo-300" />
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
                        className="p-3 rounded-full bg-zinc-800/80 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                     >
                         <Lightbulb className="w-5 h-5 text-yellow-400" />
                     </button>
                     <button 
                        onClick={(e) => { e.stopPropagation(); handleUndo(); }}
                        disabled={history.length === 0 || isComplete} 
                        className="p-3 rounded-full bg-zinc-800/80 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                     >
                         <Undo2 className="w-5 h-5 text-white" />
                     </button>
                     <button 
                        onClick={(e) => { e.stopPropagation(); handleReset(); }}
                        disabled={history.length === 0 || isComplete} 
                        className="p-3 rounded-full bg-zinc-800/80 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                     >
                         <RotateCcw className="w-5 h-5 text-white" />
                     </button>
                  </div>
            </header>

            <main className="flex-1 w-full p-4 flex flex-col relative overflow-y-auto overflow-x-hidden soft-scrollbar items-center justify-center">
               <div className="flex flex-wrap justify-center content-center gap-x-5 gap-y-12 w-full max-w-4xl pb-16 pt-8">
                   {tubes.map((tube, i) => (
                      <Tube 
                          key={`tube-${i}`} 
                          tube={tube} 
                          index={i} 
                          isSelected={selectedTube === i} 
                          onSelect={handleTubeClick} 
                          isHintSource={hint?.from === i}
                          isHintDest={hint?.to === i}
                      />
                   ))}
               </div>
            </main>
        </div>
    )
}

function Tube({ tube, index, isSelected, onSelect, isHintSource, isHintDest }: { tube: Block[], index: number, isSelected: boolean, onSelect: (i: number) => void, isHintSource?: boolean, isHintDest?: boolean }) {
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
             "relative w-14 h-[224px] rounded-b-[24px] border-x-4 border-b-4 bg-black/20 shadow-[inset_0_-10px_20px_rgba(0,0,0,0.5)] flex flex-col-reverse justify-start p-[3px] cursor-pointer transition-all duration-300",
             isSelected ? "border-white/60 bg-white/10 shadow-white/10 translate-y-[-4px]" : "border-white/20 hover:border-white/30 hover:bg-white/5",
             isHintSource && "border-yellow-400/80 shadow-[0_0_20px_rgba(250,204,21,0.5)] animate-pulse",
             isHintDest && "border-emerald-400/80 shadow-[0_0_20px_rgba(52,211,153,0.5)] animate-pulse"
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
                    className="w-full h-[48px] rounded-xl mb-1 relative overflow-hidden shadow-md flex-shrink-0 border border-black/10"
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

function WinModal({ level, onNext }: { level: number, onNext: () => void }) {
   return (
      <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm shadow-xl">
         <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center"
         >
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
                <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Level {level} Cleared</h2>
            <p className="text-zinc-400 mb-8 max-w-xs text-center text-sm">
                Excellent logical deduction. Ready for the next challenge?
            </p>
            <button 
                onClick={() => {
                    soundEngine.init();
                    soundEngine.select();
                    onNext();
                }}
                className="w-full py-4 rounded-xl bg-white text-zinc-950 font-bold text-lg hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10"
            >
                Next Level
            </button>
         </motion.div>
      </div>
   )
}
