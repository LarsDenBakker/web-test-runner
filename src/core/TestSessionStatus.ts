export type TestSessionStatus = 'SCHEDULED' | 'INITIALIZING' | 'STARTED' | 'FINISHED';

// waiting for a browser to free up and run this test session
export const STATUS_SCHEDULED = 'SCHEDULED' as TestSessionStatus;

// browser is booting up, waiting to ping back that it's starting
export const STATUS_INITIALIZING = 'INITIALIZING' as TestSessionStatus;

// browser has started, running the actual tests
export const STATUS_STARTED = 'STARTED' as TestSessionStatus;

// finished running tests
export const STATUS_FINISHED = 'FINISHED' as TestSessionStatus;
