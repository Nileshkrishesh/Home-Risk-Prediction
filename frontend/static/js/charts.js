/**
 * charts.js - Chart.js initializers & visual updates for Home Credit Risk AI
 */

const ChartsManager = {
  charts: {},

  // Half-donut Risk Gauge
  updateRiskGauge(canvasId, percentage) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const prob = Math.min(Math.max(percentage, 0), 100);
    const remainder = 100 - prob;

    let fillColor = '#10b981'; // emerald
    if (prob >= 25) fillColor = '#ef4444'; // rose
    else if (prob >= 15) fillColor = '#f97316'; // orange
    else if (prob >= 8) fillColor = '#f59e0b'; // amber

    if (this.charts[canvasId]) {
      this.charts[canvasId].data.datasets[0].data = [prob, remainder];
      this.charts[canvasId].data.datasets[0].backgroundColor = [fillColor, '#1f2937'];
      this.charts[canvasId].update();
      return;
    }

    this.charts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [prob, remainder],
          backgroundColor: [fillColor, '#1f2937'],
          borderWidth: 0,
          circumference: 180,
          rotation: 270,
          cutout: '78%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: { enabled: false },
          legend: { display: false }
        },
        animation: {
          duration: 600,
          easing: 'easeOutQuart'
        }
      }
    });
  },

  // Feature Importance Horizontal Bar Chart
  renderFeatureImportance(canvasId, features) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    const top10 = features.slice(0, 10);
    const labels = top10.map(f => f.feature);
    const values = top10.map(f => f.importance);

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Gain Importance',
          data: values,
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#e5e7eb', font: { family: 'monospace', size: 11 } }
          }
        }
      }
    });
  },

  // Submissions Distribution Multi-bar Chart
  renderSubmissionsDistribution(canvasId, submissions) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    const labels = ["0-5%", "5-10%", "10-15%", "15-20%", "20-30%", "30-50%", "50%+"];
    const colors = [
      'rgba(99, 102, 241, 0.85)', // Indigo
      'rgba(16, 185, 129, 0.85)', // Emerald
      'rgba(245, 158, 11, 0.85)', // Amber
      'rgba(236, 72, 153, 0.85)'  // Pink
    ];

    const datasets = Object.keys(submissions).map((key, idx) => {
      const sub = submissions[key];
      return {
        label: sub.filename,
        data: sub.distribution.percentages,
        backgroundColor: colors[idx % colors.length],
        borderRadius: 4
      };
    });

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#e5e7eb', boxWidth: 12 }
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.raw}% of predictions`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Predicted Default Probability Range', color: '#9ca3af' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          },
          y: {
            title: { display: true, text: 'Percentage of Test Applicants (%)', color: '#9ca3af' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });
  },

  // EDA: Education Default Rate
  renderEducationRate(canvasId, dataList) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dataList.map(d => d.category),
        datasets: [{
          label: 'Default Rate (%)',
          data: dataList.map(d => d.default_rate),
          backgroundColor: dataList.map(d => d.default_rate > 8.07 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)'),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Default Rate: ${ctx.raw}% (Sample: ${dataList[ctx.dataIndex].count.toLocaleString()})`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#9ca3af', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af', callback: val => `${val}%` }
          }
        }
      }
    });
  },

  // EDA: EXT_SOURCE_2 Distribution Comparison (Defaulters vs Repayers)
  renderExt2Distribution(canvasId, distData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    this.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: distData.labels,
        datasets: [
          {
            label: 'Repayers (TARGET = 0)',
            data: distData.repayers,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            fill: true,
            tension: 0.3,
            pointRadius: 3
          },
          {
            label: 'Defaulters (TARGET = 1)',
            data: distData.defaulters,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            fill: true,
            tension: 0.3,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#e5e7eb', boxWidth: 12 }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'EXT_SOURCE_2 Credit Score Range', color: '#9ca3af' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          },
          y: {
            title: { display: true, text: 'Proportion of Group (%)', color: '#9ca3af' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });
  },

  // EDA: Age Group Default Rate
  renderAgeGroupRate(canvasId, dataList) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    this.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dataList.map(d => d.category),
        datasets: [{
          label: 'Default Rate (%)',
          data: dataList.map(d => d.default_rate),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          fill: true,
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: '#818cf8'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af', callback: val => `${val}%` }
          }
        }
      }
    });
  }
};
