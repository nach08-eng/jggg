
# Cloud Services Setup Guide

This guide will walk you through setting up MongoDB Atlas (for the database) and AWS S3 (for file storage) so your application can run fully in the cloud on Render.

## Part 1: MongoDB Atlas (Database)

1.  **Create an Account**: Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and sign up for a free account.
2.  **Create a Cluster**:
    *   Choose the **Shared** (Free) option.
    *   Select a provider (AWS is fine) and a region close to you.
    *   Click **Create Cluster**.
3.  **Create a Database User**:
    *   Go to **Database Access** on the sidebar.
    *   Click **Add New Database User**.
    *   Choose **Password Authentication**.
    *   Enter a username (e.g., `admin`) and a secure password. **Save this password!**
    *   In "Database User Privileges", select **Read and write to any database**.
    *   Click **Add User**.
4.  **Network Access**:
    *   Go to **Network Access** on the sidebar.
    *   Click **Add IP Address**.
    *   Select **Allow Access from Anywhere** (0.0.0.0/0). (This allows Render to connect).
    *   Click **Confirm**.
5.  **Get Connection String**:
    *   Go back to **Database** (sidebar).
    *   Click **Connect** on your cluster.
    *   Select **Drivers**.
    *   Copy the connection string (it looks like `mongodb+srv://<username>:<password>@...`).
    *   **Action**: Replace `<password>` with the password you created in step 3. This is your `MONGODB_URI`.

---

## Part 2: AWS S3 (File Storage)

1.  **Create an AWS Account**: Go to [aws.amazon.com](https://aws.amazon.com/) and sign up. (Requires a credit card, but S3 has a generous free tier).
2.  **Create a Bucket**:
    *   Search for **S3** in the console.
    *   Click **Create bucket**.
    *   **Bucket name**: Give it a unique name (e.g., `my-library-books-2025`). **Save this name!** (This is your `AWS_BUCKET_NAME`).
    *   **Region**: Choose a region (e.g., `us-east-1`). **Save this region code!** (This is your `AWS_REGION`).
    *   **Object Ownership**: Select **ACLs enabled** and **Bucket owner preferred**.
    *   **Block Public Access settings**: Uncheck **"Block all public access"**. (We need files to be readable by the public).
        *   Check the authorization box acknowledging the danger.
    *   Click **Create bucket**.
3.  **Create an IAM User (for Credentials)**:
    *   Search for **IAM** in the console.
    *   Click **Users** -> **Create user**.
    *   **User name**: `library-uploader`.
    *   Click **Next**.
    *   **Permissions**: Select **Attach policies directly**.
    *   Search for `AmazonS3FullAccess` and select it. (For tighter security, you can restrict this later).
    *   Click **Next** -> **Create user**.
4.  **Get Access Keys**:
    *   Click on the newly created user (`library-uploader`).
    *   Go to the **Security credentials** tab.
    *   Scroll to **Access keys** and click **Create access key**.
    *   Select **Application running outside AWS**.
    *   Click **Next** -> **Create access key**.
    *   **IMPORTANT**: Copy the **Access key ID** and **Secret access key**. **You will only see the secret key once!**

---

## Part 3: Connect to Render

1.  Go to your [Render Dashboard](https://dashboard.render.com/).
2.  Click on your **Digital Library** service.
3.  Click **Environment** on the left menu.
4.  Add the following Environment Variables:

| Key | Value |
| :--- | :--- |
| `MONGODB_URI` | (From Part 1 - your full connection string) |
| `AWS_BUCKET_NAME` | (From Part 2 - bucket name) |
| `AWS_REGION` | (From Part 2 - e.g., `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | (From Part 2 - IAM User) |
| `AWS_SECRET_ACCESS_KEY` | (From Part 2 - IAM User) |
| `ADMIN_PASSWORD` | `Soma*Valli83` (or your chosen password) |

5.  Click **Save Changes**. Render will restart your app.
6.  Once restarted, your uploads will work and be saved permanently in the cloud!
