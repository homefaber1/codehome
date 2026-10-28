
/**
 * 中国象棋 Web 版核心逻辑
 * 包含：棋盘表示、规则校验、Minimax AI、UI交互
 */

// 棋子定义
const PIECES = {
    R_KING: 1, R_ADVISOR: 2, R_ELEPHANT: 3, R_HORSE: 4, R_ROOK: 5, R_CANNON: 6, R_PAWN: 7,
    B_KING: -1, B_ADVISOR: -2, B_ELEPHANT: -3, B_HORSE: -4, B_ROOK: -5, B_CANNON: -6, B_PAWN: -7,
    EMPTY: 0
};

const PIECE_NAMES = {
    1: '帅', 2: '仕', 3: '相', 4: '马', 5: '车', 6: '炮', 7: '兵',
    '-1': '将', '-2': '士', '-3': '象', '-4': '马', '-5': '车', '-6': '炮', '-7': '卒'
};

// 初始棋盘布局 (10行9列)
const INITIAL_BOARD = [
    [-5, -4, -3, -2, -1, -2, -3, -4, -5],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0, -6,  0,  0,  0,  0,  0, -6,  0],
    [-7,  0, -7,  0, -7,  0, -7,  0, -7],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 7,  0,  7,  0,  7,  0,  7,  0,  7],
    [ 0,  6,  0,  0,  0,  0,  0,  6,  0],
    [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    [ 5,  4,  3,  2,  1,  2,  3,  4,  5]
];

class XiangqiGame {
    constructor() {
        this.board = [];
        this.turn = 1; // 1: Red, -1: Black
        this.selectedPiece = null;
        this.history = [];
        this.gameOver = false;
        this.soundEnabled = true;
        this.aiDepth = 2;
        this.lastMove = null; // {from: [r,c], to: [r,c]}
        
        this.boardEl = document.getElementById('board');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.gameStatusEl = document.getElementById('game-status');
        this.historyEl = document.getElementById('move-history');
        this.modal = document.getElementById('modal');
        this.checkNotification = null;
        
        this.initBoard();
        this.renderBoard();
        this.setupEventListeners();
    }

    initBoard() {
        // Deep copy initial board
        this.board = INITIAL_BOARD.map(row => [...row]);
        this.turn = 1;
        this.history = [];
        this.gameOver = false;
        this.selectedPiece = null;
        this.lastMove = null;
        this.updateStatus();
    }

    restart() {
        this.initBoard();
        this.renderBoard();
        this.historyEl.innerHTML = '<div class="text-gray-400 text-center italic mt-10">暂无走棋记录</div>';
        this.modal.classList.add('hidden');
    }

    setupEventListeners() {
        document.getElementById('difficulty').addEventListener('change', (e) => {
            this.aiDepth = parseInt(e.target.value);
        });
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const btn = document.getElementById('sound-btn');
        btn.innerHTML = this.soundEnabled ? '<i class="fas fa-volume-up"></i> 音效: 开' : '<i class="fas fa-volume-mute"></i> 音效: 关';
    }

    playSound(type) {
        if (!this.soundEnabled) return;
        // Simple beep using AudioContext could be added here, 
        // for now just visual feedback is implemented in UI
    }

    // --- Rendering ---

    renderBoard() {
        this.boardEl.innerHTML = '<div class="river-text">楚 河 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 汉 界</div>';
        
        // Draw Grid Lines (Simplified visual representation using CSS borders on cells would be complex, 
        // using absolute positioned lines is better for traditional look, but for this code golf style, 
        // we will rely on the background image and place pieces accurately)
        
        // Actually, let's draw the grid lines properly for better UX
        this.drawGridLines();

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const pieceVal = this.board[r][c];
                if (pieceVal !== 0) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = `piece ${pieceVal > 0 ? 'red' : 'black'}`;
                    pieceEl.innerText = PIECE_NAMES[pieceVal];
                    pieceEl.style.left = `${c * 11.11 + 5.55}%`;
                    pieceEl.style.top = `${r * 10 + 5}%`;
                    pieceEl.dataset.r = r;
                    pieceEl.dataset.c = c;
                    
                    if (this.selectedPiece && this.selectedPiece.r === r && this.selectedPiece.c === c) {
                        pieceEl.classList.add('selected');
                    }
                    
                    pieceEl.onclick = (e) => this.handlePieceClick(r, c, pieceVal);
                    this.boardEl.appendChild(pieceEl);
                } else {
                    // Empty cell click handler for moving
                    const cell = document.createElement('div');
                    cell.className = 'cell';
                    cell.style.left = `${c * 11.11}%`;
                    cell.style.top = `${r * 10}%`;
                    cell.onclick = () => this.handleEmptyClick(r, c);
                    
                    // Highlight valid moves
                    if (this.selectedPiece) {
                        if (this.isLegalMove(this.turn, {
                            fromR: this.selectedPiece.r,
                            fromC: this.selectedPiece.c,
                            toR: r,
                            toC: c
                        })) {
                            cell.classList.add('valid-move');
                        }
                    }
                    
                    // Highlight last move
                    if (this.lastMove) {
                        if ((this.lastMove.from[0] === r && this.lastMove.from[1] === c) ||
                            (this.lastMove.to[0] === r && this.lastMove.to[1] === c)) {
                            cell.classList.add('last-move');
                        }
                    }
                    
                    this.boardEl.appendChild(cell);
                }
            }
        }

        this.checkNotification = document.createElement('div');
        this.checkNotification.className = 'check-notification';
        this.checkNotification.setAttribute('role', 'alert');
        this.checkNotification.setAttribute('aria-live', 'assertive');
        this.checkNotification.textContent = '将军';
        if (!this.isKingInCheck(this.turn)) this.checkNotification.classList.add('hidden');
        this.boardEl.appendChild(this.checkNotification);
    }

    drawGridLines() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 800 900');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true');
        Object.assign(svg.style, {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
        });

        const xAt = (col) => 44.4 + col * 88.9;
        const yAt = (row) => 45 + row * 90;
        const addPath = (d, width = 2) => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'rgba(91, 55, 29, 0.82)');
            path.setAttribute('stroke-width', String(width));
            path.setAttribute('stroke-linecap', 'round');
            svg.appendChild(path);
        };

        // Horizontal lines
        for (let i = 0; i < 10; i++) {
            addPath(`M ${xAt(0)} ${yAt(i)} H ${xAt(8)}`);
        }

        // Vertical lines
        for (let i = 0; i < 9; i++) {
            if (i === 0 || i === 8) {
                addPath(`M ${xAt(i)} ${yAt(0)} V ${yAt(9)}`);
            } else {
                addPath(`M ${xAt(i)} ${yAt(0)} V ${yAt(4)}`);
                addPath(`M ${xAt(i)} ${yAt(5)} V ${yAt(9)}`);
            }
        }

        // Cross the diagonal lines in each palace.
        for (const [topRow, bottomRow] of [[0, 2], [7, 9]]) {
            addPath(`M ${xAt(3)} ${yAt(topRow)} L ${xAt(5)} ${yAt(bottomRow)}`);
            addPath(`M ${xAt(5)} ${yAt(topRow)} L ${xAt(3)} ${yAt(bottomRow)}`);
        }

        // Add the traditional corner marks around pawn and cannon intersections.
        const markPoints = [
            [2, 1], [2, 7], [7, 1], [7, 7],
            ...[0, 2, 4, 6, 8].flatMap((col) => [[3, col], [6, col]])
        ];
        const markLength = 10;
        const markGap = 4;
        for (const [row, col] of markPoints) {
            const x = xAt(col);
            const y = yAt(row);
            const sides = [
                ...(col > 0 ? [-1] : []),
                ...(col < 8 ? [1] : [])
            ];
            for (const side of sides) {
                for (const vertical of [-1, 1]) {
                    const startX = x + side * markGap;
                    const endX = startX + side * markLength;
                    const startY = y + vertical * markGap;
                    const endY = startY + vertical * markLength;
                    addPath(`M ${startX} ${startY} H ${endX} M ${startX} ${startY} V ${endY}`, 1.5);
                }
            }
        }

        this.boardEl.appendChild(svg);
    }

    // --- Interaction ---

    handlePieceClick(r, c, val) {
        if (this.gameOver) return;
        if (this.turn === -1) return; // AI's turn

        // If clicking own piece, select it
        if (val * this.turn > 0) {
            this.selectedPiece = { r, c, val };
            this.renderBoard();
        } 
        // If clicking enemy piece, try to capture
        else if (this.selectedPiece) {
            if (this.isLegalMove(this.turn, {
                fromR: this.selectedPiece.r,
                fromC: this.selectedPiece.c,
                toR: r,
                toC: c
            })) {
                this.makeMove(this.selectedPiece.r, this.selectedPiece.c, r, c);
            }
        }
    }

    handleEmptyClick(r, c) {
        if (this.gameOver || this.turn === -1 || !this.selectedPiece) return;
        
        if (this.isLegalMove(this.turn, {
            fromR: this.selectedPiece.r,
            fromC: this.selectedPiece.c,
            toR: r,
            toC: c
        })) {
            this.makeMove(this.selectedPiece.r, this.selectedPiece.c, r, c);
        }
    }

    makeMove(fromR, fromC, toR, toC) {
        if (this.gameOver || !this.isLegalMove(this.turn, { fromR, fromC, toR, toC })) return;

        const piece = this.board[fromR][fromC];
        const target = this.board[toR][toC];
        
        // Record history
        this.history.push({
            board: JSON.parse(JSON.stringify(this.board)),
            turn: this.turn,
            lastMove: this.lastMove,
            moveText: `${PIECE_NAMES[piece]} (${fromC},${fromR}) -> (${toC},${toR})`
        });

        // Execute move
        this.board[toR][toC] = piece;
        this.board[fromR][fromC] = 0;
        this.lastMove = { from: [fromR, fromC], to: [toR, toC] };
        this.selectedPiece = null;
        
        // Check Win Condition
        if (Math.abs(target) === 1) {
            this.gameOver = true;
            this.renderBoard();
            this.showGameOver(this.turn === 1 ? "红方胜利！" : "黑方胜利！");
            return;
        }

        // Switch Turn
        this.turn = -this.turn;
        this.updateStatus();
        this.renderBoard();
        this.updateHistoryUI();

        if (!this.hasLegalMoves(this.turn)) {
            this.finishGame(this.turn, this.isKingInCheck(this.turn));
            return;
        }

        // Trigger AI
        if (this.turn === -1 && !this.gameOver) {
            setTimeout(() => {
                if (!this.gameOver && this.turn === -1) this.aiMove();
            }, 500);
        }
    }

    undo() {
        if (this.history.length < 2 || this.gameOver) return; // Undo both player and AI
        
        // Revert twice (Player + AI)
        this.history.pop(); // Remove AI move state
        const prevState = this.history.pop(); // Get Player move state
        
        this.board = prevState.board;
        this.turn = prevState.turn;
        this.lastMove = prevState.lastMove;
        this.gameOver = false;
        this.selectedPiece = null;
        
        this.renderBoard();
        this.updateStatus();
        this.updateHistoryUI();
    }

    updateStatus() {
        const inCheck = this.isKingInCheck(this.turn);
        this.turnIndicator.innerText = inCheck
            ? `${this.turn === 1 ? "红方" : "黑方"}被将军！`
            : this.turn === 1 ? "红方走棋" : "黑方思考中...";
        this.turnIndicator.className = `px-3 py-1 rounded-full text-sm font-bold ${inCheck ? 'bg-red-200 text-red-900' : this.turn === 1 ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-800'}`;
        this.gameStatusEl.innerText = inCheck ? "将军！" : "进行中";
        this.gameStatusEl.className = inCheck
            ? "rounded-full bg-red-100 px-3 py-1 font-bold text-red-700"
            : "font-semibold text-green-600";
        if (this.checkNotification) {
            this.checkNotification.classList.toggle('hidden', !inCheck);
        }
    }

    finishGame(losingSide, isCheckmate) {
        const winner = losingSide === 1 ? "黑方" : "红方";
        this.gameOver = true;
        this.turnIndicator.innerText = isCheckmate
            ? `${losingSide === 1 ? "红方" : "黑方"}被将死`
            : `${losingSide === 1 ? "红方" : "黑方"}无棋可走`;
        this.turnIndicator.className = "px-3 py-1 rounded-full bg-red-200 text-sm font-bold text-red-900";
        this.gameStatusEl.innerText = isCheckmate ? "绝杀！" : "困毙，判负";
        this.gameStatusEl.className = "rounded-full bg-red-100 px-3 py-1 font-bold text-red-700";
        this.showGameOver(`${isCheckmate ? "绝杀！" : "困毙！"}${winner}胜利！`);
    }

    hasLegalMoves(side) {
        return this.generateAllMoves(side).length > 0;
    }

    updateHistoryUI() {
        if (this.history.length === 0) {
            this.historyEl.innerHTML = '<div class="text-gray-400 text-center italic mt-10">暂无走棋记录</div>';
            return;
        }
        this.historyEl.innerHTML = '';
        this.history.forEach((h, index) => {
            const div = document.createElement('div');
            div.className = "p-2 bg-gray-50 rounded border-l-4 border-amber-500 text-xs";
            div.innerText = `${index + 1}. ${h.moveText}`;
            this.historyEl.prepend(div);
        });
    }

    showGameOver(msg) {
        document.getElementById('modal-title').innerText = "游戏结束";
        document.getElementById('modal-message').innerText = msg;
        this.modal.classList.remove('hidden');
    }

    // --- Rules Engine ---

    isKingInCheck(side) {
        let kingPosition = null;
        let enemyKingPosition = null;

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.board[r][c] === side) kingPosition = { r, c };
                if (this.board[r][c] === -side) enemyKingPosition = { r, c };
            }
        }

        if (!kingPosition) return false;

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = this.board[r][c];
                if (piece * side < 0 &&
                    this.isValidMove(r, c, kingPosition.r, kingPosition.c)) {
                    return true;
                }
            }
        }

        if (enemyKingPosition && enemyKingPosition.c === kingPosition.c) {
            return this.countObstacles(
                enemyKingPosition.r,
                enemyKingPosition.c,
                kingPosition.r,
                kingPosition.c
            ) === 0;
        }

        return false;
    }

    isLegalMove(side, move) {
        const piece = this.board[move.fromR][move.fromC];
        if (piece * side <= 0 ||
            !this.isValidMove(move.fromR, move.fromC, move.toR, move.toC)) {
            return false;
        }

        const captured = this.board[move.toR][move.toC];
        this.board[move.toR][move.toC] = piece;
        this.board[move.fromR][move.fromC] = 0;
        const leavesKingInCheck = this.isKingInCheck(side);
        this.board[move.fromR][move.fromC] = piece;
        this.board[move.toR][move.toC] = captured;
        return !leavesKingInCheck;
    }

    isValidMove(fromR, fromC, toR, toC) {
        const piece = this.board[fromR][fromC];
        const target = this.board[toR][toC];
        const type = Math.abs(piece);
        const dx = toC - fromC;
        const dy = toR - fromR;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Cannot capture own piece
        if (target * piece > 0) return false;

        switch (type) {
            case 1: // King
                if (toC < 3 || toC > 5) return false;
                if (piece > 0) { // Red
                    if (toR < 7) return false;
                } else { // Black
                    if (toR > 2) return false;
                }
                return (absDx + absDy === 1);
            
            case 2: // Advisor
                if (toC < 3 || toC > 5) return false;
                if (piece > 0) { if (toR < 7) return false; } 
                else { if (toR > 2) return false; }
                return (absDx === 1 && absDy === 1);

            case 3: // Elephant
                if (piece > 0) { if (toR < 5) return false; } // Red cannot cross river
                else { if (toR > 4) return false; } // Black cannot cross river
                if (absDx !== 2 || absDy !== 2) return false;
                // Check eye
                if (this.board[fromR + dy/2][fromC + dx/2] !== 0) return false;
                return true;

            case 4: // Horse
                if (absDx === 1 && absDy === 2) {
                    // Check leg
                    if (this.board[fromR + (dy > 0 ? 1 : -1)][fromC] !== 0) return false;
                    return true;
                }
                if (absDx === 2 && absDy === 1) {
                    // Check leg
                    if (this.board[fromR][fromC + (dx > 0 ? 1 : -1)] !== 0) return false;
                    return true;
                }
                return false;

            case 5: // Rook
                if (fromR !== toR && fromC !== toC) return false;
                return this.countObstacles(fromR, fromC, toR, toC) === 0;

            case 6: // Cannon
                if (fromR !== toR && fromC !== toC) return false;
                const obstacles = this.countObstacles(fromR, fromC, toR, toC);
                if (target === 0) {
                    return obstacles === 0;
                } else {
                    return obstacles === 1;
                }

            case 7: // Pawn
                if (piece > 0) { // Red
                    if (toR > fromR) return false; // Cannot go back
                    if (fromR >= 5) { // Before river
                        return (fromC === toC && fromR - toR === 1);
                    } else { // After river
                        return (absDx + absDy === 1);
                    }
                } else { // Black
                    if (toR < fromR) return false;
                    if (fromR <= 4) {
                        return (fromC === toC && toR - fromR === 1);
                    } else {
                        return (absDx + absDy === 1);
                    }
                }
        }
        return false;
    }

    countObstacles(r1, c1, r2, c2) {
        let count = 0;
        if (r1 === r2) {
            const min = Math.min(c1, c2);
            const max = Math.max(c1, c2);
            for (let c = min + 1; c < max; c++) {
                if (this.board[r1][c] !== 0) count++;
            }
        } else {
            const min = Math.min(r1, r2);
            const max = Math.max(r1, r2);
            for (let r = min + 1; r < max; r++) {
                if (this.board[r][c1] !== 0) count++;
            }
        }
        return count;
    }

    // --- AI Engine (Minimax + AlphaBeta) ---

    aiMove() {
        if (this.gameOver || this.turn !== -1) return;
        const depth = this.aiDepth;
        const bestMove = this.getBestMove(depth);
        if (bestMove) {
            this.makeMove(bestMove.fromR, bestMove.fromC, bestMove.toR, bestMove.toC);
        } else {
            this.finishGame(-1, this.isKingInCheck(-1));
        }
    }

    getBestMove(depth) {
        let bestVal = -Infinity;
        let bestMove = null;
        const moves = this.generateAllMoves(-1); // Black moves

        // Simple ordering: captures first
        moves.sort((a, b) => {
            const valA = Math.abs(this.board[a.toR][a.toC]);
            const valB = Math.abs(this.board[b.toR][b.toC]);
            return valB - valA;
        });

        for (const move of moves) {
            // Execute move virtually
            const captured = this.board[move.toR][move.toC];
            this.board[move.toR][move.toC] = this.board[move.fromR][move.fromC];
            this.board[move.fromR][move.fromC] = 0;

            const val = this.minimax(depth - 1, -Infinity, Infinity, false);

            // Undo move
            this.board[move.fromR][move.fromC] = this.board[move.toR][move.toC];
            this.board[move.toR][move.toC] = captured;

            if (val > bestVal) {
                bestVal = val;
                bestMove = move;
            }
        }
        return bestMove;
    }

    minimax(depth, alpha, beta, isMaximizing) {
        if (depth === 0) {
            return this.evaluateBoard();
        }

        // Check if King is captured (game over in simulation)
        // Simplified: if evaluate returns huge number, stop
        
        if (isMaximizing) { // Black (AI)
            let maxEval = -Infinity;
            const moves = this.generateAllMoves(-1);
            for (const move of moves) {
                const captured = this.board[move.toR][move.toC];
                // Optimization: If capturing King, return immediate win
                if (Math.abs(captured) === 1) return 10000; 

                this.board[move.toR][move.toC] = this.board[move.fromR][move.fromC];
                this.board[move.fromR][move.fromC] = 0;

                const evalVal = this.minimax(depth - 1, alpha, beta, false);

                this.board[move.fromR][move.fromC] = this.board[move.toR][move.toC];
                this.board[move.toR][move.toC] = captured;

                maxEval = Math.max(maxEval, evalVal);
                alpha = Math.max(alpha, evalVal);
                if (beta <= alpha) break;
            }
            return maxEval === -Infinity ? this.evaluateBoard() : maxEval; // Handle no moves
        } else { // Red (Player)
            let minEval = Infinity;
            const moves = this.generateAllMoves(1);
            for (const move of moves) {
                const captured = this.board[move.toR][move.toC];
                if (Math.abs(captured) === 1) return -10000;

                this.board[move.toR][move.toC] = this.board[move.fromR][move.fromC];
                this.board[move.fromR][move.fromC] = 0;

                const evalVal = this.minimax(depth - 1, alpha, beta, true);

                this.board[move.fromR][move.fromC] = this.board[move.toR][move.toC];
                this.board[move.toR][move.toC] = captured;

                minEval = Math.min(minEval, evalVal);
                beta = Math.min(beta, evalVal);
                if (beta <= alpha) break;
            }
            return minEval === Infinity ? this.evaluateBoard() : minEval;
        }
    }

    generateAllMoves(turn) {
        const moves = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = this.board[r][c];
                if (piece * turn > 0) {
                    // Generate pseudo-legal moves
                    // Optimized: only check relevant destinations based on piece type
                    // For simplicity in this demo, we scan board or use logic
                    // Here we iterate all cells to check validity (slow but robust for demo)
                    // Better: generate specific offsets
                    this.getPieceMoves(r, c, piece, moves);
                }
            }
        }
        return moves.filter((move) => this.isLegalMove(turn, move));
    }

    getPieceMoves(r, c, piece, moves) {
        // Define offsets for each piece to reduce search space
        // This is a simplified generator
        const targets = [];
        const type = Math.abs(piece);
        
        // Generate candidate targets
        if (type === 1 || type === 2) { // King, Advisor
             [[0,1], [0,-1], [1,0], [-1,0], [1,1], [1,-1], [-1,1], [-1,-1]].forEach(([dr, dc]) => {
                 if (type===1 && Math.abs(dr)+Math.abs(dc)>1) return; // King only orthogonal
                 if (type===2 && Math.abs(dr)!==1) return; // Advisor only diagonal
                 targets.push([r+dr, c+dc]);
             });
        } else if (type === 3) { // Elephant
            [[2,2], [2,-2], [-2,2], [-2,-2]].forEach(([dr, dc]) => targets.push([r+dr, c+dc]));
        } else if (type === 4) { // Horse
            [[2,1], [2,-1], [-2,1], [-2,-1], [1,2], [1,-2], [-1,2], [-1,-2]].forEach(([dr, dc]) => targets.push([r+dr, c+dc]));
        } else if (type === 5 || type === 6) { // Rook, Cannon
            for(let i=0; i<10; i++) if(i!==r) targets.push([i, c]);
            for(let i=0; i<9; i++) if(i!==c) targets.push([r, i]);
        } else if (type === 7) { // Pawn
            const forward = piece > 0 ? -1 : 1;
            targets.push([r+forward, c]);
            if ((piece > 0 && r < 5) || (piece < 0 && r > 4)) {
                targets.push([r, c+1]);
                targets.push([r, c-1]);
            }
        }

        for (const [tr, tc] of targets) {
            if (tr >= 0 && tr < 10 && tc >= 0 && tc < 9) {
                if (this.isValidMove(r, c, tr, tc)) {
                    moves.push({ fromR: r, fromC: c, toR: tr, toC: tc });
                }
            }
        }
    }

    evaluateBoard() {
        let score = 0;
        const pieceValues = { 1: 10000, 2: 20, 3: 20, 4: 40, 5: 90, 6: 45, 7: 10 };
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const val = this.board[r][c];
                if (val !== 0) {
                    const absVal = Math.abs(val);
                    const baseScore = pieceValues[absVal];
                    // Position bonus (simplified)
                    let posBonus = 0;
                    if (absVal === 7) { // Pawn bonus for crossing river
                        if (val > 0 && r < 5) posBonus = 10;
                        if (val < 0 && r > 4) posBonus = 10;
                    }
                    
                    if (val > 0) score -= (baseScore + posBonus); // Red is minimizing for AI (Black)
                    else score += (baseScore + posBonus);
                }
            }
        }
        return score;
    }
}

// Initialize Game
const game = new XiangqiGame();
