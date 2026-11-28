import * as fs from 'fs';
import * as path from 'path';
import type { ConsolePluginBuildMetadata } from '@openshift-console/dynamic-plugin-sdk-webpack';

const ROOT = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as {
  name: string;
  consolePlugin: ConsolePluginBuildMetadata;
};
const localeFile = path.join(ROOT, `locales/en/plugin__${packageJson.consolePlugin.name}.json`);
const extensions = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'console-extensions.json'), 'utf-8'),
) as { type: string; properties: { component?: { $codeRef: string } } }[];

describe('plugin metadata', () => {
  it('has a matching i18n locale file, package name, and consolePlugin name', () => {
    expect(packageJson.consolePlugin.name).toBe('console-demos-ocp-virtualization');
    expect(fs.existsSync(localeFile)).toBe(true);
    expect(packageJson.name).toBe(packageJson.consolePlugin.name);
  });

  it('exposes every routed page', () => {
    const exposedModules = packageJson.consolePlugin.exposedModules;
    for (const extension of extensions.filter((item) => item.type === 'console.page/route')) {
      const codeRef = extension.properties.component?.$codeRef;
      expect(codeRef).toBeDefined();
      expect(exposedModules).toHaveProperty(codeRef ?? '');
    }
  });
});
