// zoho-crm-api.js - Handles all Zoho CRM API interactions
import config from './config.js';

class ZohoCRMService {
    constructor() {
        // Use HTTP in development
        const hostname = window.location.hostname;
        this.baseUrl = `http://${hostname}:3000/zoho`;
    }

    async initialize() {
        try {
            console.log('Initializing Zoho CRM service...');
            const response = await fetch(`${this.baseUrl}/deals?status=active`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            console.log('Successfully connected to Zoho CRM');
        } catch (error) {
            console.error('Failed to initialize Zoho CRM service:', error);
            throw error;
        }
    }

    async fetchActiveDeals() {
        try {
            const response = await fetch(`${this.baseUrl}/deals?status=active`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.data.map(deal => ({
                id: deal.id,
                Deal_Name: deal.Deal_Name,
                Stage: deal.Stage,
                Amount: deal.Amount
            }));
        } catch (error) {
            console.error('Error fetching active deals:', error);
            throw error;
        }
    }

    async fetchDealAssets(dealId) {
        try {
            const response = await fetch(`${this.baseUrl}/deals/${dealId}/assets`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.data.map(asset => ({
                id: asset.id,
                Model: asset.Model,
                Serial_Numbers: asset.Serial_Numbers || [],
                Status: asset.Status
            }));
        } catch (error) {
            console.error('Error fetching deal assets:', error);
            throw error;
        }
    }

    async updateDealAssets(dealId, assets) {
        try {
            const response = await fetch(`${this.baseUrl}/deals/${dealId}/assets`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: assets.map(asset => ({
                        id: asset.id,
                        Serial_Numbers: asset.Serial_Numbers
                    }))
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.data;
        } catch (error) {
            console.error('Error updating deal assets:', error);
            throw error;
        }
    }

    async searchDealBySerialNumber(serialNumber) {
        try {
            const response = await fetch(`${this.baseUrl}/deals/search`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    criteria: [
                        {
                            field: "Serial_Numbers",
                            operator: "contains",
                            value: serialNumber
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.data;
        } catch (error) {
            console.error('Error searching deal by serial number:', error);
            throw error;
        }
    }
}

// Create and export a single instance
const zohoCRM = new ZohoCRMService();
export default zohoCRM; 