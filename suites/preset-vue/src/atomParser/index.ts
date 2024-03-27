import type { MetaCheckerOptions } from '@dumijs/vue-meta';
import { createProject, dumiTransformer } from '@dumijs/vue-meta';
import { getProjectRoot } from 'dumi';
import { fsExtra } from 'dumi/plugin-utils';
import {
  IBaseApiParserOptions,
  ILanguageMetaParser,
  IPatchFile,
  createApiParser,
} from 'dumi/tech-stack-utils';
import path from 'path';

export interface VueParserOptions extends IBaseApiParserOptions {
  tsconfigPath?: string;
  checkerOptions?: MetaCheckerOptions;
}

class VueMetaParser implements ILanguageMetaParser {
  protected entryFile: string;
  protected resolveDir: string;
  private checkerOptions!: MetaCheckerOptions;
  private checker!: ReturnType<typeof createProject>;
  constructor(opts: VueParserOptions) {
    const { tsconfigPath, checkerOptions, resolveDir, entryFile } = opts;
    this.checkerOptions = Object.assign({}, checkerOptions);
    this.resolveDir = resolveDir;
    this.entryFile = path.resolve(this.resolveDir, entryFile);
    this.checker = createProject({
      rootPath: getProjectRoot(resolveDir),
      tsconfigPath,
      checkerOptions: this.checkerOptions,
    });
  }
  async patch(file: IPatchFile) {
    const { event, fileName } = file;
    switch (event) {
      case 'add':
      case 'change': {
        const fileContent = await fsExtra.readFile(fileName, 'utf8');
        this.checker.patchFiles([
          { action: event, fileName, text: fileContent },
        ]);
        return;
      }
      case 'unlink':
        this.checker.deleteFile(fileName);
        return;
    }
  }
  async parse() {
    return this.checker.service.getComponentLibraryMeta(
      this.entryFile,
      dumiTransformer,
    );
  }

  async destroy() {
    this.checker.close();
  }
}

export const VueApiParser = createApiParser({
  filename: __filename,
  worker: VueMetaParser,
  parseOptions: {
    handleWatcher(watcher, { parse, patch, watchArgs }) {
      return watcher.on('all', (ev, file) => {
        if (
          ['add', 'change', 'unlink'].includes(ev) &&
          /((?<!\.d)\.ts|\.(jsx?|tsx|vue))$/.test(file)
        ) {
          const cwd = watchArgs.options.cwd!;
          patch({
            event: ev,
            fileName: path.join(cwd, file),
          });
          parse();
        }
      });
    },
  },
});
