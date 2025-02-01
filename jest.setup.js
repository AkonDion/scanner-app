require('@testing-library/jest-dom');

// Mock the MediaDevices API
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn()
  }
});

// Mock canvas operations
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  drawImage: jest.fn(),
  getImageData: jest.fn(() => ({
    data: new Uint8ClampedArray(100)
  })),
  putImageData: jest.fn()
}));

// Mock Tesseract.js
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockResolvedValue({}),
    loadLanguage: jest.fn().mockResolvedValue({}),
    initialize: jest.fn().mockResolvedValue({}),
    recognize: jest.fn().mockResolvedValue({
      data: { text: 'MOCK-MODEL-123' },
    }),
  })),
})); 