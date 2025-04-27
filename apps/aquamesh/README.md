# 🌊 AquaMesh

🌊 AquaMesh is a host application that integrates multiple microfrontends using Webpack Module Federation. This architecture allows for independently deployable frontend applications to work together seamlessly within a single UI.

## 🧐 Overview

AquaMesh serves as the container application (host) that integrates the following microfrontends:
- **System Lens**: A remote application for system visualization
- **Control Flow**: A remote application for workflow management

## ⚙️ Technology Stack

- `React 18`
- `Webpack` with `Module Federation`
- `TypeScript`
- `Material UI` / `PrimeReact`
- `Module SCSS`
- `flexlayout-react` / `react-tabs`

## 🛠 Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

> [!NOTE]
> If you execute the command from the root. URLs to open the microfrontends `system-lens` and `control-flow` will also be available at [http://localhost:3001](http://localhost:3001) and [http://localhost:3002](http://localhost:3002)

### `npm test`

Runs both unit and E2E tests.

> [!NOTE]
> More specific test commands:
> -  `npm run test:unit` to run just unit tests,
> - `npm run test:snapshot` to create the images for the e2e tests,
> - `npm run test:e2e` to run e2e tests.

## 🦄 Microfrontends with Module Federation

AquaMesh uses Webpack's ModuleFederation plugin to implement a microfrontend architecture. This allows for:

- Independent development and deployment of frontend applications
- Runtime integration of remote modules
- Shared dependencies to prevent duplication

### 📦 Host Configuration

The ModuleFederation configuration in `webpack.config.js` defines AquaMesh as the host:

```js
new ModuleFederationPlugin({
  name: "aquamesh",
  filename: "remoteEntry.js",
  remotes: {
    aquamesh_system_lens: "aquamesh_system_lens@http://localhost:3001/remoteEntry.js",
    aquamesh_control_flow: "aquamesh_control_flow@http://localhost:3002/remoteEntry.js"
  },
  exposes: {},
  shared: {
    ...deps,
    react: {
      singleton: true,
      requiredVersion: deps.react,
    },
    "react-dom": {
      singleton: true,
      requiredVersion: deps["react-dom"],
    },
  },
})
```

### ⌛️ Loading Remote Components

To load a component from a remote application:

```jsx
import React, { Suspense } from 'react';

// Async import of remote component
const RemoteComponent = React.lazy(() =>
  import('aquamesh_system_lens/Component')
);

const MyContainer = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RemoteComponent />
    </Suspense>
  );
};

export default MyContainer;
```

### ✈️ Remote Applications

Each remote application (`system-lens`, `control-flow`) must expose its components via ModuleFederation. A typical remote configuration looks like:

```js
new ModuleFederationPlugin({
  name: "aquamesh_system_lens",
  filename: "remoteEntry.js",
  exposes: {
    "./Component": "./src/components/ExposedComponent",
  },
  shared: {
    react: { singleton: true, requiredVersion: deps.react },
    "react-dom": { singleton: true, requiredVersion: deps["react-dom"] },
  },
})
```