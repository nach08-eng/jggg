// always build the API URL from the current origin so that
// the frontend and backend share the same host/port.  loading the
// HTML file directly (file://) would otherwise make the request fail.
const API_URL = `${window.location.origin}/api/books`;


// State
let currentFilters = {
    search: '',
    language: '',
    year: '',
    subject: ''
};

// DOM Elements
const bookGrid = document.getElementById('bookGrid');
const searchInput = document.getElementById('searchInput');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        fetchBooks();
        setupSearchListener();
    }
});

// --- Fetch & Render ---
async function fetchBooks() {
    const params = new URLSearchParams();
    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.language) params.append('language', currentFilters.language);
    if (currentFilters.year) params.append('year', currentFilters.year);
    if (currentFilters.subject) params.append('subject', currentFilters.subject);

    bookGrid.innerHTML =
        '<div class="book-card loading" style="grid-column: 1/-1; text-align:center; padding: 2rem;">Loading Archive...</div>';

    try {
        const response = await fetch(`${API_URL}?${params.toString()}`);

        const text = await response.text();

        if (!response.ok) {
            throw new Error("Server error while fetching books");
        }

        if (!text) {
            renderBooks([]); // empty response
            return;
        }

        let books;
        try {
            books = JSON.parse(text);
        } catch (e) {
            console.error("Invalid JSON returned:", text);
            throw new Error("Invalid server response");
        }

        renderBooks(books);

    } catch (error) {
        console.error('Error fetching books:', error);
        bookGrid.innerHTML =
            '<p style="text-align:center; color: red;">Failed to load library archive.</p>';
    }
}

function renderBooks(books) {
    bookGrid.innerHTML = '';
    if (books.length === 0) {
        bookGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; font-size: 1.2rem; margin-top: 2rem;">No books found matching criteria.</p>';
        return;
    }

    books.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.onclick = () => openModal(book);

        // Fallback image if no cover
        const coverSrc = book.coverImage || 'https://via.placeholder.com/220x280?text=No+Cover';

        card.innerHTML = `
            <div class="card-image">
                <img src="${coverSrc}" alt="${book.title}" loading="lazy">
            </div>
            <div class="card-content">
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">${book.author}</p>
                <div class="book-meta">
                    <span>${book.year || 'N/A'}</span>
                    <span class="tag">${book.language || 'Unknown'}</span>
                </div>
            </div>
        `;
        bookGrid.appendChild(card);
    });
}

// --- Search & Filter ---
function setupSearchListener() {
    if (!searchInput) return;

    // Debounce search
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            currentFilters.search = e.target.value;
            fetchBooks();
        }, 500);
    });
}

function executeSearch() {
    if (!searchInput) return;
    currentFilters.search = searchInput.value;
    fetchBooks();
}

function filterBooks(type, value) {
    // Toggle logic: if clicking same filter, turn it off
    if (currentFilters[type] === value) {
        currentFilters[type] = '';
        // Remove active class
        updateFilterUI(type, null);
    } else {
        currentFilters[type] = value;
        updateFilterUI(type, value);
    }
    fetchBooks();
}

function updateFilterUI(type, value) {
    // Find all options of this type
    // This is a simplified UI update logic; strictly specific selectors would be better for scaling
    // But for this project scope, it works if we select by onclick text content match or similar
    // Actually, we can just remove 'active' from all in that group and add to the specific one.

    // Resetting visual state for the group
    const group = document.querySelector(`[onclick*="filterBooks('${type}'"]`).parentNode;
    const options = group.querySelectorAll('.filter-option');
    options.forEach(opt => opt.classList.remove('active'));

    if (value) {
        // Find the one that was clicked
        // Simplest way is strict string match on onclick attribute or text
        // Let's iterate and check the onclick attribute content
        options.forEach(opt => {
            if (opt.getAttribute('onclick').includes(`'${value}'`)) {
                opt.classList.add('active');
            }
        });
    }
}

function resetFilters() {
    currentFilters = {
        search: '',
        language: '',
        year: '',
        subject: ''
    };
    if (searchInput) searchInput.value = '';

    // Clear UI active states
    document.querySelectorAll('.filter-option').forEach(opt => opt.classList.remove('active'));

    fetchBooks();
}

// --- Modal ---
const modal = document.getElementById('bookModal');

function openModal(book) {
    if (!modal) return;

    document.getElementById('modalImage').src = book.coverImage || 'https://via.placeholder.com/220x280?text=No+Cover';
    document.getElementById('modalTitle').textContent = book.title;
    document.getElementById('modalAuthor').textContent = `by ${book.author}`;
    document.getElementById('modalYear').textContent = book.year || 'Unknown Year';
    document.getElementById('modalLanguage').textContent = book.language || 'Unknown Language';
    document.getElementById('modalDesc').textContent = book.description || 'No description available.';

    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.href = book.fileUrl; // Serves the file from backend

    // Tags
    const tagsContainer = document.getElementById('modalTags');
    tagsContainer.innerHTML = '';
    if (book.subjects && book.subjects.length > 0) {
        book.subjects.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.style.marginRight = '0.5rem';
            span.textContent = tag;
            tagsContainer.appendChild(span);
        });
    }

    modal.classList.add('active');
}

function closeModal() {
    if (modal) modal.classList.remove('active');
}

// Close modal on outside click
window.onclick = function (event) {
    if (event.target == modal) {
        closeModal();
    }
}

// --- Upload Handling (Admin) ---
async function handleUpload(event) {
    event.preventDefault();

    const form = document.getElementById('uploadForm');
    const submitBtn = document.getElementById('submitBtn');
    const message = document.getElementById('message');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';
    message.textContent = '';

    const formData = new FormData(form);
    const token = localStorage.getItem('adminToken');

    try {
        const response = await fetch(`${window.location.origin}/api/books`, {
            method: 'POST',
            headers: {
                'x-admin-token': token || ''
            },
            body: formData
        });

        // always read text so we can show server feedback even if JSON is malformed
        const text = await response.text();
        let data = null;

        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                // if the server returned HTML or plain text we'll keep it in message
                data = { message: text };
            }
        }

        if (response.ok) {
            message.style.color = 'green';
            message.textContent = data?.message || 'Book uploaded successfully! Redirecting...';

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);

        } else if (response.status === 401 || response.status === 403) {
            // treat any auth error the same
            throw new Error('Unauthorized. Please login again.');

        } else {
            // include status code to help diagnose blank-body responses
            const errMsg = data?.message || `Upload failed (status ${response.status} ${response.statusText})`;
            throw new Error(errMsg);
        }

    } catch (error) {
        console.error('Upload request failed:', error);
        message.style.color = 'red';
        message.textContent = 'Error: ' + error.message;

        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload to Archive';

        if (error.message.includes('Unauthorized')) {
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        }
    }
}
// --- Admin Authentication ---
/*async function handleLogin(event) {
    event.preventDefault();
    const password = document.getElementById('adminPassword').value;
    const message = document.getElementById('loginMessage');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            localStorage.setItem('adminToken', data.token);
            window.location.href = 'admin.html';
        } else {
            message.textContent = data.message || 'Login failed';
        }
    } catch (error) {
        console.error('Login error:', error);
        message.textContent = 'Server error during login.';
    }
}

// Check auth on admin page
if (window.location.pathname.endsWith('admin.html')) {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = 'login.html';
    } else {
        fetchAdminBooks();
    }
}
*/
// --- Admin Book Management ---
async function fetchAdminBooks() {
    const adminBookList = document.getElementById('adminBookList');
    if (!adminBookList) return;

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to fetch books');

        const books = await response.json();
        renderAdminBooks(books);
    } catch (error) {
        console.error('Error fetching admin books:', error);
        adminBookList.innerHTML = '<p style="text-align: center; color: red;">Failed to load books.</p>';
    }
}

function renderAdminBooks(books) {
    const adminBookList = document.getElementById('adminBookList');
    if (books.length === 0) {
        adminBookList.innerHTML = '<p style="text-align: center; color: #666;">No books in the archive yet.</p>';
        return;
    }

    adminBookList.innerHTML = '';
    books.forEach(book => {
        const item = document.createElement('div');
        item.className = 'admin-book-item';

        const thumbSrc = book.coverImage || 'https://via.placeholder.com/50x70?text=No+Cover';

        item.innerHTML = `
            <img src="${thumbSrc}" class="admin-book-thumb" alt="${book.title}">
            <div class="admin-book-info">
                <h4>${book.title}</h4>
                <p>by ${book.author} (${book.year || 'N/A'})</p>
            </div>
            <button class="delete-btn" onclick="deleteBook('${book._id}')">
                <i class="fas fa-trash"></i> Delete
            </button>
        `;
        adminBookList.appendChild(item);
    });
}

async function deleteBook(id) {
    console.log(`Delete requested for book ID: ${id}`);
    if (!confirm('Are you sure you want to delete this book? This action cannot be undone.')) return;

    const token = localStorage.getItem('adminToken');
    console.log(`Using token for deletion: ${token ? 'Token present' : 'No token found'}`);

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
            headers: {
                'x-admin-token': token || ''
            }
        });

        console.log(`Delete response status: ${response.status}`);
        const data = await response.json();

        if (response.ok) {
            console.log('Book deleted successfully:', data);
            alert(data.message || 'Book deleted successfully');
            fetchAdminBooks(); // Refresh the list
        } else {
            console.error('Deletion failed on server:', data);
            throw new Error(data.message || 'Deletion failed');
        }
    } catch (error) {
        console.error('Delete error catch:', error);
        alert('Error: ' + error.message);
    }
}

// Logout function
function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = 'index.html';
}

// Re-enabled developer tools (removed restriction)




const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://nachammaisubbu2006_db_user:<db_password>@cluster0.cyiuw41.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        await client.close();
    }
}
run().catch(console.dir);
