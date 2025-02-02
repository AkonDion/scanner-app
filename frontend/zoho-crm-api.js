// zoho-crm-api.js - Handles all Zoho CRM API interactions
import config from './config.js';

class ZohoCRMService {
    constructor() {
        this.baseUrl = `${config.API_BASE_URL}/zoho`;
    }

    async initialize() {
        try {
            console.log('Initializing Zoho CRM service...');
            const response = await fetch(`${this.baseUrl}/deals`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
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
            console.log('Fetching deals from:', `${this.baseUrl}/deals`);
            const response = await fetch(`${this.baseUrl}/deals`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received deals data:', data);

            if (!data || !data.data) {
                console.error('Invalid response format:', data);
                return [];
            }

            const mappedDeals = data.data.map(deal => {
                // Extract all models from the deal
                const models = [];
                for (let i = 1; i <= 4; i++) {
                    const modelValue = deal[`Model_${i}`];
                    if (modelValue) {
                        models.push({
                            Model: `Model ${i}`,
                            Model_Value: modelValue
                        });
                    }
                }

                return {
                    id: deal.id,
                    Deal_Name: deal.Deal_Name,
                    Stage: deal.Stage,
                    Amount: deal.Amount,
                    Street: deal.Street,
                    models: models
                };
            });

            console.log('Mapped deals:', mappedDeals);
            return mappedDeals;
        } catch (error) {
            console.error('Error fetching active deals:', error);
            throw error;
        }
    }

    async fetchDealAssets(dealId) {
        try {
            const response = await fetch(`${this.baseUrl}/deals/${dealId}?fields=Client_Assets`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Raw deal assets data:', data);

            // If no Client_Assets, return empty array
            if (!data.data[0] || !data.data[0].Client_Assets || !data.data[0].Client_Assets[0]) {
                return [];
            }

            const clientAsset = data.data[0].Client_Assets[0];
            
            // Extract all models from the response
            const assets = [];
            for (let i = 1; i <= 3; i++) {
                const modelValue = clientAsset[`Model_${i}`];
                if (modelValue) {
                    assets.push({
                        id: clientAsset.id,
                        Model: `Model ${i}`,
                        Model_Value: modelValue,
                        Serial_Number: clientAsset[`Serial_${i}`] || null
                    });
                }
            }

            return assets;
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
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
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
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
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

    async updateDeal(dealId, updateData) {
        try {
            console.log('Updating deal with ID:', dealId);
            console.log('Update data:', JSON.stringify(updateData, null, 2));
            
            // Ensure the data structure matches exactly what works with the Zoho API
            const response = await fetch(`${this.baseUrl}/deals/${dealId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    data: [
                        {
                            id: dealId,
                            ...updateData.data[0]
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('Error response from Zoho:', errorData);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Deal update response:', data);
            return data;
        } catch (error) {
            console.error('Error updating deal:', error);
            throw error;
        }
    }
}

// Create and export a single instance
const zohoCRM = new ZohoCRMService();
export default zohoCRM; 