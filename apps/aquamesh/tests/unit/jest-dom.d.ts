import '@testing-library/jest-dom'

declare global {
  namespace Vi {
    interface Assertion {
      toBeInTheDocument(): Assertion
      toBeVisible(): Assertion
      toHaveAttribute(attr: string, value?: string): Assertion
      toHaveTextContent(text: string | RegExp): Assertion
      // Add other matchers as needed
    }
  }
} 