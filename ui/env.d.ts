// Types for modules and HMR APIs supplied by the Graphene Vite development server.
/* eslint-disable prefer-let/prefer-let */
declare module 'virtual:nav' {
  const navFiles: any
  export const projectName: string
  export default navFiles
}

interface ImportMeta {
  readonly hot?: {
    accept(dependency: string, callback: (module: any) => void): void
    on(event: string, callback: (payload: any) => void): void
  }
}
