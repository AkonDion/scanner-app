# Serial Number Scanner

A web-based application for scanning and tracking serial numbers using your device's camera. Built with modern web technologies and featuring a clean, intuitive interface.

## Features

- Real-time serial number scanning using device camera
- OCR-powered text recognition
- Location tracking for scanned items
- Clean, modern UI with dark mode
- Mobile-first responsive design
- Interactive map visualization
- Batch scanning support

## Technologies Used

- HTML5/CSS3/JavaScript
- Tesseract.js for OCR
- OpenCV.js for image processing
- Mapbox for location visualization
- Progressive Web App capabilities

## Setup

1. Clone the repository
2. Create a `config.js` file in the root directory using `config.example.js` as a template:
   ```javascript
   const config = {
       GOOGLE_MAPS_API_KEY: 'YOUR_GOOGLE_MAPS_API_KEY',
       MAPBOX_API_KEY: 'YOUR_MAPBOX_API_KEY'
   };
   export default config;
   ```
3. Replace the placeholder values with your actual API keys:
   - Get a Google Maps API key from [Google Cloud Console](https://console.cloud.google.com/)
   - Get a Mapbox API key from [Mapbox](https://www.mapbox.com/)
4. Open `index.html` in a modern web browser
5. Allow camera and location permissions when prompted

## Usage

1. Click "Start Scanner" to begin scanning
2. Position serial number within the scanning area
3. Numbers are automatically detected and added to the list
4. View results with location data on the map
5. Submit or scan additional numbers as needed

## Security Note

The `config.js` file containing your API keys is automatically excluded from git tracking via `.gitignore`. Never commit your actual API keys to version control.

## License

MIT License 