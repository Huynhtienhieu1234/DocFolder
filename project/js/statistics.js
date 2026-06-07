/**
 * Statistics Manager
 * Handles statistics calculation and chart rendering
 */
class StatisticsManager {
  constructor() {
    this.charts = {};
  }

  /**
   * Update all statistics
   */
  updateStatistics() {
    const stats = explorer.getStatistics();

    // Update footer stats
    document.getElementById("statTotalPdfs").textContent = stats.totalFiles;
    document.getElementById("statTotalFolders").textContent =
      stats.totalFolders;
    document.getElementById("statTotalSize").textContent =
      ExplorerManager.formatFileSize(stats.totalSize);
    document.getElementById("statTotalPages").textContent = stats.totalPages;

    // Update modal stats
    this.updateCharts();
  }

  /**
   * Update charts in statistics modal
   */
  updateCharts() {
    this.updateSizeChart();
    this.updatePagesChart();
    this.updateTopFolders();
  }

  /**
   * Update file size distribution chart
   */
  updateSizeChart() {
    const files = explorer.files;
    const sizeRanges = {
      "Nhỏ (< 1MB)": 0,
      "1-5 MB": 0,
      "5-10 MB": 0,
      "10-50 MB": 0,
      "Lớn (> 50MB)": 0,
    };

    for (const file of files) {
      const size = file.size || 0;
      const sizeMB = size / (1024 * 1024);

      if (sizeMB < 1) {
        sizeRanges["Nhỏ (< 1MB)"]++;
      } else if (sizeMB < 5) {
        sizeRanges["1-5 MB"]++;
      } else if (sizeMB < 10) {
        sizeRanges["5-10 MB"]++;
      } else if (sizeMB < 50) {
        sizeRanges["10-50 MB"]++;
      } else {
        sizeRanges["Lớn (> 50MB)"]++;
      }
    }

    const ctx = document.getElementById("sizeChart")?.getContext("2d");
    if (!ctx) return;

    // Destroy old chart if exists
    if (this.charts.sizeChart) {
      this.charts.sizeChart.destroy();
    }

    const colors = ["#198754", "#17a2b8", "#ffc107", "#fd7e14", "#dc3545"];

    this.charts.sizeChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(sizeRanges),
        datasets: [
          {
            data: Object.values(sizeRanges),
            backgroundColor: colors,
            borderColor: "transparent",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 15,
              font: { size: 11 },
              color: this.getChartLabelColor(),
            },
          },
        },
      },
    });
  }

  /**
   * Update pages distribution chart
   */
  updatePagesChart() {
    const files = explorer.files;
    const pageRanges = {
      "1-5 trang": 0,
      "6-10 trang": 0,
      "11-25 trang": 0,
      "26-50 trang": 0,
      "51-100 trang": 0,
      "> 100 trang": 0,
    };

    for (const file of files) {
      const pages = file.pageCount || 0;

      if (pages <= 5) {
        pageRanges["1-5 trang"]++;
      } else if (pages <= 10) {
        pageRanges["6-10 trang"]++;
      } else if (pages <= 25) {
        pageRanges["11-25 trang"]++;
      } else if (pages <= 50) {
        pageRanges["26-50 trang"]++;
      } else if (pages <= 100) {
        pageRanges["51-100 trang"]++;
      } else {
        pageRanges["> 100 trang"]++;
      }
    }

    const ctx = document.getElementById("pagesChart")?.getContext("2d");
    if (!ctx) return;

    // Destroy old chart if exists
    if (this.charts.pagesChart) {
      this.charts.pagesChart.destroy();
    }

    const colors = [
      "#0d6efd",
      "#6f42c1",
      "#20c997",
      "#198754",
      "#fd7e14",
      "#dc3545",
    ];

    this.charts.pagesChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: Object.keys(pageRanges),
        datasets: [
          {
            data: Object.values(pageRanges),
            backgroundColor: colors,
            borderColor: "transparent",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 15,
              font: { size: 11 },
              color: this.getChartLabelColor(),
            },
          },
        },
      },
    });
  }

  /**
   * Update top folders table
   */
  updateTopFolders() {
    const folderFileCount = {};

    for (const file of explorer.files) {
      const folderPath = file.folderPath || "Root";
      folderFileCount[folderPath] = (folderFileCount[folderPath] || 0) + 1;
    }

    // Sort by count and get top 10
    const sorted = Object.entries(folderFileCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const tableHtml =
      sorted.length > 0
        ? `<table class="table table-sm table-hover mb-0">
                <thead>
                    <tr>
                        <th style="width: 70%;">Thư Mục</th>
                        <th style="width: 30%; text-align: right;">Số File</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted
                      .map(
                        ([folder, count]) => `
                        <tr>
                            <td style="font-size: 0.8rem;">
                                <i class="bi bi-folder"></i> ${folder || "Root"}
                            </td>
                            <td style="text-align: right; font-weight: 500; color: var(--primary-color);">${count}</td>
                        </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>`
        : '<p class="text-muted">Không có dữ liệu</p>';

    const container = document.getElementById("topFoldersTable");
    if (container) {
      container.innerHTML = tableHtml;
    }
  }

  /**
   * Get chart label color based on dark mode
   * @returns {string}
   */
  getChartLabelColor() {
    return document.body.classList.contains("dark-mode")
      ? "#e0e0e0"
      : "#212529";
  }

  /**
   * Export statistics as CSV
   * @returns {string}
   */
  exportStatisticsAsCSV() {
    const files = explorer.files;

    let csv =
      "STT,Tên File,Đường Dẫn,Kích Thước (Bytes),Kích Thước,Số Trang,Ngày Sửa Đổi\n";

    files.forEach((file, index) => {
      const size = ExplorerManager.formatFileSize(file.size || 0);
      const date = ExplorerManager.formatDate(file.lastModified);

      csv += `${index + 1},"${file.name}","${file.path}",${file.size || 0},"${size}",${file.pageCount || 0},"${date}"\n`;
    });

    return csv;
  }

  /**
   * Download CSV file
   */
  downloadStatisticsCSV() {
    const csv = this.exportStatisticsAsCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `pdf-list-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Get statistics summary
   * @returns {Object}
   */
  getStatisticsSummary() {
    const stats = explorer.getStatistics();

    return {
      totalPdfs: stats.totalFiles,
      totalFolders: stats.totalFolders,
      totalSize: ExplorerManager.formatFileSize(stats.totalSize),
      totalPages: stats.totalPages,
      averageFileSize: ExplorerManager.formatFileSize(stats.averageFileSize),
      averagePagesPerFile: Math.round(stats.averagePagesPerFile * 10) / 10,
      largestFile: this.getLargestFile(),
      mostPagesPdf: this.getMostPagesPdf(),
    };
  }

  /**
   * Get largest file
   * @returns {Object}
   */
  getLargestFile() {
    if (explorer.files.length === 0) return null;

    return explorer.files.reduce((prev, current) => {
      return (prev.size || 0) > (current.size || 0) ? prev : current;
    });
  }

  /**
   * Get PDF with most pages
   * @returns {Object}
   */
  getMostPagesPdf() {
    if (explorer.files.length === 0) return null;

    return explorer.files.reduce((prev, current) => {
      return (prev.pageCount || 0) > (current.pageCount || 0) ? prev : current;
    });
  }
}

// Create global instance
const statistics = new StatisticsManager();
