import config from './config.js';

let cvReady = false;

window.addEventListener('opencv-ready', () => {
    cvReady = true;
    initializeApp();
});

document.addEventListener('DOMContentLoaded', () => {
    if (typeof cv !== 'undefined') {
        cvReady = true;
        initializeApp();
    }
});

async function initializeApp() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const startButton = document.getElementById('startButton');
    const resultDiv = document.getElementById('result');
    const modelNumberDiv = document.getElementById('model-number');
    
    const ctx = canvas.getContext('2d');
    let stream = null;
    let isScanning = false;
    let scanInterval = null;
    let worker = null;
    let isProcessing = false;
    let scannedNumbers = [];
    let map = null;
    let currentPosition = null;

    // Configure pattern matching for serial number format
    const serialNumberPattern = /^\d{10}$/;

    // Load Google Maps API
    function loadGoogleMaps() {
        if (window.google && window.google.maps) return Promise.resolve();
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${config.GOOGLE_MAPS_API_KEY}`;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Get current location without prompts
    async function getCurrentLocation() {
        try {
            if (!navigator.geolocation) {
                console.log('Geolocation not supported');
                return null;
            }

            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            return {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
        } catch (error) {
            console.log('Location not available');
            return null;
        }
    }

    async function initializeWorker() {
        try {
            resultDiv.textContent = 'Initializing scanner...';
            resultDiv.parentElement.classList.add('visible');

            worker = await Tesseract.createWorker({
                logger: m => {
                    if (m.status === 'recognizing text') {
                        resultDiv.textContent = 'Processing...';
                    }
                }
            });

            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            
            await worker.setParameters({
                tessedit_char_whitelist: '0123456789',
                tessedit_pageseg_mode: '7',
                tessedit_ocr_engine_mode: '2',
                tessjs_create_pdf: '0',
                tessjs_create_hocr: '0',
                tessjs_create_tsv: '0',
                tessjs_create_box: '0',
                tessjs_create_unlv: '0',
                tessjs_create_osd: '0'
            });

            resultDiv.textContent = 'Ready to scan';
            startButton.disabled = false;
        } catch (error) {
            console.error('Worker initialization error:', error);
            resultDiv.textContent = 'Scanner initialization failed. Please refresh and try again.';
            startButton.disabled = true;
        }
    }

    function preprocessImage(src) {
        if (!cvReady) {
            console.warn('OpenCV not ready, skipping preprocessing');
            return src;
        }

        try {
            console.log('Starting image preprocessing...');
            let mat = cv.imread(src);
            let processed = new cv.Mat();
            
            // Ensure minimum size
            const minSize = 100;
            let width = Math.max(minSize, mat.cols);
            let height = Math.max(minSize, mat.rows);
            
            console.log('Image dimensions:', { width, height });
            
            // Scale up if needed
            if (mat.cols < minSize || mat.rows < minSize) {
                console.log('Scaling up image to minimum size');
                let scaled = new cv.Mat();
                let dsize = new cv.Size(width, height);
                cv.resize(mat, scaled, dsize, 0, 0, cv.INTER_CUBIC);
                mat = scaled;
            }
            
            cv.cvtColor(mat, processed, cv.COLOR_RGBA2GRAY);
            processed.convertTo(processed, -1, 1.5, 30);
            cv.threshold(processed, processed, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
            
            const processedCanvas = document.createElement('canvas');
            processedCanvas.width = processed.cols;
            processedCanvas.height = processed.rows;
            cv.imshow(processedCanvas, processed);
            
            mat.delete();
            processed.delete();
            
            return processedCanvas;
        } catch (error) {
            console.error('Image preprocessing error:', error);
            return src;
        }
    }

    function matchesSerialNumberPattern(text) {
        return serialNumberPattern.test(text.replace(/[^0-9]/g, ''));
    }

    function showScanView() {
        document.querySelector('.video-container').style.display = 'block';
        document.querySelector('.controls-container').style.display = 'flex';
        const resultsView = document.getElementById('results-view');
        if (resultsView) resultsView.style.display = 'none';
        
        // Reset scanning states
        isScanning = false;
        isProcessing = false;
    }

    async function showResultsView() {
        console.log('Showing results view with numbers:', scannedNumbers);
        document.querySelector('.video-container').style.display = 'none';
        document.querySelector('.controls-container').style.display = 'none';
        
        let resultsView = document.getElementById('results-view');
        if (!resultsView) {
            resultsView = document.createElement('div');
            resultsView.id = 'results-view';
            resultsView.className = 'container';
            resultsView.style.cssText = `
                width: 100%;
                max-width: 430px;
                height: 100vh;
                padding: 0 16px 16px 16px;
                display: flex;
                flex-direction: column;
                position: fixed;
                top: 0;
                left: 50%;
                transform: translateX(-50%);
            `;
            document.body.appendChild(resultsView);
        }
        resultsView.style.display = 'flex';
        
        // Check if we have any valid locations before adding map container
        const hasLocations = scannedNumbers.some(scan => scan.location);
        
        // Create results content with map and enhanced styling
        resultsView.innerHTML = `
            <div style="width: 100%; display: flex; flex-direction: column; gap: 12px; padding-top: 0;">
                ${hasLocations ? `
                    <div id="map-container" class="result-container visible" 
                         style="margin: 16px 0 0 0; 
                                padding: 0; 
                                height: 250px; 
                                overflow: hidden; 
                                border-radius: 16px;
                                position: relative;">
                        <img 
                            width="100%" 
                            height="100%"
                            style="object-fit: cover; border-radius: 16px;"
                            src="https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/pin-l+ff0000(${scannedNumbers[0].location?.lng || -75.929616},${scannedNumbers[0].location?.lat || 45.296278})/${scannedNumbers[0].location?.lng || -75.929616},${scannedNumbers[0].location?.lat || 45.296278},17.5,60,45/800x500@2x?attribution=false&logo=false&access_token=${config.MAPBOX_API_KEY}"
                            alt="Location map"
                        />
                    </div>
                ` : ''}
                <div class="result-container visible" style="margin: 0; background: var(--surface);">
                    <div style="font-size: 18px; font-weight: 500; color: var(--text-primary); text-align: center;">
                        Scanned Serial Numbers
                    </div>
                    <div style="font-size: 14px; color: var(--text-secondary); text-align: center; margin-top: 4px;">
                        ${scannedNumbers.length} ${scannedNumbers.length === 1 ? 'serial number' : 'serial numbers'} found
                    </div>
                </div>
                <div id="results-list" style="display: flex; flex-direction: column; gap: 8px;">
                    ${scannedNumbers.map((scan, index) => `
                        <div class="result-container visible" 
                             style="margin: 0; 
                                    background: var(--surface);
                                    backdrop-filter: blur(10px);
                                    -webkit-backdrop-filter: blur(10px);
                                    transition: transform 0.2s ease;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div class="serial-number-text" 
                                     style="font-size: 15px; 
                                            color: var(--text-primary);
                                            font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;">
                                    ${scan.number}
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="font-size: 12px; color: var(--text-secondary);">
                                        #${index + 1}
                                    </div>
                                    <button 
                                        onclick="deleteSerialNumber(${index})" 
                                        style="background: none;
                                               border: none;
                                               padding: 8px;
                                               cursor: pointer;
                                               color: var(--text-secondary);
                                               opacity: 0.8;
                                               transition: opacity 0.2s ease;
                                               font-size: 24px;
                                               line-height: 16px;
                                               display: flex;
                                               align-items: center;
                                               justify-content: center;
                                               min-width: 32px;
                                               min-height: 32px;">
                                        ×
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button id="scanAgainButton" 
                        style="margin-top: 4px;
                               background: var(--surface);
                               border: 1px solid rgba(255, 255, 255, 0.1);
                               padding: 14px;
                               border-radius: 12px;
                               font-size: 15px;
                               font-weight: 500;
                               color: var(--text-primary);
                               cursor: pointer;
                               transition: all 0.2s ease;
                               position: relative;
                               overflow: hidden;
                               backdrop-filter: blur(10px);
                               -webkit-backdrop-filter: blur(10px);
                               width: 100%;">
                    <div style="position: absolute;
                               top: 0;
                               left: 0;
                               width: 100%;
                               height: 100%;
                               background: linear-gradient(90deg, 
                                   transparent,
                                   rgba(255, 255, 255, 0.05),
                                   transparent);
                               transform: translateX(-100%);
                               animation: shimmer 2s infinite;">
                    </div>
                    <span style="position: relative; z-index: 1;">Scan Another</span>
                </button>
                <button id="submitButton" 
                        style="margin-top: 8px;
                               background: var(--accent);
                               border: none;
                               padding: 14px;
                               border-radius: 12px;
                               font-size: 15px;
                               font-weight: 500;
                               color: white;
                               cursor: pointer;
                               transition: all 0.2s ease;
                               position: relative;
                               overflow: hidden;
                               width: 100%;
                               backdrop-filter: blur(10px);
                               -webkit-backdrop-filter: blur(10px);">
                    <span style="position: relative; z-index: 1;">Submit</span>
                </button>
            </div>
        `;

        // Add click handler for scan again button
        const scanAgainButton = document.getElementById('scanAgainButton');
        if (scanAgainButton) {
            scanAgainButton.onclick = async () => {
                console.log('Scan again clicked, resetting for new scan');
                isScanning = false;
                isProcessing = false;
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                    stream = null;
                }
                showScanView();
                await startCamera();
            };
        }
    }

    function addFoundNumber(number) {
        console.log('Attempting to add number:', number);
        if (!scannedNumbers.includes(number)) {
            console.log('Number is unique, adding to list');
            // Store number with location
            scannedNumbers.push({
                number: number,
                location: currentPosition,
                timestamp: new Date().toISOString()
            });
            return true;
        }
        console.log('Number already exists in list');
        return false;
    }

    async function processFrame() {
        if (!video.srcObject || !isScanning || isProcessing) return;

        try {
            isProcessing = true;
            
            // Update location periodically
            if (!currentPosition) {
                currentPosition = await getCurrentLocation();
            }
            
            console.log('Processing new frame...');
            
            // Set canvas size to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const scanRegion = document.querySelector('.scan-region');
            if (!scanRegion) {
                console.warn('Scan region not found');
                return;
            }

            const scanRegionRect = scanRegion.getBoundingClientRect();
            const videoRect = video.getBoundingClientRect();

            if (!scanRegionRect || !videoRect || !scanRegionRect.width || !scanRegionRect.height) {
                console.warn('Invalid scan region dimensions');
                return;
            }

            // Calculate exact scan region in video coordinates
            const scaleX = video.videoWidth / videoRect.width;
            const scaleY = video.videoHeight / videoRect.height;

            // Calculate the exact bounds of the scan region
            const exactScanX = Math.round((scanRegionRect.left - videoRect.left) * scaleX);
            const exactScanY = Math.round((scanRegionRect.top - videoRect.top) * scaleY);
            const exactScanWidth = Math.round(scanRegionRect.width * scaleX);
            const exactScanHeight = Math.round(scanRegionRect.height * scaleY);

            // Add minimal padding (just a few pixels) to ensure text isn't cut off
            const padding = 5;
            const scanX = Math.max(0, exactScanX - padding);
            const scanY = Math.max(0, exactScanY - padding);
            const scanWidth = Math.min(canvas.width - scanX, exactScanWidth + 2 * padding);
            const scanHeight = Math.min(canvas.height - scanY, exactScanHeight + 2 * padding);

            console.log('Scan region:', {
                exact: { x: exactScanX, y: exactScanY, width: exactScanWidth, height: exactScanHeight },
                withPadding: { x: scanX, y: scanY, width: scanWidth, height: scanHeight }
            });

            if (scanWidth <= 0 || scanHeight <= 0) {
                console.warn('Invalid scan dimensions');
                return;
            }

            // Create temporary canvas for scan region
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = scanWidth;
            tempCanvas.height = scanHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw only the scan region
            tempCtx.drawImage(canvas, 
                scanX, scanY, scanWidth, scanHeight,  // Source rectangle
                0, 0, scanWidth, scanHeight           // Destination rectangle
            );

            // For debugging: visualize the scan region on the main canvas
            if (false) { // Set to true to debug scan region
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.lineWidth = 2;
                ctx.strokeRect(scanX, scanY, scanWidth, scanHeight);
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
                ctx.strokeRect(exactScanX, exactScanY, exactScanWidth, exactScanHeight);
            }

            // Process image
            const processedCanvas = preprocessImage(tempCanvas);
            console.log('Starting OCR recognition...');
            const result = await worker.recognize(processedCanvas);
            const text = result.data.text.trim();
            console.log('OCR result:', text);
            
            if (!text) {
                console.log('No text detected in this frame');
                isProcessing = false;
                if (isScanning) {
                    setTimeout(processFrame, 200);
                }
                return;
            }
            
            const words = text.split(/[\s\n]+/).filter(word => word.length > 0);
            console.log('Extracted words:', words);
            
            for (const word of words) {
                const cleanWord = word.replace(/[^0-9]/g, '');
                console.log('Checking word:', cleanWord);
                
                if (cleanWord.length > 0 && matchesSerialNumberPattern(cleanWord)) {
                    console.log('Valid serial number found:', cleanWord);
                    
                    // Add the found number and show results
                    if (addFoundNumber(cleanWord)) {
                        console.log('Added to results:', cleanWord);
                        // Provide feedback
                        navigator.vibrate && navigator.vibrate(200);
                        
                        // Stop scanning and show results
                        stopScanning();
                        showResultsView();
                        
                        // Ensure we exit the processing
                        isProcessing = false;
                        return;
                    } else {
                        console.log('Number already exists:', cleanWord);
                        // Continue scanning for new numbers
                        isProcessing = false;
                        if (isScanning) {
                            setTimeout(processFrame, 200);
                        }
                    }
                    return;
                }
            }
            
            // If no valid number found, continue scanning
            isProcessing = false;
            if (isScanning) {
                setTimeout(processFrame, 200);
            }
        } catch (error) {
            console.error('Processing error:', error);
            resultDiv.textContent = 'Processing error. Please try again.';
            resultDiv.parentElement.classList.add('visible');
            isProcessing = false;
            if (isScanning) {
                setTimeout(processFrame, 200);
            }
        }
    }

    async function startCamera() {
        try {
            // Reset scanning state
            isScanning = false;
            isProcessing = false;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
            
            // Reset UI state
            resultDiv.textContent = 'Accessing camera...';
            resultDiv.parentElement.classList.add('visible');
            modelNumberDiv.style.display = 'none';
            modelNumberDiv.classList.remove('active');
            
            // Try to get location once without retries
            try {
                currentPosition = await getCurrentLocation();
            } catch (error) {
                console.log('Proceeding without location');
            }
            
            // Reset scan region
            const scanRegion = document.querySelector('.scan-region');
            scanRegion.classList.remove('scanning');
            scanRegion.classList.add('scanning');
            document.querySelector('.ready-text').style.display = 'none';

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { exact: "environment" },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });
            } catch (err) {
                console.log('Falling back to default camera:', err);
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });
            }

            video.srcObject = stream;
            video.setAttribute('playsinline', true);
            await video.play();
            
            // Start new scanning session
            isScanning = true;
            startButton.textContent = 'Stop Scanner';
            resultDiv.textContent = 'Scanning...';
            
            // Ensure clean start of frame processing
            isProcessing = false;
            processFrame();
            
        } catch (err) {
            console.error('Camera access error:', err);
            resultDiv.textContent = 'Camera access denied. Please check permissions.';
            resultDiv.parentElement.classList.add('visible');
            startButton.disabled = false;
        }
    }

    function stopScanning() {
        isScanning = false;
        isProcessing = false;
        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        video.srcObject = null;
        startButton.textContent = 'Start Scanner';
        document.querySelector('.scan-region').classList.remove('scanning');
    }

    // Add animation for ready text cycling
    const readyText = document.querySelector('.ready-text');
    const sampleNumbers = ['2310211025', '4350216026', '3314211027'];
    let currentIndex = 0;

    // Hide the initial "Ready to scan" text
    readyText.style.opacity = '0';

    readyText.style.cssText = `
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 15px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.6);
        white-space: nowrap;
        transition: opacity 0.2s ease;
        font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
    `;

    function animateNumbers() {
        if (currentIndex < sampleNumbers.length) {
            readyText.textContent = sampleNumbers[currentIndex];
            readyText.style.opacity = '1';
            currentIndex++;
            setTimeout(() => {
                readyText.style.opacity = '0';
                setTimeout(animateNumbers, 100);
            }, 500);
        } else {
            readyText.style.opacity = '0';
            setTimeout(() => {
                readyText.textContent = 'Ready to scan';
                readyText.style.opacity = '1';
            }, 100);
        }
    }

    // Start the animation sequence after a short delay
    setTimeout(animateNumbers, 500);

    // Initialize the scanner
    initializeWorker();

    // Set up button click handler
    startButton.onclick = () => {
        if (isScanning) {
            stopScanning();
            showResultsView();
        } else {
            startCamera();
        }
    };

    // Clean up on page unload
    window.addEventListener('beforeunload', async () => {
        stopScanning();
        if (worker) {
            await worker.terminate();
        }
    });

    // Clean up any existing styles first
    startButton.removeAttribute('style');
    startButton.className = 'shimmer-button';

    // Add the animation keyframes and button styles
    const shimmerStyles = document.createElement('style');
    shimmerStyles.textContent = `
        .shimmer-button {
            position: relative;
            overflow: hidden;
            background: var(--surface);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 14px 24px;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 500;
            color: var(--text-primary);
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .shimmer-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(
                90deg,
                transparent 0%,
                rgba(255, 255, 255, 0.3) 50%,
                transparent 100%
            );
            transform: translateX(-100%);
            animation: shimmer 3s ease-in-out infinite;
        }

        @keyframes shimmer {
            0% {
                transform: translateX(-100%);
            }
            100% {
                transform: translateX(100%);
            }
        }

        .shimmer-button span {
            position: relative;
            z-index: 1;
        }
    `;
    document.head.appendChild(shimmerStyles);

    // Wrap button text in span
    const buttonText = startButton.textContent;
    startButton.innerHTML = `<span>${buttonText}</span>`;

    // Remove any existing shimmer effects
    const existingShimmer = startButton.querySelector('.shimmer-effect');
    if (existingShimmer) {
        existingShimmer.remove();
    }

    // Add delete function for serial numbers
    window.deleteSerialNumber = function(index) {
        scannedNumbers.splice(index, 1);
        if (scannedNumbers.length === 0) {
            // If no numbers left, go back to scanning
            showScanView();
            startCamera();
        } else {
            // Otherwise refresh the results view
            showResultsView();
        }
    };
} 