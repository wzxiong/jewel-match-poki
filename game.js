/**
 * Jewel Match - H5 Match-3 Game for Poki
 * Compatible with Poki SDK requirements
 */

// ==================== POKI SDK INTEGRATION ====================
let pokiSDKReady = false;
let gameReady = false;
let pokiSDKTimeout = null;

// Initialize Poki SDK with timeout
function initPokiSDK() {
    // Set timeout: if SDK doesn't respond in 3 seconds, continue anyway
    pokiSDKTimeout = setTimeout(() => {
        console.log("Poki SDK timeout, continuing without ads");
        pokiSDKReady = false;
        checkReady();
    }, 3000);
    
    PokiSDK.init().then(() => {
        clearTimeout(pokiSDKTimeout);
        console.log("Poki SDK initialized");
        pokiSDKReady = true;
        checkReady();
    }).catch((err) => {
        clearTimeout(pokiSDKTimeout);
        console.log("Poki SDK failed:", err);
        pokiSDKReady = false;
        checkReady();
    });
    
    try {
        PokiSDK.gameLoadingStart();
    } catch(e) {
        console.log("gameLoadingStart failed:", e);
    }
}

// Start initialization
initPokiSDK();

// Update loading progress
function updateLoadingProgress(progress) {
    const progressBar = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    if (progressBar) {
        progressBar.style.width = (progress * 100) + '%';
    }
    if (loadingText) {
        loadingText.textContent = 'Loading... ' + Math.floor(progress * 100) + '%';
    }
    
    // Only call Poki SDK if it's ready
    if (pokiSDKReady) {
        try {
            PokiSDK.gameLoadingProgress(progress);
        } catch(e) {
            console.log("gameLoadingProgress failed:", e);
        }
    }
}

// Check if game is ready to start
function checkReady() {
    if (gameReady) {
        startGame();
    }
}

// Start game function
function startGame() {
    try {
        if (pokiSDKReady) {
            PokiSDK.gameLoadingFinished();
        }
    } catch(e) {
        console.log("gameLoadingFinished failed:", e);
    }
    
    const loadingScreen = document.getElementById('loading-screen');
    const muteBtn = document.getElementById('mute-btn');
    
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
    if (muteBtn) {
        muteBtn.classList.add('visible');
    }
    
    if (game) {
        game.start();
    }
}

// ==================== GAME CONSTANTS ====================
const GRID_SIZE = 8;
const GEM_TYPES = 6;
const COLORS = [
    '#e74c3c', // Red
    '#3498db', // Blue
    '#2ecc71', // Green
    '#f39c12', // Yellow
    '#9b59b6', // Purple
    '#e67e22'  // Orange
];
const EMOJIS = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠'];

// ==================== GAME CLASS ====================
class JewelMatch {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Game state
        this.grid = [];
        this.score = 0;
        this.level = 1;
        this.targetScore = 1000;
        this.moves = 20;
        this.combo = 0;
        this.maxCombo = 0;
        this.gameOver = false;
        this.gameWon = false;
        this.isPaused = false;
        
        // Selection
        this.selectedGem = null;
        this.isAnimating = false;
        
        // Animation
        this.animations = [];
        this.particles = [];
        
        // Input
        this.setupInput();
        
        // Audio state
        this.muted = false;
        document.getElementById('mute-btn').addEventListener('click', () => this.toggleMute());
        
        // Initialize grid
        this.initGrid();
        
        // Mark game as ready
        gameReady = true;
        updateLoadingProgress(1);
        checkReady();
    }
    
    resize() {
        const container = document.getElementById('game-container');
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.gemSize = Math.min(this.canvas.width, this.canvas.height * 0.7) / GRID_SIZE;
        this.gridOffsetX = (this.canvas.width - this.gemSize * GRID_SIZE) / 2;
        this.gridOffsetY = this.canvas.height * 0.22;
    }
    
    setupInput() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleInput(e.offsetX, e.offsetY));
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.handleInput(touch.clientX - rect.left, touch.clientY - rect.top);
        }, { passive: false });
    }
    
    handleInput(x, y) {
        if (this.isAnimating || this.gameOver || this.gameWon) return;
        
        const col = Math.floor((x - this.gridOffsetX) / this.gemSize);
        const row = Math.floor((y - this.gridOffsetY) / this.gemSize);
        
        if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
        
        if (!this.selectedGem) {
            this.selectedGem = { row, col };
            this.createSelectEffect(row, col);
        } else {
            const rowDiff = Math.abs(this.selectedGem.row - row);
            const colDiff = Math.abs(this.selectedGem.col - col);
            
            if (rowDiff + colDiff === 1) {
                this.trySwap(this.selectedGem, { row, col });
                this.selectedGem = null;
            } else if (rowDiff === 0 && colDiff === 0) {
                this.selectedGem = null;
            } else {
                this.selectedGem = { row, col };
                this.createSelectEffect(row, col);
            }
        }
    }
    
    toggleMute() {
        this.muted = !this.muted;
        document.getElementById('mute-btn').textContent = this.muted ? '🔇' : '🔊';
    }
    
    // ==================== GRID LOGIC ====================
    initGrid() {
        this.grid = [];
        for (let row = 0; row < GRID_SIZE; row++) {
            this.grid[row] = [];
            for (let col = 0; col < GRID_SIZE; col++) {
                let type;
                do {
                    type = Math.floor(Math.random() * GEM_TYPES);
                } while (
                    (col >= 2 && this.grid[row][col-1].type === type && this.grid[row][col-2].type === type) ||
                    (row >= 2 && this.grid[row-1][col].type === type && this.grid[row-2][col].type === type)
                );
                this.grid[row][col] = {
                    type: type,
                    row: row,
                    col: col,
                    x: col * this.gemSize,
                    y: row * this.gemSize,
                    scale: 1,
                    alpha: 1,
                    offsetY: 0,
                    matched: false
                };
            }
        }
        updateLoadingProgress(0.5);
    }
    
    async trySwap(gem1, gem2) {
        this.isAnimating = true;
        
        // Swap types
        const temp = this.grid[gem1.row][gem1.col].type;
        this.grid[gem1.row][gem1.col].type = this.grid[gem2.row][gem2.col].type;
        this.grid[gem2.row][gem2.col].type = temp;
        
        // Check for matches
        const matches = this.findMatches();
        
        if (matches.length > 0) {
            this.moves--;
            await this.processMatches();
            this.checkGameState();
        } else {
            // Swap back
            await this.sleep(200);
            const temp2 = this.grid[gem1.row][gem1.col].type;
            this.grid[gem1.row][gem1.col].type = this.grid[gem2.row][gem2.col].type;
            this.grid[gem2.row][gem2.col].type = temp2;
            this.isAnimating = false;
        }
    }
    
    findMatches() {
        const matches = [];
        const matched = new Set();
        
        // Horizontal matches
        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE - 2; col++) {
                const type = this.grid[row][col].type;
                if (type === this.grid[row][col+1].type && type === this.grid[row][col+2].type) {
                    for (let i = 0; i < 3; i++) {
                        const key = `${row},${col+i}`;
                        if (!matched.has(key)) {
                            matched.add(key);
                            matches.push({ row, col: col + i });
                        }
                    }
                }
            }
        }
        
        // Vertical matches
        for (let col = 0; col < GRID_SIZE; col++) {
            for (let row = 0; row < GRID_SIZE - 2; row++) {
                const type = this.grid[row][col].type;
                if (type === this.grid[row+1][col].type && type === this.grid[row+2][col].type) {
                    for (let i = 0; i < 3; i++) {
                        const key = `${row+i},${col}`;
                        if (!matched.has(key)) {
                            matched.add(key);
                            matches.push({ row: row + i, col });
                        }
                    }
                }
            }
        }
        
        return matches;
    }
    
    async processMatches() {
        this.combo = 0;
        
        while (true) {
            const matches = this.findMatches();
            if (matches.length === 0) break;
            
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;
            
            // Mark as matched and create effects
            for (const match of matches) {
                this.grid[match.row][match.col].matched = true;
                this.createParticles(
                    this.gridOffsetX + match.col * this.gemSize + this.gemSize/2,
                    this.gridOffsetY + match.row * this.gemSize + this.gemSize/2,
                    COLORS[this.grid[match.row][match.col].type]
                );
            }
            
            // Calculate score
            const points = matches.length * 10 * this.combo;
            this.score += points;
            
            // Wait for match animation
            await this.animateMatch(matches);
            
            // Drop gems
            await this.dropGems();
            
            // Fill new gems
            await this.fillNewGems();
        }
        
        this.isAnimating = false;
    }
    
    animateMatch(matches) {
        return new Promise(resolve => {
            let progress = 0;
            const animate = () => {
                progress += 0.1;
                for (const match of matches) {
                    this.grid[match.row][match.col].scale = 1 - progress;
                    this.grid[match.row][match.col].alpha = 1 - progress;
                }
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            animate();
        });
    }
    
    async dropGems() {
        for (let col = 0; col < GRID_SIZE; col++) {
            let writePos = GRID_SIZE - 1;
            for (let row = GRID_SIZE - 1; row >= 0; row--) {
                if (!this.grid[row][col].matched) {
                    if (writePos !== row) {
                        this.grid[writePos][col].type = this.grid[row][col].type;
                        this.grid[writePos][col].matched = false;
                        this.grid[writePos][col].scale = 1;
                        this.grid[writePos][col].alpha = 1;
                    }
                    writePos--;
                }
            }
            
            // Clear remaining positions
            for (let row = writePos; row >= 0; row--) {
                this.grid[row][col].type = -1;
            }
        }
        await this.sleep(150);
    }
    
    async fillNewGems() {
        for (let col = 0; col < GRID_SIZE; col++) {
            for (let row = 0; row < GRID_SIZE; row++) {
                if (this.grid[row][col].type === -1) {
                    this.grid[row][col].type = Math.floor(Math.random() * GEM_TYPES);
                    this.grid[row][col].matched = false;
                    this.grid[row][col].scale = 0;
                    this.grid[row][col].alpha = 1;
                }
            }
        }
        
        // Animate new gems appearing
        await this.animateNewGems();
    }
    
    animateNewGems() {
        return new Promise(resolve => {
            let progress = 0;
            const animate = () => {
                progress += 0.15;
                for (let row = 0; row < GRID_SIZE; row++) {
                    for (let col = 0; col < GRID_SIZE; col++) {
                        if (this.grid[row][col].scale < 1) {
                            this.grid[row][col].scale = Math.min(1, progress);
                        }
                    }
                }
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            animate();
        });
    }
    
    // ==================== GAME STATE ====================
    checkGameState() {
        // Check for ad opportunity (every 3 levels or when score milestone)
        if (this.score > 0 && this.score % 500 === 0 && pokiSDKReady) {
            this.showAdBreak();
        }
        
        if (this.score >= this.targetScore) {
            this.gameWon = true;
            setTimeout(() => {
                if (pokiSDKReady) {
                    this.showAdBreak().then(() => this.nextLevel());
                } else {
                    this.nextLevel();
                }
            }, 500);
        } else if (this.moves <= 0) {
            this.gameOver = true;
            setTimeout(() => {
                if (pokiSDKReady) {
                    this.showAdBreak().then(() => this.restart());
                } else {
                    this.restart();
                }
            }, 500);
        }
    }
    
    async showAdBreak() {
        // Poki commercial break - shown between levels or game over
        if (!pokiSDKReady) return;
        
        try {
            // Pause game before ad
            this.isPaused = true;
            await PokiSDK.commercialBreak();
        } catch(e) {
            console.log("commercialBreak failed:", e);
        } finally {
            // Resume game after ad
            this.isPaused = false;
        }
    }
    
    nextLevel() {
        this.level++;
        this.targetScore += 500 * this.level;
        this.moves = 20 + this.level * 2;
        this.gameWon = false;
        this.initGrid();
    }
    
    restart() {
        this.score = 0;
        this.level = 1;
        this.targetScore = 1000;
        this.moves = 20;
        this.combo = 0;
        this.maxCombo = 0;
        this.gameOver = false;
        this.gameWon = false;
        this.initGrid();
    }
    
    // ==================== RENDERING ====================
    start() {
        this.loop();
    }
    
    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
    
    update() {
        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3;
            p.life -= 0.02;
            return p.life > 0;
        });
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = 'rgba(102, 126, 234, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw UI
        this.drawUI();
        
        // Draw grid background
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(
            this.gridOffsetX - 5,
            this.gridOffsetY - 5,
            this.gemSize * GRID_SIZE + 10,
            this.gemSize * GRID_SIZE + 10
        );
        
        // Draw gems
        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE; col++) {
                this.drawGem(this.grid[row][col]);
            }
        }
        
        // Draw selection highlight
        if (this.selectedGem) {
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 4;
            this.ctx.shadowColor = '#fff';
            this.ctx.shadowBlur = 15;
            this.ctx.strokeRect(
                this.gridOffsetX + this.selectedGem.col * this.gemSize + 2,
                this.gridOffsetY + this.selectedGem.row * this.gemSize + 2,
                this.gemSize - 4,
                this.gemSize - 4
            );
            this.ctx.shadowBlur = 0;
        }
        
        // Draw particles
        this.drawParticles();
        
        // Draw combo text
        if (this.combo > 1) {
            this.drawCombo();
        }
        
        // Draw game over/win screen
        if (this.gameOver || this.gameWon) {
            this.drawOverlay();
        }
    }
    
    drawUI() {
        const padding = 20;
        const boxWidth = (this.canvas.width - padding * 4) / 3;
        
        // UI Boxes
        const uiItems = [
            { label: 'LEVEL', value: this.level },
            { label: 'SCORE', value: `${this.score}/${this.targetScore}` },
            { label: 'MOVES', value: this.moves, danger: this.moves <= 3 }
        ];
        
        uiItems.forEach((item, i) => {
            const x = padding + i * (boxWidth + padding);
            
            // Box background
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            this.ctx.beginPath();
            this.ctx.roundRect(x, 10, boxWidth, 70, 10);
            this.ctx.fill();
            
            // Label
            this.ctx.fillStyle = '#666';
            this.ctx.font = '12px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(item.label, x + boxWidth/2, 30);
            
            // Value
            this.ctx.fillStyle = item.danger ? '#e74c3c' : '#333';
            this.ctx.font = 'bold 24px sans-serif';
            this.ctx.fillText(String(item.value), x + boxWidth/2, 60);
        });
        
        // Progress bar
        const progress = Math.min(1, this.score / this.targetScore);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(padding, 90, this.canvas.width - padding * 2, 10);
        
        const progressGradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, 0);
        progressGradient.addColorStop(0, '#2ecc71');
        progressGradient.addColorStop(1, '#27ae60');
        this.ctx.fillStyle = progressGradient;
        this.ctx.fillRect(padding, 90, (this.canvas.width - padding * 2) * progress, 10);
    }
    
    drawGem(gem) {
        if (gem.alpha <= 0) return;
        
        const x = this.gridOffsetX + gem.col * this.gemSize + this.gemSize/2;
        const y = this.gridOffsetY + gem.row * this.gemSize + this.gemSize/2;
        const size = (this.gemSize - 8) * gem.scale / 2;
        
        this.ctx.save();
        this.ctx.globalAlpha = gem.alpha;
        
        // Shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 3, y + 5, size * 0.9, size * 0.8, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Gem body
        const gradient = this.ctx.createRadialGradient(x - size/3, y - size/3, 0, x, y, size);
        gradient.addColorStop(0, this.lightenColor(COLORS[gem.type], 30));
        gradient.addColorStop(1, COLORS[gem.type]);
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.roundRect(x - size, y - size, size * 2, size * 2, size / 3);
        this.ctx.fill();
        
        // Shine
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.beginPath();
        this.ctx.ellipse(x - size/3, y - size/3, size/3, size/4, -Math.PI/4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Emoji
        this.ctx.font = `${size}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(EMOJIS[gem.type], x, y + 2);
        
        this.ctx.restore();
    }
    
    drawParticles() {
        for (const p of this.particles) {
            this.ctx.save();
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    }
    
    drawCombo() {
        const x = this.canvas.width / 2;
        const y = this.canvas.height / 2;
        
        this.ctx.save();
        this.ctx.fillStyle = '#ffd700';
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 3;
        this.ctx.font = 'bold 48px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.shadowColor = '#ffd700';
        this.ctx.shadowBlur = 20;
        
        const text = `${this.combo} COMBO!`;
        this.ctx.strokeText(text, x, y);
        this.ctx.fillText(text, x, y);
        this.ctx.restore();
    }
    
    drawOverlay() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const title = this.gameWon ? '🎉 LEVEL CLEARED!' : '😢 GAME OVER';
        const color = this.gameWon ? '#2ecc71' : '#e74c3c';
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 36px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(title, this.canvas.width/2, this.canvas.height/2 - 40);
        
        this.ctx.font = '20px sans-serif';
        this.ctx.fillText(`Score: ${this.score}`, this.canvas.width/2, this.canvas.height/2 + 10);
        this.ctx.fillText(`Max Combo: ${this.maxCombo}`, this.canvas.width/2, this.canvas.height/2 + 40);
        
        this.ctx.fillStyle = color;
        this.ctx.font = '18px sans-serif';
        this.ctx.fillText('Click to continue...', this.canvas.width/2, this.canvas.height/2 + 90);
        
        // Click handler for overlay
        this.canvas.onclick = () => {
            if (this.gameWon) {
                this.nextLevel();
            } else {
                this.restart();
            }
        };
    }
    
    // ==================== EFFECTS ====================
    createParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * 5,
                vy: Math.sin(angle) * 5,
                life: 1,
                color: color,
                size: Math.random() * 4 + 2
            });
        }
    }
    
    createSelectEffect(row, col) {
        // Visual feedback handled in draw
    }
    
    // ==================== UTILS ====================
    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ==================== INITIALIZE ====================
const game = new JewelMatch();
