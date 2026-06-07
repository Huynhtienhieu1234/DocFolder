/**
 * PDF Viewer Manager
 * Handles PDF viewing, navigation, and search using PDF.js
 */
class PDFViewerManager {
  constructor() {
    this.pdfDoc = null;
    this.pageNum = 1;
    this.pageRendering = false;
    this.pageNumPending = null;
    this.zoom = 100;
    this.searchText = "";
    this.searchResults = [];
    this.currentSearchIndex = 0;
    this.currentFile = null;
    this.pdfjsApi = null;
    this.renderToken = 0;
    this.viewMode = "all";
  }

  /**
   * Wait for pdfjs to be available
   * @returns {Promise<void>}
   */
  async waitForPDFJS() {
    let attempts = 0;
    while (
      typeof pdfjsLib === "undefined" &&
      typeof pdfjs === "undefined" &&
      attempts < 50
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    this.pdfjsApi =
      typeof pdfjsLib !== "undefined"
        ? pdfjsLib
        : typeof pdfjs !== "undefined"
          ? pdfjs
          : null;

    if (!this.pdfjsApi) {
      throw new Error("PDF.js library failed to load");
    }

    // Ensure worker is set
    if (
      this.pdfjsApi.GlobalWorkerOptions &&
      !this.pdfjsApi.GlobalWorkerOptions.workerSrc
    ) {
      this.pdfjsApi.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    }
  }

  /**
   * Load PDF file from FileHandle
   * @param {FileSystemFileHandle} fileHandle
   * @returns {Promise<void>}
   */
  async loadPDF(fileHandle, options = {}) {
    try {
      const shouldRender = options.render !== false;

      // Ensure pdfjs is available
      await this.waitForPDFJS();

      const file = await fileHandle.getFile();
      const arrayBuffer = await file.arrayBuffer();

      // Load PDF document
      this.pdfDoc = await this.pdfjsApi.getDocument({ data: arrayBuffer })
        .promise;
      this.pageNum = 1;
      this.zoom = 100;
      this.currentFile = {
        name: file.name,
        size: file.size,
        pageCount: this.pdfDoc.numPages,
        handle: fileHandle,
      };

      // Update page count
      document.getElementById("pdfPageCount").textContent =
        `/ ${this.pdfDoc.numPages}`;
      document.getElementById("pdfPageInput").max = this.pdfDoc.numPages;

      if (shouldRender) {
        await this.renderCurrentMode();
      }

      // Save to storage
      storage.setLastOpenedFile(fileHandle.name);
      storage.setPdfViewerState({
        currentPage: 1,
        zoom: 100,
        file: file.name,
      });

      // Try to extract page count and cache it
      await this.updateFilePageCount();
    } catch (error) {
      console.error("Error loading PDF:", error);
      throw error;
    }
  }

  /**
   * Update page count in explorer
   * @returns {Promise<void>}
   */
  async updateFilePageCount() {
    if (this.currentFile && this.pdfDoc) {
      const file = explorer.findFile(this.currentFile.name);
      if (file) {
        file.pageCount = this.pdfDoc.numPages;
      }
    }
  }

  /**
   * Render PDF page
   * @param {number} num - Page number
   * @returns {Promise<void>}
   */
  async renderPage(num) {
    if (!this.pdfDoc) return;

    try {
      const token = ++this.renderToken;
      this.pageRendering = true;

      if (num < 1 || num > this.pdfDoc.numPages) {
        console.warn(`Page ${num} out of range`);
        return;
      }

      this.pageNum = num;
      document.getElementById("pdfPageInput").value = num;
      this.viewMode = "single";
      this.updateViewModeButton();

      // Get page
      const page = await this.pdfDoc.getPage(num);

      // Calculate scale based on zoom
      const scale = this.zoom / 100;

      // Get page dimensions
      const viewport = page.getViewport({ scale });

      const container = document.getElementById("pdfCanvasContainer");
      if (!container) return;

      container.onscroll = null;
      container.innerHTML = "";

      const pageWrapper = document.createElement("div");
      pageWrapper.className = "pdf-page";
      pageWrapper.dataset.page = String(num);

      const pageLabel = document.createElement("div");
      pageLabel.className = "pdf-page-label";
      pageLabel.textContent = `Trang ${num}`;

      const canvas = document.createElement("canvas");
      canvas.id = "pdfCanvas";
      canvas.className = "pdf-canvas";
      canvas.dataset.page = String(num);

      pageWrapper.appendChild(pageLabel);
      pageWrapper.appendChild(canvas);
      container.appendChild(pageWrapper);

      if (token !== this.renderToken) return;
      const context = canvas.getContext("2d");

      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Highlight search results
      if (this.searchText) {
        await this.highlightSearchResults(page, viewport, scale);
      }

      this.pageRendering = false;

      if (this.pageNumPending !== null) {
        await this.renderPage(this.pageNumPending);
        this.pageNumPending = null;
      }
    } catch (error) {
      console.error("Error rendering page:", error);
      this.pageRendering = false;
    }
  }

  /**
   * Render all PDF pages vertically.
   * @returns {Promise<void>}
   */
  async renderAllPages() {
    if (!this.pdfDoc) return;

    const container = document.getElementById("pdfCanvasContainer");
    if (!container) return;

    const token = ++this.renderToken;
    this.pageRendering = true;
    this.viewMode = "all";
    this.pageNum = 1;
    this.updateViewModeButton();
    document.getElementById("pdfPageInput").value = 1;
    container.innerHTML =
      '<div class="pdf-loading">Äang táº£i toÃ n bá»™ trang PDF...</div>';

    try {
      container.innerHTML = "";
      const scale = this.zoom / 100;

      for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
        if (token !== this.renderToken) return;

        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const pageWrapper = document.createElement("div");
        pageWrapper.className = "pdf-page";
        pageWrapper.dataset.page = String(pageNum);

        const pageLabel = document.createElement("div");
        pageLabel.className = "pdf-page-label";
        pageLabel.textContent = `Trang ${pageNum}`;

        const canvas = document.createElement("canvas");
        canvas.className = "pdf-canvas";
        canvas.dataset.page = String(pageNum);
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        pageWrapper.appendChild(pageLabel);
        pageWrapper.appendChild(canvas);
        container.appendChild(pageWrapper);

        await page.render({
          canvasContext: canvas.getContext("2d"),
          viewport: viewport,
        }).promise;
      }

      container.onscroll = () => this.updateCurrentPageFromScroll();
    } catch (error) {
      console.error("Error rendering all pages:", error);
      container.innerHTML =
        '<div class="pdf-loading">KhÃ´ng thá»ƒ hiá»ƒn thá»‹ toÃ n bá»™ trang PDF.</div>';
    } finally {
      this.pageRendering = false;
    }
  }

  /**
   * Render using the active view mode.
   * @returns {Promise<void>}
   */
  async renderCurrentMode() {
    if (this.viewMode === "single") {
      await this.renderPage(this.pageNum);
    } else {
      await this.renderAllPages();
    }
  }

  /**
   * Switch between single-page and all-pages view.
   * @returns {Promise<void>}
   */
  async toggleViewMode() {
    if (!this.pdfDoc) return;

    const targetPage = this.pageNum;
    this.viewMode = this.viewMode === "all" ? "single" : "all";

    if (this.viewMode === "single") {
      await this.renderPage(targetPage);
    } else {
      await this.renderAllPages();
      await this.goToPage(targetPage);
    }
  }

  /**
   * Update the toolbar button label/icon for current view mode.
   */
  updateViewModeButton() {
    const button = document.getElementById("pdfViewModeBtn");
    if (!button) return;

    const icon = button.querySelector("i");
    const label = button.querySelector("span");

    if (this.viewMode === "all") {
      button.title = "Đang xem toàn bộ - bấm để xem từng trang";
      if (icon) icon.className = "bi bi-files";
      if (label) label.textContent = "Toàn bộ";
    } else {
      button.title = "Đang xem từng trang - bấm để xem toàn bộ";
      if (icon) icon.className = "bi bi-file-earmark";
      if (label) label.textContent = "Từng trang";
    }
  }

  /**
   * Keep the toolbar page number in sync while scrolling.
   */
  updateCurrentPageFromScroll() {
    const container = document.getElementById("pdfCanvasContainer");
    if (!container) return;

    const containerTop = container.getBoundingClientRect().top;
    let activePage = this.pageNum;
    let closestDistance = Number.POSITIVE_INFINITY;

    document.querySelectorAll(".pdf-page").forEach((pageEl) => {
      const distance = Math.abs(pageEl.getBoundingClientRect().top - containerTop);
      if (distance < closestDistance) {
        closestDistance = distance;
        activePage = parseInt(pageEl.dataset.page, 10);
      }
    });

    if (activePage && activePage !== this.pageNum) {
      this.pageNum = activePage;
      document.getElementById("pdfPageInput").value = activePage;
    }
  }

  /**
   * Queue page render
   * @param {number} num - Page number
   * @returns {Promise<void>}
   */
  async queuePageRender(num) {
    if (num < 1 || num > this.pdfDoc.numPages) {
      return;
    }

    if (this.pageRendering) {
      this.pageNumPending = num;
    } else {
      await this.renderPage(num);
    }
  }

  /**
   * Navigate to next page
   * @returns {Promise<void>}
   */
  async nextPage() {
    if (this.pdfDoc && this.pageNum < this.pdfDoc.numPages) {
      await this.goToPage(this.pageNum + 1);
    }
  }

  /**
   * Navigate to previous page
   * @returns {Promise<void>}
   */
  async prevPage() {
    if (this.pdfDoc && this.pageNum > 1) {
      await this.goToPage(this.pageNum - 1);
    }
  }

  /**
   * Go to specific page
   * @param {number} num - Page number
   * @returns {Promise<void>}
   */
  async goToPage(num) {
    const pageNum = parseInt(num, 10);
    if (this.pdfDoc && pageNum >= 1 && pageNum <= this.pdfDoc.numPages) {
      this.pageNum = pageNum;
      document.getElementById("pdfPageInput").value = pageNum;

      const pageEl = document.querySelector(`.pdf-page[data-page="${pageNum}"]`);
      if (this.viewMode === "all" && pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        await this.renderPage(pageNum);
      }
    }
  }

  /**
   * Zoom in
   * @returns {Promise<void>}
   */
  async zoomIn() {
    const targetPage = this.pageNum;
    this.zoom = Math.min(this.zoom + 10, 200);
    document.getElementById("pdfZoomLevel").textContent = `${this.zoom}%`;
    await this.renderCurrentMode();
    await this.goToPage(targetPage);
  }

  /**
   * Zoom out
   * @returns {Promise<void>}
   */
  async zoomOut() {
    const targetPage = this.pageNum;
    this.zoom = Math.max(this.zoom - 10, 50);
    document.getElementById("pdfZoomLevel").textContent = `${this.zoom}%`;
    await this.renderCurrentMode();
    await this.goToPage(targetPage);
  }

  /**
   * Fit to page
   * @returns {Promise<void>}
   */
  async fitToPage() {
    // Get canvas container
    const container = document.getElementById("pdfCanvasContainer");
    if (!container || !this.pdfDoc) return;

    try {
      const page = await this.pdfDoc.getPage(this.pageNum);
      const viewport = page.getViewport({ scale: 1 });

      // Calculate zoom to fit
      const containerWidth = container.clientWidth - 32; // Account for padding
      const scaleWidth = containerWidth / viewport.width;

      this.zoom = scaleWidth * 100;
      this.zoom = Math.round(this.zoom);
      const targetPage = this.pageNum;

      document.getElementById("pdfZoomLevel").textContent = `${this.zoom}%`;
      await this.renderCurrentMode();
      await this.goToPage(targetPage);
    } catch (error) {
      console.error("Error fitting to page:", error);
    }
  }

  /**
   * Search in PDF
   * @param {string} text - Search text
   * @returns {Promise<number>} Number of results
   */
  async searchInPDF(text) {
    if (!this.pdfDoc || !text) {
      this.searchResults = [];
      this.currentSearchIndex = 0;
      return 0;
    }

    this.searchText = text.toLowerCase();
    this.searchResults = [];
    this.currentSearchIndex = 0;

    try {
      // Search through all pages
      for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
        const page = await this.pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();

        let pageText = "";
        for (const item of textContent.items) {
          if (item.str) {
            pageText += item.str + " ";
          }
        }

        // Find all occurrences
        const regex = new RegExp(this.escapeRegex(this.searchText), "gi");
        let match;

        while ((match = regex.exec(pageText)) !== null) {
          this.searchResults.push({
            page: pageNum,
            text: match[0],
            index: match.index,
          });
        }
      }

      // Update UI
      const countEl = document.getElementById("searchResultsCount");
      if (countEl) {
        countEl.textContent = this.searchResults.length;
      }

      // Go to first result
      if (this.searchResults.length > 0) {
        await this.goToPage(this.searchResults[0].page);
      }

      return this.searchResults.length;
    } catch (error) {
      console.error("Error searching PDF:", error);
      return 0;
    }
  }

  /**
   * Go to next search result
   * @returns {Promise<void>}
   */
  async nextSearchResult() {
    if (this.searchResults.length === 0) return;

    this.currentSearchIndex =
      (this.currentSearchIndex + 1) % this.searchResults.length;
    const result = this.searchResults[this.currentSearchIndex];

    await this.goToPage(result.page);
  }

  /**
   * Go to previous search result
   * @returns {Promise<void>}
   */
  async prevSearchResult() {
    if (this.searchResults.length === 0) return;

    this.currentSearchIndex =
      (this.currentSearchIndex - 1 + this.searchResults.length) %
      this.searchResults.length;
    const result = this.searchResults[this.currentSearchIndex];

    await this.goToPage(result.page);
  }

  /**
   * Highlight search results on page
   * @param {PDFPage} page
   * @param {PDFViewport} viewport
   * @param {number} scale
   * @returns {Promise<void>}
   */
  async highlightSearchResults(page, viewport, scale) {
    try {
      const textContent = await page.getTextContent();

      // This is simplified - in production, you'd use a more sophisticated approach
      // For now, we just show the search results count
    } catch (error) {
      console.warn("Error highlighting search results:", error);
    }
  }

  /**
   * Extract thumbnail from first page
   * @returns {Promise<string>} Data URL of thumbnail
   */
  async extractThumbnail() {
    if (!this.pdfDoc) return null;

    try {
      const page = await this.pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 0.5 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Error extracting thumbnail:", error);
      return null;
    }
  }

  /**
   * Close PDF viewer
   */
  closePDF() {
    this.pdfDoc = null;
    this.pageNum = 1;
    this.zoom = 100;
    this.searchText = "";
    this.searchResults = [];
    this.currentFile = null;
    this.viewMode = "all";
    this.renderToken++;

    // Reset UI
    document.getElementById("pdfPageInput").value = 1;
    document.getElementById("pdfPageCount").textContent = "/ 0";
    document.getElementById("pdfZoomLevel").textContent = "100%";
    document.getElementById("pdfSearchInput").value = "";
    document.getElementById("pdfCanvasContainer").innerHTML =
      '<canvas id="pdfCanvas" class="pdf-canvas"></canvas>';
    this.updateViewModeButton();

    // Hide viewer
    document.getElementById("pdfViewerContainer").style.display = "none";
    document.getElementById("contentTabContent").style.display = "block";
  }

  /**
   * Escape special regex characters
   * @param {string} text
   * @returns {string}
   */
  escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Show error message
   * @param {string} message
   */
  showError(message) {
    alert(message);
  }

  /**
   * Get current page image as blob
   * @returns {Promise<Blob>}
   */
  async getCurrentPageAsImage() {
    const canvas =
      document.querySelector(`.pdf-canvas[data-page="${this.pageNum}"]`) ||
      document.getElementById("pdfCanvas");
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  /**
   * Export current page as image
   * @returns {Promise<void>}
   */
  async exportCurrentPage() {
    try {
      const blob = await this.getCurrentPageAsImage();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `page-${this.pageNum}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting page:", error);
    }
  }
}

// Create global instance
const pdfViewer = new PDFViewerManager();
