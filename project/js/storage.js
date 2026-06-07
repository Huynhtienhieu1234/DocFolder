/**
 * Storage Manager
 * Handles LocalStorage operations for persisting application state
 */
class StorageManager {
  constructor() {
    this.storagePrefix = "pdfmanager_";
  }

  /**
   * Get item from localStorage
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if key not found
   * @returns {*} Stored value or default
   */
  getItem(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(this.storagePrefix + key);
      if (value === null) return defaultValue;

      // Try to parse as JSON
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    } catch (error) {
      console.error(`Error getting item from storage: ${key}`, error);
      return defaultValue;
    }
  }

  /**
   * Set item in localStorage
   * @param {string} key - Storage key
   * @param {*} value - Value to store (will be JSON stringified if object)
   * @returns {boolean} Success status
   */
  setItem(key, value) {
    try {
      const storageValue =
        typeof value === "string" ? value : JSON.stringify(value);
      localStorage.setItem(this.storagePrefix + key, storageValue);
      return true;
    } catch (error) {
      console.error(`Error setting item in storage: ${key}`, error);
      return false;
    }
  }

  /**
   * Remove item from localStorage
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  removeItem(key) {
    try {
      localStorage.removeItem(this.storagePrefix + key);
      return true;
    } catch (error) {
      console.error(`Error removing item from storage: ${key}`, error);
      return false;
    }
  }

  /**
   * Clear all items with prefix
   * @returns {boolean} Success status
   */
  clear() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.storagePrefix)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      console.error("Error clearing storage", error);
      return false;
    }
  }

  // ========== Specific Methods ==========

  /**
   * Get dark mode preference
   * @returns {boolean}
   */
  getDarkMode() {
    return this.getItem("darkMode", false);
  }

  /**
   * Set dark mode preference
   * @param {boolean} isDark
   */
  setDarkMode(isDark) {
    this.setItem("darkMode", isDark);
  }

  /**
   * Get favorites list
   * @returns {Array}
   */
  getFavorites() {
    return this.getItem("favorites", []);
  }

  /**
   * Set favorites list
   * @param {Array} favorites
   */
  setFavorites(favorites) {
    this.setItem("favorites", favorites);
  }

  /**
   * Add to favorites
   * @param {string} filePath
   */
  addFavorite(filePath) {
    const favorites = this.getFavorites();
    if (!favorites.includes(filePath)) {
      favorites.push(filePath);
      this.setFavorites(favorites);
    }
  }

  /**
   * Remove from favorites
   * @param {string} filePath
   */
  removeFavorite(filePath) {
    let favorites = this.getFavorites();
    favorites = favorites.filter((f) => f !== filePath);
    this.setFavorites(favorites);
  }

  /**
   * Check if file is favorite
   * @param {string} filePath
   * @returns {boolean}
   */
  isFavorite(filePath) {
    const favorites = this.getFavorites();
    return favorites.includes(filePath);
  }

  /**
   * Get completed/read files list
   * @returns {Array}
   */
  getCompletedFiles() {
    const data = this.getItem("completedFiles", []);
    if (!Array.isArray(data)) {
      return [];
    }
    return Array.from(new Set(data));
  }

  /**
   * Set completed/read files list
   * @param {Array} completedFiles
   */
  setCompletedFiles(completedFiles) {
    this.setItem("completedFiles", completedFiles);
  }

  /**
   * Mark file as completed/read
   * @param {string} filePath
   */
  addCompletedFile(filePath) {
    const completedFiles = this.getCompletedFiles();
    if (!completedFiles.includes(filePath)) {
      completedFiles.push(filePath);
      this.setCompletedFiles(completedFiles);
    }
  }

  /**
   * Remove completed/read mark
   * @param {string} filePath
   */
  removeCompletedFile(filePath) {
    let completedFiles = this.getCompletedFiles();
    completedFiles = completedFiles.filter((f) => f !== filePath);
    this.setCompletedFiles(completedFiles);
  }

  /**
   * Check if file is completed/read
   * @param {string} filePath
   * @returns {boolean}
   */
  isCompletedFile(filePath) {
    const completedFiles = this.getCompletedFiles();
    return completedFiles.includes(filePath);
  }

  /**
   * Get sort preference
   * @returns {string}
   */
  getSortPreference() {
    return this.getItem("sortPreference", "name-asc");
  }

  /**
   * Set sort preference
   * @param {string} sortType
   */
  setSortPreference(sortType) {
    this.setItem("sortPreference", sortType);
  }

  /**
   * Get filter preference
   * @returns {string}
   */
  getFilterPreference() {
    return this.getItem("filterPreference", "");
  }

  /**
   * Set filter preference
   * @param {string} filterType
   */
  setFilterPreference(filterType) {
    this.setItem("filterPreference", filterType);
  }

  /**
   * Get last opened file
   * @returns {string}
   */
  getLastOpenedFile() {
    return this.getItem("lastOpenedFile", null);
  }

  /**
   * Set last opened file
   * @param {string} filePath
   */
  setLastOpenedFile(filePath) {
    this.setItem("lastOpenedFile", filePath);
  }

  /**
   * Get session data (files, folders, etc.)
   * @returns {Object}
   */
  getSessionData() {
    return this.getItem("sessionData", {
      files: [],
      folders: [],
      folderStructure: {},
      lastUpdate: null,
    });
  }

  /**
   * Set session data
   * @param {Object} data
   */
  setSessionData(data) {
    this.setItem("sessionData", data);
  }

  /**
   * Get cached thumbnails
   * @returns {Object}
   */
  getThumbnails() {
    return this.getItem("thumbnails", {});
  }

  /**
   * Set thumbnail cache
   * @param {Object} thumbnails
   */
  setThumbnails(thumbnails) {
    this.setItem("thumbnails", thumbnails);
  }

  /**
   * Get thumbnail for specific file
   * @param {string} filePath
   * @returns {string|null}
   */
  getThumbnail(filePath) {
    const thumbnails = this.getThumbnails();
    return thumbnails[filePath] || null;
  }

  /**
   * Set thumbnail for specific file
   * @param {string} filePath
   * @param {string} dataUrl
   */
  setThumbnail(filePath, dataUrl) {
    const thumbnails = this.getThumbnails();
    thumbnails[filePath] = dataUrl;
    this.setThumbnails(thumbnails);
  }

  /**
   * Clear old thumbnails (keep only last 100)
   */
  clearOldThumbnails() {
    const thumbnails = this.getThumbnails();
    const keys = Object.keys(thumbnails);

    if (keys.length > 100) {
      const toRemove = keys.slice(0, keys.length - 100);
      toRemove.forEach((key) => {
        delete thumbnails[key];
      });
      this.setThumbnails(thumbnails);
    }
  }

  /**
   * Get view preferences
   * @returns {Object}
   */
  getViewPreferences() {
    return this.getItem("viewPreferences", {
      viewMode: "grid", // grid or list
      itemsPerPage: 20,
      showPreview: true,
    });
  }

  /**
   * Set view preferences
   * @param {Object} prefs
   */
  setViewPreferences(prefs) {
    this.setItem("viewPreferences", prefs);
  }

  /**
   * Get recent files list
   * @returns {Array}
   */
  getRecentFiles() {
    return this.getItem("recentFiles", []);
  }

  /**
   * Add to recent files
   * @param {string} filePath
   */
  addRecentFile(filePath) {
    let recent = this.getRecentFiles();

    // Remove if already exists
    recent = recent.filter((f) => f !== filePath);

    // Add to beginning
    recent.unshift(filePath);

    // Keep only last 50
    recent = recent.slice(0, 50);

    this.setItem("recentFiles", recent);
  }

  /**
   * Get window state (size, position)
   * @returns {Object}
   */
  getWindowState() {
    return this.getItem("windowState", {
      sidebarWidth: 300,
      viewerZoom: 100,
    });
  }

  /**
   * Set window state
   * @param {Object} state
   */
  setWindowState(state) {
    this.setItem("windowState", state);
  }

  /**
   * Get PDF viewer state
   * @returns {Object}
   */
  getPdfViewerState() {
    return this.getItem("pdfViewerState", {
      currentPage: 1,
      zoom: 100,
      file: null,
    });
  }

  /**
   * Set PDF viewer state
   * @param {Object} state
   */
  setPdfViewerState(state) {
    this.setItem("pdfViewerState", state);
  }
}

// Create global instance
const storage = new StorageManager();
