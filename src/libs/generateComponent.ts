import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import glob from 'glob';
import colors from 'colors';
import { camelCase, upperFirst } from 'lodash';
import { XmlData } from 'iconfont-parser';
import { Config } from './getConfig';
import { getTemplate } from './getTemplate';
import {
  replaceCases,
  replaceComponentName,
  replaceExports,
  replaceImports,
  replaceSingleIconContent,
  replaceSize,
  replaceSizeUnit,
} from './replace';
import { whitespace } from './whitespace';
import { copyTemplate } from './copyTemplate';

const ATTRIBUTE_FILL_MAP = ['path'];

export const generateComponent = (data: XmlData, config: Config) => {
  const imports: string[] = [];
  const saveDir = path.resolve(config.save_dir);
  const jsExtension = '.js';
  let cases: string[] = [];

  mkdirp.sync(saveDir);
  glob.sync(path.join(saveDir, '*')).forEach((file) => fs.unlinkSync(file));

  copyTemplate(`helper${jsExtension}`, path.join(saveDir, `helper${jsExtension}`));
  copyTemplate(`svg2css${jsExtension}`, path.join(saveDir, `svg2css${jsExtension}`));

  data.svg.symbol.forEach((item) => {
    let singleFile: string;
    let iconId = item.$.id;

    if (config.trim_icon_prefix) {
      iconId = iconId.replace(new RegExp(`^${config.trim_icon_prefix}(.+?)$`), (_, value) => value.replace(/^[-_.=+#@!~*]+(.+?)$/, '$1'))
    }

    const componentName = upperFirst(camelCase(iconId));

    cases.push(componentName);

    imports.push(componentName);

    singleFile = getTemplate('SingleIcon' + jsExtension);
    singleFile = replaceSize(singleFile, config.default_icon_size);
    singleFile = replaceComponentName(singleFile, componentName);
    singleFile = replaceSingleIconContent(singleFile, generateCase(item, 4));
    singleFile = replaceSizeUnit(singleFile, config.unit);

    fs.writeFileSync(path.join(saveDir, componentName + '.vue'), singleFile);

    console.log(`${colors.green('√')} Generated icon "${colors.yellow(iconId)}"`);
  });

  let iconFile = getTemplate('Icon' + jsExtension);

  iconFile = replaceSize(iconFile, config.default_icon_size);
  iconFile = replaceCases(iconFile, cases.join(",\n"));
  iconFile = replaceImports(iconFile, imports);
  iconFile = replaceExports(iconFile, imports);

  fs.writeFileSync(path.join(saveDir, 'Index.vue'), iconFile);

  console.log(`\n${colors.green('√')} All icons have putted into dir: ${colors.green(config.save_dir)}\n`);
};

const generateCase = (data: XmlData['svg']['symbol'][number], baseIdent: number) => {
  let template = `\n${whitespace(baseIdent)}<svg viewBox="${data.$.viewBox}" width="\${this.size}" height="\${this.size}" style="\${this.style}">\n`;

  for (const domName of Object.keys(data)) {
    if (domName === '$') {
      continue;
    }

    if (!domName) {
      console.error(colors.red(`Unable to transform dom "${domName}"`));
      process.exit(1);
    }

    const counter = {
      colorIndex: 0,
      baseIdent,
    };

    if (data[domName].$) {
      template += `${whitespace(baseIdent + 2)}<${domName}${addAttribute(domName, data[domName], counter)}\n${whitespace(baseIdent + 2)}/>\n`;
    } else if (Array.isArray(data[domName])) {
      data[domName].forEach((sub) => {
        template += `${whitespace(baseIdent + 2)}<${domName}${addAttribute(domName, sub, counter)}\n${whitespace(baseIdent + 2)}/>\n`;
      });
    }
  }

  template += `${whitespace(baseIdent)}</svg>\n`;

  return template;
};

const addAttribute = (domName: string, sub: XmlData['svg']['symbol'][number]['path'][number], counter: { colorIndex: number, baseIdent: number }) => {
  let template = '';

  if (sub && sub.$) {
    if (ATTRIBUTE_FILL_MAP.includes(domName)) {
      // Set default color same as in iconfont.cn
      // And create placeholder to inject color by user's behavior
      sub.$.fill = sub.$.fill || '#333333';
    }

    for (const attributeName of Object.keys(sub.$)) {
      if (attributeName === 'fill') {
        template += `\n${whitespace(counter.baseIdent + 4)}${camelCase(attributeName)}="\${getIconColor(this.color, ${counter.colorIndex}, '${sub.$[attributeName]}')}"`;
        counter.colorIndex += 1;
      } else {
        template += `\n${whitespace(counter.baseIdent + 4)}${camelCase(attributeName)}="${sub.$[attributeName]}"`;
      }
    }
  }

  return template;
};
