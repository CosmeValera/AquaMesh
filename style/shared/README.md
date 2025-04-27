# AquaMesh Container Query System

This system provides container-based responsive utilities for microfrontends, allowing them to adapt based on their container width rather than viewport width.

## Overview

In a microfrontend architecture where multiple applications can be displayed simultaneously, traditional responsive design based on viewport width is insufficient. The container query system addresses this by:

1. Using CSS container queries to apply styles based on container width
2. Providing React components and hooks for container-based responsiveness
3. Offering utility classes similar to popular CSS frameworks but based on container width

## Installation

The container query system is already included in the AquaMesh theme. To use it in any microfrontend:

1. Import the theme in your microfrontend
2. Import the React components from the shared directory

```typescript
// Import the React components
import { 
  ContainerBreakpointProvider, 
  ContainerVisible, 
  CQ 
} from 'style/shared';

// The SCSS styles are automatically included when using the AquaMesh theme
```

## Usage

### CSS Classes

The system provides CSS utility classes prefixed with `cq-` that are triggered by container width rather than viewport width:

```html
<!-- Element that spans 12 columns by default, 6 on medium containers, and 4 on large containers -->
<div class="cq-12 cq-md-6 cq-lg-4">Content</div>
```

Available breakpoints:
- xs: < 576px
- sm: ≥ 576px
- md: ≥ 768px
- lg: ≥ 992px
- xl: ≥ 1200px

### React Components

#### ContainerBreakpointProvider

Wrap your component in a `ContainerBreakpointProvider` to establish a container query context:

```tsx
<ContainerBreakpointProvider className="my-container">
  {/* Your content here */}
</ContainerBreakpointProvider>
```

#### ContainerVisible

Conditionally render content based on container width:

```tsx
<ContainerVisible breakpoint="md" condition="up">
  {/* Content only visible when container width is md or larger */}
</ContainerVisible>

<ContainerVisible breakpoint="sm" condition="only">
  {/* Content only visible when container width is sm */}
</ContainerVisible>

<ContainerVisible breakpoint="lg" condition="down">
  {/* Content only visible when container width is lg or smaller */}
</ContainerVisible>
```

#### CQ Object

Use the `CQ` object for class names:

```tsx
<div className={`${CQ.col12} ${CQ.md.col6} ${CQ.lg.col4}`}>
  Responsive content
</div>
```

### Hooks

#### useContainerBreakpoints

Get the current container breakpoints:

```tsx
const MyComponent = () => {
  const { breakpoints, containerWidth } = useContainerBreakpoints();
  
  return (
    <div>
      Current container width: {containerWidth}px
      {breakpoints.md && <div>MD breakpoint is active</div>}
    </div>
  );
};
```

#### useContainerQueries

Create your own container reference and get its breakpoints:

```tsx
const MyComponent = () => {
  const { containerRef, breakpoints, containerWidth } = useContainerQueries();
  
  return (
    <div ref={containerRef}>
      {/* Content with container querying */}
    </div>
  );
};
```

#### withContainerQueries

Higher-order component to inject container information:

```tsx
interface MyProps {
  title: string;
  containerBreakpoints?: Record<string, boolean>;
  containerWidth?: number;
}

const MyComponent = ({ title, containerBreakpoints, containerWidth }: MyProps) => {
  // Use containerBreakpoints and containerWidth
  return <div>{title}</div>;
};

export default withContainerQueries(MyComponent);
```

## Example

```tsx
import React from 'react';
import { ContainerBreakpointProvider, ContainerVisible, CQ } from 'style/shared';

const Dashboard = () => {
  return (
    <ContainerBreakpointProvider className="dashboard">
      <h1>Dashboard</h1>
      
      <div className="grid">
        {/* Full width on xs, half width on md, third width on lg */}
        <div className={`${CQ.col12} ${CQ.md.col6} ${CQ.lg.col4}`}>
          <div className="card">
            <h2>Card 1</h2>
            <ContainerVisible breakpoint="xs" condition="only">
              <p>Extra info for small containers only</p>
            </ContainerVisible>
          </div>
        </div>
        
        <div className={`${CQ.col12} ${CQ.md.col6} ${CQ.lg.col4}`}>
          <div className="card">
            <h2>Card 2</h2>
          </div>
        </div>
        
        <div className={`${CQ.col12} ${CQ.lg.col4}`}>
          <div className="card">
            <h2>Card 3</h2>
            <ContainerVisible breakpoint="lg" condition="up">
              <p>Extra content for large containers</p>
            </ContainerVisible>
          </div>
        </div>
      </div>
    </ContainerBreakpointProvider>
  );
};

export default Dashboard;
```

## Available Utility Classes

The system provides these class types:

1. **Grid Classes**: `cq-1` through `cq-12`, with breakpoint variants like `cq-md-6`
2. **Display Classes**: `cq-d-none`, `cq-d-block`, etc., with breakpoint variants
3. **Flex Utilities**: Directional and wrap controls with breakpoint variants
4. **Text Alignment**: Text alignment classes with breakpoint variants
5. **Spacing**: Margin and padding utilities with breakpoint variants
6. **Visibility**: Show/hide content based on container size 