/**
 * Explorer Manager
 * Handles folder selection and PDF file discovery using File System Access API
 */
class ExplorerManager {
  constructor() {
    this.files = [];
    this.folders = [];
    this.folderStructure = {};
    this.rootHandle = null;
    this.isScanning = false;
  }

  /**
   * Check if File System Access API is supported
   * @returns {boolean}
   */
  isSupported() {
    return "showDirectoryPicker" in window;
  }

  /**
   * Request folder permission from user
   * @returns {Promise<DirectoryHandle>}
   */
  async selectFolder() {
    try {
      if (!this.isSupported()) {
        throw new Error(
          "File System Access API không được hỗ trợ trên trình duyệt này",
        );
      }

      this.rootHandle = await window.showDirectoryPicker({
        mode: "read",
        startIn: "documents",
      });

      return this.rootHandle;
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("User cancelled folder selection");
      } else {
        console.error("Error selecting folder:", error);
      }
      throw error;
    }
  }

  /**
   * Scan folder recursively for PDF files
   * @param {DirectoryHandle} directoryHandle - Folder to scan
   * @param {string} path - Current path (for tracking hierarchy)
   * @returns {Promise<Object>} {files: [], folders: []}
   */
  async scanFolder(directoryHandle, path = "") {
    const results = {
      files: [],
      folders: [],
      structure: {},
    };

    try {
      for await (const entry of directoryHandle.values()) {
        const fullPath = path ? `${path}/${entry.name}` : entry.name;

        if (entry.kind === "directory") {
          results.folders.push({
            name: entry.name,
            path: fullPath,
            handle: entry,
            fileCount: 0,
          });

          // Recursively scan subdirectory
          try {
            const subResults = await this.scanFolder(entry, fullPath);
            results.files.push(...subResults.files);
            results.folders.push(...subResults.folders);

            // Store folder structure
            results.structure[fullPath] = {
              name: entry.name,
              path: fullPath,
              files: subResults.files.filter((f) => f.folderPath === fullPath),
              subFolders: subResults.folders.filter(
                (f) =>
                  f.path.startsWith(fullPath + "/") &&
                  f.path.split("/").length === fullPath.split("/").length + 1,
              ),
            };
          } catch (error) {
            console.warn(`Could not access folder: ${fullPath}`, error);
          }
        } else if (
          entry.kind === "file" &&
          entry.name.toLowerCase().endsWith(".pdf")
        ) {
          results.files.push({
            name: entry.name,
            path: fullPath,
            folderPath: path,
            handle: entry,
            size: null,
            lastModified: null,
            pageCount: null,
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning directory: ${path}`, error);
    }

    return results;
  }

  /**
   * Get file metadata
   * @param {FileSystemFileHandle} fileHandle
   * @returns {Promise<Object>}
   */
  async getFileMetadata(fileHandle) {
    try {
      const file = await fileHandle.getFile();
      return {
        size: file.size,
        lastModified: file.lastModified,
        type: file.type,
      };
    } catch (error) {
      console.error("Error getting file metadata:", error);
      return { size: 0, lastModified: null, type: "" };
    }
  }

  /**
   * Load and explore selected folder
   * @returns {Promise<void>}
   */
  async loadFolder() {
    try {
      this.isScanning = true;
      this.rootHandle = await this.selectFolder();

      if (!this.rootHandle) return;

      // Update UI status
      this.updateFolderStatus("scanning");

      // Scan folder
      const results = await this.scanFolder(this.rootHandle);
      this.files = results.files;
      this.folders = results.folders;
      this.folderStructure = results.structure;

      // Get metadata for all files
      await this.populateFileMetadata();

      // Save to storage
      storage.setSessionData({
        files: this.files.map((f) => ({
          name: f.name,
          path: f.path,
          folderPath: f.folderPath,
          size: f.size,
          lastModified: f.lastModified,
          pageCount: f.pageCount,
        })),
        folders: this.folders.map((f) => ({
          name: f.name,
          path: f.path,
          fileCount: f.fileCount,
        })),
        folderStructure: this.folderStructure,
        lastUpdate: new Date().toISOString(),
      });

      this.updateFolderStatus("ready");
      return results;
    } catch (error) {
      console.error("Error loading folder:", error);
      this.updateFolderStatus("error", error.message);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Populate metadata for all files
   * @returns {Promise<void>}
   */
  async populateFileMetadata() {
    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      const metadata = await this.getFileMetadata(file.handle);
      this.files[i].size = metadata.size;
      this.files[i].lastModified = metadata.lastModified;
    }
  }

  /**
   * Update folder status UI
   * @param {string} status
   * @param {string} message
   */
  updateFolderStatus(status, message = "") {
    const statusEl = document.getElementById("folderStatus");
    if (!statusEl) return;

    const statusMessages = {
      idle: "📁 Chọn thư mục để bắt đầu",
      scanning: "⏳ Đang quét thư mục...",
      ready: `✅ Tìm thấy ${this.files.length} file PDF trong ${this.folders.length} thư mục`,
      error: `❌ Lỗi: ${message}`,
    };

    statusEl.innerHTML = `<i class="bi bi-info-circle"></i> ${statusMessages[status] || message}`;
    statusEl.className = `alert small mb-3 alert-${status === "error" ? "danger" : status === "scanning" ? "warning" : "info"}`;
  }

  /**
   * Get folder tree structure
   * @returns {Array}
   */
  getFolderTree() {
    if (!this.rootHandle) return [];

    const tree = [];
    const rootFolders = this.folders.filter((f) => !f.path.includes("/"));

    for (const folder of rootFolders) {
      const node = this.buildTreeNode(folder);
      tree.push(node);
    }

    return tree;
  }

  /**
   * Build tree node for folder
   * @param {Object} folder
   * @returns {Object}
   */
  buildTreeNode(folder) {
    const fileCount = this.files.filter(
      (f) => f.folderPath === folder.path,
    ).length;
    const subFolders = this.folders.filter(
      (f) =>
        f.path.startsWith(folder.path + "/") &&
        f.path.split("/").length === folder.path.split("/").length + 1,
    );

    const children = [];

    // Add files in this folder
    const filesInFolder = this.files.filter(
      (f) => f.folderPath === folder.path,
    );
    for (const file of filesInFolder) {
      children.push({
        type: "file",
        name: file.name,
        path: file.path,
        folderPath: file.folderPath,
        size: file.size,
        pageCount: file.pageCount || 0,
      });
    }

    // Add subfolders
    for (const subFolder of subFolders) {
      children.push(this.buildTreeNode(subFolder));
    }

    return {
      type: "folder",
      name: folder.name,
      path: folder.path,
      fileCount: fileCount,
      children: children,
      expanded: false,
    };
  }

  /**
   * Get files in specific folder
   * @param {string} folderPath
   * @returns {Array}
   */
  getFilesInFolder(folderPath = "") {
    return this.files.filter((f) => f.folderPath === folderPath);
  }

  /**
   * Get subfolder files
   * @param {string} folderPath
   * @returns {Array}
   */
  getSubfolderFiles(folderPath) {
    return this.files.filter(
      (f) =>
        f.folderPath === folderPath ||
        f.folderPath.startsWith(folderPath + "/"),
    );
  }

  /**
   * Find file by path
   * @param {string} filePath
   * @returns {Object|null}
   */
  findFile(filePath) {
    return this.files.find((f) => f.path === filePath) || null;
  }

  /**
   * Search files by name
   * @param {string} query
   * @returns {Array}
   */
  searchFiles(query) {
    const normalizedQuery = ExplorerManager.normalizeText(query);
    return this.files.filter((f) =>
      ExplorerManager.normalizeText(f.name).includes(normalizedQuery),
    );
  }

  /**
   * Normalize text for Vietnamese-friendly searching.
   * @param {string} text
   * @returns {string}
   */
  static normalizeText(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .trim();
  }

  /**
   * Sort files
   * @param {Array} files
   * @param {string} sortType
   * @returns {Array}
   */
  sortFiles(files, sortType) {
    const sorted = [...files];

    switch (sortType) {
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "size-asc":
        sorted.sort((a, b) => (a.size || 0) - (b.size || 0));
        break;
      case "size-desc":
        sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
        break;
      case "date-asc":
        sorted.sort((a, b) => (a.lastModified || 0) - (b.lastModified || 0));
        break;
      case "date-desc":
        sorted.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        break;
      case "pages-desc":
        sorted.sort((a, b) => (b.pageCount || 0) - (a.pageCount || 0));
        break;
      default:
        break;
    }

    return sorted;
  }

  /**
   * Filter files
   * @param {Array} files
   * @param {string} filterType
   * @returns {Array}
   */
  filterFiles(files, filterType) {
    if (!filterType) return files;

    return files.filter((file) => {
      switch (filterType) {
        case "size-small":
          return (file.size || 0) < 5 * 1024 * 1024; // < 5MB
        case "size-medium":
          return (
            (file.size || 0) >= 5 * 1024 * 1024 &&
            (file.size || 0) <= 50 * 1024 * 1024
          );
        case "size-large":
          return (file.size || 0) > 50 * 1024 * 1024;
        case "pages-few":
          return (file.pageCount || 0) < 10;
        case "pages-many":
          return (file.pageCount || 0) > 50;
        default:
          return true;
      }
    });
  }

  /**
   * Get file statistics
   * @returns {Object}
   */
  getStatistics() {
    let totalSize = 0;
    let totalPages = 0;

    for (const file of this.files) {
      totalSize += file.size || 0;
      totalPages += file.pageCount || 0;
    }

    return {
      totalFiles: this.files.length,
      totalFolders: this.folders.length,
      totalSize: totalSize,
      totalPages: totalPages,
      averageFileSize:
        this.files.length > 0 ? totalSize / this.files.length : 0,
      averagePagesPerFile:
        this.files.length > 0 ? totalPages / this.files.length : 0,
    };
  }

  /**
   * Format file size
   * @param {number} bytes
   * @returns {string}
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  /**
   * Format date
   * @param {number} timestamp
   * @returns {string}
   */
  static formatDate(timestamp) {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
}

// Create global instance
const explorer = new ExplorerManager();
