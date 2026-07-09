# Ludo Game in Vanilla JavaScript 🚀

![javascript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black) ![html](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white) ![css](https://img.shields.io/badge/CSS-239120?&style=for-the-badge&logo=css3&logoColor=white)

## 🎮 Live Demo
**Play Now:** [https://ludo-game-1z67.onrender.com/](https://ludo-game-1z67.onrender.com/)

## ✨ Features
- **Modern Board Design** with immersive 3D house centerpiece and enhanced visual effects
- **Sound Effects** including background music, dice rolls, piece movement, and turn notifications
- Animated Ludo board rendered with vanilla HTML/CSS/JS
- Custom data structures (doubly linked list, singly linked list, circular queue) to manage token movement
- Real-time multiplayer rooms powered by WebSockets — share a room code with a friend and play together
- Safe squares, home paths, and kill logic faithfully implemented according to Ludo rules
- **Undo System** with limited undos per player for strategic gameplay
- **Global Leaderboard** tracking player scores across games

## 🎯 Project structure

```
src/
	client/
		index.html
		main.js
		assets/
			audio/          # Sound effects and background music
		ludo/
			AudioManager.js # Sound system controller
			Ludo.js        # Core game logic
			UI.js          # User interface management
			style.css      # Modern board styling
			...
	server/
		server.js
		WebSocketServer.js
		lib/
			GameCore.js    # Server-side game engine
			...
package.json
Dockerfile
README.md
```

## �🛠️ Getting started

### 1. Install dependencies
```bash
npm install
```

### 2. Start the WebSocket game server
```bash
npm run server
```
The server listens on `ws://localhost:8080` by default. Set the `PORT` environment variable if you need a different port.

### 3. Launch the app
The HTTP server now serves the static client bundle directly. Visit `http://localhost:8080` in your browser once the server is running.

### 4. Play the game
1. Visit the live demo at [https://ludo-game-1z67.onrender.com/](https://ludo-game-1z67.onrender.com/) or your local server.
2. Enter your name and **create** a room or **join** an existing room with its six-character code.
3. Share the code with your friend; once both players join, the game starts automatically.
4. Roll the dice when it is your turn — only your tokens become interactive.
5. Use the **undo** feature strategically (limited uses per player).
6. Enjoy immersive sound effects and smooth animations!

## 📺 Demo & Resources
- **Live Demo**: [https://ludo-game-1z67.onrender.com/](https://ludo-game-1z67.onrender.com/)
- Original Tutorial: https://youtu.be/2dgYLR2hOTk

## 🎨 Board Design

![New Ludo Board Design](https://raw.githubusercontent.com/UdaraWickramarathne/ludo-game/prod/board-preview.png)

Our enhanced board features:
- **3D House Centerpiece** with realistic architectural details
- **Smooth Animations** for piece movement with sound feedback
- **Modern UI Elements** with custom image-based buttons
- **Visual Effects** including particle animations and hover states
- **Responsive Design** optimized for various screen sizes
