module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  moduleNameMapper: {
    'react-native-webrtc': '<rootDir>/src/__mocks__/react-native-webrtc.ts',
  },
};
