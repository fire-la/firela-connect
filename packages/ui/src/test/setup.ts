/**
 * Test Setup
 *
 * Global test utilities for */
import "@testing-library/jest-dom"

// Mock i18next to avoid initialization in tests
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: vi.fn((key: string) => key),
    i18n: {
      changeLanguage: vi.fn(),
      language: "en",
    },
  }),
}))
