const { fireEvent } = require('@testing-library/dom');
require('@testing-library/jest-dom');

// Mock tesseract.js
const mockRecognize = jest.fn().mockResolvedValue({
  data: { text: 'MOCK-MODEL-123' }
});

const mockWorker = {
  load: jest.fn().mockResolvedValue({}),
  loadLanguage: jest.fn().mockResolvedValue({}),
  initialize: jest.fn().mockResolvedValue({}),
  recognize: mockRecognize
};

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn().mockImplementation(() => mockWorker)
}));

describe('Scanner App', () => {
  let video, canvas, startButton, resultDiv;
  let mockDrawImage, mockGetImageData, mockPutImageData;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set up our document body
    document.body.innerHTML = `
      <div class="container">
        <div class="scanner-container">
          <video id="video" playsinline autoplay></video>
          <div class="scan-overlay">
            <div class="scan-region"></div>
          </div>
          <canvas id="canvas" style="display: none;"></canvas>
        </div>
        <div class="controls">
          <button id="startButton">Start Scanner</button>
          <div id="result" class="result"></div>
        </div>
      </div>
    `;

    // Set up mock stream
    const mockStream = {
      getTracks: () => [{
        stop: jest.fn()
      }]
    };
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);

    // Initialize elements
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    startButton = document.getElementById('startButton');
    resultDiv = document.getElementById('result');

    // Mock video dimensions and position
    Object.defineProperty(video, 'videoWidth', { value: 1280 });
    Object.defineProperty(video, 'videoHeight', { value: 720 });
    video.getBoundingClientRect = jest.fn().mockReturnValue({
      width: 1280,
      height: 720,
      left: 0,
      top: 0
    });

    // Mock scan region position
    const scanRegion = document.querySelector('.scan-region');
    scanRegion.getBoundingClientRect = jest.fn().mockReturnValue({
      width: 640,
      height: 100,
      left: 320,
      top: 310
    });

    // Mock canvas operations
    mockDrawImage = jest.fn();
    mockGetImageData = jest.fn().mockReturnValue({
      data: new Uint8ClampedArray(100)
    });
    mockPutImageData = jest.fn();

    // Create a new mock context for each test
    const mockContext = {
      drawImage: mockDrawImage,
      getImageData: mockGetImageData,
      putImageData: mockPutImageData
    };

    // Mock the getContext method
    canvas.getContext = jest.fn().mockReturnValue(mockContext);

    // Load app.js
    require('../app.js');

    // Trigger DOMContentLoaded
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
  });

  test('initializes with correct DOM elements', () => {
    expect(video).toBeInTheDocument();
    expect(canvas).toBeInTheDocument();
    expect(startButton).toBeInTheDocument();
    expect(resultDiv).toBeInTheDocument();
  });

  test('starts camera when start button is clicked', async () => {
    await fireEvent.click(startButton);
    
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    expect(startButton.textContent).toBe('Capture');
  });

  test('handles camera access error', async () => {
    const error = new Error('Camera access denied');
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(error);

    await fireEvent.click(startButton);
    
    // Wait for async error handling
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(resultDiv.textContent).toContain('Error accessing camera');
  });

  test('captures and processes image when capture button is clicked', async () => {
    // Start camera
    await fireEvent.click(startButton);
    
    // Capture image
    await fireEvent.click(startButton);

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check if canvas operations were called
    expect(mockDrawImage).toHaveBeenCalled();
    expect(mockGetImageData).toHaveBeenCalled();
    expect(resultDiv.textContent).toBe('MOCK-MODEL-123');
  });

  test('handles OCR processing error', async () => {
    // Mock Tesseract error
    const error = new Error('OCR processing failed');
    mockRecognize.mockRejectedValueOnce(error);

    // Start camera
    await fireEvent.click(startButton);
    
    // Capture image
    await fireEvent.click(startButton);

    // Wait for async error handling
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(resultDiv.textContent).toContain('Error processing image');
  });
}); 