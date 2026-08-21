# MongoDB Local Setup Guide (Windows)

This guide walks you through setting up and running MongoDB on your Windows machine so the Habit & Performance Tracker can save your data.

---

## 1. Download and Install MongoDB

1. **Download the Installer**:
   - Go to the [MongoDB Community Server Download Page](https://www.mongodb.com/try/download/community).
   - Select the platform: **Windows**.
   - Package: **MSI**.
   - Click **Download**.

2. **Run the Installer**:
   - Double-click the downloaded `.msi` installer file.
   - Choose the **Complete** installation setup type.
   - Make sure **"Install MongoDB as a Service"** is checked. This will make MongoDB start automatically when your computer starts.
     - **Service Name**: `MongoDB`
     - **Data Directory**: `C:\Program Files\MongoDB\Server\<version>\data\`
     - **Log Directory**: `C:\Program Files\MongoDB\Server\<version>\log\`
   - Check the box to install **MongoDB Compass** (optional but highly recommended - it is a visual tool to view your data).
   - Complete the installation wizard.

---

## 2. Verify MongoDB is Running

MongoDB should start automatically as a Windows service. You can check its status:

1. Press `Win + R`, type `services.msc`, and press **Enter**.
2. Scroll down to find **MongoDB Server** (or `MongoDB`).
3. Verify that its Status is **Running** and Startup Type is **Automatic**.
   - If it is not running, right-click it and click **Start**.

---

## 3. View Your Database (Using MongoDB Compass)

1. Open **MongoDB Compass** (installed with MongoDB).
2. Click **New Connection**.
3. Use the default URI: `mongodb://localhost:27017`
4. Click **Connect**.
5. You should see a database named **daily** (created automatically by our server). Under it, you will find collections like:
   - `activities`
   - `categories`
   - `goals`
   - `dailylogs`

---

## 4. Run the Habit Tracker

Now that MongoDB is running, simply run:
```powershell
node app.js
```
The server will connect to MongoDB, perform the auto-migration, and serve your application on `http://localhost:3000`.
