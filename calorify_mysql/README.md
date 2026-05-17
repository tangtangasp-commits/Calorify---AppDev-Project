# CALORIFY! 🥗

## One-time setup

### 1. Install Python packages
Open a terminal and run:
```
pip install flask flask-cors mysql-connector-python bcrypt requests
```

### 2. Set your MySQL password
Open `backend/config.py` and replace `YOUR_PASSWORD_HERE` with your actual MySQL root password:
```python
DB_PASS = "your_actual_password"
```

### 3. Make sure MySQL is running
- Open **MySQL Workbench** or **Services** and make sure MySQL is started.

---

## Every time you want to run the app

1. **Press `Ctrl+F5`** in VS Code (Run Without Debugging)
2. Open your browser to **http://localhost:5000**

The database and tables are created automatically on first run.
