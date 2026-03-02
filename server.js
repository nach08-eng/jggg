const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Determine Mode
const IS_CLOUD = !!(process.env.DATABASE_URL && process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
console.log(`Starting server in ${IS_CLOUD ? 'CLOUD (PostgreSQL + Supabase)' : 'LOCAL (JSON + File System)'} mode.`);

// Middleware
app.use(cors());
app.use(express.json());

// make frontend assets available from the server itself so that
// the pages are always loaded from http://localhost:PORT rather than
// via file:// which would cause fetch() to fail with "Failed to fetch"
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));  // serve root-level files like index.html, style.css, script.js
app.use('/uploads', express.static('uploads'));

// serve index.html for the root path (and optionally for SPA fallbacks)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================================
// CLOUD CONFIGURATION (PostgreSQL + Supabase)
// ============================================================================
let supabase;
let pool;
if (IS_CLOUD) {
    // PostgreSQL Connection
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Required for Supabase in many environments
        }
    });

    pool.on('connect', () => console.log('PostgreSQL connected'));
    pool.on('error', (err) => console.error('PostgreSQL unexpected error:', err));

    // Supabase Configuration
    supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY
    );
    console.log('Supabase Storage connected');
}

// ============================================================================
// LOCAL CONFIGURATION (JSON + File System)
// ============================================================================
const DATA_FILE = path.join(__dirname, 'data', 'books.json');
let uploadLocal;

if (!IS_CLOUD) {
    // Ensure directories exist
    const uploadDir = path.join(__dirname, 'uploads');
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

// Multer configuration (works for both modes)
uploadLocal = multer({
    storage: multer.memoryStorage(), // Store in memory for flexibility
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Helper for Local Data
const getLocalBooks = () => {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch { return []; }
};
const saveLocalBooks = (books) => fs.writeFileSync(DATA_FILE, JSON.stringify(books, null, 2), 'utf8');


// ============================================================================
// API ROUTES
// ============================================================================

// Select appropriate uploader (only for local mode)
const upload = uploadLocal;

// Admin Login Route
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    // Simple hardcoded password for demonstration. In production, use env vars.
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Soma*Valli83';

    if (password === ADMIN_PASSWORD) {
        // Return a simple token
        return res.json({ success: true, token: 'admin-secret-access' });
    }
    return res.status(401).json({ success: false, message: 'Invalid password' });
});

// Auth Middleware
const requireAdmin = (req, res, next) => {
    const token = req.headers['x-admin-token'];
    if (token === 'admin-secret-access') {
        next();
    } else {
        res.status(403).json({ message: 'Unauthorized. Admin access required.' });
    }
};

// Upload Book (Protected)
app.post('/api/books', requireAdmin, upload.fields([{ name: 'bookFile', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), async (req, res) => {
    try {
        const { title, author, description, language, year, subjects } = req.body;

        const bookFile = req.files['bookFile'] ? req.files['bookFile'][0] : null;
        const coverImage = req.files['coverImage'] ? req.files['coverImage'][0] : null;

        if (!bookFile) return res.status(400).json({ message: 'Book file is required' });

        // Parse subjects
        let parsedSubjects = [];
        if (subjects) {
            parsedSubjects = Array.isArray(subjects) ? subjects : subjects.split(',').map(s => s.trim());
        }

        if (IS_CLOUD) {
            // --- CLOUD MODE (Supabase) ---
            const timestamp = Date.now();
            const bookFileName = `${timestamp}-${bookFile.originalname}`;
            const coverFileName = coverImage ? `${timestamp}-${coverImage.originalname}` : null;

            // Upload book file to Supabase Storage
            const { data: bookData, error: bookError } = await supabase.storage
                .from('library-books')
                .upload(`books/${bookFileName}`, bookFile.buffer, {
                    contentType: bookFile.mimetype,
                    upsert: false
                });

            if (bookError) throw new Error('Failed to upload book file: ' + bookError.message);

            // Get public URL for book
            const { data: { publicUrl: bookUrl } } = supabase.storage
                .from('library-books')
                .getPublicUrl(`books/${bookFileName}`);

            // Upload cover image if provided
            let coverUrl = null;
            if (coverImage) {
                const { data: coverData, error: coverError } = await supabase.storage
                    .from('library-books')
                    .upload(`covers/${coverFileName}`, coverImage.buffer, {
                        contentType: coverImage.mimetype,
                        upsert: false
                    });

                if (coverError) throw new Error('Failed to upload cover: ' + coverError.message);

                const { data: { publicUrl } } = supabase.storage
                    .from('library-books')
                    .getPublicUrl(`covers/${coverFileName}`);
                coverUrl = publicUrl;
            }

            // Save to PostgreSQL
            const query = `
                INSERT INTO books (title, author, description, language, year, subjects, file_url, cover_image)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;
            const values = [
                title, author, description, language,
                year ? parseInt(year) : null,
                parsedSubjects,
                bookUrl,
                coverUrl
            ];

            const result = await pool.query(query, values);
            return res.status(201).json(result.rows[0]);

        } else {
            // --- LOCAL MODE REQ ---
            const timestamp = Date.now();
            const bookFileName = `${timestamp}-${bookFile.originalname}`;
            const coverFileName = coverImage ? `${timestamp}-${coverImage.originalname}` : null;

            // Save book file to disk
            const bookPath = path.join(__dirname, 'uploads', bookFileName);
            fs.writeFileSync(bookPath, bookFile.buffer);

            // Save cover image if provided
            let coverPath = null;
            if (coverImage) {
                coverPath = path.join(__dirname, 'uploads', coverFileName);
                fs.writeFileSync(coverPath, coverImage.buffer);
            }

            const newBook = {
                _id: Date.now().toString(),
                title, author, description, language,
                year: year ? parseInt(year) : null,
                subjects: parsedSubjects,
                fileUrl: `/uploads/${bookFileName}`,
                coverImage: coverImage ? `/uploads/${coverFileName}` : null,
                uploadedAt: new Date().toISOString()
            };
            const books = getLocalBooks();
            books.push(newBook);
            saveLocalBooks(books);
            return res.status(201).json(newBook);
        }

    } catch (error) {
        console.error("Upload error:", error);
        console.error("Stack trace:", error.stack);
        res.status(500).json({ message: 'Server error during upload', error: error.message, details: error.stack });
    }
});

// Get Books
app.get('/api/books', async (req, res) => {
    try {
        const { search, language, year, subject } = req.query;

        if (IS_CLOUD) {
            // --- CLOUD MODE (PostgreSQL) ---
            let query = 'SELECT * FROM books WHERE 1=1';
            let values = [];
            let counter = 1;

            if (search) {
                query += ` AND (title ILIKE $${counter} OR author ILIKE $${counter})`;
                values.push(`%${search}%`);
                counter++;
            }
            if (language) {
                query += ` AND language = $${counter}`;
                values.push(language);
                counter++;
            }
            if (year) {
                query += ` AND year = $${counter}`;
                values.push(parseInt(year));
                counter++;
            }
            if (subject) {
                query += ` AND $${counter} = ANY(subjects)`;
                values.push(subject);
                counter++;
            }

            query += ' ORDER BY uploaded_at DESC';

            const result = await pool.query(query, values);

            // Map SQL snake_case to frontend camelCase if needed, 
            // but let's see if we can just keep them as is or map them.
            // The frontend expects: _id (or id), title, author, description, language, year, subjects, fileUrl, coverImage, uploadedAt
            const books = result.rows.map(row => ({
                _id: row.id.toString(),
                title: row.title,
                author: row.author,
                description: row.description,
                language: row.language,
                year: row.year,
                subjects: row.subjects,
                fileUrl: row.file_url,
                coverImage: row.cover_image,
                uploadedAt: row.uploaded_at
            }));

            return res.json(books);

        } else {
            // --- LOCAL MODE REQ ---
            let books = getLocalBooks();
            if (search) {
                const searchLower = search.toLowerCase();
                books = books.filter(b =>
                    (b.title && b.title.toLowerCase().includes(searchLower)) ||
                    (b.author && b.author.toLowerCase().includes(searchLower))
                );
            }
            if (language) books = books.filter(b => b.language === language);
            if (year) books = books.filter(b => b.year === parseInt(year));
            if (subject) books = books.filter(b => b.subjects && b.subjects.includes(subject));

            books.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
            return res.json(books);
        }

    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ message: 'Error fetching books' });
    }
});

// Get Single Book
app.get('/api/books/:id', async (req, res) => {
    try {
        if (IS_CLOUD) {
            // --- CLOUD MODE (PostgreSQL) ---
            const result = await pool.query('SELECT * FROM books WHERE id = $1', [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ message: 'Book not found' });

            const row = result.rows[0];
            const book = {
                _id: row.id.toString(),
                title: row.title,
                author: row.author,
                description: row.description,
                language: row.language,
                year: row.year,
                subjects: row.subjects,
                fileUrl: row.file_url,
                coverImage: row.cover_image,
                uploadedAt: row.uploaded_at
            };
            return res.json(book);

        } else {
            // --- LOCAL MODE REQ ---
            const books = getLocalBooks();
            const book = books.find(b => b._id === req.params.id);
            if (!book) return res.status(404).json({ message: 'Book not found' });
            return res.json(book);
        }

    } catch (error) {
        if (error.name === 'CastError') return res.status(404).json({ message: 'Book not found' });
        res.status(500).json({ message: 'Error fetching book details' });
    }
});

// Delete Book (Protected)
app.delete('/api/books/:id', requireAdmin, async (req, res) => {
    try {
        const bookId = req.params.id;

        if (IS_CLOUD) {
            // --- CLOUD MODE (PostgreSQL + Supabase) ---
            const result = await pool.query('SELECT * FROM books WHERE id = $1', [bookId]);
            if (result.rows.length === 0) return res.status(404).json({ message: 'Book not found' });

            const book = result.rows[0];

            // Delete from Supabase Storage
            if (book.file_url) {
                const bookFileName = book.file_url.split('/').pop();
                await supabase.storage.from('library-books').remove([`books/${bookFileName}`]);
            }
            if (book.cover_image) {
                const coverFileName = book.cover_image.split('/').pop();
                await supabase.storage.from('library-books').remove([`covers/${coverFileName}`]);
            }

            // Delete from PostgreSQL
            await pool.query('DELETE FROM books WHERE id = $1', [bookId]);
            return res.json({ message: 'Book deleted successfully' });

        } else {
            // --- LOCAL MODE ---
            let books = getLocalBooks();
            const bookIndex = books.findIndex(b => b._id === bookId);

            if (bookIndex === -1) return res.status(404).json({ message: 'Book not found' });

            const book = books[bookIndex];

            // Delete files from disk
            const deleteFile = (url) => {
                if (url && url.startsWith('/uploads/')) {
                    // Fix for Windows: path.join with a leading slash treats it as root-relative.
                    // We remove the leading slash to make it relative to __dirname.
                    const relativePath = url.substring(1);
                    const filePath = path.join(__dirname, relativePath);
                    console.log(`Attempting to delete file: ${filePath}`);
                    if (fs.existsSync(filePath)) {
                        try {
                            fs.unlinkSync(filePath);
                            console.log(`Successfully deleted: ${filePath}`);
                        } catch (err) {
                            console.error(`Error deleting file ${filePath}:`, err);
                        }
                    } else {
                        console.warn(`File not found for deletion: ${filePath}`);
                    }
                }
            };

            deleteFile(book.fileUrl);
            deleteFile(book.coverImage);

            // Remove from array and save
            books.splice(bookIndex, 1);
            saveLocalBooks(books);

            return res.json({ message: 'Book deleted successfully' });
        }

    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ message: 'Server error during deletion', error: error.message });
    }
});

// Global error handler – catches multer errors and any unhandled exceptions
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) {
        return next(err);
    }
    // multer-specific errors (file too large, unexpected field, etc.)
    if (err && err.name === 'MulterError') {
        return res.status(400).json({ message: err.message });
    }
    res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Mode: ${IS_CLOUD ? 'CLOUD (Production Ready)' : 'LOCAL (Development)'}`);
});
