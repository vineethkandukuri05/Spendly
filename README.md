# Spendly - Personal Expense Tracker

Spendly is a full-stack personal expense tracker separated into clean `frontend` and `backend` directories, now connected to **MongoDB**.

## Project Structure

```text
Spendly n/
├── backend/
│   ├── .env               # Environment configuration (PORT, MONGODB_URI)
│   ├── .env.example       # Example environment template
│   ├── package.json       # Backend dependencies (express, mongoose, cors, dotenv)
│   ├── server.js          # Express & Mongoose API server (Port 5000)
│   └── node_modules/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js     # Vite configuration (Port 5173)
│   ├── src/
│   │   ├── App.jsx        # Main React dashboard component
│   │   ├── App.css        # Dashboard styling
│   │   ├── index.css      # Base typography & layout
│   │   └── main.jsx       # React DOM entry point
│   └── node_modules/
├── package.json           # Root scripts
└── README.md
```

## Running the Application

Both servers are currently active:
- **Frontend Website**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Database**: MongoDB running on `mongodb://127.0.0.1:27017/spendly`

### Start Commands

1. **Backend**:
   ```bash
   cd backend
   node server.js
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

## Database Models (MongoDB via Mongoose)

- **`Transaction`**:
  - `description`: String (required)
  - `amount`: Number (required, min: 0.01)
  - `type`: String ('income' | 'expense')
  - `category`: String (default: 'Other')
  - `date`: String (YYYY-MM-DD)
  - `createdAt`, `updatedAt`: Timestamps

- **`Category`**:
  - `name`: String (required, unique)
  - Seeded automatically with default categories: *Food, Transport, College Fees, Shopping, Entertainment, Other*.

## API Endpoints

- `GET /api/transactions` - Fetch transactions (supports `?category=` and `?month=`)
- `POST /api/transactions` - Add a new transaction
- `PUT /api/transactions/:id` - Edit a transaction
- `DELETE /api/transactions/:id` - Delete a transaction
- `GET /api/categories` - Fetch all categories
- `POST /api/categories` - Add a new category
- `GET /api/summary` - Fetch summary (`income`, `expenses`, `balance`)
