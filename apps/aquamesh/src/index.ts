/**
 * To ensure that shared modules are initialized correctly and that there
 * are no race conditions or other timing-related issues, an asynchronous
 * boundary is needed. This entry point will load in async way the code needed
 * start the application.
 * More info: https://webpack.js.org/concepts/module-federation/#low-level-concepts
 */
import('./bootstrap')
