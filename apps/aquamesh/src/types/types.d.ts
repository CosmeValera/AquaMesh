//////////////////////
// ///// MODULES /////
declare module 'aquamesh_system_lens/*'
declare module 'aquamesh_control_flow/*'
declare const __webpack_init_sharing__: (scope: string) => Promise<void>
declare const __webpack_share_scopes__: { [key: string]: unknown }
///// END: MODULES /////
////////////////////////

//////////////////
///// LAYOUT /////
export interface Layout {
  type: 'row';
  weight?: number;
  children: (Row | Tabset)[];
}

interface Row {
  type: 'row';
  weight: number;
  children: (Row | Tabset)[];
}

interface Tabset {
  type: 'tabset';
  weight: number;
  active?: boolean;
  children: Tab[];
}

interface Tab {
  type: 'tab';
  name: string;
  component?: unknown;
}
///// END: LAYOUT /////
///////////////////////