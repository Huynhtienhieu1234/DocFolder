/**
 * PDF Manager Application
 * Main application logic and event handlers
 */
class PDFManagerApp {
  constructor() {
    this.isInitialized = false;
    this.currentView = "files";
    this.filteredFiles = [];
  }

  /**
   * Initialize PDF.js
   */
  initPDFJS() {
    try {
      const pdfjsApi =
        typeof pdfjsLib !== "undefined"
          ? pdfjsLib
          : typeof pdfjs !== "undefined"
            ? pdfjs
            : null;

      if (pdfjsApi) {
        pdfjsApi.GlobalWorkerOptions.workerSrc =
          "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
      } else {
        // Try again after a short delay
        setTimeout(() => this.initPDFJS(), 100);
      }
    } catch (error) {
      console.error("Error initializing PDF.js:", error);
    }
  }

  /**
   * Initialize application
   */
  async init() {
    try {
      // Initialize PDF.js first
      this.initPDFJS();

      // Load saved preferences
      this.loadPreferences();

      // Bind event listeners
      this.bindEventListeners();

      // Check File System API support
      if (!explorer.isSupported()) {
        this.showWarning(
          "Trình duyệt của bạn không hỗ trợ File System Access API. Vui lòng sử dụng Chrome, Edge hoặc Firefox mới nhất.",
        );
      }

      this.isInitialized = true;
      console.log("PDF Manager initialized");
    } catch (error) {
      console.error("Error initializing app:", error);
      this.showError("Lỗi khởi tạo ứng dụng: " + error.message);
    }
  }

  /**
   * Load saved preferences
   */
  loadPreferences() {
    // Load dark mode
    const isDarkMode = storage.getDarkMode();
    if (isDarkMode) {
      this.toggleDarkMode(true);
    }

    // Load sort preference
    const sortPref = storage.getSortPreference();
    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) {
      sortSelect.value = sortPref;
    }

    // Load filter preference
    const filterPref = storage.getFilterPreference();
    const filterSelect = document.getElementById("filterSelect");
    if (filterSelect) {
      filterSelect.value = filterPref;
    }
  }

  /**
   * Bind event listeners
   */
  bindEventListeners() {
    // Folder selection
    document
      .getElementById("selectFolderBtn")
      ?.addEventListener("click", () => this.handleSelectFolder());
    document
      .getElementById("folderInput")
      ?.addEventListener("change", (e) => this.handleFolderInputChange(e));

    // Dark mode toggle
    document
      .getElementById("darkModeToggle")
      ?.addEventListener("click", () => this.handleDarkModeToggle());

    // Search
    document
      .getElementById("searchInput")
      ?.addEventListener("input", (e) => this.handleGlobalSearch(e));
    document
      .getElementById("fileSearchInput")
      ?.addEventListener("input", (e) => this.handleFileSearch(e));

    // Sort and filter
    document
      .getElementById("sortSelect")
      ?.addEventListener("change", (e) => this.handleSortChange(e));
    document
      .getElementById("filterSelect")
      ?.addEventListener("change", (e) => this.handleFilterChange(e));
    document
      .getElementById("favoritesOnlyCheck")
      ?.addEventListener("change", (e) => this.handleFavoritesFilter(e));

    // Export CSV
    document
      .getElementById("exportCsvBtn")
      ?.addEventListener("click", () => this.handleExportCSV());

    // PDF Viewer Controls
    document
      .getElementById("pdfCloseBtn")
      ?.addEventListener("click", () => this.closePDFViewer());
    document
      .getElementById("pdfNextBtn")
      ?.addEventListener("click", async () => await pdfViewer.nextPage());
    document
      .getElementById("pdfPrevBtn")
      ?.addEventListener("click", async () => await pdfViewer.prevPage());
    document
      .getElementById("pdfPageInput")
      ?.addEventListener("change", (e) => this.handlePageInputChange(e));
    document
      .getElementById("pdfZoomInBtn")
      ?.addEventListener("click", async () => await pdfViewer.zoomIn());
    document
      .getElementById("pdfZoomOutBtn")
      ?.addEventListener("click", async () => await pdfViewer.zoomOut());
    document
      .getElementById("pdfFitToPageBtn")
      ?.addEventListener("click", async () => await pdfViewer.fitToPage());
    document
      .getElementById("pdfViewModeBtn")
      ?.addEventListener("click", async () => await pdfViewer.toggleViewMode());
    document
      .getElementById("pdfSearchInput")
      ?.addEventListener("input", (e) => this.handlePDFSearch(e));

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) =>
      this.handleKeyboardShortcuts(e),
    );

    // Tab switching
    document
      .getElementById("filesTab")
      ?.addEventListener("click", () => this.switchToFilesTab());
    document
      .getElementById("favoritesTab")
      ?.addEventListener("click", () => this.switchToFavoritesTab());
  }

  /**
   * Handle select folder button click
   */
  async handleSelectFolder() {
    try {
      const btn = document.getElementById("selectFolderBtn");
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Đang quét...';

      const result = await explorer.loadFolder();

      // Render tree view
      this.renderTreeView();

      // Refresh file list
      this.refreshFileList();

      // Update statistics
      statistics.updateStatistics();

      // Update favorites count
      this.updateFavoritesCount();

      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-folder-plus"></i> Chọn Thư Mục';
    } catch (error) {
      console.error("Error selecting folder:", error);
      document.getElementById("selectFolderBtn").disabled = false;
      document.getElementById("selectFolderBtn").innerHTML =
        '<i class="bi bi-folder-plus"></i> Chọn Thư Mục';
    }
  }

  /**
   * Handle folder input change
   */
  async handleFolderInputChange(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Handle file selection if needed
    }
  }

  /**
   * Render folder tree view
   */
  renderTreeView() {
    const treeContainer = document.getElementById("treeContainer");
    if (!treeContainer) return;

    const tree = explorer.getFolderTree();

    if (tree.length === 0) {
      treeContainer.innerHTML =
        '<div class="text-muted small"><i class="bi bi-folder-check"></i> Không có file PDF</div>';
      return;
    }

    treeContainer.innerHTML = this.buildTreeHTML(tree);
    this.attachTreeEventListeners();
  }

  /**
   * Build tree HTML recursively
   * @param {Array} tree
   * @returns {string}
   */
  buildTreeHTML(tree) {
    return tree
      .map((node, index) => {
        const toggleClass = node.children?.length > 0 ? "" : "hidden";
        const isFolder = node.type === "folder";

        if (isFolder) {
          return `
                    <div class="tree-item" data-path="${node.path}" data-type="folder">
                        <span class="tree-toggle ${node.expanded ? "" : "collapsed"}" style="margin-left: -6px;">
                            <i class="bi bi-chevron-down" style="font-size: 0.8rem;"></i>
                        </span>
                        <i class="bi bi-folder-fill" style="color: #ffc107;"></i>
                        <span>${node.name}</span>
                        ${node.fileCount > 0 ? `<span class="tree-item-count">${node.fileCount}</span>` : ""}
                    </div>
                    ${
                      node.children && node.children.length > 0
                        ? `
                        <ul class="tree-children ${node.expanded ? "" : "collapsed"}" style="display: ${node.expanded ? "block" : "none"};">
                            ${this.buildTreeHTML(node.children)}
                        </ul>
                    `
                        : ""
                    }
                `;
        } else {
          return `
                    <div class="tree-item" data-path="${node.path}" data-type="file" data-name="${node.name}">
                        <span class="tree-toggle" style="margin-left: -6px; visibility: hidden;"></span>
                        <i class="bi bi-file-pdf-fill" style="color: #dc3545;"></i>
                        <span>${node.name}</span>
                        ${node.pageCount > 0 ? `<span class="tree-item-count">${node.pageCount}p</span>` : ""}
                    </div>
                `;
        }
      })
      .join("");
  }

  /**
   * Attach tree event listeners
   */
  attachTreeEventListeners() {
    const treeItems = document.querySelectorAll(".tree-item");

    treeItems.forEach((item) => {
      // Toggle folder
      const toggle = item.querySelector(".tree-toggle");
      if (toggle && !toggle.style.visibility === "hidden") {
        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          const parent = item.parentElement;
          const childrenList = parent.querySelector(".tree-children");

          if (childrenList) {
            const isCollapsed = childrenList.style.display === "none";
            childrenList.style.display = isCollapsed ? "block" : "none";
            toggle.classList.toggle("collapsed");
          }
        });
      }

      // Click item
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        document
          .querySelectorAll(".tree-item.active")
          .forEach((el) => el.classList.remove("active"));
        item.classList.add("active");

        const type = item.getAttribute("data-type");
        const path = item.getAttribute("data-path");

        if (type === "folder") {
          this.showFolderFiles(path);
        } else if (type === "file") {
          this.openPDFFile(path);
        }
      });
    });
  }

  /**
   * Show files in folder
   * @param {string} folderPath
   */
  showFolderFiles(folderPath) {
    const files =
      folderPath === ""
        ? explorer.files
        : explorer.getSubfolderFiles(folderPath);

    this.filteredFiles = files;
    this.renderFilesList(files);
  }

  /**
   * Refresh file list
   */
  refreshFileList() {
    this.filteredFiles = explorer.files;
    this.applyFiltersAndSort();
  }

  /**
   * Apply filters and sort
   */
  applyFiltersAndSort() {
    let files = [...this.filteredFiles];

    // Apply search
    const searchInput = document.getElementById("fileSearchInput");
    if (searchInput?.value) {
      const query = ExplorerManager.normalizeText(searchInput.value);
      files = files.filter((f) =>
        ExplorerManager.normalizeText(f.name).includes(query),
      );
    }

    // Apply favorites filter
    if (document.getElementById("favoritesOnlyCheck")?.checked) {
      files = files.filter((f) => storage.isFavorite(f.path));
    }

    // Apply filter
    const filterSelect = document.getElementById("filterSelect");
    const filterValue = filterSelect?.value || "";
    files = explorer.filterFiles(files, filterValue);

    // Apply sort
    const sortSelect = document.getElementById("sortSelect");
    const sortValue = sortSelect?.value || "name-asc";
    files = explorer.sortFiles(files, sortValue);

    this.renderFilesList(files);
  }

  /**
   * Render files list/grid
   * @param {Array} files
   */
  renderFilesList(files) {
    const filesList = document.getElementById("filesList");
    if (!filesList) return;

    if (files.length === 0) {
      filesList.innerHTML = `
                <div class="text-muted text-center py-5">
                    <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                    <p class="mt-3">Không tìm thấy file PDF</p>
                </div>
            `;
      document.getElementById("filesCount").textContent = "0";
      return;
    }

    filesList.innerHTML = files
      .map((file, index) => {
        const isFav = storage.isFavorite(file.path);
        const isCompleted = storage.isCompletedFile(file.path);
        const thumbnail = storage.getThumbnail(file.path);
        const fileSize = ExplorerManager.formatFileSize(file.size);
        const modifiedDate = ExplorerManager.formatDate(file.lastModified);

        return `
                <div class="file-card ${isCompleted ? "completed" : ""}" data-path="${file.path}" data-index="${index}">
                    <div class="file-thumbnail ${thumbnail ? "has-image" : ""}" 
                         style="${thumbnail ? `background-image: url('${thumbnail}')` : ""}">
                        <div class="favorite-btn ${isFav ? "active" : ""}" 
                             onclick="event.stopPropagation(); app.toggleFavorite('${file.path.replace(/'/g, "\\'")}', this)">
                            <i class="bi bi-star${isFav ? "-fill" : ""}"></i>
                        </div>
                        <button class="completed-btn ${isCompleted ? "active" : ""}"
                                type="button"
                                title="${isCompleted ? "Bỏ đánh dấu đã xem xong" : "Đánh dấu đã xem xong"}"
                                onclick="event.stopPropagation(); app.toggleCompleted('${file.path.replace(/'/g, "\\'")}', this)">
                            <i class="bi bi-check2-circle"></i>
                            <span>${isCompleted ? "Đã xem" : "Xem xong"}</span>
                        </button>
                        ${!thumbnail ? '<div class="file-thumbnail-placeholder"><i class="bi bi-file-pdf"></i></div>' : ""}
                        <div class="file-badge">${file.pageCount || "?"} trang</div>
                    </div>
                    <div class="file-info">
                        <div class="file-name" title="${file.name}">${file.name}</div>
                        <div class="file-meta">
                            <div class="file-meta-item">
                                <strong>${fileSize}</strong>
                            </div>
                            <div class="file-meta-item">
                                <strong>${modifiedDate}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");

    document.getElementById("filesCount").textContent = files.length;

    // Attach card click listeners
    filesList.querySelectorAll(".file-card").forEach((card) => {
      card.addEventListener("click", async (e) => {
        const path = card.getAttribute("data-path");
        await this.openPDFFile(path);
      });
    });

    // Lazy load thumbnails
    this.lazyLoadThumbnails(files);
  }

  /**
   * Lazy load thumbnails
   * @param {Array} files
   */
  lazyLoadThumbnails(files) {
    files.forEach(async (file) => {
      const cached = storage.getThumbnail(file.path);
      if (!cached && file.handle) {
        try {
          await pdfViewer.loadPDF(file.handle, { render: false });
          const thumbnail = await pdfViewer.extractThumbnail();
          if (thumbnail) {
            storage.setThumbnail(file.path, thumbnail);

            // Update UI
            const card = document.querySelector(`[data-path="${file.path}"]`);
            if (card) {
              const thumb = card.querySelector(".file-thumbnail");
              thumb.style.backgroundImage = `url('${thumbnail}')`;
              thumb.classList.add("has-image");
            }
          }
          pdfViewer.closePDF();
        } catch (error) {
          console.warn("Error loading thumbnail:", error);
        }
      }
    });

    // Throttle to not load too many at once
    storage.clearOldThumbnails();
  }

  /**
   * Open PDF file
   * @param {string} filePath
   */
  async openPDFFile(filePath) {
    try {
      const file = explorer.findFile(filePath);
      if (!file || !file.handle) {
        this.showError("File không tìm thấy");
        return;
      }

      // Load PDF
      await pdfViewer.loadPDF(file.handle);

      // Get page count
      file.pageCount = pdfViewer.pdfDoc.numPages;
      storage.addRecentFile(filePath);

      // Show viewer
      document.getElementById("contentTabContent").classList.add("pdf-preview-open");
      document.getElementById("pdfViewerContainer").style.display = "flex";
    } catch (error) {
      console.error("Error opening PDF:", error);
      this.showError("Không thể mở file PDF: " + error.message);
    }
  }

  /**
   * Close PDF viewer
   */
  closePDFViewer() {
    pdfViewer.closePDF();
    document.getElementById("contentTabContent").classList.remove("pdf-preview-open");
    document.getElementById("pdfViewerContainer").style.display = "none";
    document.getElementById("contentTabContent").style.display = "block";
    document.getElementById("filesTab").click();
  }

  /**
   * Toggle favorite
   * @param {string} filePath
   * @param {HTMLElement} btn
   */
  toggleFavorite(filePath, btn) {
    if (storage.isFavorite(filePath)) {
      storage.removeFavorite(filePath);
      btn.classList.remove("active");
      btn.innerHTML = '<i class="bi bi-star"></i>';
    } else {
      storage.addFavorite(filePath);
      btn.classList.add("active");
      btn.innerHTML = '<i class="bi bi-star-fill"></i>';
    }

    this.updateFavoritesCount();
    this.refreshFavoritesList();
  }

  /**
   * Toggle completed/read mark
   * @param {string} filePath
   * @param {HTMLElement} btn
   */
  toggleCompleted(filePath, btn) {
    const card = btn.closest(".file-card");

    if (storage.isCompletedFile(filePath)) {
      storage.removeCompletedFile(filePath);
      btn.classList.remove("active");
      btn.title = "Đánh dấu đã xem xong";
      btn.innerHTML = '<i class="bi bi-check2-circle"></i><span>Xem xong</span>';
      card?.classList.remove("completed");
    } else {
      storage.addCompletedFile(filePath);
      btn.classList.add("active");
      btn.title = "Bỏ đánh dấu đã xem xong";
      btn.innerHTML = '<i class="bi bi-check2-circle"></i><span>Đã xem</span>';
      card?.classList.add("completed");
    }
  }

  /**
   * Update favorites count
   */
  updateFavoritesCount() {
    const favorites = storage.getFavorites();
    document.getElementById("favoritesCount").textContent = favorites.length;
    document.getElementById("favCountInTab").textContent = favorites.length;
  }

  /**
   * Switch to files tab
   */
  switchToFilesTab() {
    this.currentView = "files";
    this.refreshFileList();
  }

  /**
   * Switch to favorites tab
   */
  switchToFavoritesTab() {
    this.currentView = "favorites";
    this.refreshFavoritesList();
  }

  /**
   * Refresh favorites list
   */
  refreshFavoritesList() {
    const favoritesList = document.getElementById("favoritesList");
    if (!favoritesList) return;

    const favorites = storage.getFavorites();
    const favoriteFiles = favorites
      .map((path) => explorer.findFile(path))
      .filter((f) => f !== null);

    if (favoriteFiles.length === 0) {
      favoritesList.innerHTML = `
                <div class="text-muted text-center py-5">
                    <i class="bi bi-star" style="font-size: 3rem;"></i>
                    <p class="mt-3">Không có file yêu thích</p>
                </div>
            `;
      return;
    }

    this.renderFilesList(favoriteFiles);
  }

  /**
   * Handle global search
   * @param {Event} e
   */
  handleGlobalSearch(e) {
    const query = ExplorerManager.normalizeText(e.target.value);
    const fileSearchInput = document.getElementById("fileSearchInput");
    if (fileSearchInput) {
      fileSearchInput.value = e.target.value;
    }

    if (!query) {
      this.refreshFileList();
      return;
    }

    const results = explorer.searchFiles(query);
    this.renderFilesList(results);
  }

  /**
   * Handle file search
   * @param {Event} e
   */
  handleFileSearch(e) {
    this.applyFiltersAndSort();
  }

  /**
   * Handle sort change
   * @param {Event} e
   */
  handleSortChange(e) {
    const sortType = e.target.value;
    storage.setSortPreference(sortType);
    this.applyFiltersAndSort();
  }

  /**
   * Handle filter change
   * @param {Event} e
   */
  handleFilterChange(e) {
    const filterType = e.target.value;
    storage.setFilterPreference(filterType);
    this.applyFiltersAndSort();
  }

  /**
   * Handle favorites filter
   * @param {Event} e
   */
  handleFavoritesFilter(e) {
    this.applyFiltersAndSort();
  }

  /**
   * Handle page input change
   * @param {Event} e
   */
  async handlePageInputChange(e) {
    const pageNum = parseInt(e.target.value, 10);
    if (pageNum) {
      await pdfViewer.goToPage(pageNum);
    }
  }

  /**
   * Handle PDF search
   * @param {Event} e
   */
  async handlePDFSearch(e) {
    const query = e.target.value;
    if (query.length < 2) {
      document.getElementById("pdfSearchResults").style.display = "none";
      return;
    }

    const results = await pdfViewer.searchInPDF(query);
    if (results > 0) {
      document.getElementById("pdfSearchResults").style.display = "block";
    }
  }

  /**
   * Handle dark mode toggle
   */
  handleDarkModeToggle() {
    const isDark = document.body.classList.toggle("dark-mode");
    storage.setDarkMode(isDark);
  }

  /**
   * Toggle dark mode
   * @param {boolean} isDark
   */
  toggleDarkMode(isDark) {
    if (isDark) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }

  /**
   * Handle export CSV
   */
  handleExportCSV() {
    try {
      statistics.downloadStatisticsCSV();
    } catch (error) {
      console.error("Error exporting CSV:", error);
      this.showError("Lỗi xuất CSV: " + error.message);
    }
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} e
   */
  handleKeyboardShortcuts(e) {
    // Ctrl+F: Search
    if (e.ctrlKey && e.key === "f") {
      e.preventDefault();
      document.getElementById("searchInput")?.focus();
    }

    // Escape: Close PDF viewer
    if (
      e.key === "Escape" &&
      document.getElementById("pdfViewerContainer").style.display !== "none"
    ) {
      this.closePDFViewer();
    }

    // Arrow keys in PDF viewer
    if (
      document.getElementById("pdfViewerContainer").style.display !== "none"
    ) {
      if (e.key === "ArrowRight") {
        pdfViewer.nextPage();
      } else if (e.key === "ArrowLeft") {
        pdfViewer.prevPage();
      }
    }
  }

  /**
   * Show error message
   * @param {string} message
   */
  showError(message) {
    const alert = document.createElement("div");
    alert.className = "alert alert-danger alert-dismissible fade show";
    alert.setAttribute("role", "alert");
    alert.innerHTML = `
            <strong>Lỗi!</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

    const container = document.querySelector(".main-container");
    container?.insertAdjacentElement("beforebegin", alert);

    setTimeout(() => alert.remove(), 5000);
  }

  /**
   * Show warning message
   * @param {string} message
   */
  showWarning(message) {
    const alert = document.createElement("div");
    alert.className = "alert alert-warning alert-dismissible fade show";
    alert.setAttribute("role", "alert");
    alert.innerHTML = `
            <strong>Cảnh báo!</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

    const container = document.querySelector(".main-container");
    container?.insertAdjacentElement("beforebegin", alert);

    setTimeout(() => alert.remove(), 7000);
  }
}

// Global app instance
const app = new PDFManagerApp();

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
