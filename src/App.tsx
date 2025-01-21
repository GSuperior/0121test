import { useState, useEffect } from 'react'
import './App.css'

interface GameState {
  sunlight: number;
  plants: Plant[];
  zombies: Zombie[];
  selectedPlant: string | null;
  fallingStars: Array<{
    id: number;
    position: { x: number; y: number };
    value: number;
  }>;
}

interface Plant {
  id: number;
  type: string;
  position: { row: number; col: number };
  health: number;
  maxHealth: number;
  cost: number;
  lastActionTime?: number;
  state: 'idle' | 'attacking' | 'producing' | 'countdown';
  damage?: number;
  projectiles?: Array<{ row: number; col: number }>;
  sunlightProduction?: number;
  productionInterval?: number;
  initialDelay?: number;
  explosionRange?: number;
  explosionDamage?: number;
  countdownTime?: number;
}

interface Zombie {
  id: number;
  type: string;
  position: { row: number; col: number };
  health: number;
  maxHealth: number;
  speed: number;
  state: 'normal' | 'barrier' | 'bucket';
  armor?: {
    type: 'barrier' | 'bucket';
    health: number;
    maxHealth: number;
  };
  damage: number;
  attackSpeed: number;
  lastAttackTime?: number;
}

interface PlantCard {
  type: string;
  cost: number;
  image: string;
  maxHealth: number;
  damage?: number;
  attackInterval?: number;
  sunlightProduction?: number;
  productionInterval?: number;
  initialDelay?: number;
  explosionRange?: number;
  explosionDamage?: number;
  countdownTime?: number;
}

const PLANT_TYPES: PlantCard[] = [
  { 
    type: 'sunflower', 
    cost: 50, 
    image: '🌻',
    maxHealth: 300,
    sunlightProduction: 25,
    productionInterval: 7000,
    initialDelay: 8500
  },
  { 
    type: 'peashooter', 
    cost: 100, 
    image: '🌱',
    maxHealth: 300,
    damage: 20,
    attackInterval: 1500
  },
  { 
    type: 'wallnut', 
    cost: 50, 
    image: '🥜',
    maxHealth: 400
  },
  {
    type: 'cherry', 
    cost: 150, 
    image: '🍒',
    maxHealth: 100,
    explosionRange: 1,
    explosionDamage: 180,
    countdownTime: 3000
  }
];

function App() {
  interface ExtendedGameState extends GameState {
  wave: number;
  lives: number;
  gameStatus: 'playing' | 'won' | 'lost';
}

const [gameState, setGameState] = useState<ExtendedGameState>({
    sunlight: 50,
    plants: [],
    zombies: [],
    selectedPlant: null,
    fallingStars: [],
    wave: 1,
    lives: 5,
    gameStatus: 'playing' as 'playing' | 'won' | 'lost'
  });

  useEffect(() => {
    const spawnZombies = () => {
      if (gameState.gameStatus !== 'playing') return;

      const zombieTypes = ['normal', 'barrier', 'bucket'];
      const zombieCount = Math.min(3 + Math.floor(gameState.wave / 2), 10);
      const spawnDelay = 12000 - Math.min(gameState.wave * 500, 5000);

      for (let i = 0; i < zombieCount; i++) {
        setTimeout(() => {
          const type = zombieTypes[Math.floor(Math.random() * (gameState.wave > 3 ? 3 : 1))];
          const row = Math.floor(Math.random() * 6);
          
          const newZombie: Zombie = {
            id: Date.now() + i,
            type,
            position: { row, col: 8 },
            health: type === 'normal' ? 200 : 300,
            maxHealth: type === 'normal' ? 200 : 300,
            speed: type === 'barrier' ? 0.8 : 1,
            state: type as 'normal' | 'barrier' | 'bucket',
            armor: type !== 'normal' ? {
              type: type as 'barrier' | 'bucket',
              health: 100,
              maxHealth: 100
            } : undefined,
            damage: 25,
            attackSpeed: 2000
          };

          setGameState(prev => ({
            ...prev,
            zombies: [...prev.zombies, newZombie]
          }));
        }, i * spawnDelay);
      }

      if (gameState.wave < 10) {
        setTimeout(() => {
          setGameState(prev => ({ ...prev, wave: prev.wave + 1 }));
          spawnZombies();
        }, zombieCount * spawnDelay + 15000);
      }
    };

    const gameLoop = setInterval(() => {
      setGameState(prev => {
        if (prev.gameStatus !== 'playing') return prev;

        // 处理植物攻击和生产
        const updatedPlants = prev.plants.map(plant => {
          const now = Date.now();
          
          if (plant.type === 'sunflower' && plant.sunlightProduction && plant.productionInterval) {
            if (!plant.lastActionTime || now - plant.lastActionTime >= plant.productionInterval) {
              prev.sunlight += plant.sunlightProduction;
              plant.lastActionTime = now;
            }
          } else if (plant.type === 'peashooter' && plant.damage) {
            const zombiesInRow = prev.zombies.filter(z => z.position.row === plant.position.row);
            const targetZombie = zombiesInRow.find(z => z.position.col > plant.position.col && z.position.col <= 8);
            
            if (targetZombie && (!plant.lastActionTime || now - plant.lastActionTime >= 1500)) {
              targetZombie.health -= plant.damage;
              plant.lastActionTime = now;
              plant.state = 'attacking';
            } else {
              plant.state = 'idle';
            }
          } else if (plant.type === 'cherry' && plant.explosionDamage && plant.countdownTime) {
            if (!plant.lastActionTime || now - plant.lastActionTime >= plant.countdownTime) {
              const affectedZombies = prev.zombies.filter(z => 
                Math.abs(z.position.row - plant.position.row) <= (plant.explosionRange || 1) &&
                Math.abs(z.position.col - plant.position.col) <= (plant.explosionRange || 1)
              );
              
              affectedZombies.forEach(z => z.health -= plant.explosionDamage!);
              plant.health = 0;
            }
          }
          
          return plant;
        });

        prev.plants = updatedPlants.filter(p => p.health > 0);
        prev.zombies = prev.zombies.filter(z => z.health > 0);

        // 处理僵尸移动和攻击
        const newZombies = prev.zombies.map(zombie => {
          const plantsInRow = prev.plants.filter(p => p.position.row === zombie.position.row);
          const nearestPlant = plantsInRow.find(p => 
            Math.abs(p.position.col - zombie.position.col) <= 0.3
          );

          if (nearestPlant) {
            if (!zombie.lastAttackTime || Date.now() - zombie.lastAttackTime >= zombie.attackSpeed) {
              const updatedPlants = prev.plants.map(p => {
                if (p.id === nearestPlant.id) {
                  return { ...p, health: p.health - zombie.damage };
                }
                return p;
              });
              prev.plants = updatedPlants.filter(p => p.health > 0);
              zombie.lastAttackTime = Date.now();
            }
            return zombie;
          }

          if (zombie.position.col <= 0) {
            return { ...zombie, position: { ...zombie.position, col: 0 } };
          }
          return {
            ...zombie,
            position: {
              ...zombie.position,
              col: zombie.position.col - 0.02 * zombie.speed
            }
          };
        });

        const zombiesReachedEnd = newZombies.filter(z => z.position.col <= 0).length;
        const newLives = prev.lives - zombiesReachedEnd;
        const gameStatus = newLives <= 0 ? 'lost' : 
                          (prev.wave >= 10 && prev.zombies.length === 0) ? 'won' : 
                          prev.gameStatus;

        return {
          ...prev,
          zombies: newZombies.filter(z => z.position.col > 0),
          lives: newLives,
          gameStatus
        };
      });
    }, 50);

    spawnZombies();
    return () => clearInterval(gameLoop);
  }, [gameState.wave, gameState.gameStatus]);

  useEffect(() => {
    const generateSunlight = () => {
      const randomDelay = Math.floor(Math.random() * 3000) + 5000; // 5-8秒随机间隔
      const newStar = {
        id: Date.now(),
        position: {
          x: Math.random() * (window.innerWidth - 50),
          y: -50
        },
        value: 25
      };

      setGameState(prev => ({
        ...prev,
        fallingStars: [...prev.fallingStars, newStar]
      }));

      setTimeout(generateSunlight, randomDelay);
    };

    const timer = setTimeout(generateSunlight, 5000);
    return () => clearTimeout(timer);
  }, []);

  const collectSunlight = (starId: number) => {
    setGameState(prev => ({
      ...prev,
      sunlight: prev.sunlight + 25,
      fallingStars: prev.fallingStars.filter(star => star.id !== starId)
    }));
  };

  const handlePlantSelection = (plantType: string) => {
    setGameState(prev => ({
      ...prev,
      selectedPlant: plantType
    }));
  };

  const handleCellClick = (row: number, col: number) => {
    if (!gameState.selectedPlant) return;

    const plantType = PLANT_TYPES.find(p => p.type === gameState.selectedPlant);
    if (!plantType) return;

    if (gameState.sunlight < plantType.cost) return;

    if (gameState.plants.some(p => p.position.row === row && p.position.col === col)) return;

    const newPlant: Plant = {
      id: Date.now(),
      type: gameState.selectedPlant,
      position: { row, col },
      health: plantType.maxHealth,
      maxHealth: plantType.maxHealth,
      cost: plantType.cost,
      state: 'idle',
      lastActionTime: Date.now(),
      damage: plantType.damage,
      sunlightProduction: plantType.sunlightProduction,
      productionInterval: plantType.productionInterval,
      initialDelay: plantType.initialDelay,
      explosionRange: plantType.explosionRange,
      explosionDamage: plantType.explosionDamage,
      countdownTime: plantType.countdownTime
    };

    setGameState(prev => ({
      ...prev,
      plants: [...prev.plants, newPlant],
      sunlight: prev.sunlight - plantType.cost,
      selectedPlant: null
    }));
  };

  const renderGrid = () => {
    const grid = [];
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 9; col++) {
        const plant = gameState.plants.find(
          p => p.position.row === row && p.position.col === col
        );
        grid.push(
          <div
            key={`${row}-${col}`}
            className={`grid-cell ${plant ? 'occupied' : ''}`}
            onClick={() => handleCellClick(row, col)}
          >
            {plant && <div className="plant">{PLANT_TYPES.find(p => p.type === plant.type)?.image}</div>}
          </div>
        );
      }
    }
    return grid;
  };

  const renderZombies = () => {
    return gameState.zombies.map(zombie => {
      const healthPercentage = (zombie.health / zombie.maxHealth) * 100;
      return (
        <div
          key={zombie.id}
          className="zombie"
          style={{
            left: `${(zombie.position.col / 9) * 100}%`,
            top: `${(zombie.position.row / 6) * 100}%`,
          }}
        >
          {zombie.type === 'normal' ? '🧟' : zombie.type === 'barrier' ? '🛡️🧟' : '🪣🧟'}
          <div className="zombie-health">
            <div
              className="zombie-health-bar"
              style={{ width: `${healthPercentage}%` }}
            />
          </div>
        </div>
      );
    });
  };

  return (
    <div className="game-container">
      <header className="game-header">
        <div className="sunlight-counter">
          ☀️ {gameState.sunlight}
        </div>
        <div className="wave-indicator">
          🌊 Wave {gameState.wave}/10
        </div>
        <div className="lives-counter">
          ❤️ {gameState.lives}
        </div>
      </header>
      <div className="game-board">
        {renderGrid()}
        {renderZombies()}
        {gameState.fallingStars.map(star => (
          <div
            key={star.id}
            className="falling-star"
            style={{
              left: star.position.x + 'px',
              top: star.position.y + 'px'
            }}
            onClick={() => collectSunlight(star.id)}
          >
            ☀️
          </div>
        ))}
        {gameState.gameStatus !== 'playing' && (
          <div className="game-status">
            {gameState.gameStatus === 'won' ? '🎉 You Won!' : '💀 Game Over'}
          </div>
        )}
        <div className="plant-selector">
          {PLANT_TYPES.map((plant) => (
            <div
              key={plant.type}
              className={`plant-card ${gameState.selectedPlant === plant.type ? 'selected' : ''} ${gameState.sunlight < plant.cost ? 'disabled' : ''}`}
              onClick={() => handlePlantSelection(plant.type)}
            >
              <div className="plant-image">{plant.image}</div>
              <div className="plant-cost">☀️ {plant.cost}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App