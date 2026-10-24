import { useState, useEffect } from "react";
import "./App.css";

// Helper to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  return new Date().toISOString().split("T")[0];
};

// Helper to get the current month in YYYY-MM format
const getCurrentMonth = () => {
  return new Date().toISOString().slice(0, 7);
};

// Categories for Income
const incomeCategories = [
  "Freelanced Income",
  "Pocket Money",
  "Others"
];

// Categories for Expense
const expenseCategories = [
  "Food",
  "Transport",
  "College Fees",
  "Shopping",
  "Entertainment",
  "Others"
];

function App() {
  // State for all transactions
  const [transactions, setTransactions] = useState([]);

  // Form input states
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("Food");
  const [date, setDate] = useState(getTodayDate());

  // Editing state: stores the ID of the transaction being edited, or null when adding
  const [editingId, setEditingId] = useState(null);

  // UI filter and month selector states
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(false);

  // Fetch all transactions from the backend
  const fetchTransactions = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/transactions");
      if (!response.ok) {
        throw new Error("Server returned status " + response.status);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setTransactions(data);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  // Load transactions on initial component mount
  useEffect(() => {
    fetchTransactions();
  }, []);

  // Handle switching transaction type (Income vs Expense)
  // Automatically switches category dropdown options and defaults
  const handleTypeChange = (e) => {
    const selectedType = e.target.value;
    setType(selectedType);
    if (selectedType === "income") {
      setCategory("Freelanced Income");
    } else {
      setCategory("Food");
    }
  };

  // --- Calculations ---

  // 1. Overall Calculations (All time)
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((total, t) => total + Number(t.amount || 0), 0);

  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((total, t) => total + Number(t.amount || 0), 0);

  const balance = income - expenses;

  // 2. Monthly Calculations (Filtered by selectedMonth)
  const monthlyTransactions = transactions.filter(
    (t) => t.date && t.date.startsWith(selectedMonth)
  );

  const monthlyIncome = monthlyTransactions
    .filter((t) => t.type === "income")
    .reduce((total, t) => total + Number(t.amount || 0), 0);

  const monthlyExpenses = monthlyTransactions
    .filter((t) => t.type === "expense")
    .reduce((total, t) => total + Number(t.amount || 0), 0);

  const monthlyBalance = monthlyIncome - monthlyExpenses;

  // --- Form Reset Helper ---
  const resetForm = () => {
    setDescription("");
    setAmount("");
    setType("expense");
    setCategory("Food");
    setDate(getTodayDate());
    setEditingId(null);
  };

  // --- CRUD: Create & Update Handler ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanDescription = description.trim();
    const numericAmount = Number(amount);

    // Frontend validation
    if (!cleanDescription) {
      alert("Please enter a valid description.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      alert("Please enter a positive amount greater than 0.");
      return;
    }

    if (!date) {
      alert("Please select a valid transaction date.");
      return;
    }

    setLoading(true);

    const payload = {
      description: cleanDescription,
      amount: numericAmount,
      type: type,
      category: category || "Others",
      date: date
    };

    try {
      if (editingId) {
        // UPDATE existing transaction (PUT)
        const response = await fetch(
          `http://localhost:5000/api/transactions/${editingId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.message || "Failed to update transaction");
        }

        alert("Transaction updated successfully!");
      } else {
        // CREATE new transaction (POST)
        const response = await fetch("http://localhost:5000/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.message || "Failed to add transaction");
        }

        alert("Transaction added successfully!");
      }

      resetForm();
      await fetchTransactions();
    } catch (error) {
      console.error("Error saving transaction:", error);
      alert("Could not save transaction: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD: Start Editing ---
  const startEdit = (transaction) => {
    const txId = transaction.id || transaction._id;
    setEditingId(txId);
    setDescription(transaction.description || "");
    setAmount(transaction.amount ? String(transaction.amount) : "");
    const txType = transaction.type || "expense";
    setType(txType);
    setCategory(
      transaction.category || (txType === "income" ? "Freelanced Income" : "Food")
    );
    setDate(transaction.date || getTodayDate());
  };

  // --- CRUD: Cancel Editing ---
  const cancelEdit = () => {
    resetForm();
  };

  // --- CRUD: Delete Transaction ---
  const deleteTransaction = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/transactions/${id}`,
        {
          method: "DELETE"
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Could not delete transaction");
      }

      // If we deleted the transaction currently in edit mode, clear the form
      if (editingId === id) {
        resetForm();
      }

      await fetchTransactions();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("Could not delete transaction: " + error.message);
    }
  };

  // Filter transaction list by selected category
  const displayedTransactions = transactions.filter((t) => {
    if (categoryFilter === "All") {
      return true;
    }
    if (categoryFilter === "Others" || categoryFilter === "Other") {
      return t.category === "Others" || t.category === "Other";
    }
    return t.category === categoryFilter;
  });

  // Current list of category options based on selected Transaction Type
  const currentCategoryOptions = type === "income" ? incomeCategories : expenseCategories;

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">Spendly</div>
        <p>Student Expense Tracker</p>
      </header>

      <main className="container">
        <h1>Dashboard</h1>
        <p className="subtitle">Track your money. Manage your future.</p>

        {/* 1. Overall Summary Cards */}
        <section className="summary">
          <div className="card balance">
            <p>Total Balance</p>
            <h2>₹{balance.toFixed(2)}</h2>
          </div>

          <div className="card income">
            <p>Total Income</p>
            <h2>₹{income.toFixed(2)}</h2>
          </div>

          <div className="card expenses">
            <p>Total Expenses</p>
            <h2>₹{expenses.toFixed(2)}</h2>
          </div>
        </section>

        {/* 2. Monthly Summary Section with Month Selector */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "25px",
            marginBottom: "15px",
            flexWrap: "wrap",
            gap: "10px"
          }}
        >
          <h2 style={{ fontSize: "20px", margin: 0 }}>Monthly Summary</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label htmlFor="monthSelect" style={{ fontSize: "14px", fontWeight: "bold" }}>
              Select Month:
            </label>
            <input
              id="monthSelect"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ width: "auto", padding: "6px 10px" }}
            />
          </div>
        </div>

        <section className="summary">
          <div className="card balance">
            <p>Monthly Balance ({selectedMonth})</p>
            <h2>₹{monthlyBalance.toFixed(2)}</h2>
          </div>

          <div className="card income">
            <p>Monthly Income</p>
            <h2>₹{monthlyIncome.toFixed(2)}</h2>
          </div>

          <div className="card expenses">
            <p>Monthly Expenses</p>
            <h2>₹{monthlyExpenses.toFixed(2)}</h2>
          </div>
        </section>

        {/* 3. Main Content: Form & Recent Transactions */}
        <section className="content">
          {/* Add / Edit Transaction Form */}
          <div className="panel">
            <h2>{editingId ? "Edit Transaction" : "Add Transaction"}</h2>

            <form onSubmit={handleSubmit}>
              <label htmlFor="description">Description</label>
              <input
                id="description"
                type="text"
                placeholder="e.g. Salary, Lunch, or College Fees"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              <label htmlFor="amount">Amount (₹)</label>
              <input
                id="amount"
                type="number"
                placeholder="Enter amount"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />

              <label htmlFor="type">Transaction Type</label>
              <select
                id="type"
                value={type}
                onChange={handleTypeChange}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>

              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                {currentCategoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <label htmlFor="date">Date</label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ flex: 1, marginTop: 0 }}
                >
                  {loading
                    ? editingId
                      ? "Updating..."
                      : "Adding..."
                    : editingId
                    ? "Update Transaction"
                    : "Add Transaction"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={cancelEdit}
                    style={{ marginTop: 0, padding: "11px 16px" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Recent Transactions Panel with Category Filter */}
          <div className="panel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                flexWrap: "wrap",
                gap: "10px"
              }}
            >
              <h2 style={{ margin: 0 }}>Recent Transactions</h2>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label
                  htmlFor="categoryFilter"
                  style={{ fontSize: "14px", fontWeight: "bold" }}
                >
                  Filter:
                </label>
                <select
                  id="categoryFilter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ width: "auto", padding: "6px 10px" }}
                >
                  <option value="All">All Categories</option>
                  <optgroup label="Income Categories">
                    {incomeCategories.map((cat) => (
                      <option key={`inc-${cat}`} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Expense Categories">
                    {expenseCategories.map((cat) => (
                      <option key={`exp-${cat}`} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {displayedTransactions.length === 0 ? (
              <p className="empty">
                {categoryFilter !== "All"
                  ? `No transactions found under "${categoryFilter}".`
                  : "No transactions yet. Add your first one!"}
              </p>
            ) : (
              <div className="transaction-list">
                {displayedTransactions.map((transaction) => {
                  const txId = transaction.id || transaction._id;
                  return (
                    <div className="transaction" key={txId}>
                      <div>
                        <strong>{transaction.description}</strong>
                        <p>
                          {transaction.type} • {transaction.category || "Others"} • {transaction.date}
                        </p>
                      </div>

                      <div className="transaction-right">
                        <strong
                          className={
                            transaction.type === "income" ? "green" : "red"
                          }
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          ₹{Number(transaction.amount).toFixed(2)}
                        </strong>

                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="edit-button"
                            onClick={() => startEdit(transaction)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="delete-button"
                            onClick={() => deleteTransaction(txId)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
