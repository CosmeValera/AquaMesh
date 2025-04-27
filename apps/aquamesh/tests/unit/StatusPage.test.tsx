import React from "react"
import { describe, test, afterEach, expect } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import StatusPage, { Status } from "../../src/common/StatusPage"

// Utility function to render the component and query elements
const renderStatusPage = (status: Status, componentLine: string, urlLine: string) => {
  render(<StatusPage status={status} componentLine={componentLine} urlLine={urlLine} />)
}

const expectElementToBePresent = (text: string) => {
  const element = screen.queryByText(text)
  expect(element).not.toBeNull()
}

describe("StatusPage", () => {
  afterEach(cleanup)

  test("Should render", () => {
    renderStatusPage("default", "", "")
    const icon = document.querySelector(".pi-exclamation-circle")
    expect(icon).not.toBeNull()
  })

  test("Renders the error state with full height", () => {
    renderStatusPage("error", "Error Component", "Error URL")

    expectElementToBePresent("Error Component")
    expectElementToBePresent("Error URL")

    const icon = document.querySelector(".pi-exclamation-circle")
    expect(icon).not.toBeNull()
  })

  test("Renders the error state with screen height", () => {
    renderStatusPage("error_Main", "Main Error", "Main URL")

    expectElementToBePresent("Main Error")
    expectElementToBePresent("Main URL")

    const icon = document.querySelector(".pi-exclamation-circle")
    expect(icon).not.toBeNull()
  })

  test("Renders the unauthorized state", () => {
    renderStatusPage("unauth", "Unauthorized", "Access denied")

    expectElementToBePresent("Unauthorized")
    expectElementToBePresent("Access denied")

    const icon = document.querySelector(".pi-lock")
    expect(icon).not.toBeNull()
  })

  test("Renders the default error state", () => {
    renderStatusPage("default", "Default Error", "Something went wrong")

    expectElementToBePresent("Default Error")
    expectElementToBePresent("Something went wrong")

    const icon = document.querySelector(".pi-exclamation-circle")
    expect(icon).not.toBeNull()
  })
})
