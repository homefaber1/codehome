
/**
 * 贪吃蛇游戏核心逻辑
 * 包含游戏循环、渲染、状态管理和输入处理
 */

// 游戏配置常量
const CONFIG = {
    GRID_SIZE: 400 / 30, // 网格大小 (像素)
    TILE_COUNT: 30,     // 每行/列的格子数
    LEVEL_THRESHOLDS: [0, 100, 200, 500, 800],
    WIN_SCORE: 1000,
    MAX_LEVEL: 5,
    INITIAL_SPEED: 160, // 第 1 关每次移动的间隔（毫秒）
    LEVEL_SPEED_INCREMENT: 20,
    MIN_SPEED: 80
};

// 游戏状态
const state = {
    snake: [],          // 蛇身坐标数组 [{x, y}]
    food: { x: 0, y: 0 }, // 食物坐标
    direction: { x: 0, y: 0 }, // 当前移动方向
    nextDirection: { x: 0, y: 0 }, // 下一帧的移动方向 (防止快速按键导致自杀)
    score: 0,
    level: 1,
    highScore: localStorage.getItem('snakeHighScore') || 0,
    isRunning: false,
    isPaused: false,
    lastTime: 0,
    speed: CONFIG.INITIAL_SPEED,
    particles: []       // 粒子效果数组
};

// DOM 元素
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('scoreDisplay');
const highScoreEl = document.getElementById('highScoreDisplay');
const overlay = document.getElementById('overlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const victoryOverlay = document.getElementById('victoryOverlay');
const finalScoreEl = document.getElementById('finalScore');
const victoryScoreEl = document.getElementById('victoryScore');
const levelEl = document.getElementById('levelDisplay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');

// 初始化
function init() {
    highScoreEl.textContent = state.highScore;
    
    // 绑定事件
    document.addEventListener('keydown', handleKeyInput);
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', resetGame);
    playAgainBtn.addEventListener('click', resetGame);
    pauseBtn.addEventListener('click', pauseGame);
    resumeBtn.addEventListener('click', resumeGame);
    
    // 移动端触摸按钮
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleMobileInput(btn.dataset.dir);
        });
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handleMobileInput(btn.dataset.dir);
        });
    });

    // 初始渲染背景
    draw();
}

// 开始游戏
function startGame() {
    resetState();
    state.isRunning = true;
    state.isPaused = false;
    pauseBtn.classList.remove('hidden');
    resumeBtn.classList.add('hidden');
    overlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    victoryOverlay.classList.add('hidden');
    requestAnimationFrame(gameLoop);
}

function pauseGame() {
    if (!state.isRunning || state.isPaused) return;
    state.isPaused = true;
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.remove('hidden');
}

function resumeGame() {
    if (!state.isRunning || !state.isPaused) return;
    state.isPaused = false;
    pauseBtn.classList.remove('hidden');
    resumeBtn.classList.add('hidden');
}

// 重置游戏状态
function resetState() {
    // 初始化蛇在中间
    const startX = Math.floor(CONFIG.TILE_COUNT / 2);
    const startY = Math.floor(CONFIG.TILE_COUNT / 2);
    state.snake = [
        { x: startX, y: startY },
        { x: startX, y: startY + 1 },
        { x: startX, y: startY + 2 }
    ];
    state.direction = { x: 0, y: 0 };
    state.nextDirection = { x: 0, y: 0 };
    state.score = 0;
    state.level = 1;
    state.speed = CONFIG.INITIAL_SPEED;
    state.particles = [];
    updateScore(0);
    placeFood();
}

// 重置并重新开始
function resetGame() {
    gameOverOverlay.classList.add('hidden');
    startGame();
}

// 游戏主循环
function gameLoop(timestamp) {
    if (!state.isRunning) return;

    // 控制帧率
    if (!state.isPaused && timestamp - state.lastTime > state.speed) {
        update();
        state.lastTime = timestamp;
    }

    draw();
    
    if (state.isRunning) {
        requestAnimationFrame(gameLoop);
    }
}

// 更新逻辑
function update() {
    // 更新方向
    state.direction = { ...state.nextDirection };
    if (state.direction.x === 0 && state.direction.y === 0) return;

    // 计算新头部位置
    const head = { ...state.snake[0] };
    head.x += state.direction.x;
    head.y += state.direction.y;

    // 碰撞检测：墙壁
    if (head.x < 0 || head.x >= CONFIG.TILE_COUNT || head.y < 0 || head.y >= CONFIG.TILE_COUNT) {
        gameOver();
        return;
    }

    // 碰撞检测：自身
    for (let part of state.snake) {
        if (head.x === part.x && head.y === part.y) {
            gameOver();
            return;
        }
    }

    // 移动蛇：添加新头部
    state.snake.unshift(head);

    // 检测吃食物
    if (head.x === state.food.x && head.y === state.food.y) {
        // 加分
        updateScore(state.score + 10);
        // 生成粒子
        createParticles(head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE/2, head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE/2);
        if (state.score >= CONFIG.WIN_SCORE) {
            winGame();
            return;
        }
        // 放置新食物
        placeFood();
    } else {
        // 没吃到食物，移除尾部
        state.snake.pop();
    }

    // 更新粒子
    updateParticles();
}

// 渲染逻辑
function draw() {
    // 清空画布
    ctx.fillStyle = '#0f172a'; // Slate 900
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制网格线 (可选，增加复古感)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= CONFIG.TILE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CONFIG.GRID_SIZE, 0);
        ctx.lineTo(i * CONFIG.GRID_SIZE, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CONFIG.GRID_SIZE);
        ctx.lineTo(canvas.width, i * CONFIG.GRID_SIZE);
        ctx.stroke();
    }

    // 绘制食物
    drawFood();

    // 绘制蛇
    drawSnake();

    // 绘制粒子
    drawParticles();
}

function drawSnake() {
    if (state.snake.length === 0) return;

    const cellSize = CONFIG.GRID_SIZE;
    const renderScale = cellSize / 20;
    const points = state.snake.map(part => ({
        x: (part.x + 0.5) * 20,
        y: (part.y + 0.5) * 20
    }));

    ctx.save();
    ctx.scale(renderScale, renderScale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = 'rgba(2, 35, 27, 0.75)';
        ctx.lineWidth = 17;
        ctx.stroke();

        const bodyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height / renderScale);
        bodyGradient.addColorStop(0, '#71e0a1');
        bodyGradient.addColorStop(0.48, '#22b875');
        bodyGradient.addColorStop(1, '#08734f');
        ctx.strokeStyle = bodyGradient;
        ctx.lineWidth = 13;
        ctx.stroke();
    }

    for (let i = points.length - 1; i > 0; i--) {
        const point = points[i];
        const before = points[i - 1];
        const after = points[Math.min(i + 1, points.length - 1)];
        const angle = Math.atan2(before.y - after.y, before.x - after.x);
        const taper = Math.max(0.35, 1 - i / (points.length + 2) * 0.55);

        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, 7.5 * taper, 6.5 * taper, 0, 0, Math.PI * 2);
        const scaleGradient = ctx.createRadialGradient(-2, -3, 1, 0, 0, 9);
        scaleGradient.addColorStop(0, 'rgba(196, 255, 213, 0.75)');
        scaleGradient.addColorStop(0.42, 'rgba(61, 203, 133, 0.5)');
        scaleGradient.addColorStop(1, 'rgba(3, 99, 66, 0.55)');
        ctx.fillStyle = scaleGradient;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-1, -3.5 * taper);
        ctx.quadraticCurveTo(3 * taper, 0, -1, 3.5 * taper);
        ctx.strokeStyle = 'rgba(5, 91, 61, 0.42)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    const head = points[0];
    const direction = state.direction.x === 0 && state.direction.y === 0
        ? { x: 0, y: -1 }
        : state.direction;
    const angle = Math.atan2(direction.y, direction.x);
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 8.5, 0, 0, Math.PI * 2);
    const headGradient = ctx.createLinearGradient(0, -9, 0, 9);
    headGradient.addColorStop(0, '#a4f4bb');
    headGradient.addColorStop(0.36, '#45d98b');
    headGradient.addColorStop(1, '#08734f');
    ctx.fillStyle = headGradient;
    ctx.fill();
    ctx.strokeStyle = '#064c38';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    for (const side of [-1, 1]) {
        const eyeY = side * 5.2;
        ctx.beginPath();
        ctx.ellipse(2.5, eyeY, 3.1, 2.7, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f8f4d7';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(3.5, eyeY, 1.45, 2.1, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#b47a25';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(4, eyeY, 0.65, 1.55, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#17251d';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4.4, eyeY - 0.7, 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }

    ctx.beginPath();
    ctx.ellipse(8, 0, 1.5, 1.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#d7f4dd';
    ctx.fill();
    for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(8.4, side * 0.45, 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#174b37';
        ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(8.5, 0);
    ctx.lineTo(13, 0);
    ctx.lineTo(16, -1.8);
    ctx.moveTo(13, 0);
    ctx.lineTo(16, 1.8);
    ctx.strokeStyle = '#f05268';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
    ctx.restore();
}

function drawFood() {
    const x = state.food.x * CONFIG.GRID_SIZE;
    const y = state.food.y * CONFIG.GRID_SIZE;
    const centerX = x + CONFIG.GRID_SIZE / 2;
    const centerY = y + CONFIG.GRID_SIZE / 2;
    
    ctx.fillStyle = '#ef4444'; // Red 500
    ctx.beginPath();
    ctx.arc(centerX, centerY, CONFIG.GRID_SIZE * 0.38, 0, Math.PI * 2);
    ctx.fill();
    
    // 高光
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(
        centerX - CONFIG.GRID_SIZE * 0.12,
        centerY - CONFIG.GRID_SIZE * 0.12,
        CONFIG.GRID_SIZE * 0.1,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

// 放置食物
function placeFood() {
    let validPosition = false;
    while (!validPosition) {
        const x = Math.floor(Math.random() * CONFIG.TILE_COUNT);
        const y = Math.floor(Math.random() * CONFIG.TILE_COUNT);
        
        // 确保不生成在蛇身上
        validPosition = !state.snake.some(part => part.x === x && part.y === y);
        
        if (validPosition) {
            state.food = { x, y };
        }
    }
}

// 处理键盘输入
function handleKeyInput(e) {
    if ((e.key === 'p' || e.key === 'P' || e.code === 'Space') && state.isRunning) {
        e.preventDefault();
        if (state.isPaused) {
            resumeGame();
        } else {
            pauseGame();
        }
        return;
    }

    if (!state.isRunning) return;
    
    // 防止反向移动
    switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (state.direction.y === 0) state.nextDirection = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (state.direction.y === 0) state.nextDirection = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (state.direction.x === 0) state.nextDirection = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (state.direction.x === 0) state.nextDirection = { x: 1, y: 0 };
            break;
    }
}

// 处理移动端输入
function handleMobileInput(dir) {
    if (!state.isRunning) return;
    
    switch(dir) {
        case 'up':
            if (state.direction.y === 0) state.nextDirection = { x: 0, y: -1 };
            break;
        case 'down':
            if (state.direction.y === 0) state.nextDirection = { x: 0, y: 1 };
            break;
        case 'left':
            if (state.direction.x === 0) state.nextDirection = { x: -1, y: 0 };
            break;
        case 'right':
            if (state.direction.x === 0) state.nextDirection = { x: 1, y: 0 };
            break;
    }
}

// 更新分数
function updateScore(newScore) {
    state.score = newScore;
    scoreEl.textContent = state.score;
    state.level = CONFIG.LEVEL_THRESHOLDS.reduce(
        (level, threshold, index) => state.score >= threshold ? index + 1 : level,
        1
    );
    levelEl.textContent = `${state.level} / ${CONFIG.MAX_LEVEL}`;
    state.speed = Math.max(
        CONFIG.MIN_SPEED,
        CONFIG.INITIAL_SPEED - (state.level - 1) * CONFIG.LEVEL_SPEED_INCREMENT
    );
    if (state.score > state.highScore) {
        state.highScore = state.score;
        highScoreEl.textContent = state.highScore;
        localStorage.setItem('snakeHighScore', state.highScore);
    }
}

// 游戏结束
function gameOver() {
    state.isRunning = false;
    state.isPaused = false;
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.add('hidden');
    victoryOverlay.classList.add('hidden');
    finalScoreEl.textContent = state.score;
    gameOverOverlay.classList.remove('hidden');
}

function winGame() {
    state.isRunning = false;
    state.isPaused = false;
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    victoryScoreEl.textContent = state.score;
    victoryOverlay.classList.remove('hidden');
}

// --- 粒子系统 ---

function createParticles(x, y) {
    for (let i = 0; i < 8; i++) {
        state.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1.0,
            color: `hsl(${Math.random() * 60 + 10}, 100%, 50%)` // Yellow/Orange hues
        });
    }
}

function updateParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
        let p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        
        if (p.life <= 0) {
            state.particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    state.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });
}

// 启动初始化
init();
