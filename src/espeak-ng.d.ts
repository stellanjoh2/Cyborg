declare module 'espeak-ng' {
  export interface ESpeakNgFs {
    writeFile: (path: string, data: string | Uint8Array) => void
    readFile: (path: string) => Uint8Array
    unlink: (path: string) => void
  }

  export interface ESpeakNgModule {
    FS: ESpeakNgFs
  }

  export interface ESpeakNgOptions {
    arguments?: string[]
    preRun?: Array<(module: ESpeakNgModule) => void>
  }

  export default function ESpeakNg(
    options?: ESpeakNgOptions,
  ): Promise<ESpeakNgModule>
}
