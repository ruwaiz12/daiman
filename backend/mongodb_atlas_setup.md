# MongoDB Atlas Cloud Setup Guide

This guide walks you through setting up a free MongoDB Atlas cloud database and connecting it to your Habit & Performance Tracker.

---

## 1. Create a MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. Register for a free account or log in if you already have one.

---

## 2. Create a Free Database (Cluster)

1. Once logged in, click **Create** (or **Deploy Database**).
2. Choose **M0 (Free)** tier.
3. Select your preferred Cloud Provider (e.g. **AWS**, **Google Cloud**, or **Azure**) and select a region closest to you (e.g. regions marked as "Free Tier Available").
4. Click **Create** (or **Create Deployment**).

---

## 3. Configure Database Security (Credentials & IP)

Atlas requires you to set up database credentials and whitelist your IP address to allow connections:

1. **Security Quickstart**:
   - **Database User**: Create a username and password. Write these down! You will need them for your connection URI.
   - Click **Create Database User**.

2. **Network Access**:
   - Choose **My Local IP Address** (or select **Allow Access from Anywhere - `0.0.0.0/0`** if your IP changes frequently).
   - Click **Add IP Address** / **Finish and Close**.

---

## 4. Get Your Connection String

1. In the Database Deployments view, click the **Connect** button next to your database.
2. Select **Drivers** (or Node.js).
3. Copy the **Connection String**. It will look similar to this:
   ```text
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

---

## 5. Configure Your Habit Tracker

1. Open the `.env` file in the root folder of the project.
2. Replace the local `MONGODB_URI` with your MongoDB Atlas connection string.
3. Replace `<username>` and `<password>` inside the connection string with the user credentials you created in Step 3.

Example `.env` file:
```env
PORT=3000
MONGODB_URI=mongodb+srv://ruwaiz:mypassword123@cluster0.abcde.mongodb.net/daily?retryWrites=true&w=majority
```
*(Tip: Notice how we added `/daily` after the `.net` host to explicitly name the database database `daily`)*.

---

## 6. Run the App

Open terminal and run:
```powershell
node app.js
```
The server will connect to MongoDB Atlas, automatically migrate all categories, activities, goals, and daily logs, and start running!
