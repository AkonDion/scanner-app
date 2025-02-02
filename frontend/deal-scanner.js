// deal-scanner.js - Handles UI and scanning functionality
import zohoCRM from './zoho-crm-api.js';
import config from './config.js';

class DealScanner {
    constructor() {
        this.selectedDeal = null;
        this.assets = [];
        this.currentAssetIndex = 0;
        this.scannedSerials = {};
    }

    async initialize() {
        try {
            console.log('Initializing DealScanner...');
            // Initialize Zoho CRM service first
            await zohoCRM.initialize();
            
            // Hide scanner UI
            document.querySelector('.video-container').style.display = 'none';
            document.querySelector('.controls-container').style.display = 'none';
            
            // Remove any existing deal selector container
            const existingContainer = document.querySelector('.deal-selector-container');
            if (existingContainer) {
                existingContainer.remove();
            }
            
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
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
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
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 12px;
                    ">
                        <div class="loading-spinner" style="
                            width: 20px;
                            height: 20px;
                            border: 2px solid var(--text-secondary);
                            border-radius: 50%;
                            border-top-color: transparent;
                            animation: spin 1s linear infinite;
                        "></div>
                        <span>Loading deals...</span>
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
            console.log('Fetching deals...');
            const deals = await zohoCRM.fetchActiveDeals();
            console.log('Deals fetched:', deals);
            
            if (!deals || deals.length === 0) {
                throw new Error('No deals found');
            }
            
            this.renderDealList(deals);
        } catch (error) {
            console.error('Failed to initialize:', error);
            const loadingDiv = document.getElementById('loading-deals');
            if (loadingDiv) {
                loadingDiv.innerHTML = `
                    <div style="color: #dc2626; text-align: center;">
                        Failed to load deals: ${error.message}
                        <button onclick="dealScanner.initialize()" style="
                            margin-top: 12px;
                            padding: 8px 16px;
                            background: var(--accent);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                        ">
                            Retry
                        </button>
                    </div>
                `;
            }
        }
    }

    renderDealList(deals) {
        console.log('Starting renderDealList with deals:', deals);
        const container = document.querySelector('.deal-selector-container');
        if (container) {
            const dealOptions = deals.map(deal => {
                console.log('Processing deal for dropdown:', deal);
                return `
                    <option value="${deal.id}">
                        ${deal.Street ? `${deal.Street}` : 'No address available'}
                    </option>
                `;
            }).join('');
            console.log('Generated deal options:', dealOptions);

            // Hide the loading spinner
            const loadingDiv = document.getElementById('loading-deals');
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }

            // Create and append the dropdown section
            const dropdownSection = document.createElement('div');
            dropdownSection.className = 'result-container visible';
            dropdownSection.style.cssText = `
                background: var(--surface);
                border-radius: 16px;
                padding: 20px;
                margin-top: 16px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            `;
            dropdownSection.innerHTML = `
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
                        -webkit-appearance: none;
                        -moz-appearance: none;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        backdrop-filter: blur(10px);
                        -webkit-backdrop-filter: blur(10px);
                    ">
                        <option value="" disabled selected>Choose a deal...</option>
                        ${dealOptions}
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

            container.appendChild(dropdownSection);

            // Add hover effect styles
            const select = document.getElementById('dealSelect');
            select.addEventListener('mouseover', () => {
                select.style.background = 'var(--surface)';
                select.style.borderColor = 'var(--text-secondary)';
            });
            select.addEventListener('mouseout', () => {
                if (select !== document.activeElement) {
                    select.style.background = 'var(--surface-hover)';
                    select.style.borderColor = 'var(--border)';
                }
            });
            select.addEventListener('focus', () => {
                select.style.background = 'var(--surface)';
                select.style.borderColor = 'var(--text-secondary)';
                select.style.boxShadow = '0 0 0 1px var(--text-secondary)';
            });
            select.addEventListener('blur', () => {
                select.style.background = 'var(--surface-hover)';
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
            // Find the selected deal from the deals list
            const deals = await zohoCRM.fetchActiveDeals();
            const selectedDeal = deals.find(deal => deal.id === dealId);
            
            if (!selectedDeal) {
                throw new Error('Selected deal not found');
            }

            this.selectedDeal = dealId;
            this.assets = selectedDeal.models;
            this.renderAssetScanner();
        } catch (error) {
            this.showError('Failed to load deal models. Please try again.');
        }
    }

    renderAssetScanner() {
        const container = document.querySelector('.deal-selector-container');
        if (container) {
            container.innerHTML = `
                <div class="result-container visible" style="
                    background: var(--surface);
                    border-radius: 16px;
                    padding: 20px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    margin-bottom: 16px;
                ">
                    <h2 style="
                        font-size: 24px;
                        font-weight: 600;
                        color: var(--text-primary);
                        margin-bottom: 16px;
                        text-align: center;
                    ">
                        Scan Serial Numbers
                    </h2>
                    <div class="assets-container">
                        ${this.assets.map((asset, index) => `
                            <div class="result-container visible" style="
                                margin-bottom: 16px;
                                background: var(--surface-hover);
                                border-radius: 16px;
                                padding: 20px;
                                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                                backdrop-filter: blur(10px);
                                -webkit-backdrop-filter: blur(10px);
                            ">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="flex: 1;">
                                        <h3 style="
                                            font-size: 18px;
                                            color: var(--text-primary);
                                            margin-bottom: 8px;
                                            font-weight: 500;
                                        ">
                                            ${asset.Model}: ${asset.Model_Value}
                                        </h3>
                                        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                                            ${(this.scannedSerials[index] || []).map(serial => `
                                                <div style="
                                                    background: var(--surface);
                                                    padding: 8px 12px;
                                                    border-radius: 8px;
                                                    font-size: 15px;
                                                    color: var(--text-primary);
                                                    font-family: ui-monospace, monospace;
                                                    border: 1px solid var(--border);
                                                ">${serial}</div>
                                            `).join('')}
                                        </div>
                                    </div>
                                    <button onclick="dealScanner.startScanning(${index})" style="
                                        background: var(--surface);
                                        border: 1px solid var(--border);
                                        color: var(--text-primary);
                                        padding: ${this.scannedSerials[index] ? '10px' : '12px 20px'};
                                        border-radius: 12px;
                                        font-size: ${this.scannedSerials[index] ? '20px' : '15px'};
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        gap: 8px;
                                        cursor: pointer;
                                        transition: all 0.2s ease;
                                        min-width: ${this.scannedSerials[index] ? '42px' : '120px'};
                                        min-height: ${this.scannedSerials[index] ? '42px' : '42px'};
                                        backdrop-filter: blur(10px);
                                        -webkit-backdrop-filter: blur(10px);
                                    ">
                                        ${this.scannedSerials[index] ? 
                                            `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                                            </svg>` :
                                            'Scan Serial'
                                        }
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    ${this.isAllSerialsFilled() ? `
                        <button onclick="dealScanner.submitScannedSerials()" style="
                            width: 100%;
                            margin-top: 16px;
                            background: var(--surface-hover);
                            color: var(--text-primary);
                            border: 1px solid var(--border);
                            padding: 16px;
                            border-radius: 12px;
                            font-size: 16px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            backdrop-filter: blur(10px);
                            -webkit-backdrop-filter: blur(10px);
                        ">
                            Submit All Serial Numbers
                        </button>
                    ` : ''}
                </div>
            `;
        }
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
            // Format the data for Zoho CRM
            const dealData = {
                id: this.selectedDeal
            };

            // Dynamically add serial numbers based on the number of assets
            this.assets.forEach((asset, index) => {
                if (this.scannedSerials[index] && this.scannedSerials[index].length > 0) {
                    dealData[`Serial_${index + 1}`] = this.scannedSerials[index][0];
                }
            });

            // Format the final update data structure
            const updateData = {
                data: [dealData]
            };

            console.log('Sending update to Zoho:', JSON.stringify(updateData, null, 2));

            // Send the update to Zoho using the zohoCRM service
            const response = await zohoCRM.updateDeal(this.selectedDeal, updateData);
            
            if (!response || !response.data) {
                console.error('Invalid response structure:', response);
                throw new Error('Invalid response from Zoho CRM');
            }

            // Create success message container
            const successMessage = document.createElement('div');
            successMessage.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--surface);
                color: #22c55e;
                padding: 16px 24px;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 500;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                z-index: 2000;
                display: flex;
                align-items: center;
                gap: 8px;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid #22c55e;
            `;
            
            successMessage.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6L9 17l-5-5"/>
                </svg>
                Serial numbers successfully updated!
            `;
            
            document.body.appendChild(successMessage);
            
            // Reset state and return to home screen after a delay
            setTimeout(() => {
                successMessage.remove();
                this.selectedDeal = null;
                this.assets = [];
                this.scannedSerials = {};
                document.querySelector('.deal-selector-container').remove();
                document.querySelector('.video-container').style.display = 'block';
                document.querySelector('.controls-container').style.display = 'flex';
            }, 2000);
        } catch (error) {
            console.error('Error updating serial numbers:', error);
            
            // Create error message container with more details
            const errorMessage = document.createElement('div');
            errorMessage.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--surface);
                color: #dc2626;
                padding: 16px 24px;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 500;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                z-index: 2000;
                display: flex;
                align-items: center;
                gap: 8px;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid #dc2626;
            `;
            
            errorMessage.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                Failed to update serial numbers: ${error.message}
            `;
            
            document.body.appendChild(errorMessage);
            
            // Remove error message after 5 seconds
            setTimeout(() => {
                errorMessage.remove();
            }, 5000);
        }
    }

    isAllSerialsFilled() {
        return this.assets.every((asset, index) => 
            (this.scannedSerials[index] || []).length > 0
        );
    }

    startScanning(assetIndex) {
        try {
            console.log('Starting scanning for asset index:', assetIndex);
            this.currentAssetIndex = assetIndex;
            
            // Hide deal selector and show scanner
            document.querySelector('.deal-selector-container').style.display = 'none';
            document.querySelector('.video-container').style.display = 'block';
            document.querySelector('.controls-container').style.display = 'flex';

            // Store the current asset index for when we get a result
            window.handleScannedSerial = (serialNumber) => {
                console.log('Received scanned serial:', serialNumber);
                // Add the serial number to the current asset
                if (!this.scannedSerials[this.currentAssetIndex]) {
                    this.scannedSerials[this.currentAssetIndex] = [];
                }
                this.scannedSerials[this.currentAssetIndex].push(serialNumber);
                
                // Hide scanner and show deal selector
                document.querySelector('.deal-selector-container').style.display = 'block';
                document.querySelector('.video-container').style.display = 'none';
                document.querySelector('.controls-container').style.display = 'none';
                
                // Re-render the asset list to show the new serial
                this.renderAssetScanner();
                
                // Show success message
                this.showSuccess(`Serial number ${serialNumber} added successfully`);
            };

            // Start the scanner
            if (typeof window.startCamera === 'function') {
                window.startCamera().catch(error => {
                    console.error('Failed to start camera:', error);
                    this.showError('Failed to start camera. Please try again.');
                    
                    // Show deal selector again
                    document.querySelector('.deal-selector-container').style.display = 'block';
                    document.querySelector('.video-container').style.display = 'none';
                    document.querySelector('.controls-container').style.display = 'none';
                });
            } else {
                throw new Error('Camera functionality not initialized');
            }
        } catch (error) {
            console.error('Error in startScanning:', error);
            this.showError('Failed to start scanning. Please try again.');
            
            // Show deal selector again
            document.querySelector('.deal-selector-container').style.display = 'block';
            document.querySelector('.video-container').style.display = 'none';
            document.querySelector('.controls-container').style.display = 'none';
        }
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
