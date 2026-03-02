# Supabase Storage Setup Guide

Follow these steps to set up **Supabase Storage** (free, no credit card required):

---

## Step 1: Create Supabase Account

1. Go to [supabase.com](https://supabase.com/)
2. Click **"Start your project"** and sign up (free account)
3. You'll be taken to your dashboard

---

## Step 2: Create a New Project

1. Click **"New Project"**
2. Fill in the details:
   - **Name**: `library-archive` (or any name you like)
   - **Database Password**: Create a strong password and **save it** (you'll need it later)
   - **Region**: Choose the closest region to you
3. Click **"Create new project"**
4. Wait 1-2 minutes for the project to be created

---

## Step 3: Get Your API Credentials

1. In your project dashboard, click on the **⚙️ Settings** icon (bottom left)
2. Go to **API** section
3. You'll see these values (we need them for Render):
   - **Project URL** - This is your `SUPABASE_URL`
   - **anon/public** key - This is your `SUPABASE_KEY`

**Copy both and save them somewhere safe!**

---

## Step 4: Create Storage Bucket

1. In the left sidebar, click on **Storage** 📦
2. Click **"New bucket"**
3. Fill in:
   - **Name**: `library-books`
   - **Public bucket**: ✅ **Check this box** (files need to be publicly accessible)
4. Click **"Create bucket"**

---

## Step 5: Set Bucket Policies (Important!)

1. Click on your newly created `library-books` bucket
2. Go to **"Policies"** tab (top menu)
3. Click **"New Policy"**
4. Select template: **"Enable read access to everyone"**
5. Click **"Review"** then **"Save Policy"**

This allows anyone to read/download the books after they're uploaded.

---

## Step 6: Configure Render

1. Go to your [Render Dashboard](https://dashboard.render.com/)
2. Select your **Digital Library** service
3. Click **"Environment"** on the left
4. Add these Environment Variables:

| Key | Value |
|-----|-------|
| `MONGODB_URI` | `mongodb+srv://nachammaisubbu2006_db_user:tvB3HlMnXM2tMZfy@cluster0.cyiuw41.mongodb.net/?appName=Cluster0` |
| `SUPABASE_URL` | *(Your Project URL from Step 3)* |
| `SUPABASE_KEY` | *(Your anon/public key from Step 3)* |
| `ADMIN_PASSWORD` | `Soma*Valli83` |

5. Click **"Save Changes"**
6. Render will automatically restart your app

---

## ✅ You're Done!

Your app will now:
- ✅ Store book records in **MongoDB**
- ✅ Store PDF/EPUB files in **Supabase Storage**
- ✅ Keep files **permanently** (no more lost uploads!)
- ✅ All for **FREE** (no credit card needed)

Test by uploading a book through your admin panel!
