# Token Chess

A full-stack chess variant platform featuring **fairy chess pieces** and a **token-based draft system** for asymmetric gameplay.

## Overview

**Token Chess** is an innovative take on chess that combines:
- **Fairy Chess Pieces**: Custom pieces like Champions, Princesses, Amazons, Painters, and more with unique movement rules
- **Token Economy**: Players draft their starting position using a limited token budget, creating diverse and strategic setups
- **Multiplayer Gameplay**: Real-time PvP with WebSocket synchronization
- **Puzzle & Tutorial System**: Learn fairy chess rules and solve tactical puzzles

## Architecture

### Frontend (`src/`)
**React + TypeScript + Vite**

Key components:
- **`AnalysisBoard`** – PGN viewer and move analysis
- **`DraftBuilder`** – Token-based piece placement editor
- **`TutorialBoard`** – Interactive lessons and puzzles
- **`GamePage`** – Real-time multiplayer board
- **`DraftsPage`** – Manage saved piece configurations (5 draft slots)

Uses [Chessground](https://github.com/lichess-org/chessground) for board UI and [chessops](https://github.com/niklasf/chessops.js) for move logic.

### Backend (`server/`)
**Express + TypeScript + Prisma + PostgreSQL**

Core features:
- **Auth**: JWT-based login/registration with bcrypt password hashing
- **Draft Management**: CRUD operations for piece configurations with 5-slot system per user
- **Game Rooms**: WebSocket-powered real-time gameplay with FEN synchronization
- **Room Logic**: Combines player drafts into a single game board (normal + reversed color variants)

Key endpoints:
- `POST /api/auth/register` – User registration
- `POST /api/auth/login` – Login by username
- `GET/POST /api/drafts` – Manage drafts
- `POST /api/rooms` – Create game room
- `WS /api/rooms/:id` – Real-time game communication

### Database
- **Users** – Email, username, hashed password
- **Drafts** – 5 slots per user, stores FEN + metadata
- **Rooms** – Ephemeral; stores active games, players, current FEN

## Concept

1. **Draft Phase**: Each player designs their starting position by placing fairy chess pieces within a token budget
2. **Game Phase**: Two drafts are combined vertically on an 8×16 board; players compete in real-time
3. **Learning**: Tutorials and puzzles teach fairy piece rules; analysis board for studying games


## Deployment

- **Frontend**: Netlify or Vercel
- **Backend**: Railway, Render, or Fly.io (with PostgreSQL)
- See `fly.toml` and `Dockerfile` for container setup
