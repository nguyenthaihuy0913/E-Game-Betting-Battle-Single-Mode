# 🐺 Grammar & Vocab Betting Battle - Lone Wolf Edition

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Tech Stack](https://img.shields.io/badge/tech-Node.js%20%7C%20Socket.io%20%7C%20Vanilla%20JS-orange.svg)
![Course](https://img.shields.io/badge/Assignment-E--Game%20Design-purple.svg)

> An interactive, gamified English learning platform built for the **E-Game Design Assignment 2 (Summit 2 Edition)**. This project transforms traditional grammar and vocabulary exercises into a high-stakes betting battle, motivating learners through risk, reward, and real-time feedback.

---

## ✨ Key Features

This "Lone Wolf" edition is specifically optimized for single-player practice, offering a seamless, friction-free learning experience:

* 🎯 **Frictionless Solo Mode:** Jump straight into the action without waiting for a Host or room codes. The backend server automatically generates a dedicated smart-bot room for every player.
* 🎲 **Risk & Reward Betting System:** Players start with 50 points. Before seeing each question, they must wager their points. Faster correct answers yield higher multipliers (up to x2.0). 
* 🔀 **Dynamic Question Shuffling:** Powered by the **Fisher-Yates algorithm**, the game automatically draws and shuffles exactly 30 Multiple-Choice questions and 20 Gap-Fill questions from a larger JSON database, ensuring no two playthroughs are ever the same.
* 🏆 **Auto-Saving Local Leaderboard:** Compete against yourself! The system securely stores your top 5 highest scores in the browser's LocalStorage and displays them right on the home screen.
* 🚨 **Aggressive Anti-Cheat System:** * Blocks Right-click, Copy, Paste, and Developer Tools (F12).
    * **Tab-Switching Detection:** If a player switches tabs to Google an answer, the screen blurs, and a personalized, audio-visual penalty meme (calling out the player's exact name) is triggered upon their return.

---

## 🎮 How to Play

1.  **Enter the Arena:** Open the homepage, type your name, and hit "Start Practice".
2.  **Round 1 - Multiple Choice (30 Questions):**
    * Look at the category and place your bet (10, 30, or ALL-IN).
    * Answer the question as fast as possible to maximize your multiplier.
3.  **Round 2 - Gap Fill (20 Questions):**
    * The game transitions automatically.
    * Type the exact missing word and press Enter.
4.  **Leaderboard:** Finish all 50 questions to record your score and secure your rank on the Top 5 Local Leaderboard.

---

## 🛠️ Tech Stack & Architecture

* **Backend:** Node.js, Express.
* **Real-time Engine:** Socket.io (Handles auto-room creation, anti-cheat alerts, and countdown synchronization).
* **Frontend:** HTML5, CSS3 (Custom animations, grain filters, responsive design), Vanilla JavaScript.
* **Data Storage:** LocalStorage (Leaderboard), JSON (Question Bank).

---

## 🚀 Installation & Deployment

To run this application locally or on a VPS (Linux):

### 1. Clone the repository
```
git clone [https://github.com/nguyenthaihuy0913/E-Game-Betting-Battle.git](https://github.com/nguyenthaihuy0913/E-Game-Betting-Battle.git)
cd E-Game-Betting-Battle
```
2. Install dependencies
```
npm install
```
3. Start the server
For local testing:

```
node server.js
```
For 24/7 production running (Recommended using PM2):
```
npm install pm2 -g
pm2 start server.js --name "betting-battle-solo"
```
4. Access the App
Open your browser and navigate to:

http://localhost:3000
📁 Project Structure
```
E-Game-Betting-Battle/
├── backend/
│   ├── GameManager.js      # Manages auto-room creation & garbage collection
│   └── Room.js             # Core game logic, scoring, and Fisher-Yates shuffling
├── frontend/
│   ├── index.html          # Homepage & Local Leaderboard UI
│   └── src/
│       ├── assets/         # Anti-cheat memes & sound effects
│       ├── data/           # questions.json (The question bank)
│       ├── pages/          # Test interfaces (MCQ & Gap Fill)
│       ├── scripts/        # Core client logic & Anti-cheat engine
│       └── styles/         # Global CSS
├── package.json
└── server.js               # Express & Socket.io initialization
```