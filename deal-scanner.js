// deal-scanner.js - Handles UI and scanning functionality
import zohoCRM from './zoho-crm-api.js';

class DealScanner {
    constructor() {
        this.selectedDeal = null;
        this.assets = [];
        this.currentAssetIndex = 0;
        this.scannedSerials = {};
    }

    async initialize() {
        try {
            // Initialize Zoho CRM service first
            await zohoCRM.initialize();
            
            // Hide scanner UI
            document.querySelector('.video-container').style.display = 'none';
            document.querySelector('.controls-container').style.display = 'none';
            
            // Create and show the deal selector container
            const container = document.createElement('div');
            container.className = 'deal-selector-container';
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 50%;
                transform: translateX(-50%);
                width: 100%;
                max-width: 430px;
                padding: 16px;
                z-index: 1000;
            `;
            container.innerHTML = `
                <div class="result-container visible" style="
                    background: var(--surface);
                    border-radius: 16px;
                    padding: 20px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                ">
                    <h2 style="
                        font-size: 24px;
                        font-weight: 600;
                        color: var(--text-primary);
                        margin-bottom: 16px;
                        text-align: center;
                    ">
                        Select Deal
                    </h2>
                    <div id="loading-deals" style="
                        color: var(--text-secondary);
                        font-size: 15px;
                        text-align: center;
                        padding: 12px;
                    ">
                        <div class="loading-spinner" style="
                            display: inline-block;
                            width: 20px;
                            height: 20px;
                            border: 2px solid var(--text-secondary);
                            border-radius: 50%;
                            border-top-color: transparent;
                            animation: spin 1s linear infinite;
                            margin-right: 8px;
                            vertical-align: middle;
                        "></div>
                        Loading deals...
                    </div>
                </div>
            `;
            
            // Add loading spinner animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(container);

            // Fetch deals after showing the loading state
            const deals = await zohoCRM.fetchActiveDeals();
            this.renderDealList(deals);
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Failed to load deals. Please try again.');
        }
    }

    renderDealList(deals) {
        const loadingDiv = document.getElementById('loading-deals');
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <div class="select-wrapper" style="
                    position: relative;
                    width: 100%;
                ">
                    <select id="dealSelect" style="
                        width: 100%;
                        padding: 14px;
                        padding-right: 40px;
                        background: var(--surface-hover);
                        color: var(--text-primary);
                        border: 1px solid var(--border);
                        border-radius: 12px;
                        font-size: 16px;
                        appearance: none;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    ">
                        <option value="" disabled selected>Choose a deal...</option>
                        ${deals.map(deal => `
                            <option value="${deal.id}">${deal.Deal_Name}</option>
                        `).join('')}
                    </select>
                    <div style="
                        position: absolute;
                        right: 14px;
                        top: 50%;
                        transform: translateY(-50%);
                        pointer-events: none;
                        color: var(--text-secondary);
                    ">
                        ▼
                    </div>
                </div>
            `;

            // Add hover effect styles
            const select = document.getElementById('dealSelect');
            select.addEventListener('mouseover', () => {
                select.style.borderColor = 'var(--accent)';
            });
            select.addEventListener('mouseout', () => {
                if (select !== document.activeElement) {
                    select.style.borderColor = 'var(--border)';
                }
            });
            select.addEventListener('focus', () => {
                select.style.borderColor = 'var(--accent)';
                select.style.boxShadow = '0 0 0 2px var(--accent-transparent)';
            });
            select.addEventListener('blur', () => {
                select.style.borderColor = 'var(--border)';
                select.style.boxShadow = 'none';
            });

            select.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.handleDealSelection(e.target.value);
                }
            });
        }
    }

    async handleDealSelection(dealId) {
        try {
            this.selectedDeal = dealId;
            const assets = await zohoCRM.fetchDealAssets(dealId);
            this.assets = assets;
            this.renderAssetScanner();
        } catch (error) {
            this.showError('Failed to load deal assets. Please try again.');
        }
    }

    renderAssetScanner() {
        const container = document.querySelector('.deal-selector-container');
        container.innerHTML = `
            <div class="assets-container">
                ${this.assets.map((asset, index) => `
                    <div class="result-container visible" style="
                        margin: 16px;
                        background: var(--surface);
                        border-radius: 16px;
                        padding: 16px;
                        box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div style="flex: 1;">
                                <h3 style="font-size: 16px; color: var(--text-primary); margin-bottom: 4px;">
                                    ${asset.Model || `Model ${index + 1}`}
                                </h3>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                                    ${(this.scannedSerials[index] || []).map(serial => `
                                        <div style="
                                            background: var(--surface-hover);
                                            padding: 4px 8px;
                                            border-radius: 8px;
                                            font-size: 13px;
                                            color: var(--text-primary);
                                            font-family: ui-monospace, monospace;
                                        ">${serial}</div>
                                    `).join('')}
                                </div>
                            </div>
                            <button onclick="dealScanner.startScanning(${index})" style="
                                background: var(--surface-hover);
                                border: 1px solid var(--border);
                                color: var(--text-primary);
                                padding: 8px 16px;
                                border-radius: 8px;
                                font-size: 14px;
                                display: flex;
                                align-items: center;
                                gap: 6px;
                                cursor: pointer;
                                transition: all 0.2s ease;
                            ">
                                <span style="font-size: 18px;">+</span>
                                Scan Serial
                            </button>
                        </div>
                    </div>
                `).join('')}
                ${this.isAllSerialsFilled() ? `
                    <button onclick="dealScanner.showFinalResults()" style="
                        width: calc(100% - 32px);
                        margin: 0 16px 16px;
                        background: var(--accent);
                        color: white;
                        border: none;
                        padding: 12px;
                        border-radius: 12px;
                        font-size: 15px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    ">
                        Next
                    </button>
                ` : ''}
            </div>
        `;
    }

    showFinalResults() {
        const container = document.querySelector('.deal-selector-container');
        container.innerHTML = `
            <div class="final-results" style="padding: 16px;">
                <h2 style="
                    font-size: 24px;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 16px;
                    text-align: center;
                ">
                    Final Results
                </h2>
                ${this.assets.map((asset, index) => `
                    <div class="result-container visible" style="
                        margin-bottom: 16px;
                        background: var(--surface);
                        border-radius: 16px;
                        padding: 16px;
                        box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
                    ">
                        <h3 style="font-size: 16px; color: var(--text-primary); margin-bottom: 8px;">
                            ${asset.Model || `Model ${index + 1}`}
                        </h3>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${(this.scannedSerials[index] || []).map(serial => `
                                <div style="
                                    background: var(--surface-hover);
                                    padding: 4px 8px;
                                    border-radius: 8px;
                                    font-size: 13px;
                                    color: var(--text-primary);
                                    font-family: ui-monospace, monospace;
                                ">${serial}</div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
                <button onclick="dealScanner.submitScannedSerials()" style="
                    width: 100%;
                    background: var(--accent);
                    color: white;
                    border: none;
                    padding: 12px;
                    border-radius: 12px;
                    font-size: 15px;
                    font-weight: 500;
                    cursor: pointer;
                    margin-top: 16px;
                    transition: all 0.2s ease;
                ">
                    Submit to Zoho CRM
                </button>
            </div>
        `;
    }

    addSerialNumber(serialNumber) {
        if (!this.scannedSerials[this.currentAssetIndex]) {
            this.scannedSerials[this.currentAssetIndex] = [];
        }
        this.scannedSerials[this.currentAssetIndex].push(serialNumber);
        this.renderAssetScanner();
    }

    async submitScannedSerials() {
        try {
            const updatedAssets = this.assets.map((asset, index) => ({
                ...asset,
                Serial_Numbers: this.scannedSerials[index] || []
            }));

            await zohoCRM.updateDealAssets(this.selectedDeal, updatedAssets);
            this.showSuccess('Serial numbers successfully updated in Zoho CRM!');
            
            // Reset state after successful submission
            this.selectedDeal = null;
            this.assets = [];
            this.scannedSerials = {};
            
            // Return to home page after a short delay
            setTimeout(() => {
                document.querySelector('.deal-selector-container').remove();
                document.querySelector('.video-container').style.display = 'block';
                document.querySelector('.controls-container').style.display = 'flex';
            }, 2000);
        } catch (error) {
            this.showError('Failed to update serial numbers. Please try again.');
        }
    }

    isAllSerialsFilled() {
        return this.assets.every((asset, index) => 
            (this.scannedSerials[index] || []).length > 0
        );
    }

    startScanning(assetIndex) {
        this.currentAssetIndex = assetIndex;
        // Hide deal selector and show scanner
        document.querySelector('.deal-selector-container').style.display = 'none';
        document.querySelector('.video-container').style.display = 'block';
        document.querySelector('.controls-container').style.display = 'flex';
        // Start the scanner
        window.startCamera();
    }

    showError(message) {
        const resultDiv = document.getElementById('result');
        if (resultDiv) {
            resultDiv.textContent = message;
            resultDiv.parentElement.classList.add('visible');
        }
        console.error(message);
    }

    showSuccess(message) {
        const resultDiv = document.getElementById('result');
        if (resultDiv) {
            resultDiv.textContent = message;
            resultDiv.parentElement.classList.add('visible');
        }
        console.log(message);
    }
}

// Create an instance and export it
const dealScanner = new DealScanner();
window.dealScanner = dealScanner; // Make it available globally for the UI
export default dealScanner;