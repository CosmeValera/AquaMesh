# 🌊 AquaMesh | No-Code Dashboard Platform with React & Module Federation

🌊 AquaMesh is a powerful no-code dashboard creation platform that enables users to build, customize, and manage interactive dashboards through an intuitive drag-and-drop interface.

Built on a React-based Turborepo monorepo architecture, it dynamically loads components and allows for highly flexible customization of dashboards and widgets.

## ✨ Key Features
- **🔧 No-Code Widget Editor:** Build custom widgets without programming knowledge
- **📊 Dynamic Dashboard System:** Drag, resize, and position widgets in flexible layouts
- **🔗 Module Federation Architecture:** Load widgets as independent micro-frontends
- **⚡ React-based Turborepo Structure:** Optimized monorepo for efficient development
- **🎨 Rich Component Library:** Pre-built UI elements, containers, and visualization tools

## 🚀 Quickstart

```sh
# Clone the repository
git clone https://github.com/CosmeValera/AquaMesh.git

# Install dependencies (just one command for the entire monorepo!)
npm install

# Launch AquaMesh
npm start
```

That's it! The AquaMesh application and all its components will be up and running.

### 📊 Dashboards

Dashboards are container layouts that organize multiple widgets into a cohesive view. Think of them as the canvas where you arrange your widgets.

![Dashboard Interface](tools/readme_images/Mix.png)

In the **Dashboard Library** You can save, categorize, and change visibility of dashboards.

![Dashboards Library](tools/readme_images/topbar-dashboards-library.png)

### 🧩 Widgets

Widgets are individual components that display specific data, visualizations, or controls. Each widget serves a distinct purpose and can be added to dashboards.

![Widget Library](tools/readme_images/topbar-widgets.png)

### 🔧 No-Code Widget Creation

AquaMesh's most powerful feature is its **Widget Editor**, which enables users to create custom widgets without coding:

**Widget Editor Features:**

- **Intuitive Drag & Drop**: Easily drag components from the palette onto your canvas to design widgets.
- **Rich Component Library**: Choose from UI components (buttons, switches, text fields), layout containers, and data visualization tools.
- **Deep Customization**: Fine-tune each component's appearance and behavior through dedicated property editors.
- **Live Preview**: See your changes reflected instantly for rapid iteration and design adjustments.
- **Complex Layouts**: Create sophisticated structures by nesting components within layout containers.
- **Save & Reuse**: Build a personal library of widgets that can be reused across different dashboards.

![Widget Editor](tools/readme_images/widget_editor.png)

**Supported Component Types:**

The Widget Editor offers various component types:

- **UI Components**: Buttons, Labels, Text Fields, Switches and Charts
- **Layout Containers**: FieldSets, FlexBox, GridBox for organizing content

**Drag and Resize Capabilities:**

Customize your dashboard by dragging, repositioning, and resizing widgets to suit your needs.

![Drag and Resize](tools/readme_images/Mix.png)

### Top Navigation

The top navigation bar provides quick access to all platform capabilities:

- **📊 Dashboards**: Browse and select from both predefined and custom dashboards
- **🧩 Widgets**: Access ready-made components and your custom-built widgets
- **🔧 Widget Editor**: The heart of our no-code experience. Build custom widgets without programming!
- **📚 Libraries**: Save and organize your dashboard and widget creations
- **❓ Support**: Get help through tutorials and FAQ sections
- **👤 User Management**: Select and manage user profiles (only admin can create new widgets)

All our pre-built widgets load as microfrontends using Module Federation. Want to customize what's available? Just update the `apps/aquamesh/public/config/widgets.json` file. 

## 🏗️ Architecture Overview

### 📦 Modular Design with Dynamic Component Loading

AquaMesh's architecture emphasizes flexibility and extensibility:

- **Drag and Drop Interface**: Widgets can be freely moved, resized, and positioned.
- **Dynamic Component Loading**: New predefined widgets can be added easily through configuration.
- **Customizable Dashboard**: Users have complete control over their layout.

### 🛠 Turborepo Setup

The platform uses **Turborepo** for managing the applications in the monorepo:

- **Simplified package management**: Only one npm install needed from the root.
- **Efficient development**: Built-in tools for running and building multiple projects simultaneously.
- **Consistency**: Shared dependencies and dashboard scripts ensure all components work seamlessly together.

🔍 Start creating amazing dashboards today! 🌊