import '@testing-library/jest-dom/vitest'
import { expect } from 'vitest'
import matchers from '@testing-library/jest-dom/matchers'

// Add the custom matchers from jest-dom
expect.extend(matchers) 