document.addEventListener('DOMContentLoaded', () => {
    const dashboardGrid = document.getElementById('dashboard-grid');
    const loader = document.getElementById('loader');
    const lastUpdatedEl = document.getElementById('last-updated');

    function fetchAndDisplayStatusCounts() {
        console.log('Requesting dashboard data from background script...');
        loader.style.display = 'block'; // Show loader
        dashboardGrid.innerHTML = ''; // Clear old data

        // Send a message to the background script asking for the data
        chrome.runtime.sendMessage({ action: 'getDashboardData' }, (response) => {
            loader.style.display = 'none'; // Hide loader

            if (response && response.success) {
                console.log('Received data:', response.data);
                renderDashboard(response.data);
                lastUpdatedEl.textContent = new Date().toLocaleTimeString();
            } else {
                dashboardGrid.innerHTML = `<p style="color: #ef4444;">Error: Could not load dashboard data. ${response ? response.message : 'No response from extension.'}</p>`;
                console.error('Failed to get dashboard data:', response);
            }
        });
    }


    // --- START: PASTE THIS ENTIRE NEW FUNCTION ---

    function renderDashboard(statusCounts) {
        const dashboardGrid = document.getElementById('dashboard-grid');
        if (!dashboardGrid) {
            console.error("CRITICAL ERROR: 'dashboard-grid' element not found.");
            return;
        }
        dashboardGrid.innerHTML = '';

        // --- NEW SORTING LOGIC ---
        // This new logic puts "Unchanged" first, then "Waiting for approval", then all others.
        const sortedStatuses = Object.entries(statusCounts).sort(([statusA, countA], [statusB, countB]) => {
            // Rule 1: "Unchanged" is highest priority
            if (statusA === 'Unchanged (36h+)') return -1;
            if (statusB === 'Unchanged (36h+)') return 1;

            // Rule 2: "Waiting for approval" is second priority
            if (statusA === 'Waiting for approval') return -1;
            if (statusB === 'Waiting for approval') return 1;

            // Rule 3: For all other statuses, sort by the highest count.
            return countB - countA;
        });

        if (sortedStatuses.length === 0) {
            dashboardGrid.innerHTML = `<p style="color: #f59e0b;">No data to display.</p>`;
            return;
        }

        sortedStatuses.forEach(([status, count]) => {
            const card = document.createElement('div');
            card.className = 'status-card';

            // --- NEW STYLING LOGIC ---
            // Apply special classes based on the status name.
            if (status === 'Unchanged (36h+)') {
                card.classList.add('unchanged-card'); // Makes the card bigger
                card.classList.add('level-critical', 'blinking-critical'); // Makes it red and blinking
            } else if (status === 'Closed') {
                return; // Don't show the "Closed" card at all
            } else if (count >= 20) {
                card.classList.add('level-critical', 'blinking-critical');
            } else if (count >= 10) {
                card.classList.add('level-warning', 'blinking-warning');
            } else {
                card.classList.add('level-normal', 'blinking-normal');
            }

            card.innerHTML = `
            <div class="status-count">${count}</div>
            <div class="status-name">${status}</div>
        `;
            dashboardGrid.appendChild(card);
        });
    }

    // --- END OF THE NEW FUNCTION ---
    fetchAndDisplayStatusCounts();

    // Optional: Auto-refresh the data every 30 seconds
    setInterval(fetchAndDisplayStatusCounts, 10000);
});