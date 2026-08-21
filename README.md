# Daily Tracker (E-commerce Style Restructured Dashboard)

A premium daily performance, habits, goals, and finance tracker application built with a responsive glassmorphic design and a clean MVC architecture.

## Tech Stack

- **Frontend**: React, Vite, CSS, Chart.js, SweetAlert2, Canvas Confetti
- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Tooling**: Git, npm

## Project Structure

```
my-ecommerce/ (Daily Tracker Root)
├── frontend/                 ← React / Vite
│   ├── src/                  ← Components, Hooks, Styling
│   ├── public/               ← Static assets
│   ├── package.json          ← Frontend dependencies & scripts
│   ├── vite.config.js        ← Vite bundler settings & proxy configuration
│   └── .env                  ← Frontend environment config
│
├── backend/                  ← Node.js / Express
│   ├── config/               ← Database connection & migration setup
│   ├── models/               ← Mongoose Models (Activity, Category, Goal, DailyLog)
│   ├── controllers/          ← API endpoint request/response logic
│   ├── routes/               ← Express API Routing
│   ├── middleware/           ← Global error handling and logging
│   ├── server.js             ← Main application entry point
│   ├── package.json          ← Backend dependencies, start, build & dev scripts
│   └── .env                  ← Backend environment secrets & PORT configuration
│
├── README.md                 ← Project documentation
└── .gitignore                ← Files/folders ignored by Git
```

## Setup & Running Locally

### Prerequisites
- Node.js (v18+)
- MongoDB running locally (default: `mongodb://127.0.0.1:27017/daily`)

### Installation & Run

1. Clone or navigate to the repository.
2. Go to the `backend/` directory:
   ```bash
   cd backend
   ```
3. Install dependencies for the backend and the frontend client:
   ```bash
   npm install
   npm run install:client
   ```
4. Setup env variables. Create a `.env` file in the `backend/` directory:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/daily
   ```
5. Run the project in development mode:
   ```bash
   npm run dev
   ```
   This command starts the backend server on `http://localhost:3000` and the React client concurrently with Hot Module Replacement (HMR).
