# 🌊 StudyMesh

🌊 StudyMesh is a no-code custom widget builder for dashboards. It helps people create reusable dashboard widgets from visual blocks, save them locally, and place them into dashboards without writing React, configuration files, or layout code.

Many dashboards begin as a developer request: someone needs a form, chart, controls, status view, or operational workspace, and engineering has to wire the interface together. StudyMesh turns that workflow into a visual product where non-programmers can build the widget they need first, then reuse it inside a dashboard.

## 🤔 What you can do

- **Create widgets without code:** Design reusable dashboard blocks from text, forms, buttons, charts, controls, and layout containers.
- **Build dashboards visually:** Add, drag, resize, and arrange saved widgets in flexible layouts.
- **Reuse saved work:** Save widgets and dashboards so they can be added to future dashboard projects.
- **Share and back up widgets:** Import and export widget definitions between environments.
- **Recover earlier versions:** Use widget version history when you need to restore previous work.

## ✨ Key Features

- **No-Code Widget Editor:** Build custom widgets without programming knowledge
- **Rich Component Library:** Pre-built UI elements, containers, and visualization tools
- **Dynamic Dashboard System:** Drag, resize, and position widgets in flexible layouts
- **React-based Turborepo Structure:** Optimized monorepo for efficient development
- **Module Federation Architecture:** Load widgets as independent micro-frontends

## 🎬 Demo

<a href="https://aqua-mesh.vercel.app/" target="_blank" rel="noopener noreferrer">Try StudyMesh</a> on Vercel! Ready to use with zero setup.

![Live Demo](readme_docs/live_demo.gif)

## 🚀 Quickstart

```sh
# Clone the repository
git clone https://github.com/CosmeValera/AquaMesh.git

# Install dependencies for the full monorepo
npm install

# Launch StudyMesh
npm start
```

That's it! The StudyMesh application and all its components will be up and running.

## ⚙️ Technology Stack

- **React:** Frontend framework for building user interfaces
- **flexlayout-react:** Layout system for resizable and repositionable widgets
- **react-tabs:** Tab management for multiple dashboard views
- **Turborepo:** For the monorepo setup
- **Testing Suite:**
  - **Playwright:** End-to-end testing framework
  - **Vitest:** Unit testing framework
  - **Vendored bashunit:** Bash script tests via `tools/git-hooks/lib/bashunit`

The most rewarding aspect was solving the technical challenges for designing an intuitive way for users to customize widgets while keeping everything working smoothly.

---

### 📚 Additional Resources

- Check out the [TUTORIAL.md](./readme_docs/TUTORIAL.md) for more information and images

🌊 Start creating powerful dashboards with StudyMesh today!
