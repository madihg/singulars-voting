// Get admin token from URL
const urlPath = window.location.pathname;
let adminToken = urlPath.split('/').pop();

// If accessing via admin.html, extract token from query param or use default
if (adminToken === 'admin.html' || !adminToken || adminToken === 'admin') {
    const urlParams = new URLSearchParams(window.location.search);
    adminToken = urlParams.get('token') || 'a7f3e9b2-4d8c-4a1e-9f6b-3c7d2e8a5b4f';
}

// State management
let themes = [];
let editingId = null;
let hideCompleted = false;

// DOM elements
const adminThemeForm = document.getElementById('adminThemeForm');
const adminThemeInput = document.getElementById('adminThemeInput');
const adminThemesList = document.getElementById('adminThemesList');
const adminCharCount = document.getElementById('adminCharCount');
const adminFormMessage = document.getElementById('adminFormMessage');
const totalThemesEl = document.getElementById('totalThemes');
const totalVotesEl = document.getElementById('totalVotes');
const filterCompletedCheckbox = document.getElementById('filterCompletedCheckbox');
const hiddenSection = document.getElementById('hiddenSection');
const hiddenThemesList = document.getElementById('hiddenThemesList');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadThemes();
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    adminThemeForm.addEventListener('submit', handleAdminSubmit);
    adminThemeInput.addEventListener('input', updateCharCount);
    filterCompletedCheckbox.addEventListener('change', handleFilterChange);
    
    // Add event delegation for hide/show buttons as backup
    document.addEventListener('click', (e) => {
        const hideBtn = e.target.closest('.admin-btn.hide, .admin-btn.show');
        if (hideBtn && hideBtn.dataset.themeId) {
            e.preventDefault();
            e.stopPropagation();
            const themeId = parseInt(hideBtn.dataset.themeId);
            console.log('Hide button clicked via event delegation, theme ID:', themeId);
            toggleHidden(themeId);
        }
    });
}

// Update character count
function updateCharCount() {
    const count = adminThemeInput.value.length;
    adminCharCount.textContent = count;
    adminCharCount.parentElement.classList.toggle('warning', count > 45);
}

// Load themes from API
async function loadThemes() {
    try {
        const response = await fetch('/api/themes', {
            headers: {
                'X-Admin-Token': adminToken,
            },
        });
        if (!response.ok) throw new Error('Failed to load themes');
        
        themes = await response.json();
        console.log('Loaded themes:', themes);
        console.log('Admin token:', adminToken);
        renderThemes();
        updateStats();
    } catch (error) {
        console.error('Load themes error:', error);
        showMessage('Failed to load themes. Please refresh the page.', 'error');
    }
}

// Update statistics
function updateStats() {
    totalThemesEl.textContent = themes.length;
    totalVotesEl.textContent = themes.reduce((sum, theme) => sum + theme.votes, 0);
}

// Handle filter change
function handleFilterChange() {
    hideCompleted = filterCompletedCheckbox.checked;
    console.log('Filter completed checkbox changed:', hideCompleted);
    renderThemes();
}

// Render themes
function renderThemes() {
    console.log('Rendering themes. Total themes:', themes.length);
    
    // Separate themes into visible and hidden (check for both 0 and falsy values)
    const visibleThemes = themes.filter(t => !t.hidden || t.hidden === 0);
    const hiddenThemes = themes.filter(t => t.hidden && t.hidden !== 0);
    
    console.log('Visible themes:', visibleThemes.length, 'Hidden themes:', hiddenThemes.length);
    
    // Further filter visible themes based on hideCompleted state
    const displayThemes = hideCompleted ? visibleThemes.filter(t => !t.completed) : visibleThemes;
    
    // Render visible themes
    if (displayThemes.length === 0) {
        adminThemesList.innerHTML = `
            <div class="empty-state">
                <p>${hideCompleted ? 'No incomplete themes.' : 'No visible themes yet.'}</p>
            </div>
        `;
    } else {
        adminThemesList.innerHTML = displayThemes.map(theme => renderThemeCard(theme)).join('');
    }
    
    // Render hidden themes section
    if (hiddenThemes.length === 0) {
        hiddenSection.style.display = 'none';
    } else {
        hiddenSection.style.display = 'block';
        hiddenThemesList.innerHTML = hiddenThemes.map(theme => renderThemeCard(theme)).join('');
    }
}

// Render a single theme card
function renderThemeCard(theme) {
    return `
        <div class="theme-card ${theme.completed ? 'completed' : ''}" data-id="${theme.id}">
            ${editingId === theme.id ? `
                <div class="edit-form">
                    <input 
                        type="text" 
                        value="${escapeHtml(theme.content)}" 
                        id="editInput-${theme.id}"
                        maxlength="50"
                        autofocus
                    >
                    <button class="save" onclick="window.saveEdit(${theme.id})">Save</button>
                    <button class="cancel" onclick="window.cancelEdit()">Cancel</button>
                </div>
            ` : `
                <div class="theme-content">
                    <div class="theme-text">${escapeHtml(theme.content)}${theme.completed ? ' <span class="done-badge">[DONE]</span>' : ''}</div>
                    <div class="theme-meta">
                        <span class="theme-date">${formatDate(theme.created_at)}</span>
                    </div>
                </div>
                <div class="vote-btn">
                    <span class="vote-icon">▲</span>
                    <span class="vote-count">${theme.votes}</span>
                </div>
                <div class="admin-actions">
                    <label class="checkbox-container" title="${theme.completed ? 'Mark as incomplete' : 'Mark as done'}">
                        <input 
                            type="checkbox" 
                            ${theme.completed ? 'checked' : ''} 
                            onchange="window.toggleComplete(${theme.id})"
                        >
                        <span class="checkbox-label">Done</span>
                    </label>
                    <button class="admin-btn ${theme.hidden ? 'show' : 'hide'}" onclick="window.toggleHidden(${theme.id})" title="${theme.hidden ? 'Show to users' : 'Hide from users'}" data-theme-id="${theme.id}" data-is-hidden="${theme.hidden ? '1' : '0'}">
                        ${theme.hidden ? 'Show' : 'Hide'}
                    </button>
                    <button class="admin-btn edit" onclick="window.startEdit(${theme.id})">Edit</button>
                    <button class="admin-btn delete" onclick="window.deleteTheme(${theme.id})">Delete</button>
                </div>
            `}
        </div>
    `;
}

// Handle form submission
async function handleAdminSubmit(e) {
    e.preventDefault();
    
    const content = adminThemeInput.value.trim();
    
    if (!content) {
        showMessage('Please enter a theme', 'error');
        return;
    }
    
    if (content.length > 50) {
        showMessage('Theme must be 50 characters or less', 'error');
        return;
    }
    
    const submitBtn = adminThemeForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/api/themes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': adminToken,
            },
            body: JSON.stringify({ content }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to add theme');
        }
        
        // Success
        themes.unshift(data);
        themes.sort((a, b) => b.votes - a.votes || new Date(a.created_at) - new Date(b.created_at));
        renderThemes();
        updateStats();
        
        adminThemeInput.value = '';
        updateCharCount();
        showMessage('Theme added successfully!', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
    }
}

// Start editing a theme
function startEdit(id) {
    editingId = id;
    renderThemes();
}

// Cancel editing
function cancelEdit() {
    editingId = null;
    renderThemes();
}

// Save edited theme
async function saveEdit(id) {
    const input = document.getElementById(`editInput-${id}`);
    const content = input.value.trim();
    
    if (!content) {
        showMessage('Theme cannot be empty', 'error');
        return;
    }
    
    if (content.length > 50) {
        showMessage('Theme must be 50 characters or less', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/themes/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': adminToken,
            },
            body: JSON.stringify({ content }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to update theme');
        }
        
        // Update local state
        const index = themes.findIndex(t => t.id === id);
        if (index !== -1) {
            themes[index] = data;
        }
        
        editingId = null;
        renderThemes();
        showMessage('Theme updated successfully!', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

// Toggle theme hidden status
async function toggleHidden(id) {
    try {
        console.log('=== TOGGLE HIDDEN CALLED ===');
        console.log('Theme ID:', id, 'Type:', typeof id);
        console.log('Admin token:', adminToken);
        
        // Find the theme before toggle
        const themeBefore = themes.find(t => t.id === id);
        console.log('Theme before toggle:', themeBefore);
        console.log('Current hidden value:', themeBefore?.hidden, 'Type:', typeof themeBefore?.hidden);
        
        const response = await fetch(`/api/admin/themes/${id}/toggle-hidden`, {
            method: 'PATCH',
            headers: {
                'X-Admin-Token': adminToken,
                'Content-Type': 'application/json',
            },
        });
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('API Error:', errorData);
            throw new Error(errorData.error || 'Failed to toggle visibility');
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        console.log('Response hidden value:', data.hidden, 'Type:', typeof data.hidden);
        
        // Normalize hidden value (handle null, undefined, string "0"/"1", etc.)
        const normalizedHidden = data.hidden === null || data.hidden === undefined ? 0 : (parseInt(data.hidden) || 0);
        data.hidden = normalizedHidden;
        
        console.log('Normalized hidden value:', normalizedHidden, 'Type:', typeof normalizedHidden);
        
        // Update local state
        const index = themes.findIndex(t => t.id === id);
        console.log('Theme index in array:', index);
        
        if (index !== -1) {
            const oldHidden = themes[index].hidden;
            themes[index] = { ...themes[index], ...data, hidden: normalizedHidden };
            console.log('Theme updated from hidden=' + oldHidden + ' to hidden=' + themes[index].hidden);
        } else {
            console.error('Theme not found in local state!');
        }
        
        // Force re-render
        renderThemes();
        updateStats();
        
        // Show correct message based on normalized value
        const isHidden = normalizedHidden === 1;
        console.log('Is hidden?', isHidden, 'Value:', normalizedHidden);
        showMessage(isHidden ? 'Theme hidden from users' : 'Theme visible to users', 'success');
        
    } catch (error) {
        console.error('Toggle hidden error:', error);
        console.error('Error stack:', error.stack);
        showMessage(error.message || 'Failed to toggle visibility', 'error');
        // Revert on error
        renderThemes();
    }
}

// Make functions available globally for inline onclick handlers
window.toggleHidden = toggleHidden;
window.toggleComplete = toggleComplete;
window.startEdit = startEdit;
window.cancelEdit = cancelEdit;
window.saveEdit = saveEdit;
window.deleteTheme = deleteTheme;

// Toggle theme completed status
async function toggleComplete(id) {
    try {
        const response = await fetch(`/api/admin/themes/${id}/toggle-complete`, {
            method: 'PATCH',
            headers: {
                'X-Admin-Token': adminToken,
            },
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to toggle completion');
        }
        
        // Update local state
        const index = themes.findIndex(t => t.id === id);
        if (index !== -1) {
            themes[index] = data;
        }
        
        renderThemes();
        showMessage(data.completed ? 'Theme marked as done!' : 'Theme marked as incomplete', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
        // Revert checkbox on error
        renderThemes();
    }
}

// Delete a theme
async function deleteTheme(id) {
    if (!confirm('Are you sure you want to delete this theme? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/themes/${id}`, {
            method: 'DELETE',
            headers: {
                'X-Admin-Token': adminToken,
            },
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete theme');
        }
        
        // Remove from local state
        themes = themes.filter(t => t.id !== id);
        renderThemes();
        updateStats();
        showMessage('Theme deleted successfully!', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

// Show message
function showMessage(text, type = 'info') {
    adminFormMessage.textContent = text;
    adminFormMessage.className = `message ${type} show`;
    
    setTimeout(() => {
        adminFormMessage.classList.remove('show');
    }, 5000);
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

