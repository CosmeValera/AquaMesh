
## 🔍 Tutorial
When you first use the app, a **Tutorial** will automatically appear, explaining **Dashboards**, **Widgets**, and the **Widget Editor** features. You can revisit this tutorial anytime from the help menu. For specific questions, there's also a **FAQ** section available.

**Tutorial:**

![Tutorial Modal](./readme_images/tutorial.png)

**FAQ:**

![FAQ Modal](./readme_images/faq.png)

### 🧭 Top Navigation

The top navigation bar provides quick access to all platform capabilities:

- **📊 Dashboards**: Browse and select from both predefined and custom dashboards
- **🧩 Widgets**: Access ready-made components and your custom-built widgets
- **🔧 Widget Editor**: The heart of our no-code experience. Build custom widgets without programming!
- **📚 Libraries**: Save and organize your dashboard and widget creations
- **❓ Help**: Get support through the tutorial and FAQ sections
- **👤 User**: Select and manage user profiles (only admin can create new widgets)

All our pre-built widgets load as microfrontends using Module Federation. Want to customize what's available? Just update the `apps/aquamesh/public/config/widgets.json` file.

### 📊 Dashboards

Dashboards are container layouts that organize multiple widgets into a cohesive view. Think of them as the canvas where you arrange your widgets (visual components).

![Dashboard Interface](./readme_images/dashboard.png)

In the **Dashboard Library**, you can save, categorize, and change visibility of your dashboards.

![Dashboards Library](./readme_images/dashboards-library.png)

### 🧩 Widgets

Widgets are individual components that display specific data, visualizations, or controls. Each widget serves a distinct purpose and can be added to any dashboard.

![Widget Interface](./readme_images/widget.png)

In the **Widget Library**, you can sort, load and delete your widgets.

![Widget Library](./readme_images/widgets-library.png)

### 🔧 Widget Editor

AquaMesh's most powerful feature is its **Widget Editor**, which enables users to create custom widgets without coding:

![Widget Editor](./readme_images/widget_editor.png)

**Widget Editor Features:**

- **Intuitive Drag & Drop**: Easily drag components from the palette onto your canvas to design widgets.
- **Component Library**: Choose from UI components (buttons, switches, text fields), layout containers, and data visualization ..
- **Customization**: Adjust appearance and behavior through property editors.
- **Live Preview**: See your changes instantly.

**Widget Editor Common Features:**

- **Toggle Edit/Preview modes**: Add, adjust and move your components in the Edit mode. Use the Preview mode to see how it would look like.

**Edit mode:**
![Search](./readme_images/edit_mode.png)
**Preview Mode:**
![Search](./readme_images/preview_mode.png)

- **Search**: Quickly search for any component in your canvas.

![Search](./readme_images/search.png)

- **Settings**: Settings for-> Interface options, Confirmation options and Keyboard Shortcuts.

![Settings](./readme_images/settings.png)

**Widget Editor Advanced Features:**
- **Templates**: Templates are predefined widget configurations that you can use to quickly create new widgets.

![Templates](./readme_images/templates.png)

- **Versions**: A version control system is already built-in. You can see all your saved versions of the current widget, and you can restore any previous version.

![Version History](./readme_images/version_history1.png)
![Version History](./readme_images/version_history2.png)

- **Import & Export**: You can export your widgets as JSON to import them later. This is useful for backup or sharing with others.

![Import & Export](./readme_images/import_export1.png)
![Import & Export](./readme_images/import_export2.png)

### 📱💻🖥️ Responsive
Aquamesh is responsive and can be used with your phone, tablet or computer. However, computer is the most recommended especially to build complex layouts.

#### 📱 Phone
![Phone empty](./readme_images/phone/phone_empty.jpg)
![Phone Templates](./readme_images/phone/phone_templates.jpg)
![Phone Widget History](./readme_images/phone/phone_widget_history.jpg)
![Phone Import & Export](./readme_images/phone/phone_import_export.jpg)